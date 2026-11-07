// Sinónimos de las etiquetas (subtemáticas, 2026-11-04, a pedido del usuario): al proponer una etiqueta
// nueva, "Aguas negras" es lo mismo que "Aguas residuales", así que se usa la que ya existe en esa
// temática en vez de crear otra. Lo revisan el navegador (ui/SelectorDeEtiquetas,
// ui/SubtematicasDelPerfil, para avisar) y el servidor (lib/etiquetas/catalogo.ts, que manda).
// Se compara sin acentos ni mayúsculas y en singular, y desde el 2026-11-07 también con otro orden,
// faltas de ortografía y erratas (ver etiquetaEquivalente). La lista es a mano: un sinónimo nuevo se
// agrega aquí. Solo equivalentes reales: "Abejas" no va en Polinizadores porque es un caso, no lo mismo.
// Algunas no tienen sinónimo claro y quedan vacías. Sin imports de servidor.

import { claveDeTematica, singular } from "@/lib/tematicas/analizar";

export const SINONIMOS_DE_ETIQUETAS: Record<string, string[]> = {
  // Medio ambiente
  "Cambio climático": ["calentamiento global", "crisis climática", "emergencia climática"],
  Contaminación: ["polución"],
  Deforestación: ["tala", "tala de árboles", "tala ilegal", "tala clandestina", "desmonte"],
  Conservación: ["preservación", "preservación ambiental", "conservación ambiental"],
  "Energía renovable": ["energía limpia", "energía verde", "energía alternativa"],
  "Educación ambiental": ["conciencia ambiental", "concientización ambiental", "cultura ambiental"],
  Fauna: ["vida animal", "fauna silvestre", "vida silvestre"],
  Árboles: ["arbolado", "arbolado urbano"],

  // Salud
  "Salud mental": ["bienestar emocional", "salud emocional", "salud psicológica"],
  Nutrición: ["alimentación saludable", "alimentación sana", "dieta saludable"],
  Vacunación: ["vacunas", "vacunar", "inmunización", "campañas de vacunación"],
  Diabetes: ["diabetes mellitus"],
  "Salud materna": ["salud de la madre", "salud de las madres", "maternidad"],
  Adicciones: ["drogadicción", "farmacodependencia", "toxicomanía", "dependencia a sustancias"],
  "Enfermedades infecciosas": ["enfermedades contagiosas", "enfermedades transmisibles", "infecciones"],
  "Primeros auxilios": ["auxilio inmediato", "atención prehospitalaria"],

  // Educación
  Escuelas: ["colegios", "planteles escolares", "planteles educativos", "centros educativos"],
  Alfabetización: ["analfabetismo", "enseñar a leer y escribir"],
  "Educación inicial": ["educación temprana", "preescolar", "kínder"],
  Bibliotecas: ["salas de lectura", "bibliotecas públicas"],
  "Deserción escolar": ["abandono escolar", "abandono de estudios"],
  Becas: ["apoyos escolares", "apoyos educativos", "ayudas escolares"],
  "Educación digital": ["educación en línea", "educación virtual", "clases en línea", "alfabetización digital"],

  // Infraestructura
  "Calles y banquetas": ["calles", "banquetas", "aceras", "vialidades", "pavimentación", "pavimento"],
  Baches: ["hoyos en la calle", "hoyos en el pavimento"],
  "Alumbrado público": ["luminarias", "postes de luz", "lámparas públicas", "iluminación pública"],
  Puentes: ["pasos elevados", "puentes peatonales", "pasos a desnivel"],
  Drenaje: ["alcantarillado", "alcantarillas", "coladeras", "drenaje sanitario", "drenaje pluvial"],
  "Edificios públicos": ["inmuebles públicos", "edificios de gobierno", "edificios gubernamentales"],

  // Protección animal
  Adopción: ["adopción de animales", "adopción de mascotas", "adoptar mascotas"],
  Rescate: ["rescate animal", "rescate de animales"],
  Esterilización: ["castración", "castraciones", "esterilización de mascotas"],
  "Maltrato animal": ["crueldad animal", "abuso animal", "violencia animal"],
  "Animales callejeros": ["perros callejeros", "gatos callejeros", "animales abandonados", "animales sin hogar", "animales en situación de calle"],
  Refugios: ["albergues", "santuarios", "refugios de animales", "albergues de animales"],
  "Tenencia responsable": ["dueños responsables", "tenencia responsable de mascotas", "cuidado responsable de mascotas"],

  // Animales
  Perros: ["canes", "caninos", "lomitos", "perritos"],
  Gatos: ["felinos", "michis", "gatitos", "mininos"],
  Aves: ["pájaros", "pajaritos"],
  Peces: ["pececitos", "peces de ornato"],
  Reptiles: [],
  Insectos: ["bichos"],
  Caballos: ["equinos", "yeguas", "potros"],
  "Animales de granja": ["animales de corral", "animales de rancho"],
  "Fauna silvestre": ["animales silvestres", "animales salvajes", "vida silvestre"],

  // Movilidad
  "Transporte público": ["camiones urbanos", "transporte colectivo", "transporte urbano", "rutas de camión", "combis"],
  Bicicleta: ["bici", "ciclismo urbano"],
  Peatones: ["transeúntes", "viandantes"],
  Tráfico: ["tránsito", "congestión vial", "congestionamiento vial", "embotellamientos"],
  "Accidentes viales": ["accidentes de tránsito", "accidentes de tráfico", "accidentes automovilísticos", "choques", "siniestros viales"],
  Estacionamiento: ["cocheras", "parqueo", "parqueaderos", "aparcamiento"],
  patineta: ["monopatín", "skate", "skateboard"],

  // Arte y cultura
  Música: [],
  Pintura: ["artes plásticas"],
  Teatro: ["artes escénicas", "dramaturgia", "obras de teatro"],
  Danza: ["baile", "bailes"],
  Literatura: ["letras", "creación literaria"],
  Patrimonio: ["patrimonio cultural", "patrimonio histórico", "monumentos históricos", "sitios históricos"],
  Artesanías: ["arte popular", "trabajos artesanales", "artesanos"],
  Fotografía: ["fotos", "fotografía artística"],

  // Entretenimiento
  Cine: ["películas", "pelis", "cinematografía", "séptimo arte"],
  Videojuegos: ["juegos de video", "gaming", "consolas"],
  Series: ["series de televisión", "series de tv"],
  Conciertos: ["recitales", "tocadas", "música en vivo"],
  Festivales: [],
  "Juegos de mesa": ["juegos de tablero", "board games"],

  // Agua y saneamiento
  "Agua potable": ["agua para beber", "agua para consumo humano", "suministro de agua", "abastecimiento de agua", "agua de la llave"],
  "Fugas de agua": ["fugas", "tuberías rotas", "tubos rotos", "fugas en la red"],
  "Calidad del agua": ["agua contaminada", "contaminación del agua", "pureza del agua"],
  "Ríos y lagos": ["ríos", "lagos", "lagunas", "arroyos", "cuerpos de agua", "presas"],
  "Aguas residuales": ["aguas negras", "aguas reciduales", "aguas servidas", "aguas cloacales", "aguas sucias"],
  "Captación de lluvia": ["captación de agua de lluvia", "agua de lluvia", "cosecha de lluvia", "cosecha de agua", "captación pluvial"],

  // Calidad del aire
  Humo: ["humaredas"],
  Polvo: ["tolvaneras", "polvaredas"],
  "Emisiones de vehículos": ["emisiones vehiculares", "contaminación vehicular", "gases de vehículos", "gases de autos", "humo de carros", "humo de coches"],
  Quemas: ["quema de basura", "quema de llantas", "quema de pastizales", "quemas agrícolas"],
  "Malos olores": ["mal olor", "olores", "olores desagradables", "hedor", "pestilencia"],
  Partículas: ["partículas suspendidas", "partículas contaminantes", "material particulado"],

  // Residuos y reciclaje
  Basura: ["desechos", "desperdicios", "residuos", "residuos sólidos"],
  Reciclaje: ["reciclado", "reciclar", "separación de basura", "separación de residuos"],
  Composta: ["compostaje", "compost", "abono orgánico"],
  Plásticos: ["plásticos de un solo uso", "envases de plástico", "botellas de plástico"],
  "Tiraderos clandestinos": ["basureros clandestinos", "tiraderos ilegales", "basureros ilegales", "vertederos clandestinos"],
  "Recolección de basura": ["recolección de residuos", "recolección de desechos", "camión de la basura", "servicio de limpia"],

  // Biodiversidad
  "Especies en peligro": ["especies amenazadas", "especies en riesgo", "especies en peligro de extinción", "animales en peligro de extinción"],
  "Especies invasoras": ["especies exóticas", "especies exóticas invasoras", "especies introducidas"],
  Polinizadores: ["insectos polinizadores", "animales polinizadores", "polinización"],
  Humedales: ["pantanos", "ciénagas", "marismas", "esteros"],
  Manglares: ["mangles", "manga", "bosques de manglar"],
  "Áreas naturales protegidas": ["áreas protegidas", "reservas naturales", "reservas ecológicas", "reservas de la biosfera", "parques nacionales"],

  // Plantas y jardinería
  Huertos: ["huertas", "huertos urbanos", "huertos familiares", "huertos caseros"],
  "Plantas medicinales": ["herbolaria", "hierbas medicinales", "plantas curativas"],
  Flores: ["floricultura", "flores de ornato"],
  "Cactus y suculentas": ["cactus", "suculentas", "cactáceas"],
  "Plantas nativas": ["plantas endémicas", "plantas autóctonas", "flora nativa", "flora endémica", "flora local"],
  "Árboles frutales": ["frutales", "árboles de fruta"],

  // Espacios públicos
  Parques: ["parques públicos", "parques urbanos"],
  Plazas: ["plazuelas", "plazas públicas", "zócalos", "explanadas"],
  "Áreas verdes": ["zonas verdes", "espacios verdes"],
  "Juegos infantiles": ["columpios", "resbaladillas", "áreas de juegos", "áreas infantiles", "parques infantiles"],
  "Mobiliario urbano": ["equipamiento urbano", "bancas públicas"],
  Grafiti: ["graffiti", "grafitis", "pintas"],

  // Seguridad
  Robos: ["asaltos", "hurtos", "atracos"],
  Iluminación: ["calles oscuras"],
  Violencia: ["agresiones", "violencia comunitaria", "violencia urbana"],
  "Zonas de riesgo": ["zonas peligrosas", "lugares peligrosos", "puntos peligrosos", "colonias peligrosas"],
  "Vigilancia vecinal": ["vecinos vigilantes", "redes vecinales", "alarmas vecinales"],
  Extorsión: ["cobro de piso", "derecho de piso", "extorsiones telefónicas"],

  // Protección civil
  Sismos: ["terremotos", "temblores"],
  Inundaciones: ["encharcamientos", "desbordamientos", "anegaciones"],
  Huracanes: ["ciclones", "ciclones tropicales", "tormentas tropicales"],
  Incendios: ["incendios forestales", "incendios urbanos", "conflagraciones"],
  Deslaves: ["derrumbes", "deslizamientos de tierra", "desgajamientos", "aludes"],
  "Refugios temporales": ["albergues", "albergues temporales", "albergues de emergencia"],
  Simulacros: ["simulacros de evacuación", "ensayos de evacuación", "prácticas de evacuación"],

  // Accesibilidad e inclusión
  Discapacidad: ["personas con discapacidad", "capacidades diferentes", "diversidad funcional"],
  Rampas: ["rampas de acceso", "rampas para sillas de ruedas"],
  "Lengua de señas": ["lenguaje de señas", "lengua de señas mexicana", "intérpretes de señas"],
  "Personas mayores": ["adultos mayores", "tercera edad", "personas de la tercera edad", "ancianos", "abuelitos"],
  "Pueblos indígenas": ["comunidades indígenas", "pueblos originarios", "comunidades originarias", "indígenas"],
  Neurodiversidad: ["neurodivergencia", "personas neurodivergentes"],

  // Igualdad de género
  "Violencia de género": ["violencia contra las mujeres", "violencia contra la mujer", "violencia machista"],
  "Brecha salarial": ["desigualdad salarial", "diferencia salarial"],
  "Comunidad LGBT": ["lgbt", "lgbtq", "lgbtiq", "lgbttiq", "comunidad lgbtq", "diversidad sexual", "comunidad gay"],
  "Liderazgo de mujeres": ["liderazgo femenino", "mujeres líderes", "empoderamiento femenino", "empoderamiento de la mujer"],
  Acoso: ["acoso sexual", "acoso callejero", "hostigamiento", "hostigamiento sexual"],
  Cuidados: ["trabajo de cuidados", "economía del cuidado", "labores de cuidado"],

  // Derechos humanos
  Migración: ["migrantes", "personas migrantes", "inmigración", "emigración"],
  "Personas desaparecidas": ["desaparecidos", "desapariciones", "desaparición forzada", "búsqueda de personas"],
  "Libertad de expresión": ["libertad de prensa", "libre expresión"],
  Niñez: ["infancia", "infancias", "niños", "niños y niñas", "derechos de la niñez"],
  Discriminación: ["trato desigual", "exclusión"],
  "Acceso a la justicia": ["impartición de justicia", "justicia"],

  // Gobierno y participación ciudadana
  Transparencia: ["rendición de cuentas", "acceso a la información", "gobierno abierto"],
  "Presupuesto participativo": ["presupuesto ciudadano"],
  Elecciones: ["votaciones", "comicios", "procesos electorales"],
  "Servicios públicos": ["servicios municipales"],
  Trámites: ["gestiones", "papeleo", "trámites gubernamentales", "trámites burocráticos"],
  "Consulta ciudadana": ["consulta pública", "consulta popular", "plebiscito", "referéndum"],

  // Vivienda
  Renta: ["alquiler", "arrendamiento"],
  "Asentamientos irregulares": ["asentamientos informales", "colonias irregulares", "invasiones", "paracaidistas"],
  Hacinamiento: ["sobrepoblación en vivienda", "vivienda saturada"],
  "Vivienda social": ["vivienda de interés social", "casas de interés social", "vivienda popular", "vivienda económica"],
  "Servicios básicos": ["agua y luz", "luz y agua", "servicios de vivienda"],
  Desalojos: ["desahucios", "desalojos forzados"],

  // Agricultura
  Cultivos: ["siembras", "sembradíos", "cosechas", "milpas"],
  Plagas: ["plagas agrícolas", "control de plagas"],
  Riego: ["irrigación", "sistemas de riego", "riego agrícola"],
  Ganadería: ["ganado", "crianza de ganado"],
  Pesca: ["pesquerías", "pesca artesanal", "pescadores"],
  Semillas: ["semillas nativas", "semillas criollas", "bancos de semillas"],
  Suelos: ["tierras de cultivo", "fertilidad del suelo"],

  // Cocina y alimentación
  Recetas: ["recetarios"],
  "Comida tradicional": ["gastronomía tradicional", "cocina tradicional", "comida típica", "platillos típicos", "cocina mexicana", "comida mexicana"],
  Mercados: ["tianguis", "mercados municipales", "mercados públicos"],
  "Desperdicio de alimentos": ["desperdicio de comida", "comida desperdiciada", "merma de alimentos"],
  "Comedores comunitarios": ["comedores populares", "comedores sociales", "comedores públicos", "comedores gratuitos"],
  "Precios de alimentos": ["costo de alimentos", "costo de la comida", "precio de la comida", "canasta básica"],

  // Trabajo y economía
  Empleo: ["bolsa de trabajo", "vacantes"],
  Emprendimiento: ["emprendedores", "startups", "negocios propios"],
  "Comercio local": ["negocios locales", "pequeños negocios", "tienditas", "tiendas de barrio", "consumo local"],
  Precios: ["inflación", "carestía", "costo de vida"],
  "Trabajo informal": ["empleo informal", "comercio informal", "economía informal", "ambulantes", "vendedores ambulantes"],
  Turismo: ["actividad turística", "turistas"],

  // Tecnología
  Internet: ["conectividad", "wifi", "acceso a internet"],
  "Inteligencia artificial": ["aprendizaje automático", "machine learning"],
  Programación: ["desarrollo de software", "desarrollo web", "código"],
  Ciberseguridad: ["seguridad informática", "seguridad digital"],
  "Brecha digital": ["desigualdad digital", "rezago digital", "exclusión digital"],
  Robótica: ["robots", "automatización"],
  Aplicaciones: ["apps", "apps móviles", "aplicaciones móviles"],

  // Deporte
  Fútbol: ["futbol soccer", "soccer", "balompié"],
  Básquetbol: ["baloncesto", "básquet", "basket", "basketball"],
  Béisbol: ["baseball"],
  Atletismo: ["carreras", "carreras pedestres", "maratones"],
  Natación: ["nado"],
  Ciclismo: ["ciclistas", "ciclismo de ruta", "ciclismo de montaña"],
  Voleibol: ["volibol", "vóley", "volley", "volleyball"],
  "Instalaciones deportivas": ["canchas", "unidades deportivas", "centros deportivos", "polideportivos", "estadios", "gimnasios"],

  // Aire libre
  Senderismo: ["excursionismo", "caminatas", "hiking", "trekking"],
  Campismo: ["acampar", "acampada", "camping"],
  Playas: ["costas", "litoral"],
  Montañas: ["cerros", "sierras"],
  "Observación de aves": ["avistamiento de aves", "pajareo", "birdwatching"],
  "Pesca deportiva": ["pesca recreativa"],
  Escalada: ["alpinismo", "rápel", "escalada en roca"],
};

