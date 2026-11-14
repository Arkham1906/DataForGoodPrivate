"use client";

// «Tu mapa de aportes» de /mis-aportes (2026-11-13; SRS v1.3: RF-GAM-15, 87, 88; diseño V10 y acercamiento por temática
// aprobado el 2026-11-13, lienzo «Mapa de aportes: acercamiento por temática»).
// - Vista general: «Tú» al centro, tus temáticas, tus campañas y un punto por aporte.
// - Acercamiento: al elegir una temática (o una campaña desde la vista general) la temática viaja al centro, sus
//   subtemáticas salen de ella y cada campaña viaja a su subtemática principal. Migas «Todas las temáticas › …» y
//   Escape regresan un nivel a la vez (aporte → campaña → subtemática → temática → general).
// - Panel: lo más reciente, una temática (sus subtemáticas), una subtemática (sus campañas), una campaña (meta
//   colectiva y tu parte, RF-GAM-88; sus otras subtemáticas) o un aporte (calificación, EXP y su cálculo, RF-GAM-15).
// - Teléfono (< md): sin grafo; el panel lista temáticas y, dentro de una, las campañas agrupadas por subtemática.
// Movimiento (coreografía del lienzo): todo es transform y opacity con TRANSICIONES (no keyframes) para que un clic a
// media animación retome desde donde va. Lo que sale se va primero y rápido; la temática viaja en 440 ms; las campañas
// en 560 ms escalonadas 30 ms; las subtemáticas brotan del centro escalonadas 45 ms; las líneas se trazan al final
// (nunca se estiran tras un nodo). Con movimiento reducido (globals.css) solo hay fundidos de 160 ms.
// Etiquetas sin líneas encima (2026-11-13): la geometría elige el lado y la distancia de cada etiqueta contra todas las
// líneas de la vista; además cada etiqueta lleva fondo opaco y va sobre las líneas, así que ninguna puede verse encima
// de un texto. Atenuar no vuelve translúcida la etiqueta (dejaría ver la línea de atrás): baja el nodo y aclara el
// texto. Cuando las etiquetas cambian de lado (al acercarse, al regresar o al cambiar los datos), se ocultan mientras
// los nodos viajan y reaparecen en su lado nuevo, sin saltos.
// En vivo: cuando cambian aportes o campañas (lib/en-vivo-postgres.ts), la página se vuelve a pedir al servidor como
// mucho una vez cada RECARGA_MINIMA_MS; los nodos viajan con sus transiciones a la nueva disposición y la selección se
// conserva. Lo probó scripts/estres-mapa-de-aportes.mjs.
// Geometría: lib/gamificacion/mapa-de-aportes-geometria.ts. Textos: lib/gamificacion/textos.ts.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EstrellasDeCalificacion from "@/components/aportes/EstrellasDeCalificacion";
import ExpDelAporte from "@/components/gamificacion/ExpDelAporte";
import ButtonLink from "@/components/ui/ButtonLink";
import { NOMBRES_DE_ESTRELLAS } from "@/lib/aportes/calificacion";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import {
  ALTO_DEL_MAPA,
  ANCHO_DEL_MAPA,
  DIAGONAL,
  ESCALA_ACERCADA,
  ESCALA_DEL_CENTRO,
  RADIO_DE_SUBTEMATICA,
  RADIO_DE_TEMATICA,
  SEPARACION_DE_ETIQUETA,
  CLAVE_OTRAS,
  CLAVE_SIN_SUBTEMATICA,
  alejada,
  armarGeometria,
  geometriaDeIntereses,
  grupoDe,
  segmento,
  type GeometriaDelMapa,
  type GrupoDePunto,
  type LadoDeEtiqueta,
  type NodoDeSubtematica,
  type Posicion,
  type Segmento,
} from "@/lib/gamificacion/mapa-de-aportes-geometria";
import type { AporteEnElMapa, CampanaEnElMapa, DatosDelMapaDeAportes } from "@/lib/gamificacion/mapa-de-aportes-tipos";
import { TEXTOS } from "@/lib/gamificacion/textos";

const T = TEXTOS.mapaDeAportes;

type Filtro = "todos" | "excepcionales" | "altos" | "enRevision";
type Seleccion = { tematica: string | null; sub: string | null; campana: number | null; aporte: number | null };
const NADA: Seleccion = { tematica: null, sub: null, campana: null, aporte: null };

const RECIENTES = 5;
/** Aportes que lista el panel de una campaña o de un filtro; el resto se ve en la lista de abajo o en la campaña. */
const EN_EL_PANEL = 8;
const CENTRO: Posicion = { x: ANCHO_DEL_MAPA / 2, y: ALTO_DEL_MAPA / 2 };
/** Entre dos recargas en vivo del mapa: con muchos avisos seguidos, una sola recarga al final de cada ventana. */
const RECARGA_MINIMA_MS = 2000;

/** Vuelve a pedir la página al servidor cuando llega un aviso en vivo, como mucho una vez cada RECARGA_MINIMA_MS. */
function useMapaEnVivo() {
  const router = useRouter();
  const vuelta = useRecargaEnVivo();
  const ultima = useRef(0);
  const programada = useRef<number | null>(null);
  useEffect(() => {
    if (vuelta === 0 || programada.current !== null) return;
    const espera = Math.max(0, ultima.current + RECARGA_MINIMA_MS - Date.now());
    programada.current = window.setTimeout(() => {
      programada.current = null;
      ultima.current = Date.now();
      router.refresh();
    }, espera);
  }, [vuelta, router]);
  useEffect(
    () => () => {
      if (programada.current !== null) window.clearTimeout(programada.current);
    },
    [],
  );
}

function coincide(filtro: Filtro, aporte: AporteEnElMapa): boolean {
  if (filtro === "todos") return true;
  if (filtro === "enRevision") return aporte.estado === "pendiente";
  if (aporte.estado !== "aceptado") return false;
  return filtro === "excepcionales" ? aporte.calificacion === 5 : (aporte.calificacion ?? 0) >= 4;
}

function nombreDeSub(nodo: Pick<NodoDeSubtematica, "nombre">): string {
  if (nodo.nombre === CLAVE_OTRAS) return T.subtematicaOtras;
  if (nodo.nombre === CLAVE_SIN_SUBTEMATICA) return T.subtematicaSin;
  return nodo.nombre;
}

