// Pantalla /contacto (pública). Texto fijo, sin datos.

import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";

export const metadata: Metadata = { title: "Contacto" };

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />
      <main id="contenido" className="mx-auto max-w-5xl px-6 pb-24 pt-14">
        <EncabezadoPublico etiqueta="DataForGood" titulo="Contacto">
          Todavía no hay un canal de contacto publicado para el proyecto; esta página se
          completará cuando el equipo lo defina.
        </EncabezadoPublico>
      </main>
      <PublicFooter />
    </div>
  );
}