/** Sin acentos ni mayúsculas y en singular: "Aguas Negras" y "agua negra" dan lo mismo. */
function comparable(nombre: string): string {
  // claveDeTematica otra vez al final: singular() le devuelve el acento a "canciones" → "canción".
  return claveDeTematica(claveDeTematica(nombre).split(" ").filter(Boolean).map(singular).join(" "));
}

/** Palabras que no cambian el significado: "Calles y banquetas" y "Banquetas, calles" son lo mismo. */
const PALABRAS_VACIAS = new Set([
  "a", "al", "con", "de", "del", "e", "el", "en", "la", "las", "lo", "los", "o", "para", "por", "u", "un", "una", "unas", "unos", "y",
]);

/** Al inicio no dicen de qué trata: "Campaña de vacunación" y "Problemas de baches" son Vacunación y Baches. */
const MULETILLAS_AL_INICIO = new Set(["acerca", "asunto", "campana", "iniciativa", "problema", "programa", "proyecto", "sobre", "tema"]);

/**
 * Cómo suena la palabra: el error de ortografía más común en español no cambia el sonido.
 * "Reciclage" = "Reciclaje", "Bacunación" = "Vacunación", "Yuvia" = "Lluvia", "Ospital" = "Hospital".
 */
function sonido(palabra: string): string {
  return palabra
    .replace(/ch/g, "1")
    .replace(/gu(?=[ei])/g, "2")
    .replace(/g(?=[ei])/g, "j")
    .replace(/2/g, "g")
    .replace(/qu(?=[ei])/g, "k")
    .replace(/c(?=[ei])/g, "s")
    .replace(/z/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/v/g, "b")
    .replace(/h/g, "")
    .replace(/ll/g, "y")
    .replace(/(.)\1+/g, "$1");
}

