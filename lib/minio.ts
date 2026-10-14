// Almacenamiento de archivos en MinIO (compatible con S3).
// - guardarArchivo(buffer, { subdir, extension, mimeType }): guarda <subdir>/<uuid><ext> y devuelve la clave.
// - borrarArchivo(key): borra el objeto (archivo de un aporte que el creador quitó).
// - readUploadedFile(key): descarga el objeto a un Buffer.
// - abrirArchivo(key, rango?) y tamanoDeArchivo(key): para enviar un archivo por partes (video y audio).
// El archivo siempre pasa por el servidor; el bucket es privado y no se expone al navegador.

import { randomUUID } from "crypto";
import type { Readable } from "stream";
import { Client } from "minio";

const BUCKET = process.env.MINIO_BUCKET || "aportes";

// Credenciales sin valor por defecto: la app usa un usuario limitado al
// bucket (lo crea el servicio minio-init de docker-compose.yml), nunca el
// root de MinIO. Si faltan, falla en el primer uso con un error claro.
let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;
    if (!accessKey || !secretKey) {
      throw new Error("Faltan MINIO_ACCESS_KEY o MINIO_SECRET_KEY en el entorno.");
    }
    client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey,
      secretKey,
    });
  }
  return client;
}

let bucketEnsured: Promise<void> | null = null;

// En Docker el bucket ya lo crea minio-init (el usuario de la app no tiene
// permiso de crear buckets); esto cubre `next dev` contra un MinIO local.
async function ensureBucket() {
  if (!bucketEnsured) {
    bucketEnsured = (async () => {
      const exists = await getClient().bucketExists(BUCKET).catch(() => false);
      if (!exists) {
        await getClient().makeBucket(BUCKET);
      }
    })();
    // Si falla, que el siguiente intento lo vuelva a probar.
    bucketEnsured.catch(() => {
      bucketEnsured = null;
    });
  }
  return bucketEnsured;
}

export interface SavedUpload {
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Guarda un archivo ya validado y limpio (lib/aportes/imagen.ts) como
 * <subdir>/<uuid><extension>. La extensión y el tipo los decide el servidor
 * según el contenido real, nunca el nombre ni el tipo que mandó el navegador.
 */
export async function guardarArchivo(
  contenido: Buffer,
  opciones: { subdir: string; extension: string; mimeType: string }
): Promise<SavedUpload> {
  await ensureBucket();

  const objectKey = `${opciones.subdir}/${randomUUID()}${opciones.extension}`;
  await getClient().putObject(BUCKET, objectKey, contenido, contenido.byteLength, {
    "Content-Type": opciones.mimeType,
  });

  return { relativePath: objectKey, mimeType: opciones.mimeType, sizeBytes: contenido.byteLength };
}

/** Borra un objeto del bucket. Si ya no existía, no falla. */
export async function borrarArchivo(objectKey: string): Promise<void> {
  await ensureBucket();
  await getClient().removeObject(BUCKET, objectKey);
}

export async function readUploadedFile(objectKey: string): Promise<Buffer> {
  await ensureBucket();

  const stream = await getClient().getObject(BUCKET, objectKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Abre un objeto para enviarlo al navegador sin cargarlo entero en memoria. Con `rango`
 * (inclusivo, como en la cabecera Range) lee solo esos bytes: los <video> y <audio> piden
 * el archivo por partes para adelantar, y Safari no los reproduce sin eso.
 */
export async function abrirArchivo(
  objectKey: string,
  rango?: { inicio: number; fin: number }
): Promise<Readable> {
  await ensureBucket();
  return rango
    ? getClient().getPartialObject(BUCKET, objectKey, rango.inicio, rango.fin - rango.inicio + 1)
    : getClient().getObject(BUCKET, objectKey);
}

/** Tamaño en bytes de un objeto (para responder a una petición Range). */
export async function tamanoDeArchivo(objectKey: string): Promise<number> {
  await ensureBucket();
  const { size } = await getClient().statObject(BUCKET, objectKey);
  return size;
}
