// Quita los metadatos (EXIF con GPS, ICC, XMP, IPTC) de las fotos de aportes guardadas
// ANTES de que existiera la limpieza al subir (lib/aportes/imagen.ts, 2026-10-01). Las
// nuevas ya llegan limpias. Se corre una sola vez por servidor.
//
// Por defecto solo LISTA lo que encontraría. Con --aplicar re-codifica cada foto y la
// reemplaza en MinIO (misma clave); no se puede deshacer.
//
// Corre dentro de la imagen de la app, que ya tiene las variables (DATABASE_URL, MINIO_*),
// la red del compose, pg y sharp; minio se instala al momento:
//
//   docker compose run --rm --no-deps -v ./scripts:/scripts --entrypoint sh app -c \
//     "cd /tmp && npm i --no-save --silent minio@8 && NODE_PATH=/app/node_modules:/tmp/node_modules node /scripts/limpiar-metadatos.mjs"
//
// Agrega --aplicar al final del comando de node para escribir.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const sharp = require("sharp");
const { Client } = require("minio");

const aplicar = process.argv.includes("--aplicar");
const BUCKET = process.env.MINIO_BUCKET || "aportes";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "minio",
  port: Number(process.env.MINIO_PORT || 9000),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

async function leer(clave) {
  const partes = [];
  for await (const parte of await minio.getObject(BUCKET, clave)) partes.push(parte);
  return Buffer.concat(partes);
}

const { rows } = await pool.query(
  // Tabla archivos desde el 2026-10-30 (antes aportes.file_*).
  `SELECT ar.id, ar.ruta AS file_path, ar.mime AS file_mime_type FROM aportes a JOIN archivos ar ON ar.id = a.archivo_id
   WHERE ar.borrado_en IS NULL AND ar.mime IN ('image/jpeg', 'image/png')
   ORDER BY ar.id`
);
console.log(`${rows.length} fotos por revisar${aplicar ? " (modo --aplicar)" : " (solo lista; usa --aplicar para escribir)"}`);

let conMetadatos = 0;
let limpiadas = 0;
let fallas = 0;
for (const fila of rows) {
  try {
    const original = await leer(fila.file_path);
    const meta = await sharp(original).metadata();
    const trae = ["exif", "icc", "xmp", "iptc"].filter((k) => meta[k]);
    if (trae.length === 0) continue;
    conMetadatos++;
    console.log(`  aporte ${fila.id}: ${trae.join(", ")}${meta.exif ? " (puede traer GPS)" : ""}`);
    if (!aplicar) continue;

    // Igual que limpiarImagen(): se aplica la orientación y se vuelve a codificar sin metadatos.
    const base = sharp(original, { failOn: "error" }).rotate();
    const limpia = fila.file_mime_type === "image/png" ? await base.png().toBuffer() : await base.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    await minio.putObject(BUCKET, fila.file_path, limpia, limpia.byteLength, { "Content-Type": fila.file_mime_type });
    await pool.query(`UPDATE archivos SET tamano_bytes = $2 WHERE id = $1`, [fila.id, limpia.byteLength]);
    limpiadas++;
  } catch (error) {
    fallas++;
    console.error(`  aporte ${fila.id}: no se pudo procesar (${error.message})`);
  }
}

console.log(`Con metadatos: ${conMetadatos}. Limpiadas: ${limpiadas}. Fallas: ${fallas}.`);
await pool.end();
