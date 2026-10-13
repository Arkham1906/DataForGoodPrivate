// Pantalla /supervisar/sanciones/[usuarioId] (2026-10-13): dar un aviso o banear a una persona; con ?reportes=<clave>
// confirma los reportes de esa campaña o aporte. Acceso: SuperUsuario en modo supervisor (sesión raíz) (exigirModerador).
// Contenido y acción en components/moderacion/PantallaDeSancionar.tsx (compartido con la otra zona).

import type { Metadata } from "next";

import PantallaDeSancionar, { tituloDeSancionar } from "@/components/moderacion/PantallaDeSancionar";
import { exigirModerador } from "@/lib/moderacion/moderador";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ usuarioId: string }> }): Promise<Metadata> {
  const { usuarioId } = await params;
  return { title: await tituloDeSancionar(usuarioId) };
}

export default async function SancionarPage({
  params,
  searchParams,
}: {
  params: Promise<{ usuarioId: string }>;
  searchParams: Promise<{ reportes?: string }>;
}) {
  const moderador = await exigirModerador("supervisar");
  const { usuarioId } = await params;
  const { reportes } = await searchParams;
  return <PantallaDeSancionar zona="supervisar" moderador={moderador} usuarioId={usuarioId} reportes={reportes} />;
}
