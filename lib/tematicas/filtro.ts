// Filtro de palabras inapropiadas para los intereses (2026-10-19). Lo usa lib/tematicas/analizar.ts
// en el navegador (al dar "Analizar") y, por medio de esTematicaNuevaValida, el servidor antes de dar
// de alta una temática o de ofrecer una que ya existe (lib/tematicas/catalogo.ts). Todo es local.
//
// Atrapa las formas de esquivarlo más comunes, porque compara una versión "aplanada" de la palabra:
//   - sin acentos ni mayúsculas;
//   - números y símbolos que imitan letras: "p3nd3jo", "put@", "$exo", "m13rd4";
//   - letras repetidas: "puuuuto", "mierdaaa";
//   - letras que suenan igual (solo en español): "berga" = "verga", "kabron" = "cabrón", "uevon" = "huevón";
//   - letras separadas: "p u t o", "p.u.t.o" (eso lo junta analizar.ts y lo revisa aquí);
//   - palabras pegadas: "hijodeputa", "putamadre" (solo con raíces que no aparecen dentro de
//     palabras normales; "puta" no, porque está en "computadora" y "disputa").
// Lo que pase el filtro lo puede ocultar el SuperUsuario en /sistema/tematicas.

/** Números y símbolos que se usan en lugar de letras. */
const PARECIDAS_A_LETRAS: Record<string, string> = {
  "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "8": "b", "9": "g",
};

/** Sin acentos, en minúsculas, con los números y símbolos vueltos letras y sin letras repetidas. */
function ligera(palabra: string): string {
  return palabra
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[0-9!|@$]/g, (c) => PARECIDAS_A_LETRAS[c] ?? c)
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/**
 * Además, iguala las letras que en español suenan igual: "Kabrón" → "kabron", "VERGA" → "berga",
 * "huevón" → "uebon", "chingada" → "xingada". Solo para comparar con las listas; nunca se muestra.
 */
function fonetica(palabra: string): string {
  return ligera(palabra.toLowerCase().replace(/ll/g, "y"))
    .replace(/ch/g, "x") // "ch" vale por sí sola: así la "h" que queda es muda
    .replace(/h/g, "")
    .replace(/qu/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/v/g, "b")
    .replace(/(.)\1+/g, "$1");
}

// Términos que nunca son un interés. Con "*" al final cuenta como prefijo; sin él, la palabra
// exacta (o con "s"/"es" de plural). Se escriben normales: al cargar se aplanan igual que lo que
// escribe la persona. Ojo con los prefijos: aplanados no deben atrapar palabras normales
// ("culo" exacto, no "culo*", por "culto"; "rape" exacto, no "rape*", por "rapero").
const EN_ESPANOL = [
  // Groserías e insultos
  "pendej*", "chingad*", "chingar", "chinga", "chingas", "chingue*", "chingon*", "verga", "vergazo*", "puta",
  "puto", "putiza*", "putazo*", "putear", "mierd*", "cabron*", "culer*", "culo", "culon*", "ojete*", "joto",
  "maricon*", "marica", "pinche*", "pinchi*", "mamon", "mamona", "mamada", "cogid*", "coger", "cogiendo", "cojer",
  "nalga*", "teta", "tetona*", "pene", "huevon*", "idiota*", "estupid*", "imbecil*", "zorra", "malparid*",
  "hijueput*", "ptm", "alv", "cagar", "cagada*", "cagon*", "panocha*", "chichis", "joder", "jodid*", "carajo",
  "pajer*", "puñeta*", "gilipolla*", "culiao*", "retrasad*", "mongolo", "mongola", "subnormal*", "tarad*", "naco",
  "mamaguevo*", "pendejad*", "chupamela",
  // España y Sudamérica (2026-10-19). Ojo: "foll*" no, por "folleto" y "follaje".
  "follar", "follo", "folla", "follas", "follan", "follamos", "follando", "follada*", "follador*", "follarse",
  "follarme", "follarte", "polla", "pollas", "coño", "coñazo", "boludo*", "pelotud*", "weon*", "weona*",
  "aweonad*", "huevad*", "cojud*", "conchetumadre*", "conchatumadre*", "conchesumadre*", "conchatumare",
  "culiad*", "gonorrea", "malnacid*", "pinga", "pingas", "hijoputa*", "hijaputa*", "gilipuert*",
  // Verbos sexuales conjugados (México y en general)
  "cogerse", "cogerme", "cogerte", "cogerla", "cogerlo", "cogemos", "cogen", "cogí", "cogió", "cogieron",
  "culear", "culiar", "culeando", "culiando", "culeo", "pajear*", "pajazo*", "chupármela", "mamármela", "nopor",
  "sexting", "tetas", "putear*", "puteo", "puteando",
  // Sexual
  "sexo", "sexual*", "porno*", "desnud*", "encuerad*", "orgia*", "prostitu*", "erotic*", "fetich*",
  "masturb*", "eyacul*", "orgasm*", "vagina*", "violar", "violacion*", "violador*", "pedofil*", "pederast*",
  "zoofil*", "incest*", "onlyfans", "hentai", "pack", "cachond*", "calenturient*",
  // Violencia ("muertos" no: es el Día de Muertos, y el diccionario lo lleva a Cultura)
  "asesin*", "matar", "mato", "matando", "matanza*", "muerte*", "morir", "suicid*", "secuestr*",
  "tortur*", "homicid*", "masacre*", "sicari*", "balacera*", "balazo*", "disparar", "pistola*", "metralleta*",
  "arma", "bomba", "explosivo*", "terroris*", "decapit*", "descuartiz*", "degoll*", "golpiza*", "maton",
  "genocid*", "cadaver*", "sangrient*", "narco*",
  // Verbos de violencia conjugados (2026-10-19). "asesin*" ya atrapa asesinar, asesino, asesinando.
  "mataré", "mataría", "maten", "matamos", "matarlos", "matarlas", "matarlo", "matarla", "matarte", "matarme",
  "matarse", "matan", "mataron", "violando", "violan", "violaron", "violó", "violarla", "violarlo", "apuñal*",
  "acuchill*", "estrangul*", "mutil*", "envenen*", "tirote*", "linch*", "baleado*", "balacear",
  "dispararle", "dispararles", "degüell*", "desmembr*", "masacrar", "exterminar", "aniquilar", "golpear",
  "golpearlos", "golpearlas", "torturando", "secuestrando",
  // Drogas
  "droga*", "drogar*", "cocain*", "marihuan*", "mariguan*", "mota", "crack", "metanfetamin*", "extasis", "lsd",
  "fentanil*", "cannabis", "porro", "borrach*", "emborrach*", "peda",
  "drogarme", "drogarse", "tachas", "meth", "piedrear*", "marihuano", "marihuanos",
  // Odio
  "nazi*", "hitler", "supremacis*", "negrata*", "sudaca*", "travelo*", "machorra*", "maricona*",
];
// "kkk" y "xxx" no van en las listas: sin letras repetidas quedarían "k" y "x", que atrapan cualquier
// letra suelta. Los patrones de menos de 3 letras ya aplanados se descartan al cargar.

