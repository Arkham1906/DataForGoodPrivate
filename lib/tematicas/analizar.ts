// Analizador de intereses (2026-10-07): convierte lo que la persona escribe sobre sus gustos
// ("me gusta andar en bici y cuidar perritos") en temáticas ("Movilidad", "Protección animal").
// Todo es local: un diccionario de palabras clave por temática y el filtro de palabras
// inapropiadas (lib/tematicas/filtro.ts). Nada sale a un servicio externo.
//
// Desde el 2026-10-20 (decisión del usuario) solo reconoce palabras clave: el texto da temáticas
// que ya existen (las base o las del catálogo ya aprobadas) y nunca crea temáticas nuevas; lo
// que no es palabra clave se ignora ("me gusta jugar en linea" ya no da "Linea"). Antes cada
// palabra desconocida se volvía una temática nueva.
//
// Primero el texto se parte en partes (por comas, puntos y conectores como "y"). Una parte con una
// palabra inapropiada (grosería, sexual, violencia, drogas, odio; también disfrazada: "p3nd3jo",
// "p u t o") se descarta completa (2026-10-19).
//
// Después, en cada parte que queda se buscan:
//   - frases de dos o tres palabras ("futbol americano", "juegos de mesa", "medio ambiente");
//   - palabras clave del diccionario (también en plural: "videojuegos", "perritos");
//   - temáticas del catálogo por su nombre ("ajedrez" si el catálogo tiene "Ajedrez").
// Las palabras ambiguas (DEBILES: "rescatar", "jugar", "limpiar"...) solo cuentan si en esa parte
// no hubo ninguna clara: "rescatar perritos" da "Protección animal" y no "Protección civil".
//
// Sin dependencias de servidor: lo usan el navegador (/bienvenida y /cuenta, al dar Enter) y el
// servidor (lib/tematicas/catalogo.ts usa esTematicaNuevaValida para bloquear las que ya existían).

import { esInapropiada } from "@/lib/tematicas/filtro";

/** Máximo de intereses en un perfil. */
export const MAXIMO_DE_INTERESES = 20;
/** Largo máximo del texto (= columna usuarios.intereses_texto). */
export const LARGO_MAXIMO_DEL_TEXTO = 500;
/** Máximo de temáticas que salen de un solo análisis. */
const MAXIMO_POR_ANALISIS = 10;
/** Una palabra nueva necesita al menos estas letras para volverse temática. */
const LARGO_MINIMO_NUEVA = 4;
const LARGO_MAXIMO_NUEVA = 40;
/** Largo del nombre que el SuperUsuario escribe en /sistema/tematicas (la columna `tematicas.nombre` es de 60). */
export const LARGO_DEL_NOMBRE = { minimo: 3, maximo: 60 } as const;

/** Nombre sin acentos, en minúsculas y con espacios simples: "Educación" y "educacion" son la misma. */
export function claveDeTematica(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}]+/gu, " ")
    .trim();
}

