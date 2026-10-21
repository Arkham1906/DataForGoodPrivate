// Layout de la zona de usuario (dashboard): ShellDeUsuario (TopBar + SidebarNav + VigilanteDeSesion + ActualizacionEnVivo).
// Guardia: exigirUsuario() → sin sesión a /entrar, cuenta sancionada a /cuenta-bloqueada.
// No basta por sí solo: cada página y cada endpoint vuelven a verificar (ver docs/permisos.md).

import ShellDeUsuario from "@/components/layout/ShellDeUsuario";
import { exigirUsuario } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sin sesión va a /entrar; una cuenta suspendida o baneada, a /cuenta-bloqueada.
  const usuario = await exigirUsuario();

  return <ShellDeUsuario usuario={usuario}>{children}</ShellDeUsuario>;
}