// En inglés solo se quitan acentos, símbolos y letras repetidas: las reglas de sonido del español
// las estropean ("shit" quedaría "sit", que está en "visita").
const EN_INGLES = [
  "fuck*", "shit", "shitty", "bullshit", "bitch*", "dick", "pussy", "cock", "asshole*", "nigger", "nigga",
  "fag", "faggot*", "cunt*", "whore*", "slut*", "porn", "sex", "sexy", "rape", "rapist", "kill", "killer",
  "killing", "murder*", "dead", "death", "drug", "drugs", "weed", "nude", "nudes",
];

// Raíces que se buscan dentro de cualquier palabra, para las pegadas ("hijodeputa",
// "chingatumadre"). Solo las que no aparecen en palabras normales ("verga" no: "alberga").
const RAICES_EN_ESPANOL = [
  "pendej", "chingad", "chingatu", "chingues", "mierd", "cabron", "maricon", "putamadr", "deputa", "ijueput",
  "malparid", "pornogra", "pedofil", "asesin", "suicid", "cocain", "marihuan", "mariguan", "metanfet", "culer",
  "panocha", "follar", "hijoput", "conchetu", "conchatu",
];
// ("nigger" no: aplanada queda "niger", que está en "Nigeria").
const RAICES_EN_INGLES = ["fuck", "bitch", "asshole"];

type Patron = { texto: string; prefijo: boolean };

function patrones(lista: string[], aplanar: (p: string) => string): Patron[] {
  return lista
    .map((p) =>
      p.endsWith("*") ? { texto: aplanar(p.slice(0, -1)), prefijo: true } : { texto: aplanar(p), prefijo: false },
    )
    .filter((p) => p.texto.length >= 3);
}

const LISTAS: { aplanar: (p: string) => string; patrones: Patron[]; raices: string[] }[] = [
  { aplanar: fonetica, patrones: patrones(EN_ESPANOL, fonetica), raices: RAICES_EN_ESPANOL.map(fonetica) },
  { aplanar: ligera, patrones: patrones(EN_INGLES, ligera), raices: RAICES_EN_INGLES.map(ligera) },
];

function palabraInapropiada(palabra: string): boolean {
  return LISTAS.some(({ aplanar, patrones, raices }) => {
    const plana = aplanar(palabra);
    if (!plana) return false;
    // También sin la "s" o "es" de plural: "pistolas" → "pistola", "matones" → "maton".
    const formas = [plana, plana.replace(/s$/, ""), plana.replace(/es$/, "")];
    if (formas.some((f) => patrones.some((p) => (p.prefijo ? f.startsWith(p.texto) : f === p.texto)))) return true;
    return raices.some((raiz) => plana.includes(raiz));
  });
}

/** ¿Es inapropiada esta palabra, o alguna de las palabras de este texto? */
export function esInapropiada(texto: string): boolean {
  return texto.split(/\s+/).filter(Boolean).some(palabraInapropiada);
}
