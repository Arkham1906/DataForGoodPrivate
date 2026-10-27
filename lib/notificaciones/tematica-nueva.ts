// Temática nueva en los perfiles (2026-10-26, pedido del usuario): cuando una temática empieza a
// ofrecerse a todos (el SuperUsuario la crea o aprueba una pendiente en /sistema/tematicas), se
// vuelve a leer lo que cada persona escribió sobre sus gustos (usuarios.intereses_texto) con el
// mismo analizador del perfil (analizarIntereses de lib/tematicas/analizar.ts). Si el texto la
// menciona:
//   - se agrega a sus intereses (al final), si aún no la tiene y le queda lugar (MAXIMO_DE_INTERESES);
//   - le llega `tematica_nueva` con enlace a /cuenta (dice si se agregó o si antes debe quitar una).
// No a cuentas dadas de baja ni suspendidas o baneadas. El aviso respeta el interruptor general de
// Notificaciones (notificar); el perfil se actualiza igual. Las pantallas abiertas se refrescan solas
// (trigger de `usuarios` → ActualizacionEnVivo).
//
// En segundo plano y por tandas, sin hacer esperar al SuperUsuario.

import { pool } from "@/lib/db";
import { SQL_SANCION_BLOQUEANTE } from "@/lib/sanciones";
import { analizarIntereses, claveDeTematica, MAXIMO_DE_INTERESES } from "@/lib/tematicas/analizar";
import { notificar } from "./notificaciones";

const TAMANO_DE_TANDA = 200;

/** Busca a quién le corresponde una temática nueva, la agrega y avisa. No espera ni lanza. */
export function avisarTematicaNueva(nombre: string): void {
  void repartirTematicaNueva(nombre).catch((error) => console.error(`Error repartiendo la temática nueva «${nombre}»`, error));
}

/** ¿Lo que escribió la persona da esta temática? Solo se le pasa la nueva como catálogo. */
function laMenciona(texto: string, nombre: string): boolean {
  const clave = claveDeTematica(nombre);
  return analizarIntereses(texto, [nombre]).tematicas.some((t) => claveDeTematica(t) === clave);
}

async function repartirTematicaNueva(nombre: string): Promise<{ agregadas: number; sinLugar: number }> {
  let agregadas = 0;
  let sinLugar = 0;
  let desdeId = 0;

  for (;;) {
    const { rows } = await pool.query<{ id: number; intereses_texto: string }>(
      `SELECT u.id, u.intereses_texto
       FROM usuarios u
       WHERE u.id > $1
         AND COALESCE(u.intereses_texto, '') <> ''
         AND NOT u.intereses ? $2
         AND u.eliminada_en IS NULL AND NOT (${SQL_SANCION_BLOQUEANTE})
       ORDER BY u.id
       LIMIT $3`,
      [desdeId, nombre, TAMANO_DE_TANDA],
    );
    if (rows.length === 0) break;
    desdeId = rows[rows.length - 1].id;

    for (const fila of rows) {
      if (!laMenciona(fila.intereses_texto, nombre)) continue;

      // Condicional: si mientras tanto la agregó o llenó su lista, no se toca.
      const actualizada = await pool.query(
        `UPDATE usuarios SET intereses = intereses || to_jsonb($2::text), updated_at = NOW()
         WHERE id = $1 AND NOT intereses ? $2 AND jsonb_array_length(intereses) < $3`,
        [fila.id, nombre, MAXIMO_DE_INTERESES],
      );
      const seAgrego = (actualizada.rowCount ?? 0) > 0;
      if (seAgrego) {
        agregadas++;
      } else {
        const yaLaTiene = await pool.query(`SELECT 1 FROM usuarios WHERE id = $1 AND intereses ? $2`, [fila.id, nombre]);
        if ((yaLaTiene.rowCount ?? 0) > 0) continue;
        sinLugar++;
      }

      await notificar({
        usuarioId: fila.id,
        tipo: "tematica_nueva",
        titulo: `Nueva temática para ti: ${nombre}`,
        mensaje: seAgrego
          ? `La agregamos a tus intereses porque coincide con lo que escribiste sobre tus gustos. Puedes quitarla en tu cuenta.`
          : `Coincide con lo que escribiste sobre tus gustos, pero ya tienes ${MAXIMO_DE_INTERESES} intereses. Quita uno en tu cuenta para agregarla.`,
        enlace: "/cuenta",
        metadata: { tematica: nombre, agregada: seAgrego },
      });
    }
  }

  if (agregadas + sinLugar > 0) {
    console.info(`Temática nueva «${nombre}»: agregada a ${agregadas} perfiles; ${sinLugar} sin lugar.`);
  }
  return { agregadas, sinLugar };
}
