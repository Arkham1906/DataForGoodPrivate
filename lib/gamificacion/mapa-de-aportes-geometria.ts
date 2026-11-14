// Geometría del mapa de aportes (2026-11-13; diseño V10 + acercamiento por temática aprobado el 2026-11-13, lienzo
// «Mapa de aportes: acercamiento por temática»). Función pura, sin imports de servidor: la usa el componente cliente.
//
// Dos disposiciones sobre el mismo lienzo de ANCHO × ALTO, para que cada campaña VIAJE de una a otra:
// - General: «Tú» al centro, las temáticas en un anillo interior y las campañas en el exterior, en la dirección de su
//   temática. Cada temática recibe un sector proporcional a sus campañas (más un mínimo).
// - Acercada a una temática: la temática al centro, sus subtemáticas en el anillo interior y cada campaña bajo su
//   subtemática principal. Como mucho MAX_SUBTEMATICAS nodos; el resto se junta en «Otras».
// Subtemática principal (una campaña tiene de 0 a 5): la que más se repite entre tus campañas de esa temática; a igual
// cuenta, la que está en tus intereses; luego la alfabética. No usa el orden en que se eligieron: la base no lo guarda.
// Las demás subtemáticas de la campaña que tienen nodo se unen con una línea punteada al elegirla.
// Etiquetas sin líneas encima (2026-11-13, a pedido del responsable: una línea atravesaba el texto de una campaña al
// acercarse): el lado de cada etiqueta (abajo, arriba, derecha o izquierda; en las campañas, abajo o arriba con los
// puntos del otro lado) se elige en cada disposición probando contra TODAS las líneas visibles de esa vista, y gana el
// que no cruza ninguna (a igualdad, el lado habitual). Lo que no tenga lado libre lo tapa el fondo opaco de la etiqueta
// (MapaDeAportes.tsx): ninguna línea se ve encima de un texto. scripts de revisión: /tmp/pruebas/auditar-etiquetas.mjs.
// Topes de legibilidad: MAX_TEMATICAS, MAX_CAMPANAS y MAX_PUNTOS por campaña. Quedan las campañas con más aportes
// tuyos (a igual cuenta, la de actividad más reciente): con «la más reciente» sola, en una tanda de aportes el grupo
// dibujado cambiaba en cada recarga y los nodos entraban y salían sin parar (prueba de carga, 2026-11-13).
// Los nombres se recortan a LARGO_DE_ETIQUETA en el dibujo; el completo va en el panel y en la etiqueta accesible.
// Al acercarse, la temática muestra TODAS sus campañas (hasta MAX_CAMPANAS_ACERCADAS), no solo las que cabían en la
// vista general: las que no estaban ahí no tienen posición general y salen de la temática al acercarse.

import type { AporteEnElMapa, CampanaEnElMapa, DatosDelMapaDeAportes } from "./mapa-de-aportes-tipos";

export const ANCHO_DEL_MAPA = 900;
export const ALTO_DEL_MAPA = 560;
export const MAX_TEMATICAS = 8;
export const MAX_CAMPANAS = 10;
export const MAX_CAMPANAS_ACERCADAS = 12;
export const MAX_PUNTOS = 14;
export const MAX_SUBTEMATICAS = 6;
/** Clave interna del grupo «Otras» y del de campañas sin subtemática; el texto visible sale de textos.ts. */
export const CLAVE_OTRAS = "__otras__";
export const CLAVE_SIN_SUBTEMATICA = "__sin__";

