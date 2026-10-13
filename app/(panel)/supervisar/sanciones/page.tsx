// Pantalla /supervisar/sanciones (2026-10-13): lista de sanciones, lista negra, dispositivos bloqueados y buscador
// para sancionar a cualquier usuario. Acceso: SuperUsuario en modo supervisor (sesión raíz) (exigirModerador).
// Contenido y acciones en components/moderacion/PantallaDeSanciones.tsx (compartido con /supervision/sanciones).

import type { Metadata } from "next";

import PantallaDeSanciones from "@/components/moderacion/PantallaDeSanciones";
import { exigirModerador } from "@/lib/moderacion/moderador";

export const metadata: Metadata = { title: "Sanciones" };
export const dynamic = "force-dynamic";

export default async function SancionesPage({ searchParams }: { searchParams: Promise<{ buscar?: string }> }) {
  const moderador = await exigirModerador("supervisar");
  const { buscar } = await searchParams;
  return <PantallaDeSanciones zona="supervisar" moderador={moderador} buscar={typeof buscar === "string" ? buscar : ""} />;
}
