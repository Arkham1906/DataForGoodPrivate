// Pantalla /progreso, «Mi progreso» (2026-11-02, decisión del responsable: opción del menú lateral con solo lo de la
// gamificación). Versión PROVISIONAL: reutiliza ResumenDeRango y ResumenDeHoy de /inicio. La trayectoria completa de
// 20 rangos, el historial de EXP, el calendario de la racha y las medallas llegan en entregas siguientes (SRS v1.1).
// Server Component. Acceso: sesión de usuario. Datos: obtenerResumenDeProgreso() de lib/gamificacion/progreso.ts.

import type { Metadata } from "next";
import Card from "@/components/ui/Card";
import { exigirUsuario } from "@/lib/session";
import { obtenerResumenDeProgreso } from "@/lib/gamificacion/progreso";
import ResumenDeRango from "@/components/gamificacion/ResumenDeRango";
import ResumenDeHoy from "@/components/gamificacion/ResumenDeHoy";

export const metadata: Metadata = { title: "Mi progreso" };

export default async function ProgresoPage() {
  const usuario = await exigirUsuario();
  const progreso = await obtenerResumenDeProgreso(usuario.id);

  return (
    <div className="space-y-8 max-md:space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mi progreso</h1>
        <p className="mt-1 text-[13px] text-system-600">Tu rango, tus misiones y tu racha.</p>
      </div>

      {progreso ? (
        <>
          <ResumenDeRango progreso={progreso} idDelTitulo="progreso-rango" />
          <ResumenDeHoy progreso={progreso} />
          <p className="text-[13px] text-system-600">
            Estamos preparando aquí tu trayectoria completa, el historial de EXP y el calendario de tu racha.
          </p>
        </>
      ) : (
        <Card>
          <p className="text-[13px] text-system-600">Todavía no podemos mostrar tu progreso. Intenta de nuevo en unos minutos.</p>
        </Card>
      )}
    </div>
  );
}
