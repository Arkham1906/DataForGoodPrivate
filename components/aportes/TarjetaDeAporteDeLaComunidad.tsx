// Tarjeta de un aporte de la comunidad (2026-11-22, a pedido del usuario): el aporte completo arriba
// (aportes/ArchivoDeAporteDeLaComunidad), la descripción entre comillas, la temática como #etiqueta, cuándo
// llegó y "Aprobado". Nunca quién lo envió. La usan "Lo último que aportó la comunidad" de la landing y
// /comunidad: es el <li> de su lista. Sin "use client": sirve en Server Components.

import Tag from "@/components/ui/Tag";
import ArchivoDeAporteDeLaComunidad from "@/components/aportes/ArchivoDeAporteDeLaComunidad";
import type { AporteDeLaComunidad } from "@/lib/aportes/comunidad";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";

function comoHashtag(texto: string): string {
  const limpio = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `#${limpio || "campana"}`;
}

const DIA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, year: "numeric", month: "2-digit", day: "2-digit" });
const HORA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, hour: "2-digit", minute: "2-digit" });
const FECHA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, day: "numeric", month: "short" });

/** Solo la hora si llegó hoy (hora de Tepic); si no, también el día ("21 nov., 01:39 p.m."). */
function cuandoLlego(iso: string): string {
  const fecha = new Date(iso);
  const hora = HORA.format(fecha);
  return DIA.format(fecha) === DIA.format(new Date()) ? hora : `${FECHA.format(fecha)}, ${hora}`;
}

export default function TarjetaDeAporteDeLaComunidad({ aporte, className = "" }: { aporte: AporteDeLaComunidad; className?: string }) {
  return (
    <li className={`flex flex-col rounded-[18px] border border-system-200 bg-white p-4 ${className}`}>
      <ArchivoDeAporteDeLaComunidad aporte={aporte} />
      {!aporte.sinArchivo && aporte.description && (
        <p className="mt-3 text-[14px] leading-snug text-system-900">
          &ldquo;{aporte.description.length > 90 ? `${aporte.description.slice(0, 90)}…` : aporte.description}&rdquo;
        </p>
      )}
      <div className="mt-auto flex items-center justify-between pt-4">
        <div>
          <p className="text-[12px] font-medium text-brand-600">{comoHashtag(aporte.tag)}</p>
          <p className="font-mono text-[11px] text-system-500">
            <time dateTime={aporte.submittedAt}>{cuandoLlego(aporte.submittedAt)}</time>
          </p>
        </div>
        <Tag tone="ok">Aprobado</Tag>
      </div>
    </li>
  );
}