// Palabras clave del diccionario, ya sin acentos ni mayúsculas. Con "*" al final cuenta como
// prefijo ("bici*" atrapa "bicicleta" y "bicis"); sin "*", la palabra o su singular tiene que ser
// exacta (así "agua" no atrapa "aguacate"). Con espacios es una frase: las palabras seguidas, la
// última también en plural ("juegos de mesa"). Al agregar: un prefijo no debe atrapar palabras de
// otra temática ("tren" exacto por "entrenar", "foto" exacto por "fotocopia" no importa).
const DICCIONARIO: Record<string, string[]> = {
  "Medio ambiente": [
    "medio ambiente", "cambio climatico", "calentamiento global", "energia renovable", "energia solar", "ambient*",
    "ecolog*", "naturaleza", "planeta", "clima*", "sustentab*", "sostenib*", "contaminacion", "contaminar",
    "ecosistema*", "playa*", "renovable*", "montana*", "cerro*", "volcan*",
  ],
  "Salud": [
    "salud mental", "salud", "medic*", "enfermer*", "hospital*", "clinica*", "doctor*", "nutricion*", "nutriolog*",
    "vacuna*", "enfermedad*", "psicolog*", "psiquiatr*", "bienestar", "terapia*", "dental", "dentista*", "farmacia*",
    "meditacion", "meditar",
  ],
  "Educación": [
    "educ*", "escuela*", "ensen*", "maestr*", "profesor*", "estudi*", "aprend*", "alfabetiz*", "tutor*", "universidad*",
    "docente*", "ciencia*", "cientific*", "matematica*", "fisica", "quimica", "astronom*", "investigacion*", "idioma*",
    "ingles", "frances", "aleman", "japones", "conocimiento*",
  ],
  "Infraestructura": [
    "infraestructura*", "bache*", "pavimen*", "construc*", "puente*", "alumbrado*", "carretera*", "arquitect*",
    "urbanismo", "ingenier*",
  ],
  // Causa (2026-10-27): rescate, maltrato y conservación de especies. Mascotas y granja: Animales.
  "Protección animal": [
    "callejer*", "refugio*", "albergue*", "esteriliz*", "maltrato*", "rescatista*", "proteccion animal",
    "bienestar animal", "maltrato animal", "rescate animal", "rescatar animales", "rescatar perros", "rescatar gatos", "rescatar perritos", "rescatar gatitos", "rescatar animalitos", "rescatar tortugas", "liberar tortugas", "tortugas marinas",
    "perros callejeros", "gatos callejeros", "animales callejeros", "fauna silvestre", "especies en peligro",
    "en peligro de extincion", "trafico de especies", "conservacion*", "extincion", "santuario*",
  ],
  // Tema general (2026-10-27): mascotas, animales de granja, caballos.
  "Animales": [
    "animal*", "perro*", "perrit*", "lomit*", "cachorr*", "gato*", "gatit*", "michi*", "felino*", "canino*", "mascota*",
    "veterinar*", "caballo", "caballos", "conejo*", "hamster*", "perico*", "loro*", "granja*", "vaca*", "gallina*",
    "borrego*", "cerdo*", "puerco*", "chivo*", "cabra*", "pato*", "pez", "peces", "acuario*", "tortuguita*",
  ],
  "Movilidad": [
    "transporte publico", "movilidad", "bici*", "ciclis*", "ciclov*", "transporte*", "camion*", "autobus*", "trafico",
    "vialidad*", "peaton*", "metro", "coche*", "carro", "carros", "auto", "autos", "motocicleta*", "moto", "motos",
    "tren", "trenes", "taxi*", "scooter*", "manejar", "conducir",
  ],
  "Arte y cultura": [
    "cultur*", "arte", "artes", "artist*", "artesan*", "music*", "cancion*", "cantar", "canto", "coro", "coros",
    "concierto*", "banda*", "rock", "jazz", "rap", "guitarra*", "piano*", "violin*", "teatro*", "actuacion", "actuar",
    "danza*", "bail*", "ballet", "museo*", "leer", "lectura*", "libro*", "biblioteca*", "literatura*", "novela*",
    "historia*", "pintar", "pintura*", "poesia*", "poema*", "escribir", "escritura*", "tradicion*", "fotograf*", "foto",
    "fotos", "dibuj*", "escultura*", "ceramica*", "festival*", "patrimonio*", "arqueolog*", "diseno*", "moda", "muerto",
    "graffiti*", "grafiti*", "mural*",
  ],
  // Tema general (2026-10-27): cine, series, anime, videojuegos, juegos de mesa.
  "Entretenimiento": [
    "cine", "pelicula*", "serie*", "anime", "manga*", "comic*", "videojuego*", "consola*", "gamer*", "gaming",
    "esports", "nintendo", "playstation", "xbox", "streaming", "juegos de mesa", "ajedrez", "entretenimiento",
    "podcast*", "youtube", "netflix", "karaoke", "conciertos",
  ],
  "Agua y saneamiento": [
    "agua", "drenaje*", "saneamiento", "rio", "rios", "laguna*", "lago", "lagos", "potable", "lluvia*", "pozo", "pozos",
    "acuifero*", "oceano*",
  ],
  "Calidad del aire": ["calidad del aire", "smog", "humo", "emision*", "quema*", "ozono"],
  "Residuos y reciclaje": [
    "recicl*", "residuo*", "basura*", "desecho*", "composta*", "plastico*", "reutiliz*", "carton*", "vidrio*", "unicel",
  ],
  "Biodiversidad": [
    "biodiversidad", "flora", "fauna", "arbol*", "bosque*", "selva*", "especie*", "ave", "aves", "pajaro*",
    "ornitolog*", "insecto*", "abeja*", "mariposa*", "reforest*", "tortuga*", "mar", "biolog*", "botanic*", "hongo*",
    "reptil*", "anfibio*", "ballena*", "delfin*", "coral*", "manglar*", "naturalista*",
  ],
  // Tema general (2026-10-27): jardín y plantas. Especies y ecosistemas: Biodiversidad.
  "Plantas y jardinería": [
    "planta*", "jardin*", "cactus", "flor", "flores", "suculenta*", "orquidea*", "bonsai*", "maceta*", "jardineria",
  ],
  "Espacios públicos": [
    "espacio publico", "espacios publicos", "parque*", "plaza*", "banqueta*", "malecon*", "andador*", "glorieta*",
  ],
  // "robo", "robos", "robar" exactos: "robo*" atrapaba "robótica" y "robots" (2026-10-27).
  "Seguridad": [
    "seguridad ciudadana", "seguridad", "delincuencia*", "robo", "robos", "robar", "violencia*", "crimen*", "policia*",
    "vigilancia*", "asalto*",
  ],
  "Protección civil": [
    "proteccion civil", "primeros auxilios", "sismo*", "terremoto*", "huracan*", "inundacion*", "incendio*",
    "emergencia*", "desastre*", "bombero*", "auxilio*", "paramedic*", "brigada*", "simulacro*",
  ],
  "Accesibilidad e inclusión": [
    "lengua de senas", "silla de ruedas", "accesib*", "discapacidad*", "rampa*", "inclusion*", "inclusiv*", "sordo*",
    "ciego*", "braille", "autismo", "autista*", "neurodivers*", "inclusion social",
  ],
  "Igualdad de género": [
    "igualdad de genero", "diversidad sexual", "genero", "igualdad", "mujer*", "feminis*", "equidad", "lgbt*",
  ],
  "Derechos humanos": [
    "derechos humanos", "migrante*", "indigena*", "justicia*", "discrimin*", "dignidad", "refugiad*", "activismo",
    "activista*", "pobreza", "desigualdad", "infancia", "ninez", "adultos mayores", "personas mayores", "tercera edad",
  ],
  "Gobierno y participación ciudadana": [
    "transparencia*", "gobierno*", "politic*", "corrupcion*", "eleccion*", "presupuesto*", "rendicion", "democracia*",
    "voto", "votos", "votar", "participacion ciudadana", "consulta*", "cabildo*",
  ],
  "Vivienda": ["vivienda*", "habitacional*", "inmobiliari*", "renta*", "hipoteca*"],
  "Agricultura": [
    "agricult*", "cultivo*", "cultivar", "siembra*", "sembrar", "huerto*", "huerta*", "ganader*", "cosecha*",
    "hortaliza*", "agroecolog*", "maiz", "frijol*", "milpa*",
  ],
  // Tema general (2026-10-27): recetas y comida. Cultivo y ganadería: Agricultura.
  "Cocina y alimentación": [
    "aliment*", "cocin*", "comida*", "receta*", "fruta*", "verdura*", "pastel*", "reposter*", "hornear", "panader*",
    "gastronom*", "chef", "vegan*", "vegetarian*", "cafe",
  ],
  "Trabajo y economía": [
    "economia local", "emple*", "economia*", "negocio*", "emprend*", "comercio*", "tianguis", "finanza*", "ahorro*",
    "cooperativa*", "marketing", "ventas", "contabilidad", "inversion*", "oficio*",
  ],
  "Tecnología": [
    "inteligencia artificial", "redes sociales", "tecnolog*", "internet", "computa*", "programacion", "programar",
    "programador*", "software", "robot*", "conectividad", "digital*", "celular*", "codigo", "electronica*",
    "ciberseguridad", "aplicacion*", "dron", "drones",
  ],
  "Deporte": [
    "artes marciales", "futbol americano", "deport*", "futbol*", "basquet*", "beisbol*", "voleibol*", "voley*", "nadar",
    "natacion", "correr", "ejercicio*", "gimnasio*", "gym", "yoga", "pilates", "crossfit", "boxeo", "tenis",
    "atletismo", "entrenar", "patinar", "patineta*", "skate*", "surf*", "maraton*", "karate", "judo", "taekwondo",
    "equitacion", "cancha*", "lucha libre", "soccer", "golf", "box",
  ],
  // Tema general (2026-10-27): senderismo, acampar, pesca, paseos. Deportes: Deporte.
  "Aire libre": [
    "caminar", "caminata*", "senderismo", "excursion*", "recreacion*", "escalada", "escalar", "alpinismo", "acampar",
    "pasear", "paseo*", "pesca*", "pescar", "aire libre", "campamento*", "acampada*", "picnic*", "montanismo", "kayak*",
    "rapel",
  ],
};

