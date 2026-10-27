// Pantalla de un catálogo del perfil en el panel (2026-10-26): /sistema/especialidades y
// /sistema/organizaciones. Formulario de alta, búsqueda (?q=, la hace la página), lista con origen,
// personas (y campañas, si aplica) y "Más" para editar o borrar las que no son base.
// Server Component: recibe las filas ya leídas y las server actions para los componentes cliente.

import { Encabezado, formatearNumero } from "@/components/sistema/ui";
import type { ElementoDelPanel } from "@/lib/catalogos/catalogo-de-perfil";
import type { ResultadoDeAccion } from "@/lib/catalogos/acciones-de-catalogo";
import { ZONA_DE_CAMPANAS } from "@/lib/campaign-date";
import EditarOBorrarDelCatalogo from "./EditarOBorrarDelCatalogo";
import NuevoDelCatalogo from "./NuevoDelCatalogo";

const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: ZONA_DE_CAMPANAS });

const ORIGEN = { base: "Base", usuario: "De un usuario", panel: "Creada aquí" } as const;

export default function PantallaDeCatalogo({
  titulo,
  subtitulo,
  q,
  elementos,
  conCampanas,
  textos,
  maximo,
  acciones,
}: {
  titulo: string;
  subtitulo: string;
  q: string;
  elementos: ElementoDelPanel[];
  /** Mostrar cuántas campañas usan cada uno (organizaciones). */
  conCampanas: boolean;
  textos: { nuevo: string; placeholder: string; ayuda: string; buscar: string; sustantivo: string; sinElDato: string; ninguna: string };
  maximo: number;
  acciones: {
    crear: (nombre: string) => Promise<ResultadoDeAccion>;
    editar: (id: number, nombre: string) => Promise<ResultadoDeAccion>;
    borrar: (id: number) => Promise<ResultadoDeAccion>;
  };
}) {
  const deUsuarios = elementos.filter((e) => e.origen === "usuario").length;
  const delPanel = elementos.filter((e) => e.origen === "panel").length;

  return (
    <div>
      <Encabezado titulo={titulo} subtitulo={subtitulo} />

      <NuevoDelCatalogo titulo={textos.nuevo} placeholder={textos.placeholder} ayuda={textos.ayuda} maximo={maximo} crear={acciones.crear} />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={textos.buscar}
          aria-label={textos.buscar}
          className="w-full max-w-xs rounded border border-system-300 bg-white px-3 py-2 text-[13px] text-system-900 outline-none focus:border-brand-600"
        />
        <p className="font-mono text-[12px] text-system-500">
          {formatearNumero(elementos.length)} {q ? "encontradas" : "en total"} · {formatearNumero(deUsuarios)} de usuarios ·{" "}
          {formatearNumero(delPanel)} creadas aquí
        </p>
      </form>

      {elementos.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">{q ? `Ninguna coincide con «${q}».` : textos.ninguna}</p>
      ) : (
        <ul className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
          {elementos.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="break-words font-bold text-system-900">{e.nombre}</p>
                <p className="mt-0.5 text-[12px] text-system-500">
                  {e.origen === "base" ? ORIGEN.base : `${ORIGEN[e.origen]} · ${fecha.format(new Date(e.creadaEl))}`} ·{" "}
                  {formatearNumero(e.personas)} {e.personas === 1 ? "persona" : "personas"}
                  {conCampanas ? ` · ${formatearNumero(e.campanas)} ${e.campanas === 1 ? "campaña" : "campañas"}` : null}
                </p>
              </div>
              {e.origen !== "base" ? (
                <EditarOBorrarDelCatalogo
                  id={e.id}
                  nombre={e.nombre}
                  personas={e.personas}
                  campanas={conCampanas ? e.campanas : null}
                  sustantivo={textos.sustantivo}
                  sinElDato={textos.sinElDato}
                  maximo={maximo}
                  editar={acciones.editar}
                  borrar={acciones.borrar}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
