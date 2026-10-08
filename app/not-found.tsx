// Página 404 de una ruta que no existe (2026-10-07, accesibilidad). Antes salía la de Next: en inglés
// y con texto blanco sobre el fondo claro de la app (contraste 1.04:1). Dentro de (dashboard) y
// (panel), notFound() usa su propio not-found.tsx, sin <main> (ver components/ui/AvisoNoEncontrado).

import type { Metadata } from "next";
import { PantallaNoEncontrada } from "@/components/ui/AvisoNoEncontrado";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NoEncontrada() {
  return <PantallaNoEncontrada />;
}
