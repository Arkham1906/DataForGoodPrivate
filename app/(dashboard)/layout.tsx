// Layout de la zona de usuario (dashboard): ShellDeUsuario (TopBar + SidebarNav + VigilanteDeSesion + ActualizacionEnVivo +
// DetectorDeUbicacion, 2026-10-31: zona por GPS, solo si la persona la activó en /campanas).
// Guardia: exigirUsuario() → sin sesión a /entrar, cuenta sancionada a /cuenta-bloqueada.
// Excepción: la ficha /campanas/[id], que se ve sin sesión (desde /explorar), sin el armazón.
// No basta por sí solo: cada página y cada endpoint vuelven a verificar (ver docs/permisos.md).

import ShellDeUsuario from "@/components/layout/ShellDeUsuario";
import { exigirUsuario, getSessionUser, obtenerBloqueoDeLaSesion } from "@/lib/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getSessionUser();
  if (usuario) return <ShellDeUsuario usuario={usuario}>{children}</ShellDeUsuario>;

  // Solo proxy.ts pone este encabezado, y solo en /campanas/[id]: si lo manda el navegador, el proxy lo
  // borra (2026-11-11). Una cuenta sancionada sigue yendo a /cuenta-bloqueada, también desde la ficha.
  if ((await headers()).get("x-public-campaign-detail") === "1") {
    if (await obtenerBloqueoDeLaSesion()) redirect("/cuenta-bloqueada");
    return <>{children}</>;
  }
  return <ShellDeUsuario usuario={await exigirUsuario()}>{children}</ShellDeUsuario>;
}
