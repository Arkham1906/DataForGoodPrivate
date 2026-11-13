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
// Etiquetas siempre debajo del nodo y puntos en un arco hacia arriba: así nada cambia de lado al moverse.
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
const ANCHO_DE_CARACTER = 7.1;
const LARGO_DE_ETIQUETA = 26;
const MARGEN = 8;

export type Posicion = { x: number; y: number };
export type GrupoDePunto = "excepcional" | "alto" | "aceptado" | "pendiente";
/** Un punto relativo al centro de su campaña. */
export type PuntoDeAporte = Posicion & { aporte: AporteEnElMapa; grupo: GrupoDePunto };
/** Segmento de línea: origen, largo y ángulo en grados (se dibuja como un div rotado). */
export type Segmento = { x: number; y: number; largo: number; angulo: number };

export type NodoDeTematica = { nombre: string; general: Posicion };

export type NodoDeSubtematica = {
  /** Única en todo el mapa: «temática::subtemática». */
  clave: string;
  tematica: string;
  /** Nombre real, o CLAVE_OTRAS / CLAVE_SIN_SUBTEMATICA. */
  nombre: string;
  posicion: Posicion;
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
    tematicas.push({ nombre: t, general: enElipse(inicio + sector / 2, 132, 98) });
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
      subtematicas.push({ clave, tematica: t, nombre: g.nombre, posicion, indice: i, campanas: g.ids, agrupadas: g.agrupadas });
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