const CENTRO = { x: ANCHO_DEL_MAPA / 2, y: ALTO_DEL_MAPA / 2 };
const PESO_MINIMO = 0.6;
/** Escala de la temática acercada en el centro (el componente la usa al moverla). */
export const ESCALA_DEL_CENTRO = 1.4;
/** Escala de las campañas en la vista acercada. */
export const ESCALA_ACERCADA = 1.08;
/** Separación entre el borde del nodo y su etiqueta, y medidas de los nodos (px del lienzo). */
export const RADIO_DE_TEMATICA = 9;
export const RADIO_DE_SUBTEMATICA = 7.5;
export const SEPARACION_DE_ETIQUETA = 5;
const ALTO_DE_ETIQUETA = 19;
const ALTO_DE_ETIQUETA_DE_CAMPANA = 36;
const ANCHO_DE_SEGUNDA_LINEA = 130;
const ANCHO_DE_CARACTER = 7.1;
const LARGO_DE_ETIQUETA = 26;
const MARGEN = 8;

export type Posicion = { x: number; y: number };
/** De qué lado del nodo va su etiqueta. Las campañas solo usan abajo o arriba (sus puntos van del otro lado). */
export type LadoDeEtiqueta =
  | "abajo"
  | "arriba"
  | "derecha"
  | "izquierda"
  | "abajo-derecha"
  | "abajo-izquierda"
  | "arriba-derecha"
  | "arriba-izquierda";
export type GrupoDePunto = "excepcional" | "alto" | "aceptado" | "pendiente";
/** Un punto relativo al centro de su campaña. */
export type PuntoDeAporte = Posicion & { aporte: AporteEnElMapa; grupo: GrupoDePunto };
/** Segmento de línea: origen, largo y ángulo en grados (se dibuja como un div rotado). */
export type Segmento = { x: number; y: number; largo: number; angulo: number };

export type NodoDeTematica = {
  nombre: string;
  general: Posicion;
  ladoGeneral: LadoDeEtiqueta;
  extraGeneral: number;
  // Acercada, en el centro, no lleva etiqueta: su nombre ya está en las migas y en el panel, y de ahí salen líneas
  // hacia todas sus subtemáticas (no queda ningún lado libre para un texto ancho).
};

export type NodoDeSubtematica = {
  /** Única en todo el mapa: «temática::subtemática». */
  clave: string;
  tematica: string;
  /** Nombre real, o CLAVE_OTRAS / CLAVE_SIN_SUBTEMATICA. */
  nombre: string;
  posicion: Posicion;
  lado: LadoDeEtiqueta;
  /** Separación extra de la etiqueta (px), además de la normal. */
  extra: number;
  /** Orden dentro de su temática, para escalonar su entrada. */
  indice: number;
  campanas: number[];
  /** Subtemáticas reales agrupadas en «Otras». */
  agrupadas: string[];
};

export type NodoDeCampana = {
  id: number;
  nombre: string;
  /** El nombre recortado para el dibujo. */
  nombreCorto: string;
  tematica: string;
  /** Clave del nodo de subtemática del que cuelga. */
  subtematica: string;
  /** Claves de sus otras subtemáticas que tienen nodo (línea punteada al elegirla). */
  otrasConNodo: string[];
  radio: number;
  /** null: no cabe en la vista general; solo aparece al acercarse a su temática. */
  general: Posicion | null;
  acercada: Posicion;
  /** Desplazamiento horizontal de la etiqueta para no salirse del lienzo, en cada disposición. */
  etiquetaGeneral: number;
  etiquetaAcercada: number;
  /** Lado de la etiqueta en cada disposición; los puntos van del lado contrario. */
  ladoGeneral: "abajo" | "arriba";
  ladoAcercado: "abajo" | "arriba";
  extraGeneral: number;
  extraAcercado: number;
  /** Orden dentro de su temática (escalonado del viaje) y orden global (entrada inicial). */
  orden: number;
  indice: number;
  puntos: PuntoDeAporte[];
  puntosOcultos: number;
};

export type LineaDeTematica = Segmento & { subtematica: string; campana: number | null };

export type GeometriaDelMapa = {
  centro: Posicion;
  tematicas: NodoDeTematica[];
  subtematicas: NodoDeSubtematica[];
  campanas: NodoDeCampana[];
  lineasGenerales: Segmento[];
  lineasPorTematica: Record<string, LineaDeTematica[]>;
  secundarias: (Segmento & { campana: number; subtematica: string })[];
  /** Campañas que no caben en la vista general. */
  campanasOcultas: number;
  /** Por temática: campañas que no caben ni al acercarse (más de MAX_CAMPANAS_ACERCADAS). */
  ocultasAlAcercarse: Record<string, number>;
};

