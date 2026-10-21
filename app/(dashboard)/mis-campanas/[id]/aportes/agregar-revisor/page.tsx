"use client";

// Pantalla /mis-campanas/[id]/aportes/agregar-revisor: invitar revisores a la campaña.
// Componente cliente. Desde el 2026-10-19 muestra a todos los usuarios verificados (GET
// /api/usuarios?campanaId=&q=&pagina=, de 30 en 30 con "Mostrar más") y filtra mientras se
// escribe por nombre y apellidos; por correo, solo con el correo completo (el correo va oculto).
// Lista e invita con GET/POST /api/campanas/[id]/revisores. La persona invitada acepta desde sus
// notificaciones.

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { BASE_PATH } from "@/lib/base-path";
import PantallaEsqueleto from "@/components/ui/Esqueletos";

type UserCandidate = {
  id: number;
  nombre: string;
  apellidos: string;
  // El servidor nunca manda el correo completo (an***@gmail.com).
  emailOculto: string;
  role?: string[] | string;
};

type CampaignInfo = { id: string; name: string; creatorId: string };

type PaginaDeCandidatos = { data?: UserCandidate[]; total?: number; hayMas?: boolean; error?: string };

/** ¿Escribió un correo a medias? Con "@" el servidor solo busca el correo completo. */
function esCorreoIncompleto(texto: string): boolean {
  return texto.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto);
}

