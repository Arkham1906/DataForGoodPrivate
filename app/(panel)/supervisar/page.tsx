// Pantalla /supervisar: el SuperUsuario como supervisor (equivalente de /supervision con sesión raíz).
// Server Component. Datos: listarCampanasParaRoot() de lib/supervision/root.ts (exige sesión raíz).
// "Supervisadas", "Finalizadas" e incidencias muestran las de todos los supervisores, no solo las suyas (2026-10-15).
// Arriba, las pestañas Campañas / Reportes / Sanciones (components/moderacion/PestanasDeModeracion).

import type { Metadata } from "next";
import { listarCampanasParaRoot } from "@/lib/supervision/root";
import PestanasDeModeracion from "@/components/moderacion/PestanasDeModeracion";
import PestanasDeSupervision from "./pestanas";

export const metadata: Metadata = { title: "Modo supervisor" };

export default async function SupervisarPage() {
  const { pendientes, supervisadas } = await listarCampanasParaRoot();

  return (
    <>
    <PestanasDeModeracion zona="supervisar" />
    <PestanasDeSupervision
      pendientes={pendientes}
      supervisadas={supervisadas.filter((c) => c.status === "activa" || c.status === "aceptada" || c.status === "pausada")}
      finalizadas={supervisadas.filter((c) => c.status === "finalizada")}
      conIncidencia={supervisadas.filter(
        (c) => c.latestSupervisionAction === "reportada" || c.status === "rechazada",
      )}
    />
    </>
  );
}
