// Layout de la zona de usuario (dashboard): ShellDeUsuario (TopBar + SidebarNav + VigilanteDeSesion + ActualizacionEnVivo +
// DetectorDeUbicacion, 2026-10-31: zona por GPS, solo si la persona la activó en /campanas).
// Guardia: exigirUsuario() → sin sesión a /entrar, cuenta sancionada a /cuenta-bloqueada.
// No basta por sí solo: cada página y cada endpoint vuelven a verificar (ver docs/permisos.md).

import ShellDeUsuario from "@/components/layout/ShellDeUsuario";
import { exigirUsuario, getSessionUser } from "@/lib/session";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // El proxy marca únicamente el detalle público de una campaña. Las demás
  // rutas siguen usando la guardia normal, incluso con una sesión inválida.
  const usuario = await getSessionUser();
  if (!usuario) {
    const encabezados = await headers();
    if (encabezados.get("x-public-campaign-detail") === "1") return <>{children}</>;
    return <ShellDeUsuario usuario={await exigirUsuario()}>{children}</ShellDeUsuario>;
  }

  return <ShellDeUsuario usuario={usuario}>{children}</ShellDeUsuario>;
}
