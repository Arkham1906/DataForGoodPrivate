// Analizador de intereses (2026-10-07): convierte lo que la persona escribe sobre sus gustos
// ("me gusta andar en bici y cuidar perritos") en temáticas ("Movilidad", "Protección animal").
// Todo es local: un diccionario de palabras por temática, una lista de palabras vacías y otra de
// groserías. Nada sale a un servicio externo.
//
// Para cada palabra del texto, en este orden:
//   1. Si está en el diccionario, da la temática base (una de las 23 de lib/intereses.ts).
//   2. Si ya existe en el catálogo (una temática que escribió otra persona), da esa.
//   3. Si es palabra vacía ("gusta", "hacer", "mucho"), grosería o muy corta, se ignora.
//   4. Si no, se vuelve una temática nueva con la palabra en singular ("Ajedrez", "Fotografía").
//
// Sin dependencias de servidor: lo usan el navegador (/bienvenida y /cuenta, al dar Enter) y el
// servidor (lib/tematicas/catalogo.ts valida con esTematicaNuevaValida antes de guardar).

/** Máximo de intereses en un perfil. */
export const MAXIMO_DE_INTERESES = 20;
/** Largo máximo del texto (= columna usuarios.intereses_texto). */
export const LARGO_MAXIMO_DEL_TEXTO = 500;
/** Máximo de temáticas que salen de un solo análisis. */
const MAXIMO_POR_ANALISIS = 10;
/** Una palabra nueva necesita al menos estas letras para volverse temática. */
const LARGO_MINIMO_NUEVA = 4;
const LARGO_MAXIMO_NUEVA = 40;

/** Nombre sin acentos, en minúsculas y con espacios simples: "Educación" y "educacion" son la misma. */
export function claveDeTematica(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}]+/gu, " ")
    .trim();
}

// Palabras del diccionario, ya sin acentos. Con "*" al final cuenta como prefijo ("bici*" atrapa
// "bicicleta" y "bicis"); sin "*", la palabra o su singular tiene que ser exacta (así "agua" no
// atrapa "aguacate").
const DICCIONARIO: Record<string, string[]> = {
  "Medio ambiente": ["ambient*", "ecolog*", "naturaleza", "planeta", "clima*", "sustentab*", "sostenib*", "contaminacion", "contaminar", "ecosistema*", "playa*"],
  "Salud urbana": ["salud", "medic*", "enfermer*", "hospital*", "clinica*", "doctor*", "nutricion*", "vacuna*", "enfermedad*", "psicolog*", "bienestar"],
  "Educación": ["educ*", "escuela*", "ensen*", "maestr*", "profesor*", "estudi*", "aprend*", "alfabetiz*", "tutor*", "universidad*", "docente*"],
  "Infraestructura": ["infraestructura*", "bache*", "pavimen*", "calle", "construc*", "puente*", "alumbrado*"],
  "Protección animal": ["animal*", "perro*", "perrit*", "gato*", "gatit*", "mascota*", "veterinar*", "callejer*", "adopt*"],
  "Movilidad": ["movilidad", "bici*", "ciclis*", "ciclov*", "transporte*", "camion*", "autobus*", "trafico", "vialidad*", "peaton*", "metro", "coche*", "carro", "auto", "motocicleta*"],
  "Cultura": ["cultur*", "arte", "artist*", "artesan*", "music*", "cancion*", "teatro*", "cine", "danza*", "bail*", "museo*", "leer", "lectura*", "libro*", "literatura*", "historia*", "pintar", "pintura*", "poesia*", "escribir", "escritura*", "tradicion*", "fotograf*", "dibuj*"],
  "Agua y saneamiento": ["agua", "drenaje*", "saneamiento", "rio", "laguna*", "lago", "potable"],
  "Calidad del aire": ["aire", "smog", "humo", "emision*", "quema*"],
  "Residuos y reciclaje": ["recicl*", "residuo*", "basura*", "desecho*", "composta*", "plastico*", "limpi*", "reutiliz*"],
  "Biodiversidad": ["biodiversidad", "flora", "fauna", "planta*", "arbol*", "bosque*", "selva*", "especie*", "ave", "pajaro*", "insecto*", "abeja*", "mariposa*", "jardin*", "reforest*", "tortuga*", "mar"],
  "Espacios públicos": ["parque*", "plaza*", "espacio*", "banqueta*"],
  "Seguridad ciudadana": ["seguridad", "delincuencia*", "robo*", "violencia*", "crimen*", "policia*", "vigilancia*"],
  "Protección civil": ["civil", "sismo*", "terremoto*", "huracan*", "inundacion*", "incendio*", "emergencia*", "desastre*", "rescat*", "bombero*", "auxilio*"],
  "Accesibilidad": ["accesib*", "discapacidad*", "rampa*", "inclusion*", "inclusiv*", "sordo*", "ciego*", "braille"],
  "Igualdad de género": ["genero", "igualdad", "mujer*", "feminis*", "equidad", "lgbt*"],
  "Derechos humanos": ["derecho*", "migrante*", "indigena*", "justicia*", "discrimin*", "dignidad"],
  "Transparencia y gobierno": ["transparencia*", "gobierno*", "politic*", "corrupcion*", "eleccion*", "presupuesto*", "rendicion"],
  "Vivienda": ["vivienda*", "habitacional*", "inmobiliari*"],
  "Alimentación y agricultura": ["aliment*", "agricult*", "cultivo*", "cultivar", "siembra*", "sembrar", "huerto*", "huerta*", "cocin*", "comida*", "ganader*", "cosecha*", "receta*", "fruta*", "verdura*", "hortaliza*"],
  "Empleo y economía local": ["emple*", "trabajo", "economia*", "negocio*", "emprend*", "comercio*", "mercado*", "tianguis", "finanza*", "ahorro*", "cooperativa*"],
  "Tecnología y conectividad": ["tecnolog*", "internet", "computa*", "programa*", "software", "robot*", "conectividad", "digital*", "celular*", "videojuego*", "codigo", "electronica*", "artificial"],
  "Deporte y recreación": ["deport*", "futbol*", "basquet*", "beisbol*", "voleibol*", "voley*", "nadar", "natacion", "correr", "ejercicio*", "gimnasio*", "gym", "yoga", "caminar", "caminata*", "senderismo", "excursion*", "recreacion*", "juego*", "jugar", "boxeo", "tenis", "atletismo", "entrenar", "patinar", "acampar", "pasear", "paseo*", "pesca*"],
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

// Groserías y términos ofensivos (sin acentos). Con "*", prefijo; sin él, palabra exacta.
const GROSERIAS = [
  "pendej*", "chingad*", "chingar", "chinga", "chingon*", "verga", "vergas", "puta", "putas", "puto", "putos",
  "mierd*", "cabron*", "culer*", "culo", "culos", "joto", "jotos", "maricon*", "marica*", "pinche*", "mamon",
  "mamona", "mamada", "mamadas", "cogid*", "coger", "nalga*", "teta", "tetas", "pene", "penes", "huevon*",
  "idiota*", "estupid*", "imbecil*", "zorra", "zorras", "nazi*", "hitler", "porno*", "sexo",
];

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
  if (/[lrndj]es$/.test(p)) return p.slice(0, -2);
  if (/[aeo]s$/.test(p)) return p.slice(0, -1);
  return p;
}

