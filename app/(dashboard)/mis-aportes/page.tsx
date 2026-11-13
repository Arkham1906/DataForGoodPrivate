// Pantalla /mis-aportes. Desde el 2026-11-12 (decisión del responsable) arriba va «Cómo calificaron tus aportes», que
// antes estaba en el Resumen de /progreso. Desde el 2026-11-13 le sigue «Tu mapa de aportes» (V10MisAportes, RF-GAM-87,
// 88; fase 3 de modificaciones-sistema-previas-srs-v1.4). Los dos se arman aquí, en el servidor, y la lista (cliente)
// los muestra bajo su encabezado. Si alguno falla, la lista se muestra igual.

import CalificacionesDeAportes from "@/components/gamificacion/CalificacionesDeAportes";
import MapaDeAportes from "@/components/gamificacion/MapaDeAportes";
import { obtenerMapaDeAportes } from "@/lib/gamificacion/mapa-de-aportes";
import { obtenerCalificacionesDeAportes } from "@/lib/gamificacion/mi-progreso";
import { exigirUsuario } from "@/lib/session";
import ListaDeMisAportes from "./ListaDeMisAportes";

export default async function MisAportesPage() {
  const usuario = await exigirUsuario();
  const [calificaciones, mapa] = await Promise.all([obtenerCalificacionesDeAportes(usuario.id), obtenerMapaDeAportes(usuario.id)]);
  const resumen =
    calificaciones || mapa ? (
      <div className="flex flex-col gap-5 max-md:gap-4">
        {calificaciones && <CalificacionesDeAportes calificaciones={calificaciones} />}
        {mapa && <MapaDeAportes datos={mapa} />}
      </div>
    ) : null;
  return <ListaDeMisAportes resumen={resumen} />;
}
