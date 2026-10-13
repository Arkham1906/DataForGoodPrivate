// Pantalla /supervision/sanciones (2026-10-13): lista de sanciones, lista negra, dispositivos bloqueados y buscador
// para sancionar a cualquier usuario. Acceso: usuario con rol de supervisor (exigirModerador).
// Contenido y acciones en components/moderacion/PantallaDeSanciones.tsx (compartido con /supervisar/sanciones).

import type { Metadata } from "next";

import PantallaDeSanciones from "@/components/moderacion/PantallaDeSanciones";
import { exigirModerador } from "@/lib/moderacion/moderador";

export const metadata: Metadata = { title: "Sanciones" };
export const dynamic = "force-dynamic";

export default async function SancionesPage({ searchParams }: { searchParams: Promise<{ buscar?: string }> }) {
  const moderador = await exigirModerador("supervision");
  const { buscar } = await searchParams;
  return <PantallaDeSanciones zona="supervision" moderador={moderador} buscar={typeof buscar === "string" ? buscar : ""} />;
}
