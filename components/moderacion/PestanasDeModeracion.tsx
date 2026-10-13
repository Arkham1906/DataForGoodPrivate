// Pestañas de arriba en las dos zonas de supervisión (2026-10-13): Campañas / Reportes / Sanciones.
// En /supervisar (SuperUsuario en modo supervisor) y en /supervision (usuario con rol de supervisor).
// Rutas en lib/moderacion/rutas.ts; las pestañas son components/sistema/subtabs.

import Subtabs from "@/components/sistema/subtabs";
import { pestanasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";

export default function PestanasDeModeracion({ zona }: { zona: ZonaDeModeracion }) {
  return <Subtabs pestanas={pestanasDeModeracion(zona)} etiquetaAria="Secciones de supervisión" />;
}
