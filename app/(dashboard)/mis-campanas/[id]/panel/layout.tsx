// Título de la pestaña de esta pantalla (WCAG 2.4.2). La página es cliente y no puede declararlo.

import type { Metadata } from "next";
import { tituloDeSeccion } from "@/lib/titulo";

export const metadata: Metadata = { title: tituloDeSeccion("Panel de la campaña") };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