const redondear = (v: number) => Math.round(v * 10) / 10;

function enElipse(angulo: number, rx: number, ry: number): Posicion {
  const t = (angulo * Math.PI) / 180;
  return { x: redondear(CENTRO.x + rx * Math.cos(t)), y: redondear(CENTRO.y + ry * Math.sin(t)) };
}

function dentro(p: Posicion): Posicion {
  return { x: Math.max(86, Math.min(ANCHO_DEL_MAPA - 86, p.x)), y: Math.max(64, Math.min(470, p.y)) };
}

export function segmento(p: Posicion, q: Posicion): Segmento {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  return { x: redondear(p.x), y: redondear(p.y), largo: redondear(Math.hypot(dx, dy)), angulo: redondear((Math.atan2(dy, dx) * 180) / Math.PI) };
}

/** Lo que una posición se aleja del centro al salir de la vista (las temáticas no elegidas «se quedan atrás»). */
export function alejada(p: Posicion, factor = 1.14): Posicion {
  return { x: redondear(CENTRO.x + (p.x - CENTRO.x) * factor), y: redondear(CENTRO.y + (p.y - CENTRO.y) * factor) };
}

export function grupoDe(aporte: AporteEnElMapa): GrupoDePunto | null {
  if (aporte.estado === "pendiente") return "pendiente";
  if (aporte.estado !== "aceptado") return null;
  if (aporte.calificacion === 5) return "excepcional";
  if (aporte.calificacion === 4) return "alto";
  return "aceptado";
}

/**
 * La subtemática de la que cuelga una campaña: la que más se repite entre las campañas de la misma temática; a igual
 * cuenta, la de los intereses; luego la alfabética. null si la campaña no tiene subtemáticas.
 */
export function subtematicaPrincipal(
  campana: CampanaEnElMapa,
  deLaTematica: readonly CampanaEnElMapa[],
  intereses: ReadonlySet<string>,
): string | null {
  if (campana.subtematicas.length === 0) return null;
  const cuenta = new Map<string, number>();
  for (const c of deLaTematica) for (const s of c.subtematicas) cuenta.set(s, (cuenta.get(s) ?? 0) + 1);
  return [...campana.subtematicas].sort(
    (a, b) =>
      (cuenta.get(b) ?? 0) - (cuenta.get(a) ?? 0) ||
      Number(intereses.has(b)) - Number(intereses.has(a)) ||
      a.localeCompare(b, "es"),
  )[0];
}

function recortar(nombre: string): string {
  return nombre.length > LARGO_DE_ETIQUETA ? `${nombre.slice(0, LARGO_DE_ETIQUETA - 1).trimEnd()}…` : nombre;
}

function desplazamientoDeEtiqueta(nombre: string, x: number): number {
  const mitad = (nombre.length * ANCHO_DE_CARACTER) / 2;
  const limitada = Math.min(Math.max(x, MARGEN + mitad), ANCHO_DEL_MAPA - MARGEN - mitad);
  return redondear(limitada - x);
}

function puntosDe(c: CampanaEnElMapa, radio: number): { puntos: PuntoDeAporte[]; ocultos: number } {
  const dibujables = c.aportes.filter((a) => grupoDe(a) !== null);
  const visibles = dibujables.slice(0, MAX_PUNTOS);
  const anillo = radio + 11 + (visibles.length > 10 ? 4 : 0);
  const abertura = Math.min(visibles.length > 10 ? 290 : 250, (visibles.length - 1) * 24);
  const paso = visibles.length > 1 ? abertura / (visibles.length - 1) : 0;
  const puntos = visibles.map((aporte, k) => {
    const t = ((-90 - abertura / 2 + k * paso) * Math.PI) / 180;
    return { x: redondear(anillo * Math.cos(t)), y: redondear(anillo * Math.sin(t)), aporte, grupo: grupoDe(aporte) as GrupoDePunto };
  });
  return { puntos, ocultos: dibujables.length - visibles.length };
}