/** Singular también en palabras cortas ("Ríos", "Aves") y sin diminutivo ("gatito" → "gato"). */
function sinVariantes(palabra: string): string {
  const una = claveDeTematica(singular(palabra));
  const sinPlural = una === palabra && una.length === 4 && /[aeo]s$/.test(una) ? una.slice(0, -1) : una;
  return sinPlural.replace(/^(.{3,})it([oa])$/, "$1$2");
}

/**
 * Sin la "e" final tras consonante: singular() le quita "es" completo a "mangles" y "calles" ("mangl",
 * "call") y deja igual a "mangle" y "calle". Sin ella, plural y singular coinciden.
 */
function sinEFinal(palabra: string): string {
  return palabra.replace(/([^aeiou])e$/, "$1");
}

/** La palabra lista para compararla en un texto. */
export function palabraBase(palabra: string): string {
  return sinEFinal(sinVariantes(palabra));
}

/** Las palabras que importan de un nombre, ya como suenan, en el orden en que se escribieron. */
export function palabrasQueImportan(nombre: string): string[] {
  const todas = claveDeTematica(nombre).split(" ").filter(Boolean);
  const llenas = todas.filter((p) => !PALABRAS_VACIAS.has(p));
  const base = (llenas.length > 0 ? llenas : todas).map(sinVariantes);
  const utiles = base.length > 1 && MULETILLAS_AL_INICIO.has(base[0]) ? base.slice(1) : base;
  // La "e" se quita después del sonido: es la que hace que la "g" de "reciclage" suene a "j".
  return utiles.map((p) => sinEFinal(sonido(p)));
}

