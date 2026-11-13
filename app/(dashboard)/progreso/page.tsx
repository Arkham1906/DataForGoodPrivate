// /progreso ya no tiene pantalla propia (2026-11-12, decisión del responsable: se eliminó el Resumen). Lleva a la
// primera pestaña de Mi progreso. Se conserva la ruta por los avisos ya enviados y los enlaces guardados.

import { redirect } from "next/navigation";
import { PANTALLAS_DE_PROGRESO } from "@/lib/gamificacion/pantallas-de-progreso";

export default function ProgresoPage() {
  redirect(PANTALLAS_DE_PROGRESO.find((p) => p.href)?.href ?? "/inicio");
}
