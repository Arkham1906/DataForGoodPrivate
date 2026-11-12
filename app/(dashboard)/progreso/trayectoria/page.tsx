import type { Metadata } from "next";
import Card from "@/components/ui/Card";
import TrayectoriaDeRangos from "@/components/gamificacion/TrayectoriaDeRangos";
import { exigirUsuario } from "@/lib/session";
import { obtenerDatosDeTrayectoria } from "@/lib/gamificacion/mi-progreso";
import { obtenerResumenDeProgreso } from "@/lib/gamificacion/progreso";

export const metadata: Metadata = { title: "Trayectoria" };

export default async function TrayectoriaPage() {
  const usuario = await exigirUsuario();
  const progreso = await obtenerResumenDeProgreso(usuario.id);
  const datos = progreso ? await obtenerDatosDeTrayectoria(usuario.id, progreso) : null;

  if (!progreso || !datos) {
    return (
      <Card>
        <p className="text-[13px] text-system-600">Todavía no podemos mostrar tu trayectoria. Intenta de nuevo en unos minutos.</p>
      </Card>
    );
  }

  return (
    <TrayectoriaDeRangos
      actual={progreso.rangoActual}
      total={progreso.totalDeRangos}
      nombre={progreso.nombreDelRango}
      datos={datos}
    />
  );
}