// Fecha corta en hora de Tepic, armada a mano para que servidor y navegador escriban lo mismo (hidratación).
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const PARTES = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_DE_CAMPANAS,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function fechaCorta(iso: string, conHora = false): string {
  const partes = Object.fromEntries(PARTES.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const dia = `${Number(partes.day)} ${MESES[Number(partes.month) - 1]}`;
  return conHora ? `${dia}, ${partes.hour}:${partes.minute}` : dia;
}

const decimal = (v: number) => (Math.round(v * 100) / 100).toString().replace(".", ",");

// --- Movimiento ---------------------------------------------------------------------------------------------------

const IO = "cubic-bezier(0.77, 0, 0.175, 1)"; // movimiento en pantalla (--ease-movimiento)
const OUT = "cubic-bezier(0.23, 1, 0.32, 1)"; // entradas y salidas (--ease-salida)

/** [propiedad, duración, curva, retraso] → valor de `transition`. */
function tr(...partes: [string, number, string, number][]): string {
  return partes.map(([p, d, c, r]) => `${p} ${d}ms ${c} ${r}ms`).join(", ");
}

function mover(p: Posicion, escala = 1): string {
  return `translate(${p.x}px, ${p.y}px) scale(${escala})`;
}

/** Estilo de un nodo que se mueve; `mapa-mov` lo reduce a fundidos con movimiento reducido (globals.css). */
function estiloDeNodo(transform: string, opacity: number, transition: string, visible: boolean, z = 1): CSSProperties {
  return { transform, opacity, transition, pointerEvents: visible ? "auto" : "none", zIndex: z };
}

// --- Etiquetas ----------------------------------------------------------------------------------------------------

/**
 * Coloca una etiqueta del lado elegido por la geometría (cajaDeEtiqueta usa las mismas cuentas): a `separacion` px del
 * centro del nodo, más `dx` en horizontal para no salirse del lienzo.
 */
function posicionDeEtiqueta(lado: LadoDeEtiqueta, separacion: number, dx = 0): CSSProperties {
  const d = separacion * DIAGONAL;
  switch (lado) {
    case "abajo":
      return { left: 0, top: separacion, transform: `translate(calc(-50% + ${dx}px), 0)` };
    case "arriba":
      return { left: 0, top: -separacion, transform: `translate(calc(-50% + ${dx}px), -100%)` };
    case "derecha":
      return { left: separacion, top: 0, transform: "translate(0, -50%)" };
    case "izquierda":
      return { left: -separacion, top: 0, transform: "translate(-100%, -50%)" };
    case "abajo-derecha":
      return { left: d, top: d, transform: "none" };
    case "abajo-izquierda":
      return { left: -d, top: d, transform: "translate(-100%, 0)" };
    case "arriba-derecha":
      return { left: d, top: -d, transform: "translate(0, -100%)" };
    case "arriba-izquierda":
      return { left: -d, top: -d, transform: "translate(-100%, -100%)" };
  }
}

/** Fondo opaco de toda etiqueta: tapa cualquier línea que pase por detrás (red de seguridad de la geometría). */
const FONDO_DE_ETIQUETA = "pointer-events-none absolute rounded-[5px] bg-white px-1 py-px whitespace-nowrap";

/** Se ocultan mientras viajan los nodos si cambian de lado; reaparecen al llegar. */
function visibilidadDeEtiqueta(enViaje: boolean): CSSProperties {
  return { opacity: enViaje ? 0 : 1, transition: enViaje ? "opacity 90ms ease-out" : `opacity 200ms ${OUT}` };
}

// --- Piezas pequeñas ----------------------------------------------------------------------------------------------

const ICONO_DE_TIPO: Record<string, string> = {
  foto: "M4 7h3l2-3h6l2 3h3v12H4z M12 10a3.5 3.5 0 1 0 .01 0",
  texto: "M5 6h14M5 10h14M5 14h10M5 18h7",
  audio: "M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2",
  video: "M4 6h12v12H4z M16 10l5-3v10l-5-3",
  documento: "M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6M9 16h6",
};

function IconoDeTipo({ tipo, destacado }: { tipo: string; destacado: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-[30px] items-center justify-center rounded-lg ${destacado ? "bg-warning-100 text-warning-800" : "bg-system-100 text-system-700"}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICONO_DE_TIPO[tipo] ?? ICONO_DE_TIPO.documento} />
      </svg>
    </span>
  );
}

function EstadoDelAporte({ aporte }: { aporte: AporteEnElMapa }) {
  const clase =
    aporte.estado === "pendiente"
      ? "border border-dashed border-warning-600 bg-warning-50 text-warning-800"
      : aporte.estado === "rechazado"
        ? "bg-error-50 text-error-700"
        : "bg-success-50 text-success-800";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap ${clase}`}>{T.estados[aporte.estado]}</span>;
}

/** Calificación o estado, con los colores del punto en el mapa. */
function ChipDelAporte({ aporte }: { aporte: AporteEnElMapa }) {
  if (aporte.estado !== "aceptado" || !aporte.calificacion) return <EstadoDelAporte aporte={aporte} />;
  const clase =
    aporte.calificacion === 5 ? "bg-warning-100 text-warning-900" : aporte.calificacion === 4 ? "bg-success-50 text-success-800" : "bg-system-100 text-system-700";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap ${clase}`}>
      {aporte.calificacion}★ {NOMBRES_DE_ESTRELLAS[aporte.calificacion]}
    </span>
  );
}

/** Rombo para los 5★, círculo para lo demás (V10). Medidas en px del lienzo. */
const FORMA_DEL_PUNTO: Record<GrupoDePunto, string> = {
  excepcional: "size-2.5 rotate-45 rounded-[2px] border-[1.2px] border-warning-900 bg-warning-500 shadow-[0_0_0_3px_rgb(234_179_8/0.25)]",
  alto: "size-2.5 rounded-full border-[1.4px] border-success-800 bg-success-300",
  aceptado: "size-[9px] rounded-full border-[1.4px] border-success-600 bg-white",
  pendiente: "size-[9px] rounded-full border-[1.4px] border-dashed border-warning-700 bg-white",
};

function MuestraDelFiltro({ grupo }: { grupo: GrupoDePunto | null }) {
  return <span aria-hidden="true" className={`inline-block ${grupo ? FORMA_DEL_PUNTO[grupo].replace(/shadow-\S+/, "") : "size-2.5 rounded-full bg-brand-600"}`} />;
}

/** Línea: un div rotado; el hijo se traza con scaleX (solo transform). */
function Linea({ s, estilo, trazo, clase = "" }: { s: Segmento; estilo?: CSSProperties; trazo?: CSSProperties; clase?: string }) {
  return (
    <div
      aria-hidden="true"
      className="mapa-mov absolute top-0 left-0 h-0 origin-top-left"
      style={{ width: s.largo, transform: `translate(${s.x}px, ${s.y}px) rotate(${s.angulo}deg)`, ...estilo }}
    >
      <div className={`mapa-linea h-0 origin-left ${clase}`} style={trazo} />
    </div>
  );
}

