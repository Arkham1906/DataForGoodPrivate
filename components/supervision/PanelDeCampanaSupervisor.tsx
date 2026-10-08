// Panel de métricas de una campaña, compartido por /supervision/[id]/panel y /supervisar/[id]/panel.
// Recibe los datos ya calculados por lib/campanas/panel.ts.

import Link from "next/link";
import Tag from "@/components/ui/Tag";
import type { PanelDeCampana } from "@/lib/campanas/panel";
import RefrescoEnVivo from "./RefrescoEnVivo";

const ESTADO: Record<string, string> = {
  en_revision: "en revisión",
  aceptada: "aceptada",
  activa: "activa",
  pausada: "pausada",
  finalizada: "finalizada",
  rechazada: "rechazada",
  borrador: "borrador",
};

function formatearFecha(fecha: string | null, conAnio = true) {
  if (!fecha) return "sin fecha";
  const [year, month, day] = fecha.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(conAnio ? { year: "numeric" } : {}),
  });
}

/**
 * Panel de campaña de la vista de supervisor. Lo comparten el usuario
 * promovido (/supervision) y el SuperUsuario (/supervisar); cada página
 * verifica el acceso y pasa sus propias rutas de regreso.
 */
export default function PanelDeCampanaSupervisor({
  panel,
  volverHref,
  volverTexto,
}: {
  panel: PanelDeCampana;
  volverHref: string;
  volverTexto: string;
}) {
  const enVivo = panel.status === "activa";
  const maxDiario = Math.max(...panel.recoleccionDiaria.map((d) => d.valor), 1);
  const primerDia = panel.recoleccionDiaria[0];
  const ultimoDia = panel.recoleccionDiaria[panel.recoleccionDiaria.length - 1];

  const metricas: [string, string | number][] = [
    ["Aportes aprobados", panel.metricas.aprobados],
    ["Participantes", panel.metricas.participantes],
    ["Pendientes", panel.metricas.pendientes],
    ["Meta", `${panel.porcentajeMeta}%`],
  ];

  let mensajeRitmo: string;
  if (panel.status === "finalizada") {
    mensajeRitmo = `La campaña cerró el ${formatearFecha(panel.fechaFin)} con ${panel.metricas.recibidos} de ${panel.meta} aportes (${panel.porcentajeMeta}% de la meta).`;
  } else if (panel.status !== "activa" && panel.status !== "pausada") {
    mensajeRitmo = "La campaña todavía no recolecta aportes: la proyección aparece cuando esté activa.";
  } else if (panel.meta > 0 && panel.metricas.recibidos >= panel.meta) {
    mensajeRitmo = "La campaña ya alcanzó su meta de aportes.";
  } else if (!panel.ritmo.fechaEstimadaMeta) {
    mensajeRitmo = "Sin aportes en los últimos 14 días: no hay ritmo para estimar cuándo se alcanza la meta.";
  } else {
    const cuando = formatearFecha(panel.ritmo.fechaEstimadaMeta);
    const cierre = panel.ritmo.llegaAntesDelCierre === null
      ? ""
      : panel.ritmo.llegaAntesDelCierre
        ? ", antes de la fecha de cierre"
        : `, después de la fecha de cierre (${formatearFecha(panel.fechaFin)})`;
    mensajeRitmo = `Al ritmo actual de ${panel.ritmo.aportesPorDia} aportes por día, la meta se alcanza alrededor del ${cuando}${cierre}.`;
  }

  return (
    <div className="mx-auto max-w-5xl">
      {enVivo && <RefrescoEnVivo />}

      <Link href={volverHref} className="mb-5 inline-block text-[13px] text-system-600 hover:text-brand-600">← {volverTexto}</Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Panel de campaña</p>
          <h1 className="mt-2 text-2xl font-extrabold text-system-900">{panel.nombre}</h1>
          <p className="mt-1 font-mono text-[12px] text-system-600">
            {formatearFecha(panel.fechaInicio, false)} – {formatearFecha(panel.fechaFin)} · {ESTADO[panel.status] ?? panel.status}
          </p>
        </div>
        <Tag tone={enVivo ? "ok" : "default"}>{enVivo ? "En vivo · actualiza cada 3 s" : "Solo lectura"}</Tag>
      </div>

      <div className="supervision-metrics-grid mb-6 grid grid-cols-4 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricas.map(([etiqueta, valor]) => (
          <section key={etiqueta} className="min-w-0 rounded-lg border border-system-200 bg-white p-5 shadow-sm max-md:rounded-md max-md:p-2.5">
            <p className="break-words text-[12.5px] text-system-600 max-md:text-[10px] max-md:leading-tight">{etiqueta}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-system-900 max-md:mt-1 max-md:text-xl">{valor}</p>
          </section>
        ))}
      </div>

      <section className="mb-6 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
        <h2 className="text-[13px] font-bold text-system-900">
          Recolección diaria <span className="font-normal text-system-500">· últimos 14 días</span>
        </h2>
        <div className="mt-5 flex h-36 items-end gap-2 border-b border-system-200 px-1">
          {panel.recoleccionDiaria.map((dia) => (
            <div
              key={dia.fecha}
              className="flex-1 rounded-t bg-brand-600"
              style={{ height: `${(dia.valor / maxDiario) * 100}%`, minHeight: dia.valor > 0 ? 2 : 0 }}
              title={`${dia.etiqueta}: ${dia.valor} aporte${dia.valor === 1 ? "" : "s"}`}
              role="img"
                aria-label={`${dia.etiqueta}: ${dia.valor} aporte${dia.valor === 1 ? "" : "s"}`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-system-500">
          <span>{primerDia?.etiqueta}</span>
          <span>{ultimoDia?.etiqueta}</span>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
          <h2 className="text-[13px] font-bold text-system-900">Por tipo de dato <span className="font-normal text-system-500">· aprobados</span></h2>
          {panel.porTipo.length === 0 || panel.metricas.aprobados === 0 ? (
            <p className="mt-5 text-[12.5px] text-system-600">Todavía no hay aportes aprobados.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {panel.porTipo.map((tipo) => (
                <div key={tipo.tipo} className="flex items-center gap-3 text-[12.5px]">
                  <span className="w-20 text-system-600">{tipo.etiqueta}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-pill bg-system-100">
                    <div className="h-full rounded-pill bg-success-700" style={{ width: `${tipo.porcentaje}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-system-600">{tipo.valor}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
          <h2 className="text-[13px] font-bold text-system-900">Progreso hacia la meta</h2>
          <div className="mt-5 h-2.5 overflow-hidden rounded-pill bg-system-100">
            <div className="h-full rounded-pill bg-success-700" style={{ width: `${panel.porcentajeMeta}%` }} />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-system-500">
            <span>{panel.metricas.recibidos} de {panel.meta} aportes</span>
            {panel.diasRestantes !== null && panel.status !== "finalizada" && <span>{panel.diasRestantes} días restantes</span>}
          </div>
          <p className="mt-2 text-[11.5px] text-system-500">
            {panel.metricas.aprobados} aprobados · {panel.metricas.pendientes} pendientes · {panel.metricas.rechazados} rechazados
          </p>
          <p className="mt-5 rounded-lg bg-system-100 p-4 text-[12.5px] leading-5 text-system-600">{mensajeRitmo}</p>
        </section>
      </div>
    </div>
  );
}
