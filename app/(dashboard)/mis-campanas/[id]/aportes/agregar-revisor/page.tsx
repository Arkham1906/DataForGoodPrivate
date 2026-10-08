"use client";

// Pantalla /mis-campanas/[id]/aportes/agregar-revisor: invitar revisores a la campaña.
// Componente cliente. Busca con GET /api/usuarios?campanaId=&q=; lista e invita con GET/POST /api/campanas/[id]/revisores.
// La persona invitada acepta desde sus notificaciones.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { BASE_PATH } from "@/lib/base-path";

type UserCandidate = {
  id: number;
  nombre: string;
  apellidos: string;
  // El servidor nunca manda el correo completo (an***@gmail.com).
  emailOculto: string;
  role?: string[] | string;
};

type CampaignInfo = { id: string; name: string; creatorId: string };

// Igual que en GET /api/usuarios: con menos no se busca.
const MINIMO_BUSQUEDA = 3;

export default function AgregarRevisorPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [users, setUsers] = useState<UserCandidate[]>([]);
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
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

  // La búsqueda la hace el servidor (GET /api/usuarios), con una pausa de
  // 300 ms tras la última tecla para no pedir una vez por letra. Excluye al
  // creador de la campaña.
  useEffect(() => {
    const texto = query.trim();
    const suficiente = texto.includes("@") || texto.length >= MINIMO_BUSQUEDA;
    const controlador = new AbortController();

    const temporizador = setTimeout(async () => {
      if (!params.id || !suficiente) {
        setUsers([]);
        return;
      }
      setBuscando(true);
      try {
        const response = await fetch(
          `${BASE_PATH}/api/usuarios?campanaId=${encodeURIComponent(params.id)}&q=${encodeURIComponent(texto)}`,
          { signal: controlador.signal }
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(body.error ?? "No se pudo buscar");
          setUsers([]);
          return;
        }
        setUsers(Array.isArray(body.data) ? body.data : []);
      } catch {
        // Búsqueda cancelada por otra más reciente.
      } finally {
        if (!controlador.signal.aborted) setBuscando(false);
      }
    }, 300);

    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [query, params.id]);

  if (!campaign) {
    return <p className="text-sm text-system-600">Cargando campaña…</p>;
  }

  const textoBuscado = query.trim();
  const busquedaSuficiente = textoBuscado.includes("@") || textoBuscado.length >= MINIMO_BUSQUEDA;

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

      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">Agregar revisor</h1>
          <p className="mt-1 text-[13px] text-system-600">{campaign.name}</p>
        </div>
        <Input
          placeholder="Nombre o correo completo"
          value={query}
          onChange={(e) => {
            setError(null);
            setQuery(e.target.value);
          }}
          className="w-56"
        />
      </div>

      {invitedName && (
        <div className="mb-5 rounded-lg border-l-4 border-brand-600 bg-system-100 p-3.5 text-[12.5px] text-system-600">
          Invitaste a {invitedName} como revisor de aportes. Queda pendiente hasta que la acepte.
        </div>
      )}

      {error && <p className="mb-4 rounded border border-error-700 bg-error-50 p-3 text-[12.5px] text-error-700">{error}</p>}

      {!busquedaSuficiente ? (
        <p className="mb-4 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">
          Escribe al menos {MINIMO_BUSQUEDA} letras del nombre, o el correo completo de la persona que quieres invitar.
        </p>
      ) : !buscando && users.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed border-system-300 bg-white p-6 text-center text-[12.5px] text-system-600">
          No encontramos usuarios verificados con “{textoBuscado}”.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-system-200">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-system-100 text-[11px] uppercase tracking-wide text-system-400">
            <tr>
              <th className="px-3 py-2.5">Usuario</th>
              <th className="px-3 py-2.5">Rol actual</th>
              <th className="px-3 py-2.5 text-right"></th>
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
                    <p className="font-mono text-[11.5px] text-system-400">{candidate.emailOculto}</p>
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

      <p className="mt-4 text-[12.5px] text-system-600">
        La persona invitada recibe una notificación; el rol de Revisor de aportes se
        aplica solo dentro de esta campaña.
      </p>
    </div>
  );
}
