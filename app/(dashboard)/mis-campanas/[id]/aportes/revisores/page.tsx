"use client";

// Pantalla /mis-campanas/[id]/aportes/revisores: los revisores de aportes de la campaña (2026-10-22,
// a pedido del usuario). Solo el creador (la API responde 403 a otros). Componente cliente.
// Datos: GET /api/campanas/[id] y GET /api/campanas/[id]/revisores (nombre, estado de la invitación,
// fechas y aportes que decidió cada uno). Sin límite de revisores: "Agregar revisor" siempre está.
// "Quitar" (revisor aceptado) y "Cancelar invitación" (pendiente), con ventana de confirmación:
// DELETE /api/campanas/[id]/revisores?usuarioId= (lib/campanas/revisores.ts).

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Tag from "@/components/ui/Tag";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import { BASE_PATH } from "@/lib/base-path";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

type Revisor = {
  usuarioId: string;
  estado: "invitado" | "aceptado" | "rechazado";
  nombre: string;
  invitadoEn: string;
  aceptadoEn: string | null;
  revisados: number;
};

const ESTADO: Record<Revisor["estado"], { texto: string; tono: "ok" | "warn" | "default" }> = {
  aceptado: { texto: "Revisor", tono: "ok" },
  invitado: { texto: "Invitación pendiente", tono: "warn" },
  rechazado: { texto: "Rechazó la invitación", tono: "default" },
};

const fecha = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONA_DE_CAMPANAS });

export default function RevisoresDeCampanaPage() {
  const params = useParams<{ id: string }>();
  const [nombreDeCampana, setNombreDeCampana] = useState<string | null>(null);
  const [revisores, setRevisores] = useState<Revisor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [porQuitar, setPorQuitar] = useState<Revisor | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [errorAlQuitar, setErrorAlQuitar] = useState<string | null>(null);

  async function quitar() {
    if (!porQuitar) return;
    setQuitando(true);
    setErrorAlQuitar(null);
    try {
      const response = await fetch(
        `${BASE_PATH}/api/campanas/${params.id}/revisores?usuarioId=${encodeURIComponent(porQuitar.usuarioId)}`,
        { method: "DELETE" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "No se pudo quitar al revisor");
      const quitado = porQuitar.usuarioId;
      setRevisores((prev) => (prev ? prev.filter((r) => r.usuarioId !== quitado) : prev));
      setPorQuitar(null);
    } catch (cause) {
      setErrorAlQuitar(cause instanceof Error ? cause.message : "No se pudo quitar al revisor");
    } finally {
      setQuitando(false);
    }
  }

  // Vuelve a leer cuando algo cambia en la base (p. ej. alguien acepta la invitación).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function load() {
      try {
        const [campanaRes, revisoresRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas/${params.id}`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/campanas/${params.id}/revisores`, { cache: "no-store" }),
        ]);
        const campana = await campanaRes.json().catch(() => ({}));
        if (!campanaRes.ok) throw new Error(campana.error ?? "No se pudo cargar la campaña");
        const lista = await revisoresRes.json().catch(() => ({}));
        if (!revisoresRes.ok) throw new Error(lista.error ?? "No se pudieron cargar los revisores");
        setNombreDeCampana(String(campana.data?.name ?? ""));
        setRevisores(Array.isArray(lista.data) ? (lista.data as Revisor[]) : []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar la información");
      }
    }
    void load();
  }, [params.id, recarga]);

  if (error) return <p className="text-sm text-error-700">{error}</p>;
  if (!revisores) return <PantallaEsqueleto tipo="tabla" etiqueta="Cargando revisores…" />;

  const aceptados = revisores.filter((r) => r.estado === "aceptado").length;
  const pendientes = revisores.filter((r) => r.estado === "invitado").length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/mis-campanas/${params.id}/aportes`} className="mb-4 inline-block text-[13px] text-system-600 hover:text-system-900">
        ← Volver a los aportes
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-system-900">Revisores de aportes</h1>
          <p className="break-words text-[13px] text-system-600">{nombreDeCampana}</p>
        </div>
        <ButtonLink href={`/mis-campanas/${params.id}/aportes/agregar-revisor`} variant="primary" size="sm">
          Agregar revisor
        </ButtonLink>
      </div>

      <p className="mb-4 text-[12.5px] text-system-600">
        Puedes tener los revisores que necesites. Cada uno acepta o rechaza aportes igual que tú, y la
        primera decisión sobre un aporte es la que vale.
        <span className="mt-1 block font-mono">
          {aceptados} {aceptados === 1 ? "revisor" : "revisores"} · {pendientes} {pendientes === 1 ? "invitación pendiente" : "invitaciones pendientes"}
        </span>
      </p>

      {revisores.length === 0 ? (
        <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">
          Aún no invitas a nadie a revisar los aportes de esta campaña.
        </p>
      ) : (
        <ul className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white">
          {revisores.map((r) => (
            <li key={r.usuarioId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-system-900">{r.nombre}</p>
                <p className="mt-0.5 font-mono text-[11.5px] text-system-500">
                  {r.estado === "aceptado" && r.aceptadoEn
                    ? `Revisor desde el ${fecha.format(new Date(r.aceptadoEn))}`
                    : `Invitado el ${fecha.format(new Date(r.invitadoEn))}`}
                  {r.estado === "aceptado" && ` · ${r.revisados} ${r.revisados === 1 ? "aporte revisado" : "aportes revisados"}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={ESTADO[r.estado]?.tono ?? "default"}>{ESTADO[r.estado]?.texto ?? r.estado}</Tag>
                {(r.estado === "aceptado" || r.estado === "invitado") && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setErrorAlQuitar(null);
                      setPorQuitar(r);
                    }}
                  >
                    {r.estado === "aceptado" ? "Quitar" : "Cancelar invitación"}
                    <span className="sr-only"> de {r.nombre}</span>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <VentanaDeConfirmacion
        abierto={porQuitar !== null}
        titulo={porQuitar?.estado === "aceptado" ? `¿Quitar a ${porQuitar.nombre} como revisor?` : "¿Cancelar la invitación?"}
        textoConfirmar={porQuitar?.estado === "aceptado" ? "Quitar revisor" : "Cancelar invitación"}
        textoOcupado={porQuitar?.estado === "aceptado" ? "Quitando…" : "Cancelando…"}
        ocupado={quitando}
        peligro
        onCancelar={() => setPorQuitar(null)}
        onConfirmar={() => void quitar()}
      >
        {porQuitar?.estado === "aceptado" ? (
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-system-600">
            <li>Ya no podrá ver ni decidir los aportes de esta campaña.</li>
            <li>Los aportes que ya revisó conservan su decisión.</li>
            <li>Le llegará un aviso. Puedes volver a invitarlo cuando quieras.</li>
          </ul>
        ) : (
          <p className="text-[13px] text-system-600">
            {porQuitar?.nombre} ya no podrá aceptar la invitación y se borrará de sus notificaciones. Puedes volver a invitarlo después.
          </p>
        )}
        {errorAlQuitar && (
          <p role="alert" className="mt-3 text-[12.5px] text-error-700">{errorAlQuitar}</p>
        )}
      </VentanaDeConfirmacion>
    </div>
  );
}
