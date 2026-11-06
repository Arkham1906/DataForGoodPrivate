// Pantalla /contacto (pública). Texto fijo, sin datos.

import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";
import FranjaDeCampo from "@/components/landing/FranjaDeCampo";
import { retraso } from "@/lib/animaciones";

export const metadata: Metadata = { title: "Contacto" };

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader variante="portada" />
      <main id="contenido">
        <div className="mx-auto max-w-[1180px] px-6 pt-14 md:pt-20">
          <EncabezadoPublico centrado etiqueta="DataForGood" titulo="Contacto">
            Todavía no hay un canal de contacto publicado para el proyecto; esta página se
            completará cuando el equipo lo defina.
          </EncabezadoPublico>
        </div>
        <FranjaDeCampo style={retraso(240)} className="landing-entrada mt-12 h-[220px] md:h-[260px]" />
      </main>
      <PublicFooter />
    </div>
  );
}