type Forma = {
  palabras: string[];
  /** Sin importar el orden: "Banquetas y calles" = "Calles y banquetas". */
  ordenada: string;
  /** Sin espacios: "Video juegos" = "Videojuegos". */
  junta: string;
};

function formaDe(nombre: string): Forma {
  const palabras = palabrasQueImportan(nombre);
  return { palabras, ordenada: [...palabras].sort().join(" "), junta: palabras.join("") };
}

function mismaForma(a: Forma, b: Forma): boolean {
  return a.junta !== "" && (a.ordenada === b.ordenada || a.junta === b.junta);
}

/** Distancia de edición con trasposición (Damerau-Levenshtein): "potabel" y "potable" están a 1. */
function distancia(a: string, b: string): number {
  const filas = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) filas[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cambio = a[i - 1] === b[j - 1] ? 0 : 1;
      filas[i][j] = Math.min(filas[i - 1][j] + 1, filas[i][j - 1] + 1, filas[i - 1][j - 1] + cambio);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        filas[i][j] = Math.min(filas[i][j], filas[i - 2][j - 2] + 1);
      }
    }
  }
  return filas[a.length][b.length];
}

/**
 * Erratas al teclear. A propósito estricto, porque aquí un acierto falso impide proponer una etiqueta
 * real: una sola letra de diferencia, nunca en la primera ("Renta" no es "Venta"), desde 6 letras; y
 * cambiar una letra por otra (sin que falte, sobre o se volteen) solo desde 9: "Playas" no es "Plagas"
 * ni "Donación" es "Dotación".
 */
