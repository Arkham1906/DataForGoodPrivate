// Ubicación de una campaña como texto, y la opción "para todo el país" (2026-10-21, a pedido del
// usuario). Una campaña puede limitarse a un estado (y a un municipio y colonia) o abarcar toda la
// República: campanas.todo_el_pais = true, con estado, municipio y colonia vacíos. Sin municipio
// (y sin todo el país) abarca todo el estado. La ubicación no limita quién ve ni quién aporta:
// decide a quién se avisa de la campaña nueva, los filtros por estado y el texto que se muestra.
// Sin imports de servidor: lo usan pantallas, rutas y avisos.

export const TEXTO_TODO_EL_PAIS = "Todo el país";

/** "Centro, Tepic, Nayarit"; "Todo el país"; o `vacio` si no hay ubicación (un borrador). */
export function textoDeUbicacion(
  campana: { todoElPais?: unknown; estado?: unknown; municipio?: unknown; colonia?: unknown },
  vacio = ""
): string {
  if (campana.todoElPais === true) return TEXTO_TODO_EL_PAIS;
  const partes = [campana.colonia, campana.municipio, campana.estado].map((v) => String(v ?? "").trim());
  return partes.filter(Boolean).join(", ") || vacio;
}