// Palabras ambiguas: solo cuentan si en esa parte del texto no hubo una palabra clave clara.
// "jugar videojuegos" → solo Entretenimiento; "adoptar perritos" → solo Animales; pero
// "me gusta rescatar" sola sí da Protección civil.
const DEBILES: Record<string, string[]> = {
  "Protección civil": ["rescat*", "civil"],
  "Deporte": ["juego*", "jugar"],
  "Residuos y reciclaje": ["limpi*"],
  "Espacios públicos": ["espacio*"],
  "Infraestructura": ["calle", "calles", "obra*"],
  "Trabajo y economía": ["trabajo", "mercado*"],
  "Calidad del aire": ["aire"],
  "Derechos humanos": ["derecho*", "voluntariado"],
  "Tecnología": ["programa*", "artificial"],
  "Arte y cultura": ["tocar"],
  "Animales": ["adopt*"],
};

// Palabras que nunca son un interés por sí solas: conectores, pronombres y los verbos con que la
// gente cuenta sus gustos ("me gusta", "disfruto", "quiero hacer").
const PALABRAS_VACIAS = new Set(
  `a al algo algun alguna algunas alguno algunos ahi aqui asi ante bajo bien bastante buen buena bueno
  cada casi como con contra cosa cosas cual cuales cuando de del demas desde donde dos el ella ellas ellos
  en entre era eres es esa esas ese eso esos esta estas este esto estos estoy estar gran grande ha hace
  hacer hacia hago hasta hay la las le les lo los mas me mi mis mucha muchas mucho muchos muy nada ni no
  nos nosotros nuestra nuestro o otra otras otro otros para pero poco por porque pues que quien se ser si
  sin sobre solo son soy su sus tal tambien tan tanto te tengo tener ti todo toda todas todos tu tus un
  una unas uno unos y ya yo
  gusta gustan gusto gustos gustaria encanta encantan encantaria interesa interesan interes intereses
  interesante prefiero preferencia preferencias quiero quisiera disfruto disfrutar amo adoro odio fan
  favorito favorita favoritos favoritas hobby hobbies pasatiempo pasatiempos actividad actividades tema
  temas tipo tipos forma manera mundo vida gente persona personas comunidad otros demas dia dias tiempo
  libre ratos rato vez veces semana fines fin tarde tardes noche noches manana siempre nunca ademas
  mejor mejores nuevo nueva nuevos nuevas saber conocer puedo puede ver salir ir voy vamos estar hacerlo
  andar ando anda pasar quedar dar poder tomar llevar
  ayudar apoyar participar colaborar trabajar cosa cuidar cuidado proteger mejorar aportar sobretodo
  mucho bueno buenas buenos cerca lejos casa hogar familia amigos amigas`.split(/\s+/),
);

