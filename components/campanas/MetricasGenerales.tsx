// "Métricas generales" del panel de una campaña (2026-10-27): tarjetas según los atributos de la
// campaña (tipos de dato, ubicación, checklists; la temática se quitó el 2026-10-27 a pedido del usuario) y cómo llegan y se revisan sus aportes.
// Solo dibuja: los datos los calcula lib/campanas/metricas-generales.ts. Lo usan el panel del
// creador (/mis-campanas/[id]/panel, vía GET /api/campanas/[id]/metricas) y el de supervisión
// (components/supervision/PanelDeCampanaSupervisor). Sin estado ni efectos.

import type { ReactNode } from "react";
import ProgressBar from "@/components/ui/ProgressBar";
import { formatearTamano } from "@/lib/aportes/archivo";
import type { MetricasGenerales as Datos } from "@/lib/campanas/metricas-generales-tipos";

const nf = new Intl.NumberFormat("es-MX");
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);
const plural = (n: number, uno: string, varios: string) => `${nf.format(n)} ${n === 1 ? uno : varios}`;

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-system-200 bg-white p-4">
      <h3 className="mb-3 text-[13px] font-bold text-system-900">{titulo}</h3>
      <div className="flex flex-col gap-2 text-[12.5px] text-system-600">{children}</div>
    </section>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{etiqueta}</span>
      <span className="text-right font-mono font-medium text-system-900">{valor}</span>
    </div>
  );
}

function Barra({ etiqueta, valor, porcentaje, detalle }: { etiqueta: string; valor: number; porcentaje: number; detalle?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate" title={etiqueta}>
          {etiqueta}
        </span>
        <span className="shrink-0 font-mono text-system-900">
          {nf.format(valor)}
          {detalle ? <span className="text-system-500"> · {detalle}</span> : null}
        </span>
      </div>
      <ProgressBar pct={porcentaje} />
    </div>
  );
}

const Vacio = ({ children }: { children: ReactNode }) => <p className="text-system-500">{children}</p>;

