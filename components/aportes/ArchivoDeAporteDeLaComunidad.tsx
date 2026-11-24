// El aporte completo en la tarjeta de un aporte de la comunidad (aportes/TarjetaDeAporteDeLaComunidad: landing y
// /comunidad, 2026-11-22, a pedido del usuario): foto, video con su reproductor, audio, texto a la vista y archivo (PDF, Word, PowerPoint o Excel)
// con "Abrir". Reutiliza ui/ArchivoDelAporte, ui/MiniaturaDeAporte y la pantalla completa de
// ui/BotonPantallaCompletaDeAporte (sin la protección de las pantallas de revisión: aquí el aporte es público).
// El archivo sale de GET /api/aportes/[id]/archivo, que sin sesión solo deja ver los aportes de la comunidad
// (lib/aportes/comunidad.ts). Sin "use client": sirve en Server Components.

import ArchivoDelAporte, { MiniaturaDeAporte } from "@/components/ui/ArchivoDelAporte";
import BotonPantallaCompletaDeAporte from "@/components/ui/BotonPantallaCompletaDeAporte";
import type { AporteDeLaComunidad } from "@/lib/aportes/comunidad";

const ALTO = "h-44";

export default function ArchivoDeAporteDeLaComunidad({ aporte }: { aporte: AporteDeLaComunidad }) {
  const alt = `Aporte para ${aporte.tag || "una campaña"}`;

  // Sin archivo: lo que aportó es la descripción, completa y con scroll.
  if (aporte.sinArchivo) {
    return (
      <div className={`${ALTO} overflow-y-auto whitespace-pre-wrap rounded-lg border border-system-200 bg-system-50 p-3 text-[13px] leading-relaxed text-system-800`}>
        {aporte.description || "Aporte de solo texto."}
      </div>
    );
  }

  // El video ya trae su reproductor (con pantalla completa); lo demás se abre en grande.
  if (aporte.tipo === "video") {
    return <ArchivoDelAporte aporteId={aporte.id} tipo="video" alt={alt} alto={ALTO} />;
  }

  return (
    <BotonPantallaCompletaDeAporte aporteId={aporte.id} tipo={aporte.tipo} mimeType={aporte.mimeType ?? undefined} alt={alt} descripcion={aporte.description}>
      {aporte.tipo === "documento" ? (
        <MiniaturaDeAporte aporteId={aporte.id} tipo="documento" mimeType={aporte.mimeType ?? undefined} alt={alt} className={`${ALTO} w-full`} />
      ) : (
        <ArchivoDelAporte aporteId={aporte.id} tipo={aporte.tipo} mimeType={aporte.mimeType ?? undefined} alt={alt} alto={ALTO} />
      )}
    </BotonPantallaCompletaDeAporte>
  );
}