function coincide(palabra: string, lista: string[]): boolean {
  return lista.some((p) => (p.endsWith("*") ? palabra.startsWith(p.slice(0, -1)) : palabra === p));
}

/**
 * Singular aproximado de una palabra en español: "perros" → "perro", "árboles" → "árbol", "canciones" → "canción",
 * "luces" → "luz". Respeta acentos. No toca palabras que terminan en -is ("tenis") ni en vocal
 * acentuada + s ("autobús").
 */
export function singular(palabra: string): string {
  const p = palabra.toLowerCase();
  if (p.length <= LARGO_MINIMO_NUEVA) return p;
  if (p.endsWith("ces")) return `${p.slice(0, -3)}z`;
  // "canciones" → "canción", "leones" → "león": el singular recupera el acento.
  if (p.endsWith("ones")) return `${p.slice(0, -4)}ón`;
  // "paisajes" → "paisaje", "viajes" → "viaje" (más comunes que "relojes" → "reloj").
  if (p.endsWith("ajes")) return p.slice(0, -1);
  if (/[lrndj]es$/.test(p)) return p.slice(0, -2);
  if (/[aeo]s$/.test(p)) return p.slice(0, -1);
  return p;
}

/** Temática de una palabra suelta según `diccionario` (sin las frases), o null. */
function temaDeLaPalabra(clave: string, diccionario: Record<string, string[]>): string | null {
  const enSingular = singular(clave);
  for (const [tema, palabras] of Object.entries(diccionario)) {
    const sueltas = palabras.filter((p) => !p.includes(" "));
    if (coincide(clave, sueltas) || coincide(enSingular, sueltas)) return tema;
  }
  return null;
}

/** Frases del diccionario, de la más larga a la más corta, con sus palabras ya en singular. */
const FRASES = Object.entries(DICCIONARIO)
  .flatMap(([tema, palabras]) =>
    palabras.filter((p) => p.includes(" ")).map((frase) => ({ tema, palabras: frase.split(" ").map(singular) })),
  )
  .sort((a, b) => b.palabras.length - a.palabras.length);

/**
 * ¿Empieza en `claves[i]` una frase? Compara palabra por palabra en singular ("juego de mesa" y
 * "juegos de mesa" son la misma). Devuelve el tema y cuántas palabras ocupa.
 */
function fraseEn(claves: string[], i: number, frases: { tema: string; palabras: string[] }[]) {
  for (const frase of frases) {
    const tramo = claves.slice(i, i + frase.palabras.length).map(singular);
    if (tramo.length === frase.palabras.length && tramo.every((p, k) => p === frase.palabras[k])) {
      return { tema: frase.tema, largo: frase.palabras.length };
    }
  }
  return null;
}

/**
 * ¿Es un nombre aceptable para una temática? Letras, espacios o guiones; de 4 a 40 letras; hasta
 * tres palabras; sin palabras inapropiadas (lib/tematicas/filtro.ts) y que no sea solo palabras
 * vacías. Desde el 2026-10-20 el texto ya no crea temáticas; el servidor la usa para dejar de
 * ofrecer las de usuario que ya existían y no pasan el filtro (catalogo.ts, bloqueadaPorElFiltro).
 */
export function esTematicaNuevaValida(nombre: string): boolean {
  const limpio = nombre.trim();
  const clave = claveDeTematica(limpio);
  if (!/^\p{L}[\p{L} -]*$/u.test(limpio)) return false;
  if (clave.replace(/ /g, "").length < LARGO_MINIMO_NUEVA || limpio.length > LARGO_MAXIMO_NUEVA) return false;
  const palabras = clave.split(" ");
  if (palabras.length > 3) return false;
  if (esInapropiada(limpio)) return false;
  return palabras.some((p) => !PALABRAS_VACIAS.has(p));
}

