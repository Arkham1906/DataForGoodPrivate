// Pantalla /contacto (pública). Texto fijo, sin datos.

import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";

export const metadata: Metadata = { title: "Contacto" };

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-tight text-system-900">Contacto</h1>
        <p className="mt-4 text-[14.5px] leading-relaxed text-system-600">
          Todavía no hay un canal de contacto publicado para el proyecto; esta página se
          completará cuando el equipo lo defina.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