function esErrata(a: string, b: string): boolean {
  if (a === b) return true;
  const largo = Math.min(a.length, b.length);
  if (largo < 6 || a[0] !== b[0] || distancia(a, b) !== 1) return false;
  const cambiaUnaLetra = a.length === b.length && [...a].filter((letra, i) => letra !== b[i]).length === 1;
  return !cambiaUnaLetra || largo >= 9;
}

function conErrata(a: Forma, b: Forma): boolean {
  return a.palabras.length === b.palabras.length && a.palabras.every((p, i) => esErrata(p, b.palabras[i]));
}

type Grupo = { claves: Set<string>; formas: Forma[] };

const GRUPOS: Grupo[] = Object.entries(SINONIMOS_DE_ETIQUETAS).map(([etiqueta, sinonimos]) => {
  const terminos = [etiqueta, ...sinonimos];
  return { claves: new Set(terminos.map(comparable)), formas: terminos.map(formaDe) };
});

/**
 * Las candidatas que coinciden según `coincide`, comparando el texto con cada una y con los sinónimos
 * de su grupo. Sin repetir, para saber si hay más de una.
 */
function coincidencias(forma: Forma, candidatas: string[], coincide: (a: Forma, b: Forma) => boolean): string[] {
  const halladas = new Set(candidatas.filter((c) => coincide(forma, formaDe(c))));
  for (const grupo of GRUPOS) {
    if (!grupo.formas.some((f) => coincide(forma, f))) continue;
    for (const c of candidatas) {
      if (grupo.claves.has(comparable(c)) || grupo.formas.some((f) => mismaForma(formaDe(c), f))) halladas.add(c);
    }
  }
  return [...halladas];
}

