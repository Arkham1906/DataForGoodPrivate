// Pantalla /progreso, pestaña Resumen de «Mi progreso» (2026-11-04; diseño v10, SRS v1.2: RF-GAM-22, 31, 46, 78, 85,
// 99). De arriba abajo: bloque de rango, «Hoy» (potenciador, misiones y racha, con su calendario), cómo calificaron
// tus aportes y medallas cerca de subir. El título y las pestañas están en ./layout.tsx.
// Server Component. Acceso: sesión de usuario. Datos: obtenerResumenDeProgreso() (lib/gamificacion/progreso.ts, común
// con /inicio) y obtenerDatosDeResumen() (lib/gamificacion/mi-progreso.ts). Solo lectura.

import type { Metadata } from "next";
import Card from "@/components/ui/Card";
import { exigirUsuario } from "@/lib/session";
import { obtenerDatosDeResumen } from "@/lib/gamificacion/mi-progreso";
import { obtenerResumenDeProgreso } from "@/lib/gamificacion/progreso";
import BloqueDeRango from "@/components/gamificacion/BloqueDeRango";
import CalendarioDeRacha from "@/components/gamificacion/CalendarioDeRacha";
import CalificacionesDeAportes from "@/components/gamificacion/CalificacionesDeAportes";
import MedallasCercaDeSubir from "@/components/gamificacion/MedallasCercaDeSubir";
import ResumenDeHoy from "@/components/gamificacion/ResumenDeHoy";

export const metadata: Metadata = { title: "Mi progreso" };

export default async function ProgresoPage() {
  const usuario = await exigirUsuario();
  const progreso = await obtenerResumenDeProgreso(usuario.id);
  const datos = progreso ? await obtenerDatosDeResumen(usuario.id, progreso) : null;

  if (!progreso || !datos) {
    return (
      <Card>
        <p className="text-[13px] text-system-600">Todavía no podemos mostrar tu progreso. Intenta de nuevo en unos minutos.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <BloqueDeRango progreso={progreso} datos={datos} />
      <ResumenDeHoy progreso={progreso} accionDeRacha={<CalendarioDeRacha racha={progreso.racha} />} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <CalificacionesDeAportes calificaciones={datos.calificaciones} />
        <MedallasCercaDeSubir medallas={datos.medallasCerca} />
      </div>
    </div>
  );
}