type Caja = { x0: number; x1: number; y0: number; y1: number };
/** Fracción de la separación que se usa en x y en y para las esquinas (≈ cos 45°). */
export const DIAGONAL = 0.7;

/** Caja de una etiqueta de `ancho` × `alto` del lado `lado` de un nodo de radio `radio` en `p` (con `dx` horizontal). */
export function cajaDeEtiqueta(p: Posicion, radio: number, ancho: number, alto: number, lado: LadoDeEtiqueta, dx = 0, extra = 0): Caja {
  const g = radio + SEPARACION_DE_ETIQUETA + extra;
  if (lado === "abajo") return { x0: p.x + dx - ancho / 2, x1: p.x + dx + ancho / 2, y0: p.y + g, y1: p.y + g + alto };
  if (lado === "arriba") return { x0: p.x + dx - ancho / 2, x1: p.x + dx + ancho / 2, y0: p.y - g - alto, y1: p.y - g };
  if (lado === "derecha") return { x0: p.x + g, x1: p.x + g + ancho, y0: p.y - alto / 2, y1: p.y + alto / 2 };
  if (lado === "izquierda") return { x0: p.x - g - ancho, x1: p.x - g, y0: p.y - alto / 2, y1: p.y + alto / 2 };
  // Esquinas: la etiqueta empieza en la diagonal del nodo (a g·0.7 en x y en y).
  const d = g * DIAGONAL;
  const derecha = lado.endsWith("derecha");
  const abajo = lado.startsWith("abajo");
  const x0 = derecha ? p.x + d : p.x - d - ancho;
  const y0 = abajo ? p.y + d : p.y - d - alto;
  return { x0, x1: x0 + ancho, y0, y1: y0 + alto };
}

/** ¿El segmento atraviesa la caja? (Liang–Barsky, con 1 px de holgura hacia adentro.) */
export function segmentoCruzaCaja(s: Segmento, b: Caja): boolean {
  const t = (s.angulo * Math.PI) / 180;
  const x1 = s.x;
  const y1 = s.y;
  const dx = s.largo * Math.cos(t);
  const dy = s.largo * Math.sin(t);
  let u0 = 0;
  let u1 = 1;
  const limites: [number, number][] = [
    [-dx, x1 - (b.x0 + 1)],
    [dx, b.x1 - 1 - x1],
    [-dy, y1 - (b.y0 + 1)],
    [dy, b.y1 - 1 - y1],
  ];
  for (const [p, q] of limites) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > u1) return false;
      if (r > u0) u0 = r;
    } else {
      if (r < u0) return false;
      if (r < u1) u1 = r;
    }
  }
  return u0 < u1;
}

/** Cuánto se sale una caja del lienzo (penaliza el lado que la empujaría fuera). */
function fueraDelLienzo(b: Caja): number {
  return Math.max(0, -b.x0) + Math.max(0, b.x1 - ANCHO_DEL_MAPA) + Math.max(0, -b.y0) + Math.max(0, b.y1 - ALTO_DEL_MAPA);
}

/** Separaciones extra que se prueban: entre las líneas que salen de un nodo el hueco crece con la distancia. */
export const SEPARACIONES_EXTRA = [0, 12, 24, 36] as const;

/** Área en que se encima la caja `b` con las cajas `otras` (etiquetas ya colocadas y nodos). */
function solape(b: Caja, otras: readonly Caja[]): number {
  let area = 0;
  for (const o of otras) {
    const w = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0);
    const h = Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0);
    if (w > 0 && h > 0) area += w * h;
  }
  return area;
}

