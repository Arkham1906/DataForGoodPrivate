// Pantalla /usuarios/sanciones: todas las sanciones de los usuarios (avisos, suspensiones y baneos de la
// cuenta, y baneos por campaña; vigentes y pasadas), la lista negra de correos (listarListaNegra) y los
// bloqueos globales de dispositivos anónimos.
// Server Component. Datos: listarSanciones() (lib/usuarios/directorio.ts) y listarBloqueosGlobales()
// (lib/aportes/sanciones-anonimas.ts). La lista agrupada por usuario está en lista.tsx (cliente).
// Acciones: boton-restaurar.tsx y boton-quitar-bloqueo.tsx.

import type { Metadata } from "next";
import Link from "next/link";

import Subtabs from "@/components/sistema/subtabs";
import { Aviso, Encabezado } from "@/components/sistema/ui";
import { PESTANAS_USUARIOS } from "@/lib/usuarios/dashboard";
import { formatearFecha, formatearFechaYHora, listarSanciones } from "@/lib/usuarios/directorio";
import ListaDeSanciones from "./lista";
import BotonQuitarBloqueo from "./boton-quitar-bloqueo";
import { DIAS_DE_BLOQUEO, INAPROPIADOS_PARA_BLOQUEO, VENTANA_DE_DIAS, listarBloqueosGlobales } from "@/lib/aportes/sanciones-anonimas";
import { listarListaNegra } from "@/lib/usuarios/lista-negra";
import { AVISOS_PARA_BANEO } from "@/lib/usuarios/escala-de-avisos";

export const metadata: Metadata = { title: "Sanciones" };
export const dynamic = "force-dynamic";

export default async function SancionesPage() {
  const [sanciones, bloqueos, listaNegra] = await Promise.all([listarSanciones(), listarBloqueosGlobales(), listarListaNegra()]);
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
        Escala de avisos: el 1.º es solo un mensaje, el 2.º suspende la cuenta 2 días, el 3.º 7 días y el
        {" "}{AVISOS_PARA_BANEO}.º la banea y pone su correo en la lista negra. Los avisos no caducan ni se
        restauran (los strikes de antes cuentan como avisos). Restaurar un baneo saca el correo de la lista
        negra. El baneo en una campaña lo quita quien la creó, desde la lista de aportes de su campaña.
      </Aviso>

      <h2 className="mb-1 mt-10 text-[17px] font-extrabold text-system-900">Lista negra de correos</h2>
      <p className="mb-4 text-[13px] text-system-600">
        Correos de cuentas baneadas: no pueden registrarse otra vez ni entrar con Google como cuenta nueva.
        Para sacar uno, restaura el baneo de la cuenta.
      </p>
      {listaNegra.length === 0 ? (
        <p className="py-4 text-[13px] text-system-600">No hay correos en la lista negra.</p>
      ) : (
        <ul className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
          {listaNegra.map((c) => (
            <li key={c.email} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3.5">
              <span className="min-w-0">
                <span className="block break-all font-mono text-[12.5px] text-system-900">{c.email}</span>
                <span className="block text-[12px] text-system-600">
                  {c.usuarioId && c.usuario ? (
                    <Link href={`/usuarios/${c.usuarioId}`} className="hover:text-brand-600">
                      {c.usuario}
                    </Link>
                  ) : (
                    "Cuenta eliminada"
                  )}
                  {c.motivo ? ` · ${c.motivo}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-system-500">desde {formatearFecha(c.desde)}</span>
            </li>
          ))}
        </ul>
      )}

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
