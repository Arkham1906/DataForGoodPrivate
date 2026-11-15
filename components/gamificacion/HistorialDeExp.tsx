"use client";

// Movimientos del historial de EXP (2026-11-14; lienzo aprobado el mismo día; SRS v1.3: RF-GAM-03, 07, 37 a 39;
// descuento por reporte, A1 de la propuesta v1.4). Va en /progreso/historial, debajo del encabezado.
// - Filtros: Todos, Aportes, Misiones, Bonos y, solo si la persona tiene alguno, Descuentos (decisión del 2026-11-14:
//   no mostrar de entrada algo negativo a quien no lo necesita). Cada filtro pide su primera página al servidor.
// - Agrupados por día (zona de la app) con la EXP del día completo. Cada fila se despliega con su cálculo, tomado de lo
//   que guardó el movimiento; nada se recalcula aquí.
// - Un descuento enlaza con su movimiento original y el original con su descuento, si los dos están en la lista: el
//   enlace abre el otro, lo resalta y le pasa el foco.
// - «Ver movimientos anteriores»: 20 más (cursor del servidor).
// Movimiento: el detalle entra con opacidad y 4 px (200 ms, curva de salida) y la flecha gira; con movimiento reducido,
// nada se mueve. Textos en TEXTOS.historialDeExp.

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base-path";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { NOMBRES_DE_ESTRELLAS, calificacionDesde } from "@/lib/aportes/calificacion";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
import { TEXTOS } from "@/lib/gamificacion/textos";
import type {
  FiltroDeMovimientos,
  MovimientoDeExp,
  PaginaDeMovimientos,
  TipoDeMovimiento,
} from "@/lib/gamificacion/historial-exp-tipos";

const T = TEXTOS.historialDeExp;
const nf = new Intl.NumberFormat("es-MX");

const CLAVE_DE_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_DE_CAMPANAS, year: "numeric", month: "2-digit", day: "2-digit" });
const DIA_LARGO = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, weekday: "long", day: "numeric", month: "short" });
const DIA_CON_ANIO = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, weekday: "long", day: "numeric", month: "short", year: "numeric" });
const FECHA_CORTA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, day: "numeric", month: "short" });
const FECHA_Y_HORA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const HORA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const sinPunto = (texto: string) => texto.replace(/\./g, "");
const fechaCorta = (iso: string) => sinPunto(FECHA_CORTA.format(new Date(iso)));
const fechaYHora = (iso: string) => sinPunto(FECHA_Y_HORA.format(new Date(iso)));
const claveDeDia = (fecha: Date) => CLAVE_DE_DIA.format(fecha);

