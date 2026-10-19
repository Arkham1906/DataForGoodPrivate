import { ZipArchive } from "archiver";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { extensionForMime } from "@/lib/open-data";
import { tablaDeAportesCsv, ubicacionDeCampana, type FilaDeAporteAbierto } from "@/lib/open-data-csv";
import { readUploadedFile } from "@/lib/minio";

/**
 * Descarga pública del conjunto de datos abierto de una campaña finalizada:
 * un ZIP con los archivos de sus aportes aceptados y la tabla aportes.csv
 * (desde el 2026-10-07; lib/open-data-csv.ts), sin nombre ni correo de quien
 * participó (dominio.md § 9). La tabla lleva todos los aportes aceptados,
 * también los de solo texto; cada archivo se llama aporte-NNN.ext con el
 * mismo número que su fila. El contador de descargas sube en cada ZIP
 * generado, no cuando el navegador termina de bajarlo.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const campana = await pool.query(
      `SELECT id, name, location_state, location_city, location_colonia
       FROM campanas WHERE id = $1 AND status = 'finalizada' LIMIT 1`,
      [id]
    );
    if (campana.rowCount === 0) {
      return NextResponse.json({ error: "Conjunto no encontrado" }, { status: 404 });
    }
    const c = campana.rows[0];

    const aportes = await pool.query(
      `SELECT id, user_id, anonimo_id, participant_name, description, file_type,
              CASE WHEN archivo_borrado_en IS NULL THEN NULLIF(file_path, '') END AS file_path,
              archivo_borrado_en IS NOT NULL AS archivo_borrado,
              file_mime_type
       FROM aportes
       WHERE campaign_id = $1 AND status = 'aceptado'
       ORDER BY id`,
      [id]
    );
    if (aportes.rowCount === 0) {
      return NextResponse.json(
        { error: "Este conjunto todavía no tiene aportes aprobados para descargar" },
        { status: 404 }
      );
    }

    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<void>((resolve, reject) => {
      archive.on("end", () => resolve());
      archive.on("error", reject);
    });

    const ubicacion = ubicacionDeCampana(c.location_state, c.location_city, c.location_colonia);
    const filas: FilaDeAporteAbierto[] = [];
    let numero = 0;
    for (const row of aportes.rows) {
      numero += 1;
      let archivo = "";
      if (row.archivo_borrado) {
        // Lo borró quien administra la campaña (contenido ilegal o dañino): ya no existe.
        archivo = "(archivo eliminado)";
      } else if (row.file_path) {
        const nombre = `aporte-${String(numero).padStart(3, "0")}${extensionForMime(String(row.file_mime_type ?? ""))}`;
        try {
          const buffer = await readUploadedFile(String(row.file_path));
          archive.append(buffer, { name: nombre });
          archivo = nombre;
        } catch (fileError) {
          // Un archivo que ya no está en MinIO no debe tumbar la descarga completa; su fila
          // queda en la tabla con la columna de archivo vacía.
          console.error(`No se pudo leer el archivo del aporte ${row.id} para el ZIP`, fileError);
        }
      }
      filas.push({
        numero,
        archivo,
        usuarioId: row.user_id === null ? null : Number(row.user_id),
        sinCuenta: row.anonimo_id !== null || row.participant_name === "Anónimo",
        campana: String(c.name ?? ""),
        ubicacion,
        descripcion: String(row.description ?? ""),
        tipo: String(row.file_type ?? ""),
      });
    }
    archive.append(tablaDeAportesCsv(filas), { name: "aportes.csv" });
    await archive.finalize();
    await finished;

    await pool.query(`UPDATE campanas SET downloads_count = downloads_count + 1 WHERE id = $1`, [id]);
    // Las páginas que muestran las descargas se guardan en caché 5 minutos: que la siguiente
    // visita ya traiga el número nuevo.
    revalidatePath(`/datos/${id}`);
    revalidatePath("/datos");
    revalidatePath("/");

    const zipBuffer = Buffer.concat(chunks);
    const nombreArchivo = `${c.name}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nombreArchivo || "conjunto"}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generando la descarga del conjunto", error);
    return NextResponse.json({ error: "No se pudo generar la descarga" }, { status: 500 });
  }
}
