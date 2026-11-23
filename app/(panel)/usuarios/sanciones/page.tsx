// Pantalla /usuarios/sanciones del panel: el SuperUsuario fuera del modo supervisor solo CONSULTA las
// sanciones (2026-10-13, a pedido del usuario): lista, lista negra y dispositivos bloqueados, sin el buscador
// "Sancionar a alguien" ni botones; desde el 2026-11-22 la lista sí se filtra (?q=, ?tipo=, ?vigencia=). Para dar avisos, banear, restaurar o quitar bloqueos, /supervisar/sanciones (modo supervisor).
// Server Component. Acceso: sesión raíz (layout de (panel) + exigirSesionRoot()).
// Contenido en components/moderacion/PantallaDeSanciones.tsx con soloLectura.

import type { Metadata } from "next";

import PantallaDeSanciones from "@/components/moderacion/PantallaDeSanciones";
import { exigirModerador } from "@/lib/moderacion/moderador";

export const metadata: Metadata = { title: "Sanciones" };
export const dynamic = "force-dynamic";

export default async function SancionesDelPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; vigencia?: string }>;
}) {
  const moderador = await exigirModerador("supervisar");
  const { q, tipo, vigencia } = await searchParams;
  return <PantallaDeSanciones zona="supervisar" moderador={moderador} soloLectura filtros={{ q, tipo, vigencia }} />;
}