function etiquetaDeDia(clave: string, ejemplo: string): string {
  const ahora = new Date();
  const ayer = new Date(ahora.getTime() - 86_400_000);
  const fecha = new Date(ejemplo);
  const mismoAnio = clave.slice(0, 4) === claveDeDia(ahora).slice(0, 4);
  const texto = sinPunto((mismoAnio ? DIA_LARGO : DIA_CON_ANIO).format(fecha)).replace(",", "");
  if (clave === claveDeDia(ahora)) return `${T.hoy} · ${texto}`;
  if (clave === claveDeDia(ayer)) return `${T.ayer} · ${texto}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const expConSigno = (exp: number) => `${exp < 0 ? "−" : "+"}${nf.format(Math.abs(exp))}`;

// Íconos de trazo (Lucide, ISC), como el resto de la gamificación.
const ICONOS: Record<TipoDeMovimiento, string> = {
  aporte: "M20 6 9 17l-5-5",
  mision: "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M6 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  bono: "M12 7v14 M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8 M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5 M4 7h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z",
  descuento: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5",
  ajuste: "M12 20h9 M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",
};
const COLORES: Record<TipoDeMovimiento, string> = {
  aporte: "bg-brand-50 text-brand-700",
  mision: "bg-success-50 text-success-800",
  bono: "bg-warning-100 text-warning-800",
  descuento: "bg-error-50 text-error-700",
  ajuste: "bg-system-100 text-system-700",
};

type Fila = { etiqueta: string; valor: string; fuerte?: boolean };
type Vista = {
  titulo: string;
  origen: string;
  filas: Fila[];
  nota: string | null;
  marca: string | null;
  /** Enlace a otra página (el detalle del aporte). */
  href: string | null;
  /** Enlace dentro de la lista (el original de un descuento o el descuento de un original). */
  salto: { id: string; texto: string } | null;
};

function vistaDe(m: MovimientoDeExp): Vista {
  const nombreTipo = m.tipoDeDato ? NOMBRE_DE_TIPO[m.tipoDeDato] : null;
  const campana = m.campana?.nombre ?? null;
  const hrefAporte = m.campana && m.aporte ? `/mis-aportes/${m.campana.id}/${m.aporte.id}` : null;

  if (m.tipo === "aporte") {
    const calificacion = calificacionDesde(m.calificacion);
    const filas: Fila[] = [];
    if (m.calculo) {
      const { base, multCalidad, factor, bonificacionPotenciador, multCampana } = m.calculo;
      const sinRedondear = Math.round(base * multCalidad * factor * 1000) / 1000;
      filas.push({ etiqueta: T.detalle.calculo, valor: T.calculoAporte(base, multCalidad, factor, sinRedondear, m.exp), fuerte: true });
      if (factor !== 1) filas.push({ etiqueta: T.detalle.factor, valor: T.factorAporte(bonificacionPotenciador, multCampana) });
    }
    if (m.aporte?.enviadoEn) filas.push({ etiqueta: T.detalle.enviado, valor: fechaYHora(m.aporte.enviadoEn) });
    return {
      titulo: calificacion ? T.tituloAporte(nombreTipo, calificacion, NOMBRES_DE_ESTRELLAS[calificacion]) : T.tituloAporteSinDatos,
      origen: campana ?? T.campanaBorrada,
      filas,
      nota: m.descontado ? T.notaDescontado(fechaCorta(m.descontado.en)) : null,
      marca: m.descontado ? T.marcaDescontado(fechaCorta(m.descontado.en)) : null,
      href: hrefAporte,
      salto: m.descontado ? { id: m.descontado.id, texto: T.verDescuento } : null,
    };
  }

  if (m.tipo === "mision") {
    const filas: Fila[] = [{ etiqueta: T.detalle.recompensa, valor: T.recompensaMision(m.exp), fuerte: true }];
    if (m.mision) filas.push({ etiqueta: T.detalle.periodo, valor: `${fechaYHora(m.mision.periodoInicio)} – ${fechaYHora(m.mision.periodoFin)}` });
    return {
      titulo: m.mision?.nombre ?? m.motivo ?? T.tipos.mision,
      origen: m.mision ? T.periodicidad(m.mision.periodicidad) : T.tipos.mision,
      filas,
      nota: T.notaMision,
      marca: null,
      href: null,
      salto: null,
    };
  }

  if (m.tipo === "bono") {
    const filas: Fila[] = [];
    if (m.bono && m.bono.porcentaje !== null) {
      const sinLimites = Math.round(((m.bono.expReferencia * m.bono.porcentaje) / 100) * 1000) / 1000;
      filas.push({ etiqueta: T.detalle.calculo, valor: T.calculoBono(m.bono.porcentaje, m.bono.expReferencia, sinLimites, m.exp), fuerte: true });
    }
    if (m.bono && m.bono.minimo !== null && m.bono.maximo !== null) {
      filas.push({ etiqueta: T.detalle.limites, valor: T.limitesBono(m.bono.minimo, m.bono.maximo) });
    }
    return {
      titulo: m.bono ? T.tituloBono(m.bono.cuota) : T.tituloBonoSinDatos,
      origen: campana ?? T.campanaBorrada,
      filas,
      nota: m.bono ? T.notaBono(m.bono.cuota) : m.motivo,
      marca: null,
      href: null,
      salto: null,
    };
  }

  if (m.tipo === "descuento") {
    return {
      titulo: T.tituloDescuento,
      origen: campana ?? T.campanaBorrada,
      filas: [
        { etiqueta: T.detalle.motivo, valor: T.motivoDescuento(nombreTipo, m.original ? fechaCorta(m.original.en) : null), fuerte: true },
        { etiqueta: T.detalle.devuelve, valor: T.devuelve(Math.abs(m.exp)) },
      ],
      nota: T.notaDescuento,
      marca: null,
      href: null,
      salto: m.original ? { id: m.original.id, texto: T.verOriginal } : null,
    };
  }

  return { titulo: T.tituloAjuste, origen: T.tipos.ajuste, filas: m.motivo ? [{ etiqueta: T.detalle.motivo, valor: m.motivo, fuerte: true }] : [], nota: null, marca: null, href: null, salto: null };
}

type Estado = {
  filtro: FiltroDeMovimientos;
  movimientos: MovimientoDeExp[];
  totales: Record<string, number>;
  cursor: string | null;
};

export default function HistorialDeExp({ inicial, hayDescuentos }: { inicial: PaginaDeMovimientos; hayDescuentos: boolean }) {
  const [estado, setEstado] = useState<Estado>({ filtro: "todos", movimientos: inicial.movimientos, totales: inicial.totalesPorDia, cursor: inicial.cursor });
  const [cargando, setCargando] = useState<"filtro" | "mas" | null>(null);
  const [error, setError] = useState<{ filtro: FiltroDeMovimientos; cursor: string | null } | null>(null);
  const [abiertos, setAbiertos] = useState<ReadonlySet<string>>(new Set());
  const [resaltado, setResaltado] = useState<string | null>(null);
  const pedido = useRef(0);

  const filtros: FiltroDeMovimientos[] = hayDescuentos ? ["todos", "aporte", "mision", "bono", "descuento"] : ["todos", "aporte", "mision", "bono"];

  const pedir = useCallback(async (filtro: FiltroDeMovimientos, cursor: string | null) => {
    const numero = ++pedido.current;
    setCargando(cursor ? "mas" : "filtro");
    setError(null);
    try {
      const params = new URLSearchParams({ filtro });
      if (cursor) params.set("cursor", cursor);
      const respuesta = await fetch(`${BASE_PATH}/api/progreso/historial-exp?${params}`, { cache: "no-store" });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      const pagina = (await respuesta.json()) as PaginaDeMovimientos;
      if (numero !== pedido.current) return; // Llegó tarde: ya se pidió otro filtro.
      setEstado((anterior) =>
        cursor
          ? { filtro, movimientos: [...anterior.movimientos, ...pagina.movimientos], totales: { ...anterior.totales, ...pagina.totalesPorDia }, cursor: pagina.cursor }
          : { filtro, movimientos: pagina.movimientos, totales: pagina.totalesPorDia, cursor: pagina.cursor },
      );
      if (!cursor) setAbiertos(new Set());
    } catch {
      if (numero === pedido.current) setError({ filtro, cursor });
    } finally {
      if (numero === pedido.current) setCargando(null);
    }
  }, []);

  const elegirFiltro = (filtro: FiltroDeMovimientos) => {
    if (filtro === estado.filtro && !error) return;
    setResaltado(null);
    setEstado((anterior) => ({ ...anterior, filtro }));
    void pedir(filtro, null);
  };

  const alternar = (id: string) => {
    setResaltado(null);
    setAbiertos((anterior) => {
      const nuevo = new Set(anterior);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const presentes = useMemo(() => new Set(estado.movimientos.map((m) => m.id)), [estado.movimientos]);

  const saltarA = (id: string) => {
    setAbiertos((anterior) => new Set(anterior).add(id));
    setResaltado(id);
    requestAnimationFrame(() => {
      const boton = document.getElementById(`historial-mov-${id}`);
      if (!boton) return;
      const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      boton.scrollIntoView({ block: "center", behavior: reducido ? "auto" : "smooth" });
      boton.focus({ preventScroll: true });
    });
  };

  const dias = useMemo(() => {
    const lista: { clave: string; etiqueta: string; movimientos: MovimientoDeExp[] }[] = [];
    for (const m of estado.movimientos) {
      const clave = claveDeDia(new Date(m.creadoEn));
      const ultimo = lista[lista.length - 1];
      if (ultimo && ultimo.clave === clave) ultimo.movimientos.push(m);
      else lista.push({ clave, etiqueta: etiquetaDeDia(clave, m.creadoEn), movimientos: [m] });
    }
    return lista;
  }, [estado.movimientos]);

  const cambiandoFiltro = cargando === "filtro";

  return (
    <section aria-labelledby="historial-movs" className="flex min-w-0 flex-col gap-3 rounded-lg border border-system-200 bg-white p-5 max-md:p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="historial-movs" className="text-xl font-extrabold text-system-900 max-md:px-1 max-md:text-lg">
          {T.movimientos}
        </h2>
        <div role="group" aria-label={T.filtrosEtiqueta} className="flex gap-1.5 overflow-x-auto max-md:-mx-1 max-md:w-full max-md:px-1 max-md:pb-1">
          {filtros.map((f) => {
            const activo = estado.filtro === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={activo}
                onClick={() => elegirFiltro(f)}
                className={`min-h-10 shrink-0 rounded-pill border px-3.5 text-[13px] font-bold transition-[transform,background-color] duration-150 ease-salida active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none motion-reduce:active:scale-100 md:min-h-9 ${
                  activo ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-700 hover:bg-system-50"
                }`}
              >
                {T.filtros[f]}
              </button>
            );
          })}
        </div>
      </div>

      <div aria-live="polite" aria-busy={cargando !== null} className={`flex flex-col transition-opacity duration-150 ${cambiandoFiltro ? "opacity-60" : ""}`}>
        {cambiandoFiltro && <span className="sr-only">{T.cargando}</span>}

        {estado.movimientos.length === 0 && !cambiandoFiltro && !error && (
          <p className="my-2 rounded-lg border border-dashed border-system-300 px-4 py-6 text-center text-[13.5px] text-system-600">{T.vacioFiltro}</p>
        )}

        {dias.map((dia) => {
          const total = estado.totales[dia.clave] ?? dia.movimientos.reduce((s, m) => s + m.exp, 0);
          return (
            <section key={dia.clave} aria-labelledby={`historial-dia-${dia.clave}`} className="flex flex-col">
              <h3 id={`historial-dia-${dia.clave}`} className="mt-2 mb-1 flex justify-between gap-3 px-2 text-[13px] font-extrabold text-system-700 max-md:px-1">
                <span>{dia.etiqueta}</span>
                <span className={`font-mono font-bold ${total < 0 ? "text-error-700" : "text-success-800"}`}>
                  <span aria-hidden="true">{expConSigno(total)} EXP</span>
                  <span className="sr-only">{T.totalDelDiaAria(total)}</span>
                </span>
              </h3>
              <ul>
                {dia.movimientos.map((m) => (
                  <FilaDeMovimiento
                    key={m.id}
                    m={m}
                    abierto={abiertos.has(m.id)}
                    resaltado={resaltado === m.id}
                    alternar={() => alternar(m.id)}
                    saltarA={(id) => (presentes.has(id) ? saltarA(id) : undefined)}
                    puedeSaltar={(id) => presentes.has(id)}
                  />
                ))}
              </ul>
            </section>
          );
        })}

        {error && (
          <div role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-error-50 px-4 py-3 text-[13.5px] text-error-800">
            <span>{T.errorPagina}</span>
            <button
              type="button"
              onClick={() => void pedir(error.filtro, error.cursor)}
              className="min-h-11 rounded-pill border border-error-300 bg-white px-4 text-[13px] font-bold text-error-800 hover:bg-error-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {T.reintentar}
            </button>
          </div>
        )}

        {estado.cursor && !error && !cambiandoFiltro && (
          <button
            type="button"
            onClick={() => void pedir(estado.filtro, estado.cursor)}
            disabled={cargando === "mas"}
            className="mt-3 min-h-11 self-center rounded-pill border border-system-300 bg-white px-5 text-sm font-bold text-system-900 transition-transform duration-150 ease-salida hover:bg-system-50 active:scale-[0.97] disabled:cursor-wait disabled:bg-system-100 disabled:text-system-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none motion-reduce:active:scale-100 max-md:w-full"
          >
            {cargando === "mas" ? T.cargando : T.verAnteriores}
          </button>
        )}
        {!estado.cursor && estado.movimientos.length > 0 && !cambiandoFiltro && (
          <p className="mt-3 text-center text-[12.5px] text-system-500">{estado.filtro === "todos" ? T.primerMovimiento : T.finDelFiltro}</p>
        )}
      </div>

      <p className="border-t border-system-100 pt-3 text-[12.5px] text-system-600 max-md:px-1">{T.pie}</p>
    </section>
  );
}

function FilaDeMovimiento({
  m,
  abierto,
  resaltado,
  alternar,
  saltarA,
  puedeSaltar,
}: {
  m: MovimientoDeExp;
  abierto: boolean;
  resaltado: boolean;
  alternar: () => void;
  saltarA: (id: string) => void;
  puedeSaltar: (id: string) => boolean;
}) {
  const v = vistaDe(m);
  const negativo = m.exp < 0;
  const idDetalle = `historial-det-${m.id}`;
  return (
    <li className={`rounded-lg border-t border-system-100 transition-colors duration-200 ${resaltado ? "bg-brand-50" : ""}`}>
      <button
        id={`historial-mov-${m.id}`}
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-controls={idDetalle}
        className="grid min-h-14 w-full grid-cols-[40px_minmax(0,1fr)_auto_18px] items-center gap-3.5 rounded-lg px-2 py-3 text-left hover:bg-system-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 max-md:grid-cols-[36px_minmax(0,1fr)_auto] max-md:gap-2.5 max-md:px-1"
      >
        <span aria-hidden="true" className={`inline-flex h-10 w-10 items-center justify-center rounded-[12px] max-md:h-9 max-md:w-9 ${COLORES[m.tipo]}`}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONOS[m.tipo]} />
          </svg>
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[14.5px] font-bold text-system-900 max-md:text-sm">{v.titulo}</span>
          <span className="truncate text-[12.5px] text-system-600 max-md:text-xs">
            {/* En teléfono la hora va primero: un nombre de campaña largo la cortaba. */}
            <span className="md:hidden">{HORA.format(new Date(m.creadoEn))} · </span>
            <span className="max-md:hidden">{T.tipos[m.tipo]} · </span>
            {v.origen}
            <span className="max-md:hidden"> · {HORA.format(new Date(m.creadoEn))}</span>
          </span>
          {v.marca && (
            <span className="self-start rounded-[6px] bg-error-50 px-2 text-[11.5px] font-bold text-error-800">{v.marca}</span>
          )}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 font-mono text-[13px] leading-none font-bold tabular-nums ${
            negativo ? "bg-error-50 text-error-700" : "bg-success-50 text-success-700"
          }`}
        >
          <span aria-hidden="true">{expConSigno(m.exp)} EXP</span>
          <span className="sr-only">{T.expAria(m.exp)}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-system-500 transition-transform duration-200 ease-salida motion-reduce:transition-none max-md:hidden ${abierto ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {abierto && (
        <div id={idDetalle} className="historial-detalle mx-2 mb-3 ml-[62px] flex flex-col gap-2.5 rounded-lg border border-system-100 bg-system-50 px-3.5 py-3 max-md:mx-1 max-md:ml-1">
          {v.filas.length > 0 && (
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13.5px] max-md:grid-cols-1 max-md:gap-y-0.5 max-md:text-[13px]">
              {v.filas.map((f) => (
                <div key={f.etiqueta} className="contents">
                  <dt className="text-system-600 max-md:mt-1.5 max-md:text-xs">{f.etiqueta}</dt>
                  <dd className={f.fuerte ? "font-bold text-system-900" : "text-system-800"}>{f.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {v.nota && <p className="text-[13px] text-system-700">{v.nota}</p>}
          {(v.href || (v.salto && puedeSaltar(v.salto.id))) && (
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {v.salto && puedeSaltar(v.salto.id) && (
                <button
                  type="button"
                  onClick={() => saltarA(v.salto!.id)}
                  className="inline-flex min-h-11 items-center text-[13.5px] font-bold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:min-h-0"
                >
                  {v.salto.texto} →
                </button>
              )}
              {v.href && (
                <Link
                  href={v.href}
                  className="inline-flex min-h-11 items-center text-[13.5px] font-bold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:min-h-0"
                >
                  {T.verAporte} →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
