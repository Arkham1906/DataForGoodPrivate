// Pantalla /mis-aportes. Desde el 2026-11-12 (decisión del responsable) arriba va «Cómo calificaron tus aportes», que
// antes estaba en el Resumen de /progreso; se arma aquí, en el servidor, y la lista (cliente) lo muestra bajo su
// encabezado. Si las calificaciones fallan, la lista se muestra igual. El rediseño completo con el mapa de aportes
// (V10MisAportes, RF-GAM-87, 88) es la fase 3 de modificaciones-sistema-previas-srs-v1.4.

import CalificacionesDeAportes from "@/components/gamificacion/CalificacionesDeAportes";
import { obtenerCalificacionesDeAportes } from "@/lib/gamificacion/mi-progreso";
import { exigirUsuario } from "@/lib/session";
import ListaDeMisAportes from "./ListaDeMisAportes";

export default async function MisAportesPage() {
  const usuario = await exigirUsuario();
  const calificaciones = await obtenerCalificacionesDeAportes(usuario.id);
  return <ListaDeMisAportes resumen={calificaciones && <CalificacionesDeAportes calificaciones={calificaciones} />} />;
}
