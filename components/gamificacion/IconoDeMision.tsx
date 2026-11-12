// Icono de una misión (tabla 4.5). Completada: la palomita, como en el diseño v10. Sin icono propio: el
// trazo de prueba que se reciba en `respaldo`.

import { iconoDeMision } from "@/lib/gamificacion/recursos";

const PALOMITA = "M20 6L9 17l-5-5";

export default function IconoDeMision({
  clave,
  completada = false,
  tamano = 44,
  respaldo,
}: {
  clave: string;
  completada?: boolean;
  tamano?: 28 | 40 | 44;
  respaldo?: string;
}) {
  const src = iconoDeMision(clave);
  const caja = { width: tamano, height: tamano };

  if (completada || !src) {
    return (
      <span
        aria-hidden="true"
        style={caja}
        className={`flex shrink-0 items-center justify-center rounded-lg ${completada ? "bg-success-50 text-success-800" : "bg-system-100 text-system-700"}`}
      >
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d={completada ? PALOMITA : (respaldo ?? PALOMITA)} />
        </svg>
      </span>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- WebP ya optimizado en public/
  return <img src={src} alt="" width={tamano} height={tamano} style={caja} className="shrink-0" />;
}