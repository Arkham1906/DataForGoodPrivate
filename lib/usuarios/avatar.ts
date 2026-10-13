// Ícono del perfil en el servidor (2026-10-13): guardar la elección (iniciales, ícono predefinido o
// foto propia) y leer la foto. Lo usa /api/usuarios/[id]/avatar. Opciones y límites en
// ./avatar-opciones.ts (sin imports de servidor).
//
// La foto se comprueba por su firma (JPG o PNG), se recorta a un cuadrado de 256 px y se vuelve a
// codificar con sharp, lo que quita los metadatos (EXIF con GPS, modelo del teléfono). Se procesa ya
// reducida, sin mozjpeg, para no repetir lo que tumbó producción con los aportes (2026-10-05).
// Se guarda en MinIO como perfiles/<id>/<uuid>.jpg; al cambiarla o quitarla, la anterior se borra.

import sharp from "sharp";

import { pool } from "@/lib/db";
import { borrarArchivo, guardarArchivo, readUploadedFile } from "@/lib/minio";
import { MAXIMO_DE_MEGAPIXELES } from "@/lib/aportes/imagen";
import {
  LADO_FOTO_DE_PERFIL,
  datosDeAvatar,
  type DatosDeAvatar,
  type EleccionDeAvatar,
} from "@/lib/usuarios/avatar-opciones";

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FIRMA_JPEG = Buffer.from([0xff, 0xd8, 0xff]);

/** La foto como JPEG cuadrado de 256 px sin metadatos, o un mensaje de error para la persona. */
async function procesarFoto(archivo: File): Promise<{ ok: true; contenido: Buffer } | { ok: false; error: string }> {
  const original = Buffer.from(await archivo.arrayBuffer());
  const esPng = original.subarray(0, FIRMA_PNG.length).equals(FIRMA_PNG);
  const esJpeg = original.subarray(0, FIRMA_JPEG.length).equals(FIRMA_JPEG);
  if (!esPng && !esJpeg) return { ok: false, error: "El archivo no es una imagen JPG o PNG válida." };

  try {
    const { width = 0, height = 0 } = await sharp(original).metadata();
    if (width * height > MAXIMO_DE_MEGAPIXELES * 1_000_000) {
      return { ok: false, error: `La foto es demasiado grande: máximo ${MAXIMO_DE_MEGAPIXELES} megapíxeles.` };
    }
    const contenido = await sharp(original, { failOn: "error", limitInputPixels: MAXIMO_DE_MEGAPIXELES * 1_000_000 })
      .rotate()
      .resize(LADO_FOTO_DE_PERFIL, LADO_FOTO_DE_PERFIL, { fit: "cover", position: "attention" })
      // Un PNG con transparencia queda sobre blanco.
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { ok: true, contenido };
  } catch {
    return { ok: false, error: "No se pudo leer la imagen. Prueba con otra foto." };
  }
}

/**
 * Cambia el ícono de la cuenta. Con "foto" exige el archivo; con cualquier otra elección borra la
 * foto que hubiera. Devuelve los datos nuevos o un error para la persona.
 */
export async function cambiarAvatar(
  usuarioId: number,
  eleccion: EleccionDeAvatar,
  archivo: File | null,
): Promise<{ ok: true; datos: DatosDeAvatar } | { ok: false; error: string }> {
  let nuevaFoto: string | null = null;
  if (eleccion === "foto") {
    if (!archivo) return { ok: false, error: "Elige una foto." };
    const foto = await procesarFoto(archivo);
    if (!foto.ok) return foto;
    const guardada = await guardarArchivo(foto.contenido, {
      subdir: `perfiles/${usuarioId}`,
      extension: ".jpg",
      mimeType: "image/jpeg",
    });
    nuevaFoto = guardada.relativePath;
  }

  const avatar = eleccion === "iniciales" ? null : eleccion;
  let anterior: string | null = null;
  let fila: { id: number; nombre: string; avatar: string | null; avatar_foto: string | null } | undefined;
  try {
    // La foto anterior se lee en la misma sentencia que la reemplaza: dos cambios a la vez no dejan
    // un archivo huérfano sin borrar.
    const { rows } = await pool.query<{ id: number; nombre: string; avatar: string | null; avatar_foto: string | null; anterior: string | null }>(
      `UPDATE usuarios u SET avatar = $2, avatar_foto = $3, updated_at = NOW()
       FROM (SELECT id, avatar_foto AS anterior FROM usuarios WHERE id = $1 FOR UPDATE) previo
       WHERE u.id = previo.id
       RETURNING u.id, u.nombre, u.avatar, u.avatar_foto, previo.anterior`,
      [usuarioId, avatar, nuevaFoto],
    );
    fila = rows[0];
    anterior = rows[0]?.anterior ?? null;
  } catch (error) {
    if (nuevaFoto) await borrarArchivo(nuevaFoto).catch(() => undefined);
    throw error;
  }
  if (!fila) {
    if (nuevaFoto) await borrarArchivo(nuevaFoto).catch(() => undefined);
    return { ok: false, error: "La cuenta no existe." };
  }

  if (anterior && anterior !== nuevaFoto) {
    await borrarArchivo(anterior).catch((error) => console.error(`No se pudo borrar la foto de perfil ${anterior}`, error));
  }
  return { ok: true, datos: datosDeAvatar(fila) };
}

/** La foto de perfil de una cuenta, o null si no tiene. */
export async function leerFotoDePerfil(usuarioId: number): Promise<Buffer | null> {
  const { rows } = await pool.query<{ avatar_foto: string | null }>(
    `SELECT avatar_foto FROM usuarios WHERE id = $1 AND avatar = 'foto'`,
    [usuarioId],
  );
  const clave = rows[0]?.avatar_foto;
  if (!clave) return null;
  try {
    return await readUploadedFile(clave);
  } catch {
    return null;
  }
}