export default function MetricasGenerales({ datos }: { datos: Datos }) {
  const { tipos, ubicacion, origen, revision, participacion, checklists } = datos;
  const totalRecibidos = tipos.reduce((s, t) => s + t.recibidos, 0);

  return (
    <div className="mt-8">
      <h2 className="mb-1 text-[15px] font-extrabold text-system-900">Métricas generales</h2>
      <p className="mb-4 text-[12.5px] text-system-600">Según los tipos de dato, la ubicación y los checklists de la campaña.</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Tarjeta titulo="Tipos de dato">
          {tipos.length === 0 ? (
            <Vacio>La campaña no pide tipos de dato.</Vacio>
          ) : (
            tipos.map((t) => (
              <Barra
                key={t.tipo}
                etiqueta={t.etiqueta}
                valor={t.recibidos}
                porcentaje={pct(t.recibidos, totalRecibidos)}
                detalle={[
                  t.tasaDeAprobacion !== null ? `${t.tasaDeAprobacion}% aprobados` : null,
                  t.pesoPromedioBytes ? `${formatearTamano(t.pesoPromedioBytes)} prom.` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined}
              />
            ))
          )}
          {totalRecibidos === 0 && tipos.length > 0 ? <Vacio>Todavía no llegan aportes.</Vacio> : null}
        </Tarjeta>

        <Tarjeta titulo={`Ubicación${ubicacion.zona ? `: ${ubicacion.zona}` : ""}`}>
          {ubicacion.enLaZona !== null ? (
            <Fila
              etiqueta="Participantes con cuenta que viven en la zona"
              valor={
                ubicacion.participantesConCuenta > 0
                  ? `${pct(ubicacion.enLaZona, ubicacion.participantesConCuenta)}% (${nf.format(ubicacion.enLaZona)} de ${nf.format(ubicacion.participantesConCuenta)})`
                  : "—"
              }
            />
          ) : null}
          {ubicacion.porEstado.length > 0 ? (
            ubicacion.porEstado.map((e) => (
              <Barra
                key={e.estado}
                etiqueta={e.estado}
                valor={e.participantes}
                porcentaje={pct(e.participantes, ubicacion.participantesConCuenta)}
              />
            ))
          ) : (
            <Vacio>Todavía no hay participantes con cuenta.</Vacio>
          )}
          {ubicacion.sinUbicacion > 0 ? <Fila etiqueta="Sin estado en su perfil" valor={nf.format(ubicacion.sinUbicacion)} /> : null}
          {ubicacion.sinCuenta > 0 ? <Fila etiqueta="Dispositivos sin cuenta (ubicación desconocida)" valor={nf.format(ubicacion.sinCuenta)} /> : null}
        </Tarjeta>

        <Tarjeta titulo="Revisión">
          <Fila etiqueta="Tasa de aprobación" valor={revision.tasaDeAprobacion !== null ? `${revision.tasaDeAprobacion}%` : "—"} />
          <Fila
            etiqueta="Tiempo promedio para decidir"
            valor={
              revision.horasPromedio === null
                ? "—"
                : revision.horasPromedio < 48
                  ? `${revision.horasPromedio} h`
                  : `${Math.round((revision.horasPromedio / 24) * 10) / 10} días`
            }
          />
          <Fila etiqueta="Pendientes de revisar" valor={nf.format(revision.pendientes)} />
          {revision.motivos.length > 0 ? (
            <div>
              <p className="mb-1 mt-1 font-medium text-system-900">Motivos de rechazo más frecuentes</p>
              <ul className="flex flex-col gap-1">
                {revision.motivos.map((m) => (
                  <li key={m.motivo} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate" title={m.motivo}>
                      {m.motivo}
                    </span>
                    <span className="shrink-0 font-mono text-system-900">{nf.format(m.aportes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Tarjeta>

        <Tarjeta titulo="Origen de los aportes">
          {origen.total === 0 ? (
            <Vacio>Todavía no llegan aportes.</Vacio>
          ) : (
            <>
              <Barra etiqueta="Con cuenta" valor={origen.conCuenta} porcentaje={pct(origen.conCuenta, origen.total)} />
              <Barra etiqueta="Sin cuenta (enlace público)" valor={origen.sinCuenta} porcentaje={pct(origen.sinCuenta, origen.total)} />
              <Fila etiqueta="Llegaron por el enlace público o el QR" valor={`${pct(origen.porEnlace, origen.total)}% (${nf.format(origen.porEnlace)})`} />
            </>
          )}
        </Tarjeta>

        <Tarjeta titulo="Participación">
          <Fila etiqueta="Participantes" valor={nf.format(participacion.participantes)} />
          <Fila
            etiqueta="Aportes promedio por participante"
            valor={participacion.promedioPorParticipante !== null ? participacion.promedioPorParticipante : "—"}
          />
          <Fila
            etiqueta={`Llegaron a la cuota (${plural(participacion.cuota, "aporte", "aportes")})`}
            valor={
              participacion.participantes > 0
                ? `${nf.format(participacion.llegaronALaCuota)} de ${nf.format(participacion.participantes)}`
                : "—"
            }
          />
        </Tarjeta>

        {checklists.map((c, i) => (
          <Tarjeta key={`${c.titulo}-${i}`} titulo={`Checklist: ${c.titulo || "Características"}`}>
            {datos.aprobadosParaChecklists === 0 ? (
              <Vacio>Las respuestas aparecen con los aportes aprobados.</Vacio>
            ) : (
              <>
                {c.opciones.map((o) => (
                  <Barra key={o.opcion} etiqueta={o.opcion} valor={o.aportes} porcentaje={o.porcentaje} detalle={`${o.porcentaje}%`} />
                ))}
                <p className="text-[11.5px] text-system-500">
                  Sobre {plural(datos.aprobadosParaChecklists, "aporte aprobado", "aportes aprobados")}; un aporte puede marcar varias.
                </p>
              </>
            )}
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
