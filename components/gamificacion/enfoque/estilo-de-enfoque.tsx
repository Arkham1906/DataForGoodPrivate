// Color e icono de cada enfoque (cámara, documento, brújula), compartidos por el selector, Mi cuenta y Líderes. Sin
// "use client": también lo usan componentes del servidor (Podio, ListaDeLideres).

type Estilo = { icono: string; fondo: string; trazo: string; borde: string };

const ESTILOS: Record<string, Estilo> = {
  tracker: {
    icono: "M4 8h3l2-3h6l2 3h3v11H4z M8.5 13a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0",
    fondo: "bg-brand-50",
    trazo: "text-brand-700",
    borde: "has-[:checked]:border-brand-600",
  },
  collector: {
    icono: "M7 3h7l4 4v14H7z M14 3v4h4 M10 12h5 M10 16h5",
    fondo: "bg-success-50",
    trazo: "text-success-700",
    borde: "has-[:checked]:border-success-700",
  },
  explorer: {
    icono: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M15.5 8.5l-2 5-5 2 2-5z",
    fondo: "bg-warning-50",
    trazo: "text-warning-800",
    borde: "has-[:checked]:border-warning-700",
  },
};

/** Un enfoque nuevo del catálogo, sin estilo propio todavía. */
const ESTILO_COMUN: Estilo = {
  icono: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 8v8 M8 12h8",
  fondo: "bg-system-100",
  trazo: "text-system-700",
  borde: "has-[:checked]:border-brand-600",
};

export function estiloDeEnfoque(clave: string): Estilo {
  return ESTILOS[clave] ?? ESTILO_COMUN;
}

export function IconoDeEnfoque({ clave, className }: { clave: string; className: string }) {
  const estilo = estiloDeEnfoque(clave);
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`${className} ${estilo.trazo}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={estilo.icono} />
    </svg>
  );
}

/** Etiqueta chica con el icono y el nombre del enfoque. `soloIcono` desde teléfono: el nombre queda para lectores de pantalla. */
export function ChipDeEnfoque({ clave, nombre, soloIconoEnTelefono = false }: { clave: string; nombre: string; soloIconoEnTelefono?: boolean }) {
  const estilo = estiloDeEnfoque(clave);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${estilo.fondo} ${estilo.trazo}`}>
      <IconoDeEnfoque clave={clave} className="size-3.5" />
      <span className={soloIconoEnTelefono ? "max-sm:sr-only" : undefined}>{nombre}</span>
    </span>
  );
}
