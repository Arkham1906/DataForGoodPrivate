// Pantalla /comunidad (pública): los últimos 50 aportes aprobados de la comunidad con la
// tarjeta de "Lo último que aportó la comunidad" de la landing (aportes/TarjetaDeAporteDeLaComunidad), del más
// nuevo al más viejo, 4 por fila en escritorio. Se llega con "Ver más" de esa sección.
// Datos: lib/aportes/comunidad.ts (aprobados de campañas activas, pausadas o finalizadas; nunca quién aportó).
// El límite es fijo, también si llega un enlace antiguo con ?mostrar=. Se arma en cada visita y se actualiza
// en vivo (ActualizacionEnVivo): un aporte que se aprueba aparece arriba sin recargar.

import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import TarjetaDeAporteDeLaComunidad from "@/components/aportes/TarjetaDeAporteDeLaComunidad";
import {
  aportesDeLaComunidad,
  type AporteDeLaComunidad,
} from "@/lib/aportes/comunidad";

export const metadata: Metadata = {
  title: "Aportes recientes de la comunidad",
  description: "Los aportes ya aprobados que envía la comunidad a las campañas de DataForGood, sin datos de quién los envió.",
};

export const dynamic = "force-dynamic";

export default async function AportesDeLaComunidadPage() {
  let aportes: AporteDeLaComunidad[] = [];
  try {
    aportes = await aportesDeLaComunidad(50);
  } catch {
    // Sin base de datos: la pantalla sale vacía en vez de fallar.
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader variante="portada" />

      <main id="contenido" className="mx-auto max-w-[1180px] px-6 pb-16 pt-14 md:pb-24 md:pt-20">
        <EncabezadoPublico centrado etiqueta="Desde el campo" titulo="Aportes recientes de la comunidad">
          {aportes.length > 0
            ? "Explora los 50 aportes aprobados más recientes, del más nuevo al más antiguo."
            : "Todavía no hay aportes aprobados. Cuando la comunidad envíe alguno y se apruebe, aparecerá aquí."}
        </EncabezadoPublico>

        {aportes.length > 0 && (
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {aportes.map((aporte) => (
              <TarjetaDeAporteDeLaComunidad key={aporte.id} aporte={aporte} className="landing-tarjeta" />
            ))}
          </ul>
        )}

      </main>

      <PublicFooter />
      <ActualizacionEnVivo />
    </div>
  );
}
