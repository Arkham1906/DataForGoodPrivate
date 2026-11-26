// Renglones del panel (2026-11-25, a pedido del usuario): el diseño de la vista de lista de /mis-aportes
// (components/aportes/ListadoDeAportes) en lugar de las tablas del SuperUsuario. Cada fila es una tarjeta con borde
// y sombra (borde azul al pasar el cursor si toda la tarjeta es un enlace o se despliega): arriba el título en negrita
// y, tras un punto, un rótulo en mayúsculas; debajo una línea gris con los datos separados por puntos; a la derecha
// las etiquetas y las acciones. Sin encabezados de columna: cada dato dice qué es ("3 campañas", "Vence 12 dic").
// Donde la pantalla ya tiene tarjetas para el teléfono (md:hidden), estos renglones van solo en escritorio
// (`soloEscritorio`): el diseño a 360 px es de Gerard. Sin imports de servidor: lo usan páginas y componentes cliente.

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

const CLASE_TARJETA = "rounded-lg border border-system-200 bg-white shadow-sm transition-colors";
const CLASE_ENLACE =
  "hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";
const CLASE_FILA = "flex items-center gap-3 p-2.5";

/** La lista de renglones (`<ul>`). `soloEscritorio`: oculta en el teléfono, donde la pantalla tiene sus tarjetas. */
export function ListaDeRenglones({
  etiqueta,
  soloEscritorio = false,
  className = "",
  children,
}: {
  /** Nombre de la lista para el lector de pantalla ("Usuarios", "Campañas"). */
  etiqueta: string;
  soloEscritorio?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ul aria-label={etiqueta} className={`${soloEscritorio ? "hidden md:flex" : "flex"} flex-col gap-2 sm:gap-3 ${className}`}>
      {children}
    </ul>
  );
}

type Textos = {
  /** Lo principal, en negrita (nombre de la persona, de la campaña...). */
  titulo: ReactNode;
  /** Tras un punto, en mayúsculas pequeñas: el tipo de lo que es (como el tipo de dato en Mis aportes). */
  rotulo?: ReactNode;
  /** Los datos de la línea gris; los vacíos (null, false, "") no salen. */
  detalles?: ReactNode[];
  /** Algo más bajo los datos (una barra de avance). */
  debajo?: ReactNode;
};

type PropsDeRenglon = Textos & {
  /** A la izquierda, antes del título: la foto o el ícono de la persona (2026-11-26), como la miniatura de Mis aportes. */
  miniatura?: ReactNode;
  /** Etiquetas y acciones, a la derecha. */
  lateral?: ReactNode;
  /** Toda la tarjeta es este enlace (entonces nada dentro puede ser otro enlace o botón). */
  href?: string;
  /**
   * Algo más dentro de la misma tarjeta, a todo el ancho y bajo el renglón (las subtemáticas de una temática,
   * 2026-11-26). No se combina con `href`.
   */
  pie?: ReactNode;
};

function TextosDelRenglon({ titulo, rotulo, detalles, debajo }: Textos) {
  const datos = (detalles ?? []).filter((d) => d !== null && d !== undefined && d !== false && d !== "");
  return (
    <div className="min-w-0 flex-1 text-left">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
        <span className="min-w-0 break-words font-bold text-system-900">{titulo}</span>
        {rotulo ? (
          <>
            <span className="shrink-0 text-system-400" aria-hidden="true">
              •
            </span>
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-system-500">{rotulo}</span>
          </>
        ) : null}
      </div>
      {datos.length > 0 && (
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-system-600">
          {datos.map((d, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="h-1 w-1 shrink-0 rounded-full bg-system-300" aria-hidden="true" />}
              <span className="min-w-0 break-words">{d}</span>
            </Fragment>
          ))}
        </div>
      )}
      {debajo ? <div className="mt-1.5">{debajo}</div> : null}
    </div>
  );
}

function Lateral({ children }: { children: ReactNode }) {
  return <div className="flex max-w-[55%] shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>;
}

/** Un renglón. Con `href`, toda la tarjeta es el enlace (como en Mis aportes); sin él, las acciones van en `lateral`. */
export function Renglon({ href, lateral, pie, miniatura, ...textos }: PropsDeRenglon) {
  const contenido = (
    <>
      {miniatura ? <span className="shrink-0">{miniatura}</span> : null}
      <TextosDelRenglon {...textos} />
      {lateral ? <Lateral>{lateral}</Lateral> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={`${CLASE_TARJETA} ${CLASE_ENLACE} ${CLASE_FILA}`}>
          {contenido}
        </Link>
      ) : pie ? (
        <div className={CLASE_TARJETA}>
          <div className={CLASE_FILA}>{contenido}</div>
          <div className="px-2.5 pb-2.5">{pie}</div>
        </div>
      ) : (
        <div className={`${CLASE_TARJETA} ${CLASE_FILA}`}>{contenido}</div>
      )}
    </li>
  );
}

/**
 * Un renglón que se despliega (una persona y sus aportes, un caso y sus reportes). El botón abarca el chevrón y los
 * textos; `lateral` queda fuera del botón (ahí sí caben enlaces). Al abrirlo, `children` va debajo, en gris claro.
 */
export function RenglonDesplegable({
  abierto,
  alAlternar,
  idPanel,
  lateral,
  children,
  ...textos
}: Textos & {
  abierto: boolean;
  alAlternar: () => void;
  /** id del panel que se despliega (para `aria-controls`). */
  idPanel: string;
  lateral?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className={`${CLASE_TARJETA} hover:border-brand-600`}>
      <div className={CLASE_FILA}>
        <button
          type="button"
          onClick={alAlternar}
          aria-expanded={abierto}
          aria-controls={idPanel}
          className="flex min-w-0 flex-1 items-center gap-3 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className={`size-4 shrink-0 text-system-600 transition-transform motion-reduce:transition-none ${abierto ? "rotate-90" : ""}`}
          >
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <TextosDelRenglon {...textos} />
        </button>
        {lateral ? <Lateral>{lateral}</Lateral> : null}
      </div>
      {abierto && (
        <div id={idPanel} className="rounded-b-lg border-t border-system-200 bg-system-50 p-3">
          {children}
        </div>
      )}
    </li>
  );
}
