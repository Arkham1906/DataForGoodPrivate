// Qué archivo y qué descripción acepta un aporte. Sin imports de servidor: lo usan
// tanto los route handlers (POST /api/aportes, POST /api/c/[token]/aportes) como los
// formularios de /campanas/[id]/aportar y /c/[token] para avisar antes de enviar. El
// servidor siempre vuelve a validar, y el tipo real lo decide el contenido del archivo
// (lib/aportes/limpiar-archivo.ts), no el nombre ni file.type.
//
// Formatos y tamaños por tipo (decisión del usuario, 2026-10-14; dominio.md § 4).

export type TipoDeArchivo = "foto" | "video" | "audio" | "documento" | "texto";

const MB = 1_000_000;

export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MIME_XLS = "application/vnd.ms-excel";

export const FORMATOS: Record<TipoDeArchivo, { extensiones: string[]; mimes: string[]; tamanoMaximo: number }> = {
  foto: { extensiones: [".jpg", ".jpeg", ".png"], mimes: ["image/jpeg", "image/png"], tamanoMaximo: 10 * MB },
  video: { extensiones: [".mp4", ".mov", ".webm"], mimes: ["video/mp4", "video/quicktime", "video/webm"], tamanoMaximo: 50 * MB },
  audio: {
    extensiones: [".mp3", ".m4a", ".wav", ".ogg"],
    mimes: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/wave", "audio/ogg"],
    tamanoMaximo: 20 * MB,
  },
  // "Archivos" en pantalla (2026-10-26): además de PDF y Word, PowerPoint y Excel. El valor sigue siendo "documento".
  documento: {
    extensiones: [".pdf", ".docx", ".pptx", ".xlsx", ".xls"],
    mimes: ["application/pdf", MIME_DOCX, MIME_PPTX, MIME_XLSX, MIME_XLS],
    tamanoMaximo: 20 * MB,
  },
  texto: { extensiones: [".txt"], mimes: ["text/plain"], tamanoMaximo: 1 * MB },
};

const ORDEN: TipoDeArchivo[] = ["foto", "video", "audio", "documento", "texto"];

/**
 * Formatos de "Archivo" que el creador puede limitar (2026-10-28, a pedido del usuario): al marcar
 * "Archivo" en el formulario de campaña elige cuáles acepta (p. ej. solo PDF y Word). Ninguno marcado
 * = todos. Se guarda en campanas.formatos_de_documento (["pdf", "word"]).
 */
export type FormatoDeDocumento = "pdf" | "word" | "powerpoint" | "excel";
export const FORMATOS_DE_DOCUMENTO: { valor: FormatoDeDocumento; nombre: string; extensiones: string[]; mimes: string[] }[] = [
  { valor: "pdf", nombre: "PDF", extensiones: [".pdf"], mimes: ["application/pdf"] },
  { valor: "word", nombre: "Word", extensiones: [".docx"], mimes: [MIME_DOCX] },
  { valor: "powerpoint", nombre: "PowerPoint", extensiones: [".pptx"], mimes: [MIME_PPTX] },
  { valor: "excel", nombre: "Excel", extensiones: [".xlsx", ".xls"], mimes: [MIME_XLSX, MIME_XLS] },
];

/** Los formatos válidos, sin repetir y en orden fijo; [] = todos (también si se marcaron los cuatro). */
export function normalizarFormatosDeDocumento(input: unknown): FormatoDeDocumento[] {
  const lista = Array.isArray(input) ? input.map(String) : [];
  const elegidos = FORMATOS_DE_DOCUMENTO.filter((f) => lista.includes(f.valor)).map((f) => f.valor);
  return elegidos.length === FORMATOS_DE_DOCUMENTO.length ? [] : elegidos;
}

/** Los formatos de documento que acepta una campaña ([] = todos). */
function formatosPermitidos(formatos: readonly FormatoDeDocumento[] | undefined) {
  return formatos && formatos.length > 0 ? FORMATOS_DE_DOCUMENTO.filter((f) => formatos.includes(f.valor)) : FORMATOS_DE_DOCUMENTO;
}