export default function AgregarRevisorPage() {
  const params = useParams<{ id: string }>();
  const idDelBuscador = useId();
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [users, setUsers] = useState<UserCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [invitedId, setInvitedId] = useState<number | null>(null);
  const [invitedName, setInvitedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Estado de revisor DENTRO de esta campaña (campana_revisores), no el rol
  // global del usuario: alguien puede ser revisor de otra campaña y seguir
  // disponible para esta.
  const [estadoPorUsuario, setEstadoPorUsuario] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    async function loadData() {
      const [campaignResponse, revisoresResponse] = await Promise.all([
        fetch(`${BASE_PATH}/api/campanas?id=${params.id}`),
        fetch(`${BASE_PATH}/api/campanas/${params.id}/revisores`),
      ]);
      if (campaignResponse.ok) {
        const campaignBody = await campaignResponse.json();
        setCampaign(campaignBody.data ?? null);
      }
      if (revisoresResponse.ok) {
        const revisoresBody = await revisoresResponse.json();
        const filas = Array.isArray(revisoresBody.data) ? revisoresBody.data : [];
        setEstadoPorUsuario(new Map(filas.map((f: { usuarioId: string; estado: string }) => [Number(f.usuarioId), f.estado])));
      }
    }

    if (params.id) loadData();
  }, [params.id]);

  function pedirCandidatos(texto: string, numero: number, signal?: AbortSignal): Promise<PaginaDeCandidatos> {
    const consulta = new URLSearchParams({ campanaId: params.id, q: texto, pagina: String(numero) });
    return fetch(`${BASE_PATH}/api/usuarios?${consulta}`, { signal }).then(async (response) => {
      const body: PaginaDeCandidatos = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la lista de usuarios");
      return body;
    });
  }

  // La lista la filtra el servidor (GET /api/usuarios) mientras se escribe, con una pausa de
  // 250 ms tras la última tecla para no pedir una vez por letra; sin texto, salen todos. Excluye
  // al creador de la campaña. Cada búsqueda vuelve a la primera página.
  useEffect(() => {
    const texto = query.trim();
    const controlador = new AbortController();

    const temporizador = setTimeout(
      async () => {
        if (!params.id) return;
        if (esCorreoIncompleto(texto)) {
          setUsers([]);
          setTotal(0);
          setHayMas(false);
          setBuscando(false);
          return;
        }
        setBuscando(true);
        try {
          const body = await pedirCandidatos(texto, 1, controlador.signal);
          setUsers(Array.isArray(body.data) ? body.data : []);
          setTotal(body.total ?? 0);
          setHayMas(Boolean(body.hayMas));
          setPagina(1);
        } catch (e) {
          if (controlador.signal.aborted) return; // Cancelada por otra más reciente.
          setError(e instanceof Error ? e.message : "No se pudo cargar la lista de usuarios");
          setUsers([]);
          setTotal(0);
          setHayMas(false);
        } finally {
          if (!controlador.signal.aborted) setBuscando(false);
        }
      },
      // La primera carga (sin texto) va de inmediato.
      texto ? 250 : 0,
    );

    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
    // pedirCandidatos solo depende de params.id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, params.id]);

  async function mostrarMas() {
    setCargandoMas(true);
    try {
      const body = await pedirCandidatos(query.trim(), pagina + 1);
      const vistos = new Set(users.map((u) => u.id));
      setUsers([...users, ...(body.data ?? []).filter((u) => !vistos.has(u.id))]);
      setTotal(body.total ?? total);
      setHayMas(Boolean(body.hayMas));
      setPagina(pagina + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la lista de usuarios");
    } finally {
      setCargandoMas(false);
    }
  }

  if (!campaign) {
    return <PantallaEsqueleto tipo="formulario" etiqueta="Cargando campaña…" />;
  }

  const textoBuscado = query.trim();
  const correoIncompleto = esCorreoIncompleto(textoBuscado);

  async function invite(candidate: UserCandidate) {
    setError(null);
    const response = await fetch(`${BASE_PATH}/api/campanas/${params.id}/revisores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: candidate.id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "No se pudo enviar la invitación");
      return;
    }
    setInvitedId(candidate.id);
    setInvitedName(`${candidate.nombre} ${candidate.apellidos}`.trim());
    setEstadoPorUsuario((prev) => new Map(prev).set(candidate.id, "invitado"));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/mis-campanas/${params.id}/aportes`}
        className="mb-4 inline-block text-[13px] text-system-600 hover:text-system-900"
      >
        ← Volver a aportes
      </Link>

      <div className="mb-4">
        <h1 className="text-xl font-extrabold text-system-900">Agregar revisor</h1>
        <p className="mt-1 text-[13px] text-system-600">{campaign.name}</p>
      </div>

      <div className="mb-4">
        <label htmlFor={idDelBuscador} className="mb-1.5 block text-[13px] font-medium text-system-900">
          Buscar usuario
        </label>
        <Input
          id={idDelBuscador}
          type="search"
          placeholder="Nombre, apellidos o correo completo"
          value={query}
          onChange={(e) => {
            setError(null);
            setQuery(e.target.value);
          }}
          autoComplete="off"
          className="w-full"
        />
        <p aria-live="polite" className="mt-1.5 text-[12px] text-system-500">
          {buscando
            ? "Buscando…"
            : correoIncompleto
              ? "Para buscar por correo, escríbelo completo."
              : textoBuscado
                ? `${total} ${total === 1 ? "coincidencia" : "coincidencias"}`
                : `${total} ${total === 1 ? "usuario disponible" : "usuarios disponibles"}`}
        </p>
      </div>

      {invitedName && (
        <div className="mb-5 rounded-lg border-l-4 border-brand-600 bg-system-100 p-3.5 text-[12.5px] text-system-600">
          Invitaste a {invitedName} como revisor de aportes. Queda pendiente hasta que la acepte.
        </div>
      )}

      {error && <p className="mb-4 rounded border border-error-700 bg-error-50 p-3 text-[12.5px] text-error-700">{error}</p>}

      {!buscando && !correoIncompleto && users.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed border-system-300 bg-white p-6 text-center text-[12.5px] text-system-600">
          {textoBuscado
            ? `No encontramos usuarios verificados con “${textoBuscado}”.`
            : "Todavía no hay otros usuarios verificados para invitar."}
        </p>
      ) : null}

      <div className={`overflow-hidden rounded-lg border border-system-200 ${users.length === 0 ? "hidden" : ""}`}>
        <table className="w-full text-left text-[13px]">
          <thead className="bg-system-100 text-[11px] uppercase tracking-wide text-system-500">
            <tr>
              <th className="px-3 py-2.5">Usuario</th>
              <th className="px-3 py-2.5">Rol actual</th>
              <th className="px-3 py-2.5 text-right"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {users.map((candidate) => {
              const roles = Array.isArray(candidate.role) ? candidate.role : candidate.role ? [candidate.role] : ["usuario"];
              const isSupervisor = roles.includes("supervisor");
              // Estado DENTRO de esta campaña (campana_revisores), no el rol
              // global: ser revisor de otra campaña no debe bloquear esta.
              // Un supervisor sí puede invitarse: los roles ya no son
              // mutuamente excluyentes.
              const estadoAqui = estadoPorUsuario.get(candidate.id);
              const isInvited = candidate.id === invitedId || estadoAqui === "invitado";
              const yaAceptado = estadoAqui === "aceptado";
              const currentRole = yaAceptado
                ? "Revisor de esta campaña"
                : isSupervisor
                  ? "Supervisor"
                  : "Usuario común";

              return (
                <tr key={candidate.id} className="border-t border-system-200">
                  <td className="px-3 py-3">
                    <p className="font-medium text-system-900">{`${candidate.nombre} ${candidate.apellidos}`.trim()}</p>
                    <p className="font-mono text-[11.5px] text-system-500">{candidate.emailOculto}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Tag tone={isInvited ? "warn" : yaAceptado ? "ok" : "default"}>
                      {isInvited ? "Invitación pendiente" : currentRole}
                    </Tag>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      size="sm"
                      disabled={isInvited || yaAceptado}
                      onClick={() => void invite(candidate)}
                    >
                      {isInvited ? "Invitado" : yaAceptado ? "Ya es revisor" : "Invitar para revisar"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hayMas && !buscando ? (
        <div className="mt-3 text-center">
          <Button variant="secondary" size="sm" disabled={cargandoMas} onClick={() => void mostrarMas()}>
            {cargandoMas ? "Cargando…" : `Mostrar más (${users.length} de ${total})`}
          </Button>
        </div>
      ) : null}

      <p className="mt-4 text-[12.5px] text-system-600">
        La persona invitada recibe una notificación; el rol de Revisor de aportes se
        aplica solo dentro de esta campaña.
      </p>
    </div>
  );
}