// --- Lienzo escalado ----------------------------------------------------------------------------------------------

/** El dibujo se arma en px de ANCHO × ALTO y se escala al ancho disponible (todo dentro sigue siendo transform). */
function Lienzo({ children, alto = ALTO_DEL_MAPA, desdeY = 0 }: { children: ReactNode; alto?: number; desdeY?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setEscala(Math.min(1, el.clientWidth / ANCHO_DEL_MAPA));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return (
    <div ref={caja} className="relative mx-auto w-full max-w-[900px] overflow-hidden" style={{ height: escala ? alto * escala : alto * 0.75 }}>
      <div
        className="absolute top-0 left-1/2 origin-top"
        style={{
          width: ANCHO_DEL_MAPA,
          height: alto,
          transform: `translateX(-50%) scale(${escala || 1})`,
          visibility: escala ? "visible" : "hidden",
        }}
      >
        <div className="absolute inset-x-0" style={{ top: -desdeY, height: ALTO_DEL_MAPA }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Grafo --------------------------------------------------------------------------------------------------------

function Grafo({
  datos,
  geo,
  filtro,
  sel,
  elegir,
}: {
  datos: DatosDelMapaDeAportes;
  geo: GeometriaDelMapa;
  filtro: Filtro;
  sel: Seleccion;
  elegir: (s: Seleccion) => void;
}) {
  const zoom = sel.tematica !== null;
  const campanaDe = (id: number) => datos.campanas.find((c) => c.id === id) as CampanaEnElMapa;
  const campanaElegida = sel.campana != null ? geo.campanas.find((c) => c.id === sel.campana) : undefined;
  const posDeTematica = new Map(geo.tematicas.map((t) => [t.nombre, t.general]));

  // Firma de los lados de las etiquetas en la vista actual: si cambia, las etiquetas se ocultan durante el viaje.
  const firma = [
    sel.tematica ?? "",
    ...geo.tematicas.map((t) => t.ladoGeneral + t.extraGeneral),
    ...geo.subtematicas.map((s) => s.lado + s.extra),
    ...geo.campanas.map((c) => (sel.tematica === c.tematica ? c.ladoAcercado + c.extraAcercado : c.ladoGeneral + c.extraGeneral)),
  ].join("|");
  const [firmaAnterior, setFirmaAnterior] = useState(firma);
  const [enViaje, setEnViaje] = useState(false);
  if (firma !== firmaAnterior) {
    setFirmaAnterior(firma);
    setEnViaje(true);
  }
  useEffect(() => {
    if (!enViaje) return;
    const t = window.setTimeout(() => setEnViaje(false), 560);
    return () => window.clearTimeout(t);
  }, [enViaje, firma]);
  const etiqueta = visibilidadDeEtiqueta(enViaje);
  const subResaltada = sel.sub ?? campanaElegida?.subtematica ?? null;

  return (
    <Lienzo>
      {/* Líneas de la vista general: se ocultan antes de que algo se mueva y vuelven al final. */}
      <div
        className="mapa-mov absolute inset-0"
        style={{ opacity: zoom ? 0 : 1, transition: zoom ? tr(["opacity", 100, OUT, 0]) : tr(["opacity", 260, OUT, 380]) }}
      >
        {geo.lineasGenerales.map((s, i) => (
          <Linea key={i} s={s} clase="mapa-trazo border-t-[1.5px] border-system-300" trazo={{ "--i": i } as CSSProperties} />
        ))}
      </div>

      {/* Líneas de cada temática: se trazan de adentro hacia afuera cuando los nodos ya llegaron. */}
      {Object.entries(geo.lineasPorTematica).map(([tematica, lineas]) =>
        lineas.map((l, k) => {
          const activa = sel.tematica === tematica;
          const resaltada = activa && (subResaltada === l.subtematica && (l.campana === null || sel.campana == null || l.campana === sel.campana));
          const retraso = 380 + k * 25;
          return (
            <Linea
              key={`${tematica}-${k}`}
              s={l}
              estilo={{ opacity: activa ? 1 : 0, transition: activa ? tr(["opacity", 60, "linear", retraso]) : tr(["opacity", 100, OUT, 0]) }}
              clase={`mapa-mov transition-[border-color] duration-200 ${resaltada ? "border-t-2 border-brand-500" : "border-t-[1.5px] border-system-300"}`}
              trazo={{
                transform: `scaleX(${activa ? 1 : 0})`,
                transition: activa ? tr(["transform", 300, OUT, retraso], ["border-color", 200, "ease", 0]) : tr(["transform", 0, "linear", 120]),
              }}
            />
          );
        }),
      )}

      {/* Otras subtemáticas de la campaña elegida, en punteado. */}
      {geo.secundarias.map((l) => {
        const visible = sel.campana === l.campana && sel.tematica !== null;
        return (
          <Linea
            key={`${l.campana}-${l.subtematica}`}
            s={l}
            estilo={{ opacity: visible ? 1 : 0, transition: tr(["opacity", visible ? 240 : 100, OUT, visible ? 80 : 0]) }}
            clase="mapa-mov border-t-[1.5px] border-dashed border-brand-600"
          />
        );
      })}

      {/* «Tú» */}
      <div
        aria-hidden="true"
        className="mapa-mov absolute top-0 left-0"
        style={estiloDeNodo(
          mover(CENTRO, zoom ? 0.85 : 1),
          zoom ? 0 : 1,
          zoom ? tr(["transform", 200, OUT, 0], ["opacity", 140, OUT, 0]) : tr(["transform", 300, OUT, 200], ["opacity", 240, OUT, 200]),
          false,
        )}
      >
        <div className="mapa-entra" style={{ "--i": 0 } as CSSProperties}>
          <span className="absolute top-0 left-0 flex size-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-brand-600 bg-white text-[14px] font-extrabold text-system-900">
            {T.centro}
          </span>
        </div>
      </div>

      {/* Temáticas */}
      {geo.tematicas.map((t, i) => {
        const activa = sel.tematica === t.nombre;
        const visible = !zoom;
        const estilo = !zoom
          ? estiloDeNodo(mover(t.general), 1, tr(["transform", 380, IO, 0], ["opacity", 260, OUT, 140 + i * 30]), true)
          : activa
            ? estiloDeNodo(mover(CENTRO, ESCALA_DEL_CENTRO), 1, tr(["transform", 440, IO, 0], ["opacity", 120, OUT, 0]), false, 3)
            : estiloDeNodo(mover(alejada(t.general), 0.92), 0, tr(["transform", 200, OUT, 0], ["opacity", 160, OUT, 0]), false);
        return (
          <div key={t.nombre} className="mapa-mov absolute top-0 left-0" style={estilo} aria-hidden={!visible && !activa}>
            <div className="mapa-entra" style={{ "--i": i + 1 } as CSSProperties}>
              <button
                type="button"
                disabled={!visible}
                tabIndex={visible ? 0 : -1}
                aria-label={T.acercarseA(t.nombre)}
                onClick={() => elegir({ ...NADA, tematica: t.nombre })}
                className={`mapa-circulo size-[18px] border-2 ${activa ? "border-warning-800 bg-warning-500" : "border-warning-600 bg-warning-100"}`}
              />
              {/* Acercada, en el centro, no lleva etiqueta: su nombre está en las migas y en el panel. */}
              <span
                className={`mapa-etiqueta ${FONDO_DE_ETIQUETA} text-[12.5px] font-bold text-warning-800`}
                style={{
                  ...posicionDeEtiqueta(t.ladoGeneral, RADIO_DE_TEMATICA + SEPARACION_DE_ETIQUETA + t.extraGeneral),
                  // visibility además de opacity: la regla de movimiento reducido fuerza la opacidad, no esto.
                  ...(activa ? { opacity: 0, visibility: "hidden", transition: "opacity 120ms ease-out, visibility 0s linear 120ms" } : etiqueta),
                }}
              >
                {t.nombre}
              </span>
            </div>
          </div>
        );
      })}

      {/* Subtemáticas: brotan del centro al acercarse */}
      {geo.subtematicas.map((s) => {
        const activa = sel.tematica === s.tematica;
        const elegida = activa && sel.sub === s.clave;
        const retraso = 220 + s.indice * 45;
        const estilo = activa
          ? estiloDeNodo(mover(s.posicion), 1, tr(["transform", 320, OUT, retraso], ["opacity", 200, OUT, retraso]), true, 4)
          : estiloDeNodo(mover(CENTRO, 0.9), 0, tr(["transform", 180, OUT, 0], ["opacity", 120, OUT, 0]), false);
        return (
          <div key={s.clave} className="mapa-mov absolute top-0 left-0" style={estilo} aria-hidden={!activa}>
            <button
              type="button"
              disabled={!activa}
              tabIndex={activa ? 0 : -1}
              aria-pressed={elegida}
              aria-label={T.subtematicaAria(nombreDeSub(s))}
              onClick={() => elegir({ ...NADA, tematica: s.tematica, sub: s.clave })}
              className={`mapa-circulo size-[15px] border-2 border-warning-600 ${elegida ? "bg-warning-500" : "bg-white"}`}
            />
            <span
              className={`mapa-etiqueta ${FONDO_DE_ETIQUETA} max-w-[150px] truncate text-[12px] font-bold text-warning-800`}
              style={{ ...posicionDeEtiqueta(s.lado, RADIO_DE_SUBTEMATICA + SEPARACION_DE_ETIQUETA + s.extra), ...etiqueta }}
            >
              {nombreDeSub(s)}
            </span>
          </div>
        );
      })}

      {/* Campañas con sus puntos */}
      {geo.campanas.map((c) => {
        const datosC = campanaDe(c.id);
        const activa = sel.tematica === c.tematica;
        const elegida = activa && sel.campana === c.id && sel.aporte == null;
        const conCoincidencias = c.puntos.some((p) => coincide(filtro, p.aporte));
        const atenuada = activa && ((sel.sub !== null && c.subtematica !== sel.sub) || (sel.campana !== null && sel.campana !== c.id));
        // Las que no caben en la vista general esperan, ocultas, en su temática y salen de ella al acercarse.
        const desde = c.general ?? posDeTematica.get(c.tematica) ?? CENTRO;
        const visible = activa || (!zoom && c.general !== null);
        const estilo = !zoom
          ? c.general
            ? estiloDeNodo(mover(c.general), 1, tr(["transform", 380, IO, c.orden * 20], ["opacity", 260, OUT, 160 + c.indice * 25]), true)
            : estiloDeNodo(mover(desde, 0.9), 0, tr(["transform", 300, IO, 0], ["opacity", 160, OUT, 0]), false)
          : activa
            ? estiloDeNodo(
                mover(c.acercada, ESCALA_ACERCADA),
                1,
                tr(["transform", 440, IO, 40 + c.orden * 30], ["opacity", c.general ? 200 : 260, c.general ? "ease" : OUT, c.general ? 0 : 160 + c.orden * 30]),
                true,
                2,
              )
            : estiloDeNodo(mover(alejada(desde), 0.92), 0, tr(["transform", 200, OUT, 0], ["opacity", 160, OUT, 0]), false);
        const enRevision = datosC.aportes.filter((a) => a.estado === "pendiente").length;
        const dx = activa ? c.etiquetaAcercada : c.etiquetaGeneral;
        const lado = activa ? c.ladoAcercado : c.ladoGeneral;
        const extra = activa ? c.extraAcercado : c.extraGeneral;
        // Los puntos van del lado contrario a la etiqueta: arco arriba si la etiqueta va abajo, y al revés.
        const signo = lado === "arriba" ? -1 : 1;
        // Atenuar baja el nodo y sus puntos, no la etiqueta (su fondo dejaría de tapar las líneas).
        const tenue: CSSProperties = { opacity: atenuada ? 0.35 : 1, transition: "opacity 200ms ease" };
        return (
          <div key={c.id} className="mapa-mov absolute top-0 left-0" style={estilo} aria-hidden={!visible}>
            <div className="mapa-entra" style={{ "--i": geo.tematicas.length + 1 + c.indice } as CSSProperties}>
              {c.puntos.map((p) => (
                <button
                  key={p.aporte.id}
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  disabled={!visible}
                  onClick={() => elegir({ ...sel, campana: c.id, aporte: p.aporte.id })}
                  className="absolute top-0 left-0 flex size-4 cursor-pointer items-center justify-center rounded-full"
                  style={{
                    transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${signo * p.y}px))`,
                    opacity: (coincide(filtro, p.aporte) ? 1 : 0.15) * (atenuada ? 0.35 : 1),
                    transition: tr(["transform", 440, IO, 0], ["opacity", 200, "ease", 0]),
                  }}
                >
                  <span className={`${FORMA_DEL_PUNTO[p.grupo]} ${sel.aporte === p.aporte.id ? "ring-2 ring-brand-600 ring-offset-2" : ""}`} />
                </button>
              ))}
              <button
                type="button"
                disabled={!visible}
                tabIndex={visible ? 0 : -1}
                aria-pressed={elegida}
                aria-label={`${c.nombre}, ${datosC.aprobadosTuyos} ${datosC.aprobadosTuyos === 1 ? "aporte aceptado" : "aportes aceptados"}`}
                onClick={() => elegir({ ...NADA, tematica: c.tematica, campana: c.id })}
                className={`mapa-circulo border-2 ${conCoincidencias ? "border-brand-600 bg-brand-100" : "border-system-300 bg-system-100"} ${
                  elegida ? "shadow-[0_0_0_4px_#fff,0_0_0_6px_var(--color-brand-600)]" : ""
                }`}
                style={{ width: c.radio * 2, height: c.radio * 2, ...tenue }}
              />
              <span
                className={`mapa-etiqueta ${FONDO_DE_ETIQUETA} text-center leading-tight`}
                style={{ ...posicionDeEtiqueta(lado, c.radio + SEPARACION_DE_ETIQUETA + extra, dx), ...etiqueta }}
              >
                <span className={`block text-[13px] font-bold transition-colors duration-200 ${atenuada || !conCoincidencias ? "text-system-500" : "text-system-900"}`}>
                  {c.nombreCorto}
                </span>
                <span className={`block text-[11.5px] transition-colors duration-200 ${atenuada ? "text-system-400" : "text-system-600"}`}>
                  {`${datosC.aprobadosTuyos} ${datosC.aprobadosTuyos === 1 ? "aceptado" : "aceptados"}`}
                  {enRevision > 0 ? `, ${enRevision} en revisión` : ""}
                </span>
              </span>
              {/* Los aportes que no caben como punto, al final del arco de puntos. */}
              {c.puntosOcultos > 0 && (
                <span
                  className="mapa-etiqueta pointer-events-none absolute left-0 rounded-pill bg-system-100 px-1.5 font-mono text-[10.5px] leading-4 font-bold whitespace-nowrap text-system-700"
                  style={{
                    top: signo > 0 ? -(c.radio + 36) : c.radio + 20,
                    transform: "translateX(-50%)",
                    ...etiqueta,
                  }}
                >
                  {T.recorteDePuntos(c.puntosOcultos)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </Lienzo>
  );
}

function GrafoDeIntereses({ intereses }: { intereses: string[] }) {
  const tematicas = geometriaDeIntereses(intereses);
  return (
    <Lienzo alto={310} desdeY={ALTO_DEL_MAPA / 2 - 150}>
      {tematicas.map((t, i) => (
        <Linea key={`l-${t.nombre}`} s={segmento(CENTRO, t)} clase="mapa-trazo border-t-[1.5px] border-dashed border-system-300" trazo={{ "--i": i } as CSSProperties} />
      ))}
      <div className="absolute top-0 left-0" style={{ transform: mover(CENTRO) }} aria-hidden="true">
        <div className="mapa-entra" style={{ "--i": 0 } as CSSProperties}>
          <span className="absolute top-0 left-0 flex size-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-brand-600 bg-white text-[14px] font-extrabold">
            {T.centro}
          </span>
        </div>
      </div>
      {tematicas.map((t, i) => (
        <div key={t.nombre} className="absolute top-0 left-0" style={{ transform: mover(t) }} aria-hidden="true">
          <div className="mapa-entra" style={{ "--i": i + 1 } as CSSProperties}>
            <span className="absolute top-0 left-0 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-warning-600 bg-white" />
            <span className={`${FONDO_DE_ETIQUETA} left-0 -translate-x-1/2 text-[13px] font-semibold text-warning-800 ${t.etiquetaArriba ? "-top-9" : "top-4"}`}>
              {t.nombre}
            </span>
          </div>
        </div>
      ))}
    </Lienzo>
  );
}

// --- Panel de inspección ------------------------------------------------------------------------------------------

function FilaDeAporte({ aporte, campana, elegir }: { aporte: AporteEnElMapa; campana?: string; elegir: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={elegir}
        className="grid w-full grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors duration-150 hover:bg-system-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
      >
        <IconoDeTipo tipo={aporte.tipo} destacado={aporte.calificacion === 5} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-system-900">{aporte.descripcion || T.aporteSinDescripcion}</span>
          <span className="block truncate text-[12px] text-system-600">
            {campana ? `${campana}, ` : ""}
            {fechaCorta(aporte.enviadoEn)}
          </span>
        </span>
        <ChipDelAporte aporte={aporte} />
      </button>
    </li>
  );
}

function FilaDeNavegacion({ titulo, detalle, elegir, marca }: { titulo: string; detalle: string; elegir: () => void; marca?: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={elegir}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-150 hover:bg-system-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {marca}
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-system-900">{titulo}</span>
            <span className="block truncate text-[12px] text-system-600">{detalle}</span>
          </span>
        </span>
        <span aria-hidden="true" className="text-system-500">
          →
        </span>
      </button>
    </li>
  );
}

const MARCA_DE_SUB = <span aria-hidden="true" className="size-[11px] shrink-0 rounded-full border-2 border-warning-600" />;

function Panel({
  datos,
  geo,
  filtro,
  sel,
  elegir,
}: {
  datos: DatosDelMapaDeAportes;
  geo: GeometriaDelMapa;
  filtro: Filtro;
  sel: Seleccion;
  elegir: (s: Seleccion) => void;
}) {
  const todos = datos.campanas.flatMap((c) => c.aportes);
  const campanaDe = (id: number) => datos.campanas.find((c) => c.id === id) as CampanaEnElMapa;
  const subDe = (clave: string) => geo.subtematicas.find((s) => s.clave === clave);
  const nombreDeFiltro = filtro === "todos" ? "" : T.filtroEnFrase[filtro];
  const resumenDeCampana = (c: CampanaEnElMapa) => {
    const enRevision = c.aportes.filter((a) => a.estado === "pendiente").length;
    return `${c.aprobadosTuyos} ${c.aprobadosTuyos === 1 ? "aceptado" : "aceptados"}${enRevision ? `, ${enRevision} en revisión` : ""}`;
  };

  let tipo: string;
  let titulo: string;
  let resumen: string | null = null;
  let volver: { texto: string; a: Seleccion } | null = null;
  let cuerpo: ReactNode = null;

  if (sel.aporte != null) {
    const a = todos.find((x) => x.id === sel.aporte);
    if (!a) return null;
    const c = campanaDe(a.campanaId);
    const nombreTipo = NOMBRE_DE_TIPO[a.tipo as keyof typeof NOMBRE_DE_TIPO] ?? a.tipo;
    tipo = T.aporteTipo(nombreTipo, c.nombre);
    titulo = a.descripcion || T.aporteSinDescripcion;
    volver = { texto: T.volverA(c.nombre), a: { ...sel, campana: c.id, aporte: null } };
    const d = a.desglose;
    const calculo =
      a.estado === "pendiente"
        ? T.calculoPendiente
        : d && a.exp != null && a.exp > 0
          ? T.calculo(d.base, decimal(d.multCalidad), d.factor !== 1 ? decimal(d.factor) : null, a.exp, T.motivoDelFactor(d.conPotenciador, d.conCampanaEspecial))
          : null;
    cuerpo = (
      <>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          {a.estado === "aceptado" && (
            <>
              <dt className="text-system-600">{T.aporteCalificacion}</dt>
              <dd className="flex items-center justify-end gap-2 text-right font-semibold">
                <EstrellasDeCalificacion valor={a.calificacion} className="text-[14px]" />
                {a.calificacion ? <span aria-hidden="true">{NOMBRES_DE_ESTRELLAS[a.calificacion]}</span> : null}
              </dd>
              <dt className="text-system-600">{T.aporteExp}</dt>
              <dd className="text-right">
                <ExpDelAporte estado={a.estado} expOtorgada={a.exp} />
              </dd>
            </>
          )}
          <dt className="text-system-600">{T.aporteEstado}</dt>
          <dd className="text-right">
            <EstadoDelAporte aporte={a} />
          </dd>
          <dt className="text-system-600">{T.aporteTipoDeDato}</dt>
          <dd className="text-right font-semibold">{nombreTipo}</dd>
          <dt className="text-system-600">{T.aporteEnviado}</dt>
          <dd className="text-right font-semibold">{fechaCorta(a.enviadoEn, true)}</dd>
          {calculo && (
            <>
              <dt className="text-system-600">{T.aporteCalculo}</dt>
              <dd className="text-right font-mono text-[12px] text-system-800">{calculo}</dd>
            </>
          )}
        </dl>
        <p className="rounded-xl bg-system-50 px-3 py-2.5 text-[12.5px] text-system-700">
          {a.estado === "aceptado" ? T.notaAceptado : a.estado === "pendiente" ? T.notaPendiente : T.notaRechazado}
        </p>
        <ButtonLink href={`/mis-aportes/${a.campanaId}/${a.id}`} size="sm" className="self-start">
          {T.verDetalle}
        </ButtonLink>
      </>
    );
  } else if (sel.campana != null) {
    const c = campanaDe(sel.campana);
    const nodo = geo.campanas.find((x) => x.id === c.id);
    const sub = nodo ? subDe(nodo.subtematica) : undefined;
    tipo = sub ? T.campanaTipoConSubtematica(nombreDeSub(sub), c.especial) : T.campanaTipo(c.tematica, c.especial);
    titulo = c.nombre;
    volver = sel.sub
      ? { texto: nombreDeSub(subDe(sel.sub) ?? { nombre: "" }), a: { ...sel, campana: null } }
      : sel.tematica
        ? { texto: sel.tematica, a: { ...NADA, tematica: sel.tematica } }
        : { texto: T.volverARecientes, a: NADA };
    const cuota = c.bonoDeCuota != null ? T.cuotaCompleta(c.bonoDeCuota) : c.cuota ? T.cuotaAvance(c.aprobadosTuyos, c.cuota) : "";
    resumen = `${c.meta ? T.metaColectiva(c.aprobadosDeTodos, c.meta, c.aprobadosTuyos) : T.sinMeta(c.aprobadosDeTodos, c.aprobadosTuyos)}${cuota ? ` ${cuota}` : ""}`;
    const principal = sub && sub.nombre !== CLAVE_OTRAS && sub.nombre !== CLAVE_SIN_SUBTEMATICA ? sub.nombre : null;
    const otras = c.subtematicas.filter((s) => s !== principal);
    const conNodo = new Set((nodo?.otrasConNodo ?? []).map((k) => k.split("::")[1]));
    const lista = c.aportes.filter((a) => coincide(filtro, a));
    cuerpo = (
      <>
        {c.meta && (
          <div className="flex flex-col gap-1.5">
            <div role="img" aria-label={T.barraAria(c.meta, c.aprobadosDeTodos, c.aprobadosTuyos)} className="flex h-2.5 overflow-hidden rounded-pill bg-system-100">
              <span className="mapa-barra h-full bg-success-700" style={{ width: `${(Math.min(c.aprobadosTuyos, c.meta) / c.meta) * 100}%` }} />
              <span
                className="mapa-barra h-full bg-success-300"
                style={{ width: `${(Math.max(0, Math.min(c.aprobadosDeTodos, c.meta) - Math.min(c.aprobadosTuyos, c.meta)) / c.meta) * 100}%` }}
              />
            </div>
            <p className="text-[11.5px] text-system-600">{T.barraNota}</p>
          </div>
        )}
        {otras.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h4 className="text-[12.5px] font-bold text-system-800">{T.tambienEn}</h4>
            <ul className="flex flex-wrap gap-1.5">
              {otras.map((o) => (
                <li
                  key={o}
                  className={`rounded-md border border-dashed px-2 py-0.5 text-[11.5px] font-bold ${conNodo.has(o) ? "border-brand-600 text-brand-800" : "border-system-300 text-system-700"}`}
                >
                  {o}
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] text-system-600">
              {sel.tematica && conNodo.size > 0 ? T.tambienEnConLinea([...conNodo]) : conNodo.size === 0 ? T.tambienEnSinLinea : null}
            </p>
          </div>
        )}
        <div>
          <h4 className="mb-1 text-[12.5px] font-bold text-system-800">
            {filtro === "todos" ? T.campanaListaTitulo(c.aportes.length) : T.campanaListaFiltrada(nombreDeFiltro, lista.length)}
          </h4>
          {lista.length > 0 ? (
            <ul className="-mx-2 flex flex-col">
              {lista.slice(0, EN_EL_PANEL).map((a) => (
                <FilaDeAporte key={a.id} aporte={a} elegir={() => elegir({ ...sel, campana: c.id, aporte: a.id })} />
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-system-600">{T.campanaSinCoincidencias}</p>
          )}
          {lista.length > EN_EL_PANEL && <p className="mt-1 text-[12.5px] text-system-600">{T.masEnLaLista(lista.length - EN_EL_PANEL)}</p>}
        </div>
        <Link href={`/mis-aportes/${c.id}`} className="self-start text-[13px] font-bold text-brand-700 hover:underline">
          {T.verCampana} →
        </Link>
      </>
    );
  } else if (sel.sub != null && sel.tematica != null) {
    const s = subDe(sel.sub);
    if (!s) return null;
    const tematica = sel.tematica;
    tipo = T.subtematicaTipo(tematica);
    titulo = nombreDeSub(s);
    resumen = `${T.subtematicaResumen(s.campanas.length)}${s.agrupadas.length ? ` ${T.otrasAgrupa(s.agrupadas)}` : ""}`;
    volver = { texto: tematica, a: { ...NADA, tematica } };
    cuerpo = (
      <ul className="-mx-2 flex flex-col">
        {s.campanas.map((id) => {
          const c = campanaDe(id);
          return <FilaDeNavegacion key={id} titulo={c.nombre} detalle={resumenDeCampana(c)} elegir={() => elegir({ ...sel, campana: id })} />;
        })}
      </ul>
    );
  } else if (sel.tematica != null) {
    const tematica = sel.tematica;
    const subs = geo.subtematicas.filter((s) => s.tematica === tematica);
    const campanas = datos.campanas.filter((c) => c.tematica === tematica);
    const aportes = campanas.flatMap((c) => c.aportes);
    tipo = T.tematicaTipo;
    titulo = tematica;
    resumen = T.tematicaResumenAcercada(
      campanas.length,
      subs.length,
      aportes.filter((a) => a.estado === "aceptado").length,
      aportes.filter((a) => a.estado === "pendiente").length,
    );
    volver = { texto: T.migaVolver, a: NADA };
    cuerpo = (
      <>
        <div>
          <h4 className="mb-1 text-[12.5px] font-bold text-system-800">{T.subtematicasTitulo}</h4>
          {/* Escritorio: elegir una subtemática resalta sus campañas en el mapa. */}
          <ul className="-mx-2 flex flex-col max-md:hidden">
            {subs.map((s) => (
              <FilaDeNavegacion
                key={s.clave}
                titulo={nombreDeSub(s)}
                detalle={T.campanasDeSubtematica(s.campanas.length)}
                marca={MARCA_DE_SUB}
                elegir={() => elegir({ ...NADA, tematica, sub: s.clave })}
              />
            ))}
          </ul>
          {/* Teléfono: sin mapa, las campañas agrupadas bajo cada subtemática. */}
          <div className="flex flex-col gap-1 md:hidden">
            {subs.map((s) => (
              <div key={s.clave}>
                <div className="flex items-center gap-2 border-t border-system-100 py-1.5">
                  {MARCA_DE_SUB}
                  <h5 className="text-[13px] font-extrabold text-warning-800">{nombreDeSub(s)}</h5>
                  <span className="ml-auto text-[12px] text-system-600">{T.campanasDeSubtematica(s.campanas.length)}</span>
                </div>
                <ul className="-mx-2 flex flex-col">
                  {s.campanas.map((id) => {
                    const c = campanaDe(id);
                    return (
                      <FilaDeNavegacion key={id} titulo={c.nombre} detalle={resumenDeCampana(c)} elegir={() => elegir({ ...NADA, tematica, sub: s.clave, campana: id })} />
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="rounded-xl bg-system-50 px-3 py-2.5 text-[12px] text-system-700">{T.reglaDeSubtematica}</p>
      </>
    );
  } else if (filtro !== "todos") {
    const lista = todos.filter((a) => coincide(filtro, a));
    tipo = T.filtroTipo;
    titulo = T.filtroTitulo(nombreDeFiltro, lista.length);
    resumen = lista.length > 0 ? T.filtroResumen(lista.length, new Set(lista.map((a) => a.campanaId)).size) : T.filtroSinCoincidencias;
    cuerpo = (
      <>
        <ul className="-mx-2 flex flex-col">
          {lista.slice(0, EN_EL_PANEL).map((a) => (
            <FilaDeAporte
              key={a.id}
              aporte={a}
              campana={campanaDe(a.campanaId).nombre}
              elegir={() => elegir({ ...NADA, campana: a.campanaId, aporte: a.id })}
            />
          ))}
        </ul>
        {lista.length > EN_EL_PANEL && <p className="text-[12.5px] text-system-600">{T.masEnLaLista(lista.length - EN_EL_PANEL)}</p>}
      </>
    );
  } else {
    const recientes = [...todos].sort((a, b) => b.enviadoEn.localeCompare(a.enviadoEn)).slice(0, RECIENTES);
    tipo = T.recientesTipo;
    titulo = T.recientesTitulo;
    cuerpo = (
      <>
        <p className="text-[13px] text-system-600 max-md:hidden">{T.recientesResumen}</p>
        <p className="text-[13px] text-system-600 md:hidden">{T.recientesResumenTelefono}</p>
        {/* En teléfono no hay grafo: las temáticas se eligen de aquí. */}
        <div className="md:hidden">
          <h4 className="mb-1 text-[12.5px] font-bold text-system-800">{T.telefonoTematicasTitulo}</h4>
          <ul className="-mx-2 flex flex-col">
            {datos.tematicas.map((t) => {
              const n = datos.campanas.filter((c) => c.tematica === t).length;
              return <FilaDeNavegacion key={t} titulo={t} detalle={T.campanasDeSubtematica(n)} elegir={() => elegir({ ...NADA, tematica: t })} />;
            })}
          </ul>
        </div>
        <ul className="-mx-2 flex flex-col">
          {recientes.map((a) => (
            <FilaDeAporte
              key={a.id}
              aporte={a}
              campana={campanaDe(a.campanaId).nombre}
              elegir={() => elegir({ ...NADA, campana: a.campanaId, aporte: a.id })}
            />
          ))}
        </ul>
      </>
    );
  }

  const clave = `${sel.tematica}|${sel.sub}|${sel.campana}|${sel.aporte}|${filtro}`;
  return (
    <div key={clave} className="mapa-panel flex flex-col gap-3.5">
      {volver && (
        <button
          type="button"
          onClick={() => elegir(volver.a)}
          className="self-start text-[12.5px] font-bold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          ← {volver.texto}
        </button>
      )}
      <div>
        <p className="text-[12px] font-semibold text-system-600">{tipo}</p>
        <h3 data-titulo-del-panel tabIndex={-1} className="mt-0.5 text-[17px] leading-snug font-extrabold text-system-900 focus:outline-none">
          {titulo}
        </h3>
        {resumen && <p className="mt-1.5 text-[13px] text-system-700">{resumen}</p>}
      </div>
      {cuerpo}
    </div>
  );
}

// --- Componente ---------------------------------------------------------------------------------------------------

const FILTROS: { valor: Filtro; etiqueta: string; grupo: GrupoDePunto | null }[] = [
  { valor: "todos", etiqueta: T.filtros.todos, grupo: null },
  { valor: "excepcionales", etiqueta: T.filtros.excepcionales, grupo: "excepcional" },
  { valor: "altos", etiqueta: T.filtros.altos, grupo: "alto" },
  { valor: "enRevision", etiqueta: T.filtros.enRevision, grupo: "pendiente" },
];

function Migas({ geo, sel, elegir }: { geo: GeometriaDelMapa; sel: Seleccion; elegir: (s: Seleccion) => void }) {
  const sub = sel.sub ? geo.subtematicas.find((s) => s.clave === sel.sub) : undefined;
  if (sel.tematica === null) {
    return (
      <span key="general" className="mapa-panel inline-flex min-h-9 items-center rounded-pill border border-system-200 bg-white px-3.5 text-[12.5px] font-bold text-system-700 shadow-sm">
        {T.migaGeneral}
      </span>
    );
  }
  const tematica = sel.tematica;
  return (
    <nav key={tematica} aria-label={T.migasEtiqueta} className="mapa-migas inline-flex items-center gap-2 rounded-pill border border-system-200 bg-white p-1 pr-3 shadow-sm">
      <button
        type="button"
        onClick={() => elegir(NADA)}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-pill bg-brand-900 px-3 text-[12.5px] font-bold text-white transition-transform duration-150 ease-salida active:scale-[0.97] motion-reduce:transition-none"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {T.migaVolver}
      </button>
      {sub ? (
        <>
          <button type="button" onClick={() => elegir({ ...NADA, tematica })} className="text-[12.5px] font-bold text-system-900 hover:underline">
            {tematica}
          </button>
          <span aria-hidden="true" className="text-system-400">
            ›
          </span>
          <span aria-current="location" className="text-[12.5px] font-bold text-warning-800">
            {nombreDeSub(sub)}
          </span>
        </>
      ) : (
        <span aria-current="location" className="text-[12.5px] font-bold text-system-900">
          {tematica}
        </span>
      )}
    </nav>
  );
}

export default function MapaDeAportes({ datos }: { datos: DatosDelMapaDeAportes }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [sel, setSel] = useState<Seleccion>(NADA);
  const panel = useRef<HTMLElement>(null);
  const geo = useMemo(() => armarGeometria(datos), [datos]);
  useMapaEnVivo();

  // Si el botón pulsado desaparece al cambiar la vista (la temática que viaja al centro, una fila del panel), el foco
  // pasa al título del panel para no perderse.
  const elegir = (s: Seleccion) => {
    setSel(s);
    requestAnimationFrame(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body || (activo as HTMLButtonElement).disabled) {
        panel.current?.querySelector<HTMLElement>("[data-titulo-del-panel]")?.focus();
      }
    });
  };

  // Escape regresa un nivel: aporte → campaña → subtemática → temática → vista general.
  const alPulsarTecla = (ev: KeyboardEvent<HTMLElement>) => {
    if (ev.key !== "Escape") return;
    if (sel.aporte != null) elegir({ ...sel, aporte: null });
    else if (sel.campana != null) elegir({ ...sel, campana: null });
    else if (sel.sub != null) elegir({ ...sel, sub: null });
    else if (sel.tematica != null) elegir(NADA);
    else return;
    ev.preventDefault();
  };

  const todos = datos.campanas.flatMap((c) => c.aportes);
  const aceptados = todos.filter((a) => a.estado === "aceptado").length;
  const enRevision = todos.filter((a) => a.estado === "pendiente").length;
  const cuentas: Record<Filtro, number> = {
    todos: todos.filter((a) => grupoDe(a) !== null).length,
    excepcionales: todos.filter((a) => coincide("excepcionales", a)).length,
    altos: todos.filter((a) => coincide("altos", a)).length,
    enRevision,
  };

  if (datos.campanas.length === 0) {
    return (
      <section aria-labelledby="mapa-de-aportes" className="flex flex-col gap-4 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
        <div>
          <h2 id="mapa-de-aportes" className="text-lg font-extrabold text-system-900">
            {T.vacioTitulo}
          </h2>
          <p className="mt-1 text-[13px] text-system-600">{T.vacioTexto}</p>
        </div>
        {datos.intereses.length > 0 && (
          <div className="max-md:hidden">
            <GrafoDeIntereses intereses={datos.intereses} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/explorar" variant="primary" size="sm">
            {T.vacioCta}
          </ButtonLink>
          <p className="text-[12.5px] text-system-600">{T.vacioPie}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="mapa-de-aportes"
      onKeyDown={alPulsarTecla}
      className="flex flex-col gap-4 rounded-lg border border-system-200 bg-white p-5 shadow-sm max-md:p-4"
    >
      <div>
        <h2 id="mapa-de-aportes" className="text-lg font-extrabold text-system-900">
          {T.titulo}
        </h2>
        <p className="mt-0.5 text-[13px] text-system-600">{T.resumen(datos.campanas.length, datos.tematicas.length, aceptados, enRevision)}</p>
      </div>

      <div role="group" aria-label={T.filtrosEtiqueta} className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const activo = filtro === f.valor;
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => {
                setFiltro(f.valor);
                // El filtro no saca de la temática: solo suelta lo elegido dentro.
                setSel({ ...NADA, tematica: sel.tematica });
              }}
              className={`inline-flex min-h-9 items-center gap-2 rounded-pill border px-3.5 text-[13px] font-bold transition-[background-color,border-color,color,transform] duration-150 ease-salida active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${
                activo ? "border-brand-900 bg-brand-900 text-white" : "border-system-200 bg-white text-system-700 hover:border-brand-900"
              }`}
            >
              <span className={`flex items-center justify-center rounded-full ${activo ? "bg-white p-[3px]" : ""}`}>
                <MuestraDelFiltro grupo={f.grupo} />
              </span>
              {f.etiqueta}
              <span className={`font-mono text-[12px] ${activo ? "text-white/80" : "text-system-500"}`}>{cuentas[f.valor]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-w-0 max-md:hidden">
          <div className="absolute top-2 left-2 z-10">
            <Migas geo={geo} sel={sel} elegir={elegir} />
          </div>
          <Grafo datos={datos} geo={geo} filtro={filtro} sel={sel} elegir={elegir} />
          <p className="mt-2 text-center text-[12px] text-system-600">
            {sel.tematica === null
              ? geo.campanasOcultas > 0
                ? T.recorteDeCampanas(geo.campanasOcultas)
                : ""
              : `${(geo.ocultasAlAcercarse[sel.tematica] ?? 0) > 0 ? `${T.recorteAlAcercarse(geo.ocultasAlAcercarse[sel.tematica])} ` : ""}${T.escapeAyuda}`}
          </p>
        </div>
        <aside
          ref={panel}
          aria-live="polite"
          className="min-w-0 rounded-xl border border-system-100 bg-white p-4 xl:rounded-none xl:border-y-0 xl:border-r-0 xl:border-l xl:py-0 xl:pr-0 xl:pl-5 max-md:border-0 max-md:p-0"
        >
          <Panel datos={datos} geo={geo} filtro={filtro} sel={sel} elegir={elegir} />
        </aside>
      </div>
    </section>
  );
}
