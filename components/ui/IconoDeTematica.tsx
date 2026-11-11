// Ícono de línea de una temática (2026-11-11), para los mosaicos de "Elige tus temáticas"
// (ui/SelectorDeTemas). Dibujos propios, uno por cada temática base de lib/intereses.ts
// (TEMAS_DE_INTERES), buscados por claveDeTematica(); las demás (propuestas o nuevas del
// catálogo) llevan el genérico. Si se agrega una temática base, agregar aquí su dibujo.
// Toma currentColor; es decorativo (aria-hidden): el nombre va como texto junto al ícono.

import type { ReactNode } from "react";
import { claveDeTematica } from "@/lib/tematicas/analizar";

const ESCUDO = "M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6L12 3Z";

const DIBUJOS: Record<string, ReactNode> = {
  "medio ambiente": (
    <>
      <path d="M5 19c0-8.3 5.7-14 14-14 0 8.3-5.7 14-14 14Z" />
      <path d="M5 19 13 11" />
    </>
  ),
  salud: (
    <>
      <path d="M12 20s-7-4.4-8.6-9A4.6 4.6 0 0 1 12 6.2 4.6 4.6 0 0 1 20.6 11C19 15.6 12 20 12 20Z" />
      <path d="M6.5 12h3l1.5-2.5 2 5 1.5-2.5h3" />
    </>
  ),
  educacion: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5Z" />
      <path d="M6.5 11.5V16c1.5 1.3 3.4 2 5.5 2s4-.7 5.5-2v-4.5" />
      <path d="M21.5 9.5V15" />
    </>
  ),
  infraestructura: (
    <>
      <path d="M2 16h20M2 19.5h20" />
      <path d="M4 16v-3a8 8 0 0 1 16 0v3" />
      <path d="M8 16v-4.5M12 16v-6M16 16v-4.5" />
    </>
  ),
  "proteccion animal": (
    <>
      <path d={ESCUDO} />
      <circle cx="9.5" cy="10" r="1" />
      <circle cx="14.5" cy="10" r="1" />
      <path d="M9.5 15c0-1.5 1.1-2.5 2.5-2.5s2.5 1 2.5 2.5c0 .8-.7 1.2-1.3 1-.4-.1-.8-.2-1.2-.2s-.8.1-1.2.2c-.6.2-1.3-.2-1.3-1Z" />
    </>
  ),
  animales: (
    <>
      <circle cx="6.5" cy="10" r="1.7" />
      <circle cx="10" cy="6.3" r="1.7" />
      <circle cx="14" cy="6.3" r="1.7" />
      <circle cx="17.5" cy="10" r="1.7" />
      <path d="M7.5 17.5c0-2.8 2-5.3 4.5-5.3s4.5 2.5 4.5 5.3c0 1.6-1.4 2.4-2.6 2-.6-.2-1.2-.4-1.9-.4s-1.3.2-1.9.4c-1.2.4-2.6-.4-2.6-2Z" />
    </>
  ),
  movilidad: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16 9.5 9h6L18 16" />
      <path d="M9.5 9 12 16H6" />
      <path d="M8.5 6.5H11M15.5 9l-1-2.5h2" />
    </>
  ),
  "arte y cultura": (
    <>
      <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.7-.9 1.4-1.9-.4-1.2.4-2.1 1.6-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="15" cy="7.5" r="1" />
    </>
  ),
  entretenimiento: (
    <>
      <path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z" />
      <path d="M15 5v2M15 11v2M15 17v2" />
    </>
  ),
  "agua y saneamiento": (
    <>
      <path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11Z" />
      <path d="M9 15a3 3 0 0 0 3 3" />
    </>
  ),
  "calidad del aire": (
    <>
      <path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 12h15a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 16h7a2 2 0 1 1-2 2" />
    </>
  ),
  "residuos y reciclaje": (
    <>
      <path d="M4 7h16M9 7V4.5h6V7" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  biodiversidad: (
    <>
      <path d="M12 7v13" />
      <path d="M12 10C10 6 5 4 4 6.5S5.5 12 12 12" />
      <path d="M12 10c2-4 7-6 8-3.5S18.5 12 12 12" />
      <path d="M12 12c-4 0-6.5 2-5.5 4s3.5 2 5.5-1" />
      <path d="M12 12c4 0 6.5 2 5.5 4s-3.5 2-5.5-1" />
      <path d="M10.5 4.5 12 7l1.5-2.5" />
    </>
  ),
  "plantas y jardineria": (
    <>
      <path d="M7 14h10l-1.2 6H8.2L7 14Z" />
      <path d="M12 14V9" />
      <path d="M12 9c0-2.5-2-4.5-5-4.5 0 2.5 2 4.5 5 4.5Z" />
      <path d="M12 11c0-2.5 2-4.5 5-4.5 0 2.5-2 4.5-5 4.5Z" />
    </>
  ),
  "espacios publicos": (
    <>
      <path d="M4 6.5h16v3.5H4z" />
      <path d="M3 13.5h18" />
      <path d="M6 10v3.5M18 10v3.5M5 13.5V19M19 13.5V19" />
    </>
  ),
  seguridad: (
    <>
      <path d={ESCUDO} />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  "proteccion civil": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m6 6 3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5" />
    </>
  ),
  "accesibilidad e inclusion": (
    <>
      <circle cx="12" cy="4.5" r="1.5" />
      <path d="M5 8.5c2.3.7 4.6 1 7 1s4.7-.3 7-1" />
      <path d="M12 9.5V14" />
      <path d="m8.5 20 3.5-6 3.5 6" />
    </>
  ),
  "igualdad de genero": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 10h8M8 14h8" />
    </>
  ),
  "derechos humanos": (
    <>
      <path d="M12 4v16M8 20h8M5 7h14" />
      <path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 6a2.5 2.5 0 0 0 5 0L19 7Z" />
    </>
  ),
  "gobierno y participacion ciudadana": (
    <>
      <path d="M3 9.5 12 4l9 5.5H3Z" />
      <path d="M5 9.5v8M9.7 9.5v8M14.3 9.5v8M19 9.5v8" />
      <path d="M3 20h18" />
    </>
  ),
  vivienda: (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  agricultura: (
    <>
      <path d="M12 21V9" />
      <path d="M12 9c-1.7-.8-2.5-2.3-2.5-4.5 1.7.8 2.5 2.3 2.5 4.5Zm0 0c1.7-.8 2.5-2.3 2.5-4.5-1.7.8-2.5 2.3-2.5 4.5Z" />
      <path d="M12 13c-2-.6-3.3-2-3.5-4 2 .6 3.3 2 3.5 4Zm0 0c2-.6 3.3-2 3.5-4-2 .6-3.3 2-3.5 4Z" />
      <path d="M12 17c-2-.6-3.3-2-3.5-4 2 .6 3.3 2 3.5 4Zm0 0c2-.6 3.3-2 3.5-4-2 .6-3.3 2-3.5 4Z" />
    </>
  ),
  "cocina y alimentacion": (
    <>
      <path d="M7 3v18" />
      <path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3" />
      <path d="M17 21V3c-2 1-3 3.5-3 7 0 1.5.8 2.5 3 2.5" />
    </>
  ),
  "trabajo y economia": (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M3 12.5h18" />
    </>
  ),
  tecnologia: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 10h4v4h-4z" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </>
  ),
  deporte: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5 15.5 10l-1.3 4H9.8L8.5 10 12 7.5Z" />
      <path d="M12 3.5v4M15.5 10l4.5-1.5M14.2 14l2.6 3.5M9.8 14l-2.6 3.5M8.5 10 4 8.5" />
    </>
  ),
  "aire libre": (
    <>
      <path d="m2.5 19 6.5-10 4 6 2.5-3.5 6 7.5H2.5Z" />
      <circle cx="17" cy="6" r="2" />
    </>
  ),
  // No es base: propuesta y aprobada (la única aprobada al 2026-11-11).
  videojuegos: (
    <>
      <path d="M7 8h10a4 4 0 0 1 4 4v1.5a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.3A3 3 0 0 1 3 13.5V12a4 4 0 0 1 4-4Z" />
      <path d="M7.5 10.5v3M6 12h3" />
      <circle cx="15.5" cy="11" r=".6" />
      <circle cx="17" cy="12.8" r=".6" />
    </>
  ),
};

// Etiqueta: para las temáticas sin dibujo propio.
const GENERICO = (
  <>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7Z" />
    <circle cx="8" cy="8" r="1.3" />
  </>
);

export default function IconoDeTematica({ tematica, className = "" }: { tematica: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {DIBUJOS[claveDeTematica(tematica)] ?? GENERICO}
    </svg>
  );
}
