// Avatar de gamificación con su etapa («Etapa 9 de 20») para el resumen de rango de /inicio y /progreso
// (2026-11-02). Solo para ver el avatar: aquí no se equipa nada (eso es de «Avatar e inventario»). Si recibe
// `href` es un enlace; sin él, un bloque sin interacción (no se enlaza a una pantalla que aún no existe).
// Sin estado: sirve en servidor y cliente.

import Link from "next/link";
import AvatarDeGamificacion from "./AvatarDeGamificacion";

export default function TarjetaDeAvatar({
  etapa,
  total,
  href,
}: {
  etapa: number;
  /** Etapas que hay (una por rango). */
  total: number;
  href?: string;
}) {
  const contenido = (
    <>
      <AvatarDeGamificacion etapa={etapa} tamano="lg" />
      <span className="text-[12px] font-bold text-brand-700">
        Etapa {etapa} de {total}
      </span>
    </>
  );
  const etiqueta = `Tu avatar, etapa ${etapa} de ${total}`;
  if (!href) {
    return (
      <div role="group" aria-label={etiqueta} className="flex shrink-0 flex-col items-center gap-1.5">
        {contenido}
      </div>
    );
  }
  return (
    <Link href={href} aria-label={`${etiqueta}. Ver más`} className="flex shrink-0 flex-col items-center gap-1.5">
      {contenido}
    </Link>
  );
}
