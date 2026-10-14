// Qué archivo y qué descripción acepta un aporte. Sin imports de servidor: lo usan
// tanto los route handlers (POST /api/aportes, POST /api/c/[token]/aportes) como los
// formularios de /campanas/[id]/aportar y /c/[token] para avisar antes de enviar. El
// servidor siempre vuelve a validar, y el tipo real lo decide el contenido del archivo
// (lib/aportes/limpiar-archivo.ts), no el nombre ni file.type.
//
// Formatos y tamaños por tipo (decisión del usuario, 2026-10-14; dominio.md § 4).

export type TipoDeArchivo = "foto" | "video" | "audio" | "documento" | "texto";

const MB = 1_000_000;

export const FORMATOS: Record<TipoDeArchivo, { extensiones: string[]; mimes: string[]; tamanoMaximo: number }> = {
  foto: { extensiones: [".jpg", ".jpeg", ".png"], mimes: ["image/jpeg", "image/png"], tamanoMaximo: 10 * MB },
  video: { extensiones: [".mp4", ".mov", ".webm"], mimes: ["video/mp4", "video/quicktime", "video/webm"], tamanoMaximo: 50 * MB },
  audio: {
    extensiones: [".mp3", ".m4a", ".wav", ".ogg"],
    mimes: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/wave", "audio/ogg"],
    tamanoMaximo: 20 * MB,
  },
  documento: {
    extensiones: [".pdf", ".docx"],
    mimes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    tamanoMaximo: 20 * MB,
  },
  texto: { extensiones: [".txt"], mimes: ["text/plain"], tamanoMaximo: 1 * MB },
};

const ORDEN: TipoDeArchivo[] = ["foto", "video", "audio", "documento", "texto"];

/** El mayor de los tamaños permitidos: lo que debe dejar pasar next.config.ts (proxyClientMaxBodySize). */
export const TAMANO_MAXIMO = Math.max(...ORDEN.map((t) => FORMATOS[t].tamanoMaximo));
export const LARGO_MAXIMO_DESCRIPCION = 1000;

/**
 * Los tipos de la campaña que se pueden subir, en orden fijo. Una campaña sin tipos
 * (de antes de que existiera la columna) acepta fotos, como siempre.
 */
export function tiposAceptados(dataTypes: unknown): TipoDeArchivo[] {
  const lista = Array.isArray(dataTypes) ? dataTypes.map(String) : [];
  const tipos = ORDEN.filter((t) => lista.includes(t));
  return tipos.length > 0 ? tipos : ["foto"];
}

/** Con "texto" entre los tipos, el aporte puede ir sin archivo: la descripción es el dato. */
export function archivoEsOpcional(tipos: TipoDeArchivo[]): boolean {
  return tipos.includes("texto");
}

function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  return punto >= 0 ? nombre.slice(punto).toLowerCase() : "";
}

/** El tipo que dice el nombre del archivo (o, sin extensión conocida, file.type). Solo para avisar. */
export function tipoPorNombre(file: { name: string; type: string }): TipoDeArchivo | null {
  const extension = extensionDe(file.name);
  const porExtension = ORDEN.find((t) => FORMATOS[t].extensiones.includes(extension));
  if (porExtension) return porExtension;
  return ORDEN.find((t) => FORMATOS[t].mimes.includes(file.type)) ?? null;
}

/** "50 MB", "1 MB". */
export function textoDeTamano(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}

/** ".jpg, .jpeg, .png, .mp4..." de los tipos dados. */
export function textoDeExtensiones(tipos: TipoDeArchivo[]): string {
  return tipos.flatMap((t) => FORMATOS[t].extensiones).join(", ");
}

/** Valor del atributo accept de <input type="file">. */
export function acceptDeArchivo(tipos: TipoDeArchivo[]): string {
  return tipos.flatMap((t) => [...FORMATOS[t].extensiones, ...FORMATOS[t].mimes]).join(",");
}

/**
 * Mensaje de error para la persona, o null si el archivo sirve para esta campaña.
 * Sin archivo es válido solo si la campaña acepta texto.
 */
export function errorDeArchivo(file: FormDataEntryValue | null | undefined, tipos: TipoDeArchivo[]): string | null {
  if (!(file instanceof File) || file.size === 0) {
    return archivoEsOpcional(tipos) ? null : "El archivo es obligatorio";
  }
  const tipo = tipoPorNombre(file);
  if (!tipo || !tipos.includes(tipo)) {
    return `Formato no válido. Esta campaña acepta ${textoDeExtensiones(tipos)}.`;
  }
  const maximo = FORMATOS[tipo].tamanoMaximo;
  if (file.size > maximo) return `El archivo pesa más de ${textoDeTamano(maximo)}, el máximo para ${NOMBRE_EN_FRASE[tipo]}.`;
  return null;
}

const NOMBRE_EN_FRASE: Record<TipoDeArchivo, string> = {
  foto: "fotos",
  video: "videos",
  audio: "audios",
  documento: "documentos",
  texto: "archivos de texto",
};

/** Tamaño legible: KB debajo de 1 MB (antes un archivo chico se veía como "0.0 MB"). */
export function formatearTamano(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * Cómo se describe cada tipo de dato de una campaña a quien va a aportar
 * (/campanas/[id], "¿Qué puedes aportar?").
 */
export const TIPO_DE_DATO: Record<string, { titulo: string; detalle: string }> = {
  foto: { titulo: "Fotos", detalle: "Una foto JPG o PNG por aporte, de hasta 10 MB." },
  video: { titulo: "Video", detalle: "Un video MP4, MOV o WEBM por aporte, de hasta 50 MB." },
  audio: { titulo: "Audio", detalle: "Un audio MP3, M4A, WAV u OGG por aporte, de hasta 20 MB." },
  documento: { titulo: "Documentos", detalle: "Un PDF o Word (.docx) por aporte, de hasta 20 MB." },
  texto: { titulo: "Texto", detalle: "Lo que observaste, en la descripción; si quieres, también un archivo .txt de hasta 1 MB." },
};

/** Aviso para video y audio, que se guardan tal cual: pueden llevar la ubicación de donde se grabaron. */
export const AVISO_METADATOS_MEDIA =
  "Los videos y audios se guardan tal como los subes: si tu teléfono guarda la ubicación al grabar, el archivo la lleva. Las fotos y los documentos se guardan sin esos datos.";