/**
 * De `candidatas` (las etiquetas de UNA temática), la que significa lo mismo que `escrito`, o null. De
 * lo más seguro a lo menos: la misma palabra en singular o plural ("Perro" → "Perros"); un sinónimo de
 * la lista; lo mismo escrito de otra forma (orden, palabras vacías, espacios, muletillas, ortografía o
 * diminutivo: "Banquetas y calles", "Video juegos", "Reciclage", "Campaña de vacunación"); y, con
 * `erratas` (por defecto), una errata al teclear ("Agua potabel"), también en un sinónimo ("Aguas
 * negars"). Si en estos dos últimos pasos caben varias, no se elige ninguna: mejor proponer que
 * cambiarle a alguien su etiqueta por otra que no pidió.
 * Un grupo cuenta aunque su etiqueta principal ya no esté: con "Aguas negras" en el catálogo, "Aguas
 * servidas" también coincide. Solo se compara dentro de la temática: "Albergues" es Refugios en
 * Protección animal y Refugios temporales en Protección civil.
 */
export function etiquetaEquivalente(
  escrito: string,
  candidatas: string[],
  { erratas = true }: { erratas?: boolean } = {},
): string | null {
  const buscada = comparable(escrito);
  if (!buscada) return null;
  const mismaPalabra = candidatas.find((c) => comparable(c) === buscada);
  if (mismaPalabra) return mismaPalabra;
  for (const grupo of GRUPOS) {
    if (!grupo.claves.has(buscada)) continue;
    const sinonimo = candidatas.find((c) => grupo.claves.has(comparable(c)));
    if (sinonimo) return sinonimo;
  }
  const forma = formaDe(escrito);
  const iguales = coincidencias(forma, candidatas, mismaForma);
  if (iguales.length > 0) return iguales.length === 1 ? iguales[0] : null;
  if (!erratas) return null;
  const parecidas = coincidencias(forma, candidatas, conErrata);
  return parecidas.length === 1 ? parecidas[0] : null;
}

/** Sinónimos que en un texto libre suelen significar otra cosa: "leo manga" no habla de manglares. */
const SOLO_AL_PROPONER = new Set(["manga"]);

/**
 * Los términos que nombran a una etiqueta en un texto libre: ella y los sinónimos de su grupo. Lo usa
 * lib/etiquetas/desde-texto.ts para reconocerla ("lomitos" → Perros).
 */
export function terminosDeEtiqueta(nombre: string): string[] {
  const clave = comparable(nombre);
  const terminos = new Set([nombre]);
  for (const [etiqueta, sinonimos] of Object.entries(SINONIMOS_DE_ETIQUETAS)) {
    const grupo = [etiqueta, ...sinonimos];
    if (grupo.some((t) => comparable(t) === clave)) grupo.forEach((t) => terminos.add(t));
  }
  return [...terminos].filter((t) => !SOLO_AL_PROPONER.has(t));
}
