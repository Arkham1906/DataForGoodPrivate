// Pantalla /progreso/medallas, pestaña Medallas de «Mi progreso» (2026-11-15; lienzo aprobado el mismo día; SRS v1.3:
// RF-GAM-46 a 49). Documento: claude/pantallas-v12/medallas-propuesta.md. El título y las pestañas están en
// ../layout.tsx. Server Component. Acceso: sesión de usuario. Datos: obtenerPantallaDeMedallas().

import type { Metadata } from "next";
import Card from "@/components/ui/Card";
import MedallasDeUsuario from "@/components/gamificacion/MedallasDeUsuario";
import { exigirUsuario } from "@/lib/session";
import { obtenerPantallaDeMedallas } from "@/lib/gamificacion/medallas-pantalla";
import { TEXTOS } from "@/lib/gamificacion/textos";

export const metadata: Metadata = { title: "Medallas" };

export default async function MedallasPage() {
  const usuario = await exigirUsuario();
  const datos = await obtenerPantallaDeMedallas(usuario.id);

  if (!datos || datos.medallas.length === 0) {
    return (
      <Card>
        <p className="text-[13px] text-system-600">{TEXTOS.medallas.error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <MedallasDeUsuario medallas={datos.medallas} cerca={datos.cerca} />
    </div>
  );
}
