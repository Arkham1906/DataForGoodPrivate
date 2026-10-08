// Pantalla /sobre-nosotros (pública). Texto fijo.

import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";

export const metadata: Metadata = { title: "Sobre nosotros" };

export default function SobreNosotrosPage() {
  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-tight text-system-900">Sobre nosotros</h1>
        <p className="mt-4 text-[14.5px] leading-relaxed text-system-600">
          Esta página todavía no tiene contenido: está pendiente de que el equipo escriba la
          presentación oficial del proyecto.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