/** Extensiones de un tipo, con los formatos de documento que acepta la campaña. */
export function extensionesDe(tipo: TipoDeArchivo, formatos?: readonly FormatoDeDocumento[]): string[] {
  return tipo === "documento" ? formatosPermitidos(formatos).flatMap((f) => f.extensiones) : FORMATOS[tipo].extensiones;
}

function mimesDe(tipo: TipoDeArchivo, formatos?: readonly FormatoDeDocumento[]): string[] {
  return tipo === "documento" ? formatosPermitidos(formatos).flatMap((f) => f.mimes) : FORMATOS[tipo].mimes;
}

/** ¿Esa extensión (".pdf") es de un formato de documento que la campaña acepta? */
export function documentoPermitido(extension: string, formatos?: readonly FormatoDeDocumento[]): boolean {
  return extensionesDe("documento", formatos).includes(extension.toLowerCase());
}

/** "PDF y Word", "PDF, Word, PowerPoint y Excel": para mostrar qué archivos acepta la campaña. */
export function nombresDeFormatos(formatos?: readonly FormatoDeDocumento[]): string {
  const nombres = formatosPermitidos(formatos).map((f) => f.nombre);
  return nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

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

/** ".jpg, .jpeg, .png, .mp4..." de los tipos dados (con los formatos de documento de la campaña). */
export function textoDeExtensiones(tipos: TipoDeArchivo[], formatos?: readonly FormatoDeDocumento[]): string {
  return tipos.flatMap((t) => extensionesDe(t, formatos)).join(", ");
}

/** Valor del atributo accept de <input type="file">. */
export function acceptDeArchivo(tipos: TipoDeArchivo[], formatos?: readonly FormatoDeDocumento[]): string {
  return tipos.flatMap((t) => [...extensionesDe(t, formatos), ...mimesDe(t, formatos)]).join(",");
}

/**
 * Mensaje de error para la persona, o null si el archivo sirve para esta campaña.
 * Sin archivo es válido solo si la campaña acepta texto.
 */
export function errorDeArchivo(
  file: FormDataEntryValue | null | undefined,
  tipos: TipoDeArchivo[],
  formatos?: readonly FormatoDeDocumento[],
): string | null {
  if (!(file instanceof File) || file.size === 0) {
    return archivoEsOpcional(tipos) ? null : "El archivo es obligatorio";
  }
  const tipo = tipoPorNombre(file);
  if (!tipo || !tipos.includes(tipo) || (tipo === "documento" && !documentoPermitido(extensionDe(file.name), formatos))) {
    return `Formato no válido. Esta campaña acepta ${textoDeExtensiones(tipos, formatos)}.`;
  }
  const maximo = FORMATOS[tipo].tamanoMaximo;
  if (file.size > maximo) return `El archivo pesa más de ${textoDeTamano(maximo)}, el máximo para ${NOMBRE_EN_FRASE[tipo]}.`;
  return null;
}

const NOMBRE_EN_FRASE: Record<TipoDeArchivo, string> = {
  foto: "fotos",
  video: "videos",
  audio: "audios",
  documento: "archivos",
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
  documento: { titulo: "Archivos", detalle: "Un PDF, Word (.docx), PowerPoint (.pptx) o Excel (.xlsx o .xls) por aporte, de hasta 20 MB." },
  texto: { titulo: "Texto", detalle: "Lo que observaste, en la descripción; si quieres, también un archivo .txt de hasta 1 MB." },
};

/** Aviso para video y audio, que se guardan tal cual: pueden llevar la ubicación de donde se grabaron. */
export const AVISO_METADATOS_MEDIA =
  "Los videos y audios se guardan tal como los subes: si tu teléfono guarda la ubicación al grabar, el archivo la lleva. Las fotos y los archivos se guardan sin esos datos, salvo los Excel .xls (formato antiguo), que también van tal cual.";
