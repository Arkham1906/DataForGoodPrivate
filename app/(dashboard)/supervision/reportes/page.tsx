// Pantalla /supervision/reportes (2026-10-13): bandeja de reportes de campañas y de aportes; ?estado=resueltos
// muestra los resueltos. Acceso: usuario con rol de supervisor (exigirModerador).
// Contenido y acciones en components/moderacion/PantallaDeReportes.tsx (compartido con la otra zona).

import type { Metadata } from "next";

import PantallaDeReportes from "@/components/moderacion/PantallaDeReportes";
import { exigirModerador } from "@/lib/moderacion/moderador";

export const metadata: Metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const moderador = await exigirModerador("supervision");
  const { estado } = await searchParams;
  return <PantallaDeReportes zona="supervision" moderador={moderador} estado={estado} />;
}
