// Pestañas de arriba en las dos zonas de supervisión (2026-10-13): Campañas / Reportes / Sanciones.
// En /supervisar (SuperUsuario en modo supervisor) y en /supervision (usuario con rol de supervisor), que desde el
// 2026-11-13 tiene cuatro: Dashboard / Campañas / Reportes / Sanciones (en móvil, 2 × 2).
// Rutas en lib/moderacion/rutas.ts; las pestañas son components/sistema/subtabs.

import Subtabs from "@/components/sistema/subtabs";
import { pestanasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";

export default function PestanasDeModeracion({ zona }: { zona: ZonaDeModeracion }) {
  const pestanas = pestanasDeModeracion(zona);
  // Tres caben en una fila del teléfono (Subtabs la arma con 3 columnas); cuatro van en dos filas de dos.
  return pestanas.length > 3 ? (
    <Subtabs pestanas={pestanas} etiquetaAria="Secciones de supervisión" distribuidasEnMovil />
  ) : (
    <Subtabs pestanas={pestanas} etiquetaAria="Secciones de supervisión" unaFilaEnMovil />
  );
}
