// Pantalla /usuarios/sanciones del panel: el SuperUsuario fuera del modo supervisor solo CONSULTA las
// sanciones (2026-10-13, a pedido del usuario): lista, lista negra y dispositivos bloqueados, sin buscador
// ni botones. Para dar avisos, banear, restaurar o quitar bloqueos, /supervisar/sanciones (modo supervisor).
// Server Component. Acceso: sesión raíz (layout de (panel) + exigirSesionRoot()).
// Contenido en components/moderacion/PantallaDeSanciones.tsx con soloLectura.

import type { Metadata } from "next";

import PantallaDeSanciones from "@/components/moderacion/PantallaDeSanciones";
import { exigirModerador } from "@/lib/moderacion/moderador";

export const metadata: Metadata = { title: "Sanciones" };
export const dynamic = "force-dynamic";

export default async function SancionesDelPanelPage() {
  const moderador = await exigirModerador("supervisar");
  return <PantallaDeSanciones zona="supervisar" moderador={moderador} soloLectura />;
}