/** Caja de un nodo (círculo de radio `r`), para que ninguna etiqueta quede encima de otro nodo. */
function cajaDeNodo(p: Posicion, r: number): Caja {
  return { x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r };
}

/**
 * El lugar de la etiqueta que no queda bajo una línea ni encima de otra etiqueta o de un nodo: prueba cada lado de
 * `lados` a cada distancia de SEPARACIONES_EXTRA. Una línea encima y un choque con otra caja pesan lo mismo (ambos
 * tapan texto); después se evita salir del lienzo; a igualdad gana lo más cercano y, luego, el primer lado de `lados`.
 * `propia` es la caja del nodo dueño de la etiqueta (no cuenta como choque). La elegida se agrega a `ocupadas`.
 */
function elegirLado<L extends LadoDeEtiqueta>(
  lados: readonly L[],
  caja: (lado: L, extra: number) => Caja,
  lineas: readonly Segmento[],
  ocupadas: Caja[],
  propia?: Caja,
): { lado: L; extra: number } {
  let mejor = { lado: lados[0], extra: 0 };
  let mejorCaja = caja(lados[0], 0);
  let puntaje = Number.POSITIVE_INFINITY;
  SEPARACIONES_EXTRA.forEach((extra, nivel) => {
    lados.forEach((lado, orden) => {
      const b = caja(lado, extra);
      const cruces = lineas.reduce((n, l) => n + (segmentoCruzaCaja(l, b) ? 1 : 0), 0);
      const encima = solape(b, propia ? ocupadas.filter((o) => o !== propia) : ocupadas);
      const valor = cruces * 100000 + (encima > 0 ? 100000 + encima * 10 : 0) + fueraDelLienzo(b) * 100 + nivel * 10 + orden;
      if (valor < puntaje) {
        puntaje = valor;
        mejor = { lado, extra };
        mejorCaja = b;
      }
    });
  });
  ocupadas.push(mejorCaja);
  return mejor;
}

const LADOS: readonly LadoDeEtiqueta[] = [
  "abajo",
  "arriba",
  "derecha",
  "izquierda",
  "abajo-derecha",
  "abajo-izquierda",
  "arriba-derecha",
  "arriba-izquierda",
];
const LADOS_DE_CAMPANA = ["abajo", "arriba"] as const;

/** Medidas estimadas de las etiquetas (texto en px del lienzo, con el relleno del fondo). */
export function anchoDeEtiqueta(texto: string, porCaracter = ANCHO_DE_CARACTER): number {
  return texto.length * porCaracter + 10;
}

/** Temáticas de interés de una cuenta sin aportes, alrededor del centro (V10, «Cuenta nueva»). */
export function geometriaDeIntereses(intereses: readonly string[]): (Posicion & { nombre: string; etiquetaArriba: boolean })[] {
  const lista = intereses.slice(0, MAX_TEMATICAS);
  const paso = lista.length > 0 ? 360 / lista.length : 0;
  return lista.map((nombre, i) => {
    const p = enElipse(lista.length === 1 ? 270 : 210 + i * paso, 132, 98);
    return { nombre, ...p, etiquetaArriba: p.y < CENTRO.y };
  });
}