function esGroseria(clave: string): boolean {
  return clave.split(" ").some((palabra) => coincide(palabra, GROSERIAS) || coincide(singular(palabra), GROSERIAS));
}

function temaDelDiccionario(clave: string): string | null {
  const enSingular = singular(clave);
  for (const [tema, palabras] of Object.entries(DICCIONARIO)) {
    if (coincide(clave, palabras) || coincide(enSingular, palabras)) return tema;
  }
  return null;
}

/** "fotografía" → "Fotografía". También la usa el servidor al dar de alta una temática nueva. */
export function conMayuscula(palabra: string): string {
  return palabra.charAt(0).toLocaleUpperCase("es") + palabra.slice(1);
}

/**
 * ¿Se puede crear esta temática nueva? Letras, espacios o guiones; de 4 a 40 letras; hasta tres
 * palabras; sin groserías y que no sea solo palabras vacías. La usa el servidor antes de
 * agregarla al catálogo, con las mismas reglas que el análisis.
 */
export function esTematicaNuevaValida(nombre: string): boolean {
  const limpio = nombre.trim();
  const clave = claveDeTematica(limpio);
  if (!/^\p{L}[\p{L} -]*$/u.test(limpio)) return false;
  if (clave.replace(/ /g, "").length < LARGO_MINIMO_NUEVA || limpio.length > LARGO_MAXIMO_NUEVA) return false;
  const palabras = clave.split(" ");
  if (palabras.length > 3) return false;
  if (esGroseria(clave)) return false;
  return palabras.some((p) => !PALABRAS_VACIAS.has(p));
}

/**
 * Temáticas que salen de un texto, en el orden en que aparecen y sin repetir (máximo 10).
 * `catalogo` son las temáticas que ya existen (GET /api/tematicas): si una palabra coincide con
 * una, se usa ese nombre en lugar de crear otra.
 */
export function analizarIntereses(texto: string, catalogo: string[]): string[] {
  const porClave = new Map(catalogo.map((nombre) => [claveDeTematica(nombre), nombre]));
  const resultado: string[] = [];
  const vistas = new Set<string>();

  function agregar(nombre: string) {
    const clave = claveDeTematica(nombre);
    if (vistas.has(clave)) return;
    vistas.add(clave);
    resultado.push(nombre);
  }

  for (const original of texto.slice(0, LARGO_MAXIMO_DEL_TEXTO).split(/[^\p{L}]+/u)) {
    if (resultado.length >= MAXIMO_POR_ANALISIS) break;
    const clave = claveDeTematica(original);
    if (clave.length < 3 || esGroseria(clave)) continue;

    const delDiccionario = temaDelDiccionario(clave);
    if (delDiccionario) {
      agregar(delDiccionario);
      continue;
    }
    const enSingular = singular(original);
    const existente = porClave.get(claveDeTematica(enSingular)) ?? porClave.get(clave);
    if (existente) {
      agregar(existente);
      continue;
    }
    if (PALABRAS_VACIAS.has(clave) || PALABRAS_VACIAS.has(claveDeTematica(enSingular))) continue;
    const nueva = conMayuscula(enSingular);
    if (esTematicaNuevaValida(nueva)) agregar(nueva);
  }
  return resultado;
}
