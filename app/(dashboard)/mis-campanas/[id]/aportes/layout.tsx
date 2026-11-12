// Título de la pestaña de esta pantalla (WCAG 2.4.2). La página es cliente y no puede declararlo.
// Protegida contra copiar, pegar y capturas (2026-11-12, components/aportes/ProteccionDeAportes.tsx).

import type { Metadata } from "next";
import { tituloDeSeccion } from "@/lib/titulo";
import ZonaDeAportesConMarca from "@/components/aportes/ZonaDeAportesConMarca";

export const metadata: Metadata = { title: tituloDeSeccion("Aportes recibidos") };

export default function Layout({ children }: { children: React.ReactNode }) {
  // Revisores y agregar revisor no muestran aportes: ahí se puede copiar y pegar (p. ej. un correo).
  return <ZonaDeAportesConMarca sinProteccionEn={["/aportes/revisores", "/aportes/agregar-revisor"]}>{children}</ZonaDeAportesConMarca>;
}
