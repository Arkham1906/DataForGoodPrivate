// Pantalla /sobre-nosotros (pública). Texto fijo.

import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";

export const metadata: Metadata = { title: "Sobre nosotros" };

export default function SobreNosotrosPage() {
  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />
      <main id="contenido" className="mx-auto max-w-5xl px-6 pb-24 pt-14">
        <EncabezadoPublico etiqueta="DataForGood" titulo="Sobre nosotros">
          Esta página todavía no tiene contenido: está pendiente de que el equipo escriba la
          presentación oficial del proyecto.
        </EncabezadoPublico>
      </main>
      <PublicFooter />
    </div>
  );
}