export function armarGeometria(datos: DatosDelMapaDeAportes): GeometriaDelMapa {
  const intereses = new Set(datos.subtematicasDeInteres);
  // Campañas con algo que dibujar (aceptados o en revisión): primero las de más aportes; a igual cuenta, la más
  // reciente (ya vienen de la más reciente a la más antigua y el orden de JavaScript es estable).
  const dibujables = (c: CampanaEnElMapa) => c.aportes.filter((a) => grupoDe(a) !== null).length;
  const conPuntos = datos.campanas.filter((c) => dibujables(c) > 0).sort((a, b) => dibujables(b) - dibujables(a));
  const permitidas = new Set<string>();
  for (const t of datos.tematicas) {
    if (permitidas.size >= MAX_TEMATICAS) break;
    if (conPuntos.some((c) => c.tematica === t)) permitidas.add(t);
  }
  const elegidas = conPuntos.filter((c) => permitidas.has(c.tematica)).slice(0, MAX_CAMPANAS);
  const nombres = datos.tematicas.filter((t) => elegidas.some((c) => c.tematica === t));

  // --- Vista general ---
  const porTematica = new Map(nombres.map((t) => [t, elegidas.filter((c) => c.tematica === t)]));
  const pesoTotal = nombres.reduce((s, t) => s + (porTematica.get(t)?.length ?? 0) + PESO_MINIMO, 0);
  const tematicas: NodoDeTematica[] = [];
  const general = new Map<number, Posicion>();
  const orden = new Map<number, number>();
  let inicio = 200;
  for (const t of nombres) {
    const propias = porTematica.get(t) ?? [];
    const sector = (360 * (propias.length + PESO_MINIMO)) / pesoTotal;
    tematicas.push({ nombre: t, general: enElipse(inicio + sector / 2, 132, 98), ladoGeneral: "abajo", extraGeneral: 0 });
    const paso = Math.min(sector, 330) / propias.length;
    propias.forEach((c, j) => {
      const empuje = propias.length > 2 && j % 2 === 1 ? 1.12 : 1;
      general.set(c.id, dentro(enElipse(inicio + paso * (j + 0.5), 262 * empuje, 182 * empuje)));
      orden.set(c.id, j);
    });
    inicio += sector;
  }
  const posDeTematica = new Map(tematicas.map((t) => [t.nombre, t.general]));

  // --- Acercamiento: subtemáticas por temática, con todas sus campañas (hasta MAX_CAMPANAS_ACERCADAS) ---
  const subtematicas: NodoDeSubtematica[] = [];
  const acercada = new Map<number, Posicion>();
  const subDeCampana = new Map<number, string>();
  const delAcercamiento = new Map<string, CampanaEnElMapa[]>();
  const ocultasAlAcercarse: Record<string, number> = {};
  for (const t of nombres) {
    const todas = conPuntos.filter((c) => c.tematica === t);
    const propias = todas.slice(0, MAX_CAMPANAS_ACERCADAS);
    delAcercamiento.set(t, propias);
    ocultasAlAcercarse[t] = todas.length - propias.length;
    // Para la principal cuentan todas tus campañas de la temática, también las que no caben en el dibujo.
    const todasDeLaTematica = datos.campanas.filter((c) => c.tematica === t);
    const grupos = new Map<string, number[]>();
    for (const c of propias) {
      const s = subtematicaPrincipal(c, todasDeLaTematica, intereses) ?? CLAVE_SIN_SUBTEMATICA;
      grupos.set(s, [...(grupos.get(s) ?? []), c.id]);
    }
    let lista = [...grupos.entries()]
      .map(([nombre, ids]) => ({ nombre, ids, agrupadas: [] as string[] }))
      .sort((a, b) => b.ids.length - a.ids.length || Number(a.nombre === CLAVE_SIN_SUBTEMATICA) - Number(b.nombre === CLAVE_SIN_SUBTEMATICA) || a.nombre.localeCompare(b.nombre, "es"));
    if (lista.length > MAX_SUBTEMATICAS + 1) {
      const resto = lista.slice(MAX_SUBTEMATICAS);
      lista = [...lista.slice(0, MAX_SUBTEMATICAS), { nombre: CLAVE_OTRAS, ids: resto.flatMap((g) => g.ids), agrupadas: resto.map((g) => g.nombre) }];
    }
    const peso = lista.reduce((s, g) => s + g.ids.length + PESO_MINIMO, 0);
    // La primera subtemática (la de más campañas) queda arriba, al centro.
    let desde = -90 - (180 * (lista[0].ids.length + PESO_MINIMO)) / peso;
    lista.forEach((g, i) => {
      const sector = (360 * (g.ids.length + PESO_MINIMO)) / peso;
      const angulo = desde + sector / 2;
      const posicion = enElipse(angulo, 168, 116);
      const clave = `${t}::${g.nombre}`;
      subtematicas.push({ clave, tematica: t, nombre: g.nombre, posicion, lado: "abajo", extra: 0, indice: i, campanas: g.ids, agrupadas: g.agrupadas });
      const abanico = Math.min(sector, 300);
      const paso = abanico / g.ids.length;
      g.ids.forEach((id, j) => {
        const empuje = g.ids.length > 2 && j % 2 === 1 ? 1.1 : 1;
        acercada.set(id, dentro(enElipse(angulo - abanico / 2 + paso * (j + 0.5), 318 * empuje, 196 * empuje)));
        subDeCampana.set(id, clave);
      });
      desde += sector;
    });
  }
  const posDeSub = new Map(subtematicas.map((s) => [s.clave, s.posicion]));

  // --- Campañas: las de la vista general primero (su orden decide la entrada), luego las que solo salen al acercarse ---
  const enGeneral = new Set(elegidas.map((c) => c.id));
  const soloAlAcercarse = nombres.flatMap((t) => (delAcercamiento.get(t) ?? []).filter((c) => !enGeneral.has(c.id)));
  let ordenExtra = 0;
  const campanas: NodoDeCampana[] = [...elegidas, ...soloAlAcercarse].map((c, indice) => {
    const aceptados = c.aportes.filter((a) => a.estado === "aceptado").length;
    const radio = redondear(Math.min(17, 8 + Math.sqrt(aceptados) * 2.4));
    const { puntos, ocultos } = puntosDe(c, radio);
    const nombreCorto = recortar(c.nombre);
    const g = general.get(c.id) ?? null;
    const z = acercada.get(c.id) as Posicion;
    const sub = subDeCampana.get(c.id) as string;
    const otrasConNodo = c.subtematicas.map((s) => `${c.tematica}::${s}`).filter((k) => k !== sub && posDeSub.has(k));
    return {
      id: c.id,
      nombre: c.nombre,
      nombreCorto,
      tematica: c.tematica,
      subtematica: sub,
      otrasConNodo,
      radio,
      general: g,
      acercada: z,
      etiquetaGeneral: g ? desplazamientoDeEtiqueta(nombreCorto, g.x) : 0,
      etiquetaAcercada: desplazamientoDeEtiqueta(nombreCorto, z.x),
      ladoGeneral: "abajo",
      ladoAcercado: "abajo",
      extraGeneral: 0,
      extraAcercado: 0,
      orden: orden.get(c.id) ?? (porTematica.get(c.tematica)?.length ?? 0) + ordenExtra++,
      indice,
      puntos,
      puntosOcultos: ocultos,
    };
  });

  // --- Líneas ---
  const lineasGenerales: Segmento[] = [];
  for (const t of tematicas) lineasGenerales.push(segmento(CENTRO, t.general));
  for (const c of campanas) if (c.general) lineasGenerales.push(segmento(posDeTematica.get(c.tematica) as Posicion, c.general));
  const lineasPorTematica: Record<string, LineaDeTematica[]> = {};
  for (const s of subtematicas) {
    const lista = (lineasPorTematica[s.tematica] ??= []);
    lista.push({ ...segmento(CENTRO, s.posicion), subtematica: s.clave, campana: null });
    for (const id of s.campanas) {
      const c = campanas.find((x) => x.id === id) as NodoDeCampana;
      lista.push({ ...segmento(s.posicion, c.acercada), subtematica: s.clave, campana: id });
    }
  }
  const secundarias = campanas.flatMap((c) =>
    c.otrasConNodo.map((k) => ({ ...segmento(c.acercada, posDeSub.get(k) as Posicion), campana: c.id, subtematica: k })),
  );

  // --- Lado de cada etiqueta, contra todas las líneas visibles de cada vista ---
  const anchoDeCampana = (c: NodoDeCampana) => Math.max(anchoDeEtiqueta(c.nombreCorto), ANCHO_DE_SEGUNDA_LINEA);
  // Primero las campañas (etiquetas grandes con solo dos lados posibles); después temáticas y subtemáticas, que
  // tienen ocho lados para esquivarlas. Los nodos cuentan como ocupados desde el inicio (el de campaña, solo su círculo: sus puntos los esquiva la separación).
  const nodoGeneral = new Map(campanas.flatMap((c) => (c.general ? [[c.id, cajaDeNodo(c.general, c.radio + 3)] as const] : [])));
  const ocupadasGenerales: Caja[] = [
    cajaDeNodo(CENTRO, 26),
    ...tematicas.map((t) => cajaDeNodo(t.general, RADIO_DE_TEMATICA)),
    ...nodoGeneral.values(),
  ];
  for (const c of campanas) {
    if (!c.general) continue;
    const g = c.general;
    const r = elegirLado(
      LADOS_DE_CAMPANA,
      (l, e) => cajaDeEtiqueta(g, c.radio, anchoDeCampana(c), ALTO_DE_ETIQUETA_DE_CAMPANA, l, c.etiquetaGeneral, e),
      lineasGenerales,
      ocupadasGenerales,
      nodoGeneral.get(c.id),
    );
    c.ladoGeneral = r.lado;
    c.extraGeneral = r.extra;
  }
  for (const t of tematicas) {
    const r = elegirLado(
      LADOS,
      (l, e) => cajaDeEtiqueta(t.general, RADIO_DE_TEMATICA, anchoDeEtiqueta(t.nombre, 7.3), ALTO_DE_ETIQUETA, l, 0, e),
      lineasGenerales,
      ocupadasGenerales,
    );
    t.ladoGeneral = r.lado;
    t.extraGeneral = r.extra;
  }
  for (const t of tematicas) {
    const lineas = [...(lineasPorTematica[t.nombre] ?? []), ...secundarias.filter((l) => campanas.find((c) => c.id === l.campana)?.tematica === t.nombre)];
    const propias = campanas.filter((x) => x.tematica === t.nombre);
    const subs = subtematicas.filter((x) => x.tematica === t.nombre);
    const nodoAcercado = new Map(propias.map((c) => [c.id, cajaDeNodo(c.acercada, (c.radio + 3) * ESCALA_ACERCADA)] as const));
    const ocupadas: Caja[] = [
      cajaDeNodo(CENTRO, RADIO_DE_TEMATICA * ESCALA_DEL_CENTRO),
      ...subs.map((s) => cajaDeNodo(s.posicion, RADIO_DE_SUBTEMATICA)),
      ...nodoAcercado.values(),
    ];
    for (const c of propias) {
      const r = elegirLado(
        LADOS_DE_CAMPANA,
        (l, e) => cajaDeEtiqueta(c.acercada, c.radio * ESCALA_ACERCADA, anchoDeCampana(c) * ESCALA_ACERCADA, ALTO_DE_ETIQUETA_DE_CAMPANA * ESCALA_ACERCADA, l, c.etiquetaAcercada, e * ESCALA_ACERCADA),
        lineas,
        ocupadas,
        nodoAcercado.get(c.id),
      );
      c.ladoAcercado = r.lado;
      c.extraAcercado = r.extra;
    }
    for (const s of subs) {
      const ancho = Math.min(150, anchoDeEtiqueta(s.nombre.startsWith("__") ? "Sin subtemática" : s.nombre, 7));
      const r = elegirLado(LADOS, (l, e) => cajaDeEtiqueta(s.posicion, RADIO_DE_SUBTEMATICA, ancho, ALTO_DE_ETIQUETA, l, 0, e), lineas, ocupadas);
      s.lado = r.lado;
      s.extra = r.extra;
    }
  }

  return {
    centro: CENTRO,
    tematicas,
    subtematicas,
    campanas,
    lineasGenerales,
    lineasPorTematica,
    secundarias,
    campanasOcultas: datos.campanas.length - elegidas.length,
    ocultasAlAcercarse,
  };
}
