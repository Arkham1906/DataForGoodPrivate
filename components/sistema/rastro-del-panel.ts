// Rastro de navegación del panel del SuperUsuario (2026-11-23, a pedido del usuario: que "Volver" regrese a la
// pantalla de donde se llegó, con sus filtros, y no siempre a una pantalla fija).
//
// Es una lista en sessionStorage (por pestaña del navegador) de las pantallas del panel visitadas, una entrada por
// ruta: al entrar a una ruta que ya está en la lista (con "Volver", con el botón atrás del navegador o con cualquier
// enlace) se recorta hasta ella; si solo cambia la consulta (?q=, ?pagina=, ?pestana=...) se actualiza esa entrada.
// Así la entrada anterior a la actual es siempre la pantalla de donde se llegó.
//
// Cada entrada sabe además si se llegó a ella avanzando (`atras`): entonces la anterior del rastro es también la
// anterior del historial del navegador, y "Volver" usa el atrás del navegador, que conserva la posición en la página.
// Si se llegó regresando (recorte), el historial ya no coincide y "Volver" navega con un enlace.
//
// Solo para el navegador: lo escribe sistema/RastroDelPanel y lo lee sistema/Volver. Sin imports de servidor.

const CLAVE = "dfg:panel:rastro";
const EVENTO = "dfg:panel:rastro";
const MAXIMO = 30;

type Entrada = { url: string; atras: boolean };

/** La ruta sin la consulta: "/usuarios?q=ana" → "/usuarios". */
export function rutaDe(url: string): string {
  return url.split("?")[0] || "/";
}

