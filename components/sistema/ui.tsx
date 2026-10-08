// Utilidades de presentación del panel (formato de números, piezas pequeñas).

import Link from "next/link";
import type { ReactNode } from "react";

import ProgressBar from "@/components/sistema/ProgressBar";

const nf = new Intl.NumberFormat("es-MX");

export function formatearNumero(n: number): string {
  return nf.format(n);
}

const CLASES_ENLACE_BOTON =
  "inline-flex items-center justify-center gap-1.5 rounded-pill border border-system-300 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-system-900 transition-colors hover:border-system-400 hover:bg-system-100";

/** Link con la misma apariencia de botón secundario que ya usa `/sistema`. */
export function EnlaceBoton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={CLASES_ENLACE_BOTON}>
      {children}
    </Link>
  );
}

/* ── encabezado ─────────────────────────────────────────────────────────── */

export function Encabezado({
  titulo,
  subtitulo,
  subtituloMono = false,
  acciones,
}: {
  titulo: string;
  subtitulo?: string;
  subtituloMono?: boolean;
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-system-900">{titulo}</h1>
        {subtitulo ? (
          <p className={`mt-1 text-[13px] text-system-600 ${subtituloMono ? "font-mono" : ""}`}>
            {subtitulo}
          </p>
        ) : null}
      </div>
      {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
    </header>
  );
}

export function TituloDeSeccion({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[12.5px] font-semibold text-system-900">{children}</p>;
}

/** Link de retorno, mismo estilo en toda la sección /usuarios. */
export function Volver({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mb-5 inline-block text-[13px] text-system-600 hover:text-brand-600">
      ← {children}
    </Link>
  );
}

/* ── aviso ──────────────────────────────────────────────────────────────── */

export type TonoDeAviso = "neutro" | "info" | "aviso" | "riesgo";

const CLASES_AVISO: Record<TonoDeAviso, string> = {
  neutro: "bg-system-100 text-system-600",
  info: "border-l-4 border-brand-600 bg-system-100 text-system-600",
  aviso: "bg-warning-50 text-warning-800",
  riesgo: "bg-error-50 text-error-700",
};

export function Aviso({
  tono = "neutro",
  titulo,
  children,
  className = "",
}: {
  tono?: TonoDeAviso;
  titulo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg p-4 text-[12.5px] leading-relaxed ${CLASES_AVISO[tono]} ${className}`}>
      {titulo ? <p className="mb-1 font-bold">{titulo}</p> : null}
      <p>{children}</p>
    </div>
  );
}

/* ── reparto en barras ──────────────────────────────────────────────────── */

export type FilaDeReparto = {
  etiqueta: string;
  valor: number;
  /** Texto a la derecha. Si se omite se formatea el valor. */
  display?: string;
};

export function Reparto({
  filas,
  anchoEtiqueta = 120,
  anchoValor = 44,
  /** Base del 100% de la barra. Por defecto, el valor mayor de la lista. */
  maximo,
}: {
  filas: FilaDeReparto[];
  anchoEtiqueta?: number;
  anchoValor?: number;
  maximo?: number;
}) {
  const tope = maximo ?? Math.max(...filas.map((f) => f.valor), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {filas.map((f) => (
        <div className="flex items-center gap-2.5 text-[12.5px]" key={f.etiqueta}>
          <span className="shrink-0 text-system-600" style={{ width: anchoEtiqueta }}>
            {f.etiqueta}
          </span>
          <ProgressBar pct={(f.valor / tope) * 100} tone="ok" />
          <span
            className="shrink-0 text-right font-mono tabular-nums"
            style={{ width: anchoValor }}
          >
            {f.display ?? formatearNumero(f.valor)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── lista clave / valor ────────────────────────────────────────────────── */

export function ListaClaveValor({
  filas,
}: {
  filas: { clave: ReactNode; valor: ReactNode }[];
}) {
  return (
    <div className="divide-y divide-system-200">
      {filas.map((f, i) => (
        <div className="flex items-center justify-between gap-3.5 py-2.5 text-[13.5px]" key={i}>
          <span>{f.clave}</span>
          <span className="font-mono tabular-nums">{f.valor}</span>
        </div>
      ))}
    </div>
  );
}

/* ── tarjeta ────────────────────────────────────────────────────────────── */

export function Tarjeta({
  children,
  tenue = false,
  className = "",
}: {
  children: ReactNode;
  /** Fondo hundido, para bloques de contexto secundario. */
  tenue?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tenue ? "border-system-200 bg-system-100" : "border-system-200 bg-white shadow-sm"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ── identidad ──────────────────────────────────────────────────────────── */

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function Identidad({
  nombre,
  detalle,
  riesgo = false,
}: {
  nombre: string;
  detalle: string;
  /** Avatar en rojo: la cuenta está baneada. */
  riesgo?: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <span
        aria-hidden="true"
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white ${
          riesgo ? "bg-error-700" : "bg-brand-600"
        }`}
      >
        {iniciales(nombre)}
      </span>
      <div>
        <h1 className="text-base font-extrabold text-system-900">{nombre}</h1>
        <p className="mt-0.5 font-mono text-[13px] text-system-600">{detalle}</p>
      </div>
    </div>
  );
}

/* ── medidor de strikes ─────────────────────────────────────────────────── */

export function MedidorDeStrikes({
  acumulados,
  limite = 3,
}: {
  acumulados: number;
  limite?: number;
}) {
  const critico = acumulados >= limite;

  return (
    <div
      role="img"
      aria-label={`${acumulados} de ${limite} strikes acumulados`}
      className="mb-2 flex items-center gap-1.5"
    >
      {Array.from({ length: limite }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${
            i < acumulados ? (critico ? "bg-error-700" : "bg-warning-500") : "bg-system-300"
          }`}
        />
      ))}
    </div>
  );
}

/* ── paginación ─────────────────────────────────────────────────────────── */

export function Paginacion({
  desde,
  hasta,
  total,
  pagina,
  paginas,
  href,
}: {
  desde: number;
  hasta: number;
  total: number;
  pagina: number;
  paginas: number;
  /** Construye el enlace de cada página. */
  href: (pagina: number) => string;
}) {
  const visibles = Array.from({ length: Math.min(paginas, 5) }, (_, i) => i + 1);

  return (
    <nav
      aria-label="Paginación"
      className="mt-5 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="font-mono text-[12.5px] text-system-400">
        {formatearNumero(desde)}–{formatearNumero(hasta)} de {formatearNumero(total)}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {pagina > 1 ? (
          <Link href={href(pagina - 1)} rel="prev" className={CLASES_ENLACE_BOTON}>
            <span aria-hidden="true">←</span>
            <span className="sr-only">Página anterior</span>
          </Link>
        ) : null}

        {visibles.map((p) =>
          p === pagina ? (
            <span
              key={p}
              aria-current="page"
              className="inline-flex items-center justify-center rounded-pill border border-brand-600 bg-brand-600 px-3.5 py-1.5 text-[12.5px] font-bold text-white"
            >
              {p}
            </span>
          ) : (
            <Link key={p} href={href(p)} className={CLASES_ENLACE_BOTON}>
              {p}
            </Link>
          ),
        )}

        {pagina < paginas ? (
          <Link href={href(pagina + 1)} rel="next" className={CLASES_ENLACE_BOTON}>
            <span aria-hidden="true">→</span>
            <span className="sr-only">Página siguiente</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/* ── pie de pantalla ────────────────────────────────────────────────────── */

export function PieDePantalla({
  volver,
  acciones,
}: {
  volver: { texto: string; href: string };
  acciones?: ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-system-200 pt-4">
      <EnlaceBoton href={volver.href}>← {volver.texto}</EnlaceBoton>
      {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
    </div>
  );
}
