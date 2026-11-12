// Estilo de las ventanas emergentes (<dialog>) de toda la app (2026-11-12, a pedido del usuario: "hazlas más
// grandes para que no se vea pequeño o ilegible el contenido, que se vea que es un widget para app web").
// Una regla, un lugar: cada ventana toma de aquí el marco, el ancho y las partes (encabezado, cuerpo, pie),
// en vez de copiar las clases. Antes: 448 a 768 px de ancho, texto de 12.5 px y esquinas chicas.
// Sin imports de servidor: lo usan componentes cliente.

/** Ancho de la ventana: "normal" para avisos y formularios cortos, "grande" con listas, "amplia" con mucho contenido. */
export type TamanoDeVentana = "normal" | "grande" | "amplia";

const ANCHO: Record<TamanoDeVentana, string> = {
  normal: "max-w-2xl", // 672 px
  grande: "max-w-3xl", // 768 px
  amplia: "max-w-4xl", // 896 px
};

/**
 * Tamaño de los campos de formulario dentro de la ventana. ui/CampoEtiquetado (etiqueta, pista y error),
 * ui/Input (Input y Textarea) y ui/ReportarAPlataforma leen estas variables; fuera de una ventana no
 * existen y usan su tamaño de siempre.
 */
const TEXTO_DE_CAMPOS =
  "[--ventana-etiqueta:15px] [--ventana-pista:13.5px] [--ventana-error:14px] [--ventana-campo:15px]";

/**
 * Clases del <dialog>: centrado, con 1 rem de margen en móvil, esquinas grandes, sombra marcada y el fondo
 * oscurecido y desenfocado. `borde` cambia el color del borde (p. ej. "border-error-200" en la de problemas).
 */
export function claseDeVentana(tamano: TamanoDeVentana = "normal", borde = "border-system-200"): string {
  return `m-auto w-[calc(100%-2rem)] ${ANCHO[tamano]} rounded-2xl border ${borde} bg-white p-0 text-system-900 shadow-2xl backdrop:bg-system-900/50 backdrop:backdrop-blur-[2px] ${TEXTO_DE_CAMPOS}`;
}

/** Partes de adentro, iguales en todas las ventanas. */
export const VENTANA = {
  /** Columna con alto máximo: el cuerpo se desplaza y el encabezado y el pie quedan fijos. */
  marco: "flex max-h-[88vh] flex-col",
  encabezado: "border-b border-system-200 px-5 py-5 md:px-8 md:py-6",
  titulo: "text-xl font-extrabold text-system-900 md:text-2xl",
  /** Texto bajo el título. */
  subtitulo: "mt-1.5 text-[15px] leading-relaxed text-system-600",
  cuerpo: "flex-1 overflow-y-auto px-5 py-5 text-[15px] leading-relaxed text-system-600 md:px-8 md:py-6",
  pie: "flex flex-wrap items-center justify-end gap-3 border-t border-system-200 px-5 py-4 md:px-8 md:py-5",
  /** Botón redondo "×" de la esquina. */
  cerrar:
    "-mr-1 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-[22px] leading-none text-system-500 transition-colors hover:bg-system-100 hover:text-system-900",
} as const;