export type AnalisisDeIntereses = {
  /** Temáticas en el orden en que aparecen, sin repetir (máximo 10). */
  tematicas: string[];
  /** Partes del texto que se descartaron por tener palabras inapropiadas, para avisarle a la persona. */
  descartadas: number;
};

/** Palabras que unen dos gustos: ahí empieza otra parte del texto ("bici y asesinar enanos"). */
const CONECTORES = new Set(["y", "e", "pero", "ni", "ademas", "tambien", "aunque", "mientras"]);

type Ficha = { texto: string; cortaDespues: boolean; mala: boolean };

/**
 * Separa el texto en fichas (palabras) y marca dónde termina cada parte. Se separa por espacios y
 * signos de puntuación, pero no por números ni símbolos, para que el filtro vea completas
 * "p3nd3jo" o "p.u.t.o". Un punto o "!" al final de una palabra cierra la parte.
 */
function fichasDelTexto(texto: string): Ficha[] {
  const fichas: Ficha[] = [];
  for (const pedazo of texto.slice(0, LARGO_MAXIMO_DEL_TEXTO).split(/[,;:¿?¡()"«»/\[\]{}\n]+/u)) {
    const palabras = pedazo.split(/\s+/).filter(Boolean);
    palabras.forEach((cruda, i) => {
      // Sin signos a los lados ("puto!", "...bici"); "@" y "$" se quedan porque imitan letras.
      const limpia = cruda.replace(/^[^\p{L}\p{N}@$]+|[^\p{L}\p{N}@$]+$/gu, "");
      const cierra = /[.!]$/.test(cruda) || i === palabras.length - 1;
      if (limpia) fichas.push({ texto: limpia, cortaDespues: cierra, mala: false });
      else if (cierra && fichas.length > 0) fichas[fichas.length - 1].cortaDespues = true;
    });
  }
  return fichas;
}

/**
 * Marca como malas las letras sueltas seguidas que juntas forman algo inapropiado ("p u t o"). Se
 * prueba cada tramo de 3 o más, porque a los lados puede haber otras sueltas ("p u t o y la").
 */
function marcarLetrasSueltas(fichas: Ficha[]) {
  for (let i = 0; i < fichas.length; ) {
    let j = i;
    while (j < fichas.length && fichas[j].texto.length === 1) j++;
    for (let a = i; a + 3 <= j; a++) {
      for (let b = a + 3; b <= j; b++) {
        if (esInapropiada(fichas.slice(a, b).map((f) => f.texto).join(""))) {
          for (let k = a; k < b; k++) fichas[k].mala = true;
        }
      }
    }
    i = Math.max(j, i + 1);
  }
}

/**
 * Agrupa las fichas en partes: termina una en cada signo de puntuación y en cada conector. Una "y"
 * o "e" entre letras sueltas puede ser parte del disfraz ("p u y t o") y no corta, salvo que lo de
 * antes ya sea malo ("p u t o y la bici": la bici se queda).
 */
function partesDelTexto(fichas: Ficha[]): Ficha[][] {
  const partes: Ficha[][] = [];
  let actual: Ficha[] = [];
  const cerrar = () => {
    if (actual.length > 0) partes.push(actual);
    actual = [];
  };
  fichas.forEach((ficha, i) => {
    const palabra = claveDeTematica(ficha.texto);
    const entreSueltas = palabra.length === 1 && (fichas[i - 1]?.texto.length === 1 || fichas[i + 1]?.texto.length === 1);
    if (CONECTORES.has(palabra) && !ficha.mala && (!entreSueltas || fichas[i - 1]?.mala)) {
      cerrar();
    } else {
      actual.push(ficha);
    }
    if (ficha.cortaDespues) cerrar();
  });
  cerrar();
  return partes;
}

/**
 * Palabras de una parte del texto, ya como clave (sin acentos ni mayúsculas). Una palabra con
 * números o símbolos ("4x4", "c++") no cuenta y corta una frase (`null`); con punto o guion se
 * toma cada pedazo ("auto-cuidado").
 */
function clavesDeLaParte(parte: Ficha[]): (string | null)[] {
  return parte.flatMap((ficha) =>
    /[^\p{L}.\-]/u.test(ficha.texto) ? [null] : ficha.texto.split(/[.\-]+/).map(claveDeTematica).filter(Boolean),
  );
}

/**
 * Temáticas de una parte del texto: las claras (frases, palabras clave, nombres del catálogo) y,
 * solo si no hubo ninguna, las ambiguas (DEBILES).
 */
function temasDeLaParte(
  claves: (string | null)[],
  frasesDelCatalogo: { tema: string; palabras: string[] }[],
): string[] {
  const claras: string[] = [];
  const ambiguas: string[] = [];
  for (let i = 0; i < claves.length; ) {
    const clave = claves[i];
    if (clave === null) {
      i++;
      continue;
    }
    const tramo = claves.slice(i, claves.indexOf(null, i) === -1 ? undefined : claves.indexOf(null, i)) as string[];
    const frase = fraseEn(tramo, 0, FRASES) ?? fraseEn(tramo, 0, frasesDelCatalogo);
    if (frase) {
      claras.push(frase.tema);
      i += frase.largo;
      continue;
    }
    i++;
    if (clave.length < 3 || PALABRAS_VACIAS.has(clave)) continue;
    const clara = temaDeLaPalabra(clave, DICCIONARIO);
    if (clara) {
      claras.push(clara);
      continue;
    }
    const ambigua = temaDeLaPalabra(clave, DEBILES);
    if (ambigua) ambiguas.push(ambigua);
  }
  return claras.length > 0 ? claras : ambiguas;
}

/**
 * Temáticas que salen de un texto, solo de palabras clave (2026-10-20): nunca crea temáticas
 * nuevas. `catalogo` son las temáticas que ya se ofrecen (GET /api/tematicas, ya aprobadas): si
 * una palabra o frase coincide con el nombre de una ("ajedrez" → "Ajedrez"), se usa esa.
 *
 * El texto se parte en partes (por comas, puntos y conectores como "y" o "pero"). Si una parte
 * tiene una palabra inapropiada se descarta completa: en "follar putas y asesinar enanos" se van
 * también "enanos" (2026-10-19).
 */
export function analizarIntereses(texto: string, catalogo: string[]): AnalisisDeIntereses {
  const frasesDelCatalogo = catalogo
    .map((nombre) => ({ tema: nombre, palabras: claveDeTematica(nombre).split(" ").map(singular) }))
    .filter((f) => f.palabras.join("").length > 0)
    .sort((a, b) => b.palabras.length - a.palabras.length);
  const resultado: string[] = [];
  const vistas = new Set<string>();

  function agregar(nombre: string) {
    const clave = claveDeTematica(nombre);
    if (vistas.has(clave)) return;
    vistas.add(clave);
    resultado.push(nombre);
  }

  const fichas = fichasDelTexto(texto);
  marcarLetrasSueltas(fichas);
  for (const ficha of fichas) {
    // Cada palabra completa y, si tiene punto o guion, cada parte ("auto-cuidado").
    if (!ficha.mala) ficha.mala = esInapropiada(ficha.texto) || ficha.texto.split(/[.\-]+/).some(esInapropiada);
  }
  const partes = partesDelTexto(fichas);
  const buenas = partes.filter((parte) => !parte.some((f) => f.mala));
  const descartadas = partes.length - buenas.length;

  for (const parte of buenas) {
    for (const tema of temasDeLaParte(clavesDeLaParte(parte), frasesDelCatalogo)) {
      if (resultado.length >= MAXIMO_POR_ANALISIS) break;
      agregar(tema);
    }
  }
  return { tematicas: resultado, descartadas };
}
