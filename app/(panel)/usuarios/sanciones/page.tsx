// Pantalla /usuarios/sanciones: todas las sanciones de los usuarios (de la cuenta y por campaña,
// vigentes y pasadas) y los bloqueos globales de dispositivos anónimos.
// Server Component. Datos: listarSanciones() (lib/usuarios/directorio.ts) y listarBloqueosGlobales()
// (lib/aportes/sanciones-anonimas.ts). La lista agrupada por usuario está en lista.tsx (cliente).
// Acciones: boton-restaurar.tsx y boton-quitar-bloqueo.tsx.

import type { Metadata } from "next";

import Subtabs from "@/components/sistema/subtabs";
import { Aviso, Encabezado } from "@/components/sistema/ui";
import { PESTANAS_USUARIOS } from "@/lib/usuarios/dashboard";
import { formatearFecha, formatearFechaYHora, listarSanciones } from "@/lib/usuarios/directorio";
import ListaDeSanciones from "./lista";
import BotonQuitarBloqueo from "./boton-quitar-bloqueo";
import { DIAS_DE_BLOQUEO, INAPROPIADOS_PARA_BLOQUEO, VENTANA_DE_DIAS, listarBloqueosGlobales } from "@/lib/aportes/sanciones-anonimas";

export const metadata: Metadata = { title: "Sanciones" };
export const dynamic = "force-dynamic";

export default async function SancionesPage() {
  const [sanciones, bloqueos] = await Promise.all([listarSanciones(), listarBloqueosGlobales()]);
  const vigentes = sanciones.filter((s) => s.vigente).length;

  return (
    <div>
      <Subtabs
        pestanas={PESTANAS_USUARIOS}
        etiquetaAria="Secciones de usuarios"
        volverAlMenuEnMovil
      />

      <Encabezado
        titulo="Sanciones"
        subtitulo={`${sanciones.length} ${sanciones.length === 1 ? "sanción" : "sanciones"} · ${vigentes} ${vigentes === 1 ? "vigente" : "vigentes"}`}
      />

      {sanciones.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">Ningún usuario tiene sanciones.</p>
      ) : (
        <ListaDeSanciones sanciones={sanciones.map(({ fecha, ...s }) => ({ ...s, fechaTexto: formatearFechaYHora(fecha) }))} />
      )}

      <Aviso tono="neutro" className="mt-5">
        Restaurar el acceso no borra el historial de strikes: el contador se
        conserva para la escala de penalización. El baneo en una campaña lo quita
        quien la creó, desde la lista de aportes de su campaña.
      </Aviso>

      <h2 className="mb-1 mt-10 text-[17px] font-extrabold text-system-900">Dispositivos anónimos bloqueados</h2>
      <p className="mb-4 text-[13px] text-system-600">
        Personas sin cuenta con {INAPROPIADOS_PARA_BLOQUEO} aportes marcados como inapropiados en{" "}
        {VENTANA_DE_DIAS} días. No pueden aportar sin cuenta desde ese dispositivo en ninguna
        campaña durante {DIAS_DE_BLOQUEO} días.
      </p>
      {bloqueos.length === 0 ? (
        <p className="py-4 text-[13px] text-system-600">No hay dispositivos bloqueados.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {bloqueos.map((b) => (
              <article key={b.id} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-[14px] font-bold text-system-900">Anónimo #{b.id}</p>
                  <p className="mt-1 break-words text-[11px] text-system-500">
                    Desde {formatearFecha(b.desde)}
                    {b.campana ? ` · ${b.campana}` : ""}
                  </p>
                </div>

                <dl className="mt-3 space-y-3 border-t border-system-200 pt-3">
                  <div>
                    <dt className="text-[11px] text-system-600">Motivo</dt>
                    <dd className="mt-1 break-words text-[13px] leading-relaxed text-system-900">{b.motivo}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[11px] text-system-600">Vence</dt>
                    <dd className="text-right font-mono text-[12px] text-system-900">
                      {b.hasta ? formatearFecha(b.hasta) : "Sin fecha"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 grid">
                  <BotonQuitarBloqueo bloqueoId={b.id} anchoCompleto />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm md:block">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
                <tr>
                  <th className="pb-3 font-medium">Dispositivo</th>
                  <th className="pb-3 font-medium">Motivo</th>
                  <th className="pb-3 font-medium">Vence</th>
                  <th className="pb-3 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {bloqueos.map((b) => (
                  <tr key={b.id} className="border-b border-system-200 last:border-0">
                    <td className="py-4">
                      <p className="font-bold text-system-900">Anónimo #{b.id}</p>
                      <p className="font-mono text-[11px] text-system-500">
                        desde {formatearFecha(b.desde)}
                        {b.campana ? ` · ${b.campana}` : ""}
                      </p>
                    </td>
                    <td className="text-system-600">{b.motivo}</td>
                    <td className="font-mono text-[12px] text-system-600">
                      {b.hasta ? formatearFecha(b.hasta) : "Sin fecha"}
                    </td>
                    <td className="text-right">
                      <BotonQuitarBloqueo bloqueoId={b.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