function leerLista(crudo: string): Entrada[] {
  try {
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    if (!Array.isArray(lista)) return [];
    return lista.flatMap((e): Entrada[] => {
      if (typeof e === "string" && e.startsWith("/")) return [{ url: e, atras: false }];
      if (e && typeof e === "object" && typeof e.url === "string" && e.url.startsWith("/")) {
        return [{ url: e.url, atras: e.atras === true }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function ultimaPosicion(lista: Entrada[], ruta: string): number {
  for (let i = lista.length - 1; i >= 0; i--) if (rutaDe(lista[i].url) === ruta) return i;
  return -1;
}

/** El rastro tal cual está guardado (texto: así useSyncExternalStore compara por valor). */
export function leerRastro(): string {
  try {
    return sessionStorage.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
}

export function suscribirAlRastro(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

/** Cuándo empezó la última navegación por el historial (atrás/adelante o router.back); 0 = ninguna pendiente. */
let historialEn = 0;
/** Una marca más vieja que esto ya no corresponde a la pantalla que se registra. */
const VIGENCIA_DE_LA_MARCA_MS = 1500;

/** Lo llama RastroDelPanel al empezar una navegación por el historial (Navigation API, `navigationType: "traverse"`). */
export function marcarNavegacionPorHistorial(): void {
  historialEn = performance.now();
}

/* ── posición en la página ─────────────────────────────────────────────────
   Cuánto se había bajado en cada pantalla del rastro, para dejarla igual al regresar. El atrás del navegador intenta
   lo mismo, pero lo hace antes de que la página termine de dibujarse (grupos abiertos, listas) y se queda arriba
   (probado en la bandeja de aportes). Va en otra clave para que guardarla al desplazarse no vuelva a pintar "Volver". */

const CLAVE_POSICION = "dfg:panel:rastro:posicion";

function leerPosiciones(): Record<string, number> {
  try {
    const datos: unknown = JSON.parse(sessionStorage.getItem(CLAVE_POSICION) ?? "{}");
    return datos && typeof datos === "object" ? (datos as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Guarda cuánto se bajó en `url`; solo se conservan las pantallas que siguen en el rastro. */
export function guardarPosicion(url: string, y: number): void {
  const enElRastro = new Set(leerLista(leerRastro()).map((e) => e.url));
  const posiciones = Object.fromEntries(Object.entries(leerPosiciones()).filter(([u]) => enElRastro.has(u)));
  posiciones[url] = Math.max(0, Math.round(y));
  try {
    sessionStorage.setItem(CLAVE_POSICION, JSON.stringify(posiciones));
  } catch {
    // Sin sessionStorage no se recuerda la posición.
  }
}

/**
 * Anota la pantalla actual (`url` = ruta + consulta, sin basePath). Devuelve la posición a la que hay que bajar si se
 * regresó a una pantalla del rastro (null si es nueva o la misma).
 * - Misma ruta que la última entrada (cambió la consulta o se recargó): se actualiza esa entrada.
 * - Atrás/adelante del navegador a una pantalla del rastro: se recorta hasta ella (la de la misma URL o, si no, la de
 *   la misma ruta). Si fue un solo paso atrás, el historial sigue alineado y se conserva cómo se llegó.
 * - Un enlace a la URL exacta de una pantalla del rastro (p. ej. "Volver" sin atrás, "Ver ficha completa"): se recorta
 *   hasta ella; el historial ya no sigue al rastro.
 * - Cualquier otro enlace es una pantalla nueva, aunque su ruta ya esté en el rastro con otra consulta: la bandeja
 *   abierta con "Ver aportes recibidos" de una campaña no es regresar a la bandeja de antes.
 */
export function registrarEnElRastro(url: string): number | null {
  const lista = leerLista(leerRastro());
  const ultima = lista.length - 1;
  const conHistorial = historialEn > 0 && performance.now() - historialEn < VIGENCIA_DE_LA_MARCA_MS;
  historialEn = 0;

  let exacta = -1;
  for (let k = ultima; k >= 0; k--) if (lista[k].url === url) { exacta = k; break; }
  const deRuta = ultimaPosicion(lista, rutaDe(url));

  let nueva: Entrada[];
  let regreso = false;
  if (deRuta === ultima && ultima >= 0) {
    nueva = [...lista.slice(0, ultima), { url, atras: lista[ultima].atras }];
  } else if (conHistorial && (exacta >= 0 || deRuta >= 0)) {
    const i = exacta >= 0 ? exacta : deRuta;
    nueva = [...lista.slice(0, i), { url, atras: i === ultima - 1 ? lista[i].atras : false }];
    regreso = true;
  } else if (exacta >= 0) {
    nueva = [...lista.slice(0, exacta), { url, atras: false }];
    regreso = true;
  } else {
    // Pantalla nueva: se llegó avanzando.
    nueva = [...lista, { url, atras: true }].slice(-MAXIMO);
  }
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(nueva));
  } catch {
    // Sin sessionStorage (ventana privada estricta): "Volver" usa su destino fijo.
  }
  window.dispatchEvent(new Event(EVENTO));
  return regreso ? (leerPosiciones()[url] ?? null) : null;
}

/**
 * A dónde lleva "Volver" estando en `rutaActual`: la pantalla anterior del rastro, con su consulta, y si se puede ir
 * con el atrás del navegador. null si no hay (se entró directo, o el rastro no tiene la pantalla actual) o si la
 * anterior es una subpantalla de la actual (p. ej. se llegó a la ficha desde sus roles): entonces "Volver" usa su
 * destino fijo, que es la pantalla de arriba.
 */
export function destinoDelRastro(crudo: string, rutaActual: string): { url: string; conAtras: boolean } | null {
  const lista = leerLista(crudo);
  const i = ultimaPosicion(lista, rutaActual);
  if (i <= 0) return null;
  const anterior = lista[i - 1].url;
  if (rutaDe(anterior).startsWith(`${rutaActual}/`)) return null;
  // El atrás del navegador solo si la actual es la última del rastro y se llegó a ella avanzando.
  return { url: anterior, conAtras: lista[i].atras && i === lista.length - 1 };
}

/** Cómo se llama cada pantalla del panel en "Volver …" ("al directorio", "a la campaña"...). */
const NOMBRES: [RegExp, string][] = [
  [/^\/sistema$/, "al inicio del panel"],
  [/^\/sistema\/pendientes$/, "a pendientes"],
  [/^\/sistema\/campanas$/, "al listado de campañas"],
  [/^\/sistema\/campanas\/dashboard$/, "al dashboard de campañas"],
  [/^\/sistema\/campanas\/\d+$/, "a la campaña"],
  [/^\/sistema\/tematicas$/, "a temáticas"],
  [/^\/sistema\/especialidades$/, "a especialidades"],
  [/^\/sistema\/organizaciones$/, "a organizaciones"],
  [/^\/aportes$/, "a la bandeja de aportes"],
  [/^\/aportes\/dashboard$/, "al dashboard de aportes"],
  [/^\/apelaciones$/, "a apelaciones"],
  [/^\/tickets$/, "a tickets"],
  [/^\/usuarios$/, "al directorio"],
  [/^\/usuarios\/dashboard$/, "al dashboard de usuarios"],
  [/^\/usuarios\/sanciones$/, "a sanciones"],
  [/^\/usuarios\/supervisores$/, "a supervisores"],
  [/^\/usuarios\/supervisores\/\d+$/, "a la actividad del supervisor"],
  [/^\/usuarios\/\d+$/, "a la ficha del usuario"],
  [/^\/usuarios\/\d+\/roles$/, "a los roles del usuario"],
  [/^\/supervisar$/, "a supervisar"],
  [/^\/supervisar\/campanas$/, "a campañas supervisadas"],
  [/^\/supervisar\/reportes$/, "a reportes"],
  [/^\/supervisar\/sanciones$/, "a sanciones"],
  [/^\/supervisar\/sanciones\/\d+$/, "a la sanción del usuario"],
  [/^\/supervisar\/\d+$/, "a la campaña"],
  [/^\/supervisar\/\d+\/panel$/, "al panel de la campaña"],
  [/^\/supervisar\/\d+\/usuarios$/, "a participantes"],
  [/^\/supervisar\/\d+\/usuarios\/[^/]+\/aportes$/, "a los aportes del participante"],
  [/^\/supervisar\/\d+\/usuarios\/[^/]+\/aportes\/\d+$/, "al aporte"],
];

export function nombreDePantalla(ruta: string): string {
  return NOMBRES.find(([patron]) => patron.test(ruta))?.[1] ?? "a la pantalla anterior";
}
