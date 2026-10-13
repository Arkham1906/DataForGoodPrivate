// Ícono del perfil (2026-10-13): las iniciales (lo de siempre), uno de los íconos predefinidos
// (masculino, femenino u otro) o una foto propia. Sin imports de servidor: lo usan el editor de
// /cuenta (EditarAvatar), components/ui/Avatar y el route handler PUT /api/usuarios/[id]/avatar.
// Se guarda en usuarios.avatar (NULL = iniciales) y la foto en usuarios.avatar_foto (clave en MinIO).

export type IconoPredefinido = "masculino" | "femenino" | "otro";
/** Lo que se guarda en usuarios.avatar; null son las iniciales. */
export type TipoDeAvatar = IconoPredefinido | "foto";
/** Lo que elige la persona en el editor. */
export type EleccionDeAvatar = TipoDeAvatar | "iniciales";

export const ICONOS_PREDEFINIDOS: { valor: IconoPredefinido; etiqueta: string }[] = [
  { valor: "masculino", etiqueta: "Masculino" },
  { valor: "femenino", etiqueta: "Femenino" },
  { valor: "otro", etiqueta: "Otro" },
];

export const ELECCIONES_DE_AVATAR = new Set<string>(["iniciales", "masculino", "femenino", "otro", "foto"]);

/** La foto: JPG o PNG de hasta 5 MB; se recorta a un cuadrado de 256 px y se guarda sin metadatos. */
export const TIPOS_DE_FOTO_DE_PERFIL = new Set(["image/jpeg", "image/png"]);
export const TAMANO_MAXIMO_FOTO_DE_PERFIL = 5_000_000;
export const LADO_FOTO_DE_PERFIL = 256;

/** Mensaje para la persona, o null si el archivo sirve (el servidor lo vuelve a revisar). */
export function errorDeFotoDePerfil(file: FormDataEntryValue | null | undefined): string | null {
  if (!(file instanceof File) || file.size === 0) return "Elige una foto.";
  if (!TIPOS_DE_FOTO_DE_PERFIL.has(file.type)) return "Formato no válido. Usa .jpg, .jpeg o .png.";
  if (file.size > TAMANO_MAXIMO_FOTO_DE_PERFIL) return "La foto pesa más de 5 MB.";
  return null;
}

/** Iniciales del nombre (hasta 2), como siempre se han mostrado. */
export function inicialesDe(nombre: string | null | undefined): string {
  return (nombre ?? "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
}

/** Datos que necesita components/ui/Avatar para pintar el ícono de una cuenta. */
export type DatosDeAvatar = {
  usuarioId: number | string;
  nombre: string;
  avatar: TipoDeAvatar | null;
  /** Cambia cada vez que se sube otra foto: va en la URL para que el navegador no muestre la vieja. */
  version: string | null;
};

/** La versión que va en la URL de la foto: el nombre del archivo (un uuid nuevo en cada subida). */
function versionDe(clave: string | null): string | null {
  return clave ? (clave.split("/").pop() ?? "").replace(/\.\w+$/, "") || null : null;
}

/** Lo que guarda la fila de usuarios, para components/ui/Avatar. */
export function datosDeAvatar(fila: {
  id: number | string;
  nombre: string;
  avatar?: string | null;
  avatar_foto?: string | null;
}): DatosDeAvatar {
  const avatar = (fila.avatar ?? null) as TipoDeAvatar | null;
  // Sin archivo, una "foto" se muestra como iniciales (p. ej. si MinIO perdió el objeto).
  const valido = avatar === "foto" && !fila.avatar_foto ? null : avatar;
  return { usuarioId: fila.id, nombre: fila.nombre, avatar: valido, version: valido === "foto" ? versionDe(fila.avatar_foto ?? null) : null };
}
