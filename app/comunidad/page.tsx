// Pantalla /comunidad (pública, 2026-11-22, a pedido del usuario): todos los aportes de la comunidad con la
// tarjeta de "Lo último que aportó la comunidad" de la landing (aportes/TarjetaDeAporteDeLaComunidad), del más
// nuevo al más viejo, 4 por fila en escritorio. Se llega con "Ver más" de esa sección.
// Datos: lib/aportes/comunidad.ts (aprobados de campañas activas, pausadas o finalizadas; nunca quién aportó).
// "Ver más" suma APORTES_POR_TANDA con ?mostrar= (hasta MAXIMO_A_LA_VEZ). Se arma en cada visita y se actualiza
// en vivo (ActualizacionEnVivo): un aporte que se aprueba aparece arriba sin recargar.

import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import TarjetaDeAporteDeLaComunidad from "@/components/aportes/TarjetaDeAporteDeLaComunidad";
import { buttonClasses } from "@/components/ui/Button";
import {
  APORTES_POR_TANDA,
  MAXIMO_A_LA_VEZ,
  aportesDeLaComunidad,
  contarAportesDeLaComunidad,
  type AporteDeLaComunidad,
} from "@/lib/aportes/comunidad";

export const metadata: Metadata = {
  title: "Aportes de la comunidad",
  description: "Los aportes ya aprobados que envía la comunidad a las campañas de DataForGood, sin datos de quién los envió.",
};

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("es-MX");

/** ?mostrar= en tandas completas, entre una tanda y el tope. */
function cuantosMostrar(valor: string | undefined): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= APORTES_POR_TANDA) return APORTES_POR_TANDA;
  return Math.min(MAXIMO_A_LA_VEZ, Math.ceil(n / APORTES_POR_TANDA) * APORTES_POR_TANDA);
}

export default async function AportesDeLaComunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ mostrar?: string }>;
}) {
  const { mostrar } = await searchParams;
  const limite = cuantosMostrar(mostrar);

  let aportes: AporteDeLaComunidad[] = [];
  let total = 0;
  try {
    [aportes, total] = await Promise.all([aportesDeLaComunidad(limite), contarAportesDeLaComunidad()]);
  } catch {
    // Sin base de datos: la pantalla sale vacía en vez de fallar.
  }
  const hayMas = aportes.length < total && limite < MAXIMO_A_LA_VEZ;

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader variante="portada" />

      <main id="contenido" className="mx-auto max-w-[1180px] px-6 pb-16 pt-14 md:pb-24 md:pt-20">
        <EncabezadoPublico centrado etiqueta="Desde el campo" titulo="Aportes de la comunidad">
          {total > 0
            ? `${nf.format(total)} ${total === 1 ? "aporte aprobado" : "aportes aprobados"}, del más reciente al más antiguo. Se actualiza solo cuando se aprueba uno nuevo; nunca mostramos quién lo envió.`
            : "Todavía no hay aportes aprobados. Cuando la comunidad envíe alguno y se apruebe, aparecerá aquí."}
        </EncabezadoPublico>

        {aportes.length > 0 && (
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {aportes.map((aporte) => (
              <TarjetaDeAporteDeLaComunidad key={aporte.id} aporte={aporte} className="landing-tarjeta" />
            ))}
          </ul>
        )}

        {hayMas && (
          <div className="mt-10 flex flex-col items-center gap-2">
            <Link href={`/comunidad?mostrar=${limite + APORTES_POR_TANDA}`} scroll={false} className={buttonClasses("secondary", "sm")}>
              Ver más
            </Link>
            <p className="font-mono text-[11px] text-system-500">
              {nf.format(aportes.length)} de {nf.format(total)}
            </p>
          </div>
        )}
        {!hayMas && aportes.length > 0 && aportes.length < total && (
          <p className="mt-10 text-center text-[13px] text-system-600">
            Se muestran los {nf.format(aportes.length)} más recientes.
          </p>
        )}
      </main>

      <PublicFooter />
      <ActualizacionEnVivo />
    </div>
  );
}
