import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { ipDelCliente } from "@/lib/ip";

/*
 * Bitácora de acciones sensibles (tabla audit_log). Se llama DESPUÉS de que
 * la acción se completó. Si el registro falla, se reporta en consola pero no
 * se revierte la acción: perder una fila de bitácora es preferible a dejar
 * a medias un cambio de rol o una sanción.
 */

export type ActorDeAuditoria =
  | { tipo: "usuario"; id: number }
  | { tipo: "superusuario" }
  | { tipo: "anonimo" };

export type AccionAuditada =
  | "rol.asignar"
  | "rol.revocar"
  | "sancion.aplicar"
  | "sancion.restaurar"
  | "supervision.revertir"
  | "supervision.tomar"
  | "supervision.dictaminar"
  // Pausar, reanudar o finalizar una campaña desde la supervisión (lib/supervision/estado-por-supervision.ts).
  | "supervision.pausar"
  | "supervision.reanudar"
  | "supervision.finalizar"
  | "campana.banear"
  | "campana.eliminar"
  // El creador pausó su campaña activa (PATCH /api/campanas/[id], 2026-10-24; antes no quedaba registro).
  | "campana.pausar"
  // El creador editó su campaña pausada (PATCH /api/campanas/[id]); detalle.campos dice qué cambió.
  | "campana.editar_pausada"
  // Aceptó los acuerdos al inscribirse para aportar (lib/campanas/inscripciones.ts).
  | "campana.inscribirse"
  // Reportes de campañas y de participantes (lib/reportes/reportes.ts y lib/moderacion/acciones.ts).
  | "campana.reportar"
  | "aporte.reportar_participante"
  | "reporte.descartar"
  | "campana.desbanear"
  | "campana.enlace_regenerar"
  | "revisor.invitar"
  | "revisor.aceptar"
  // El creador quita a un revisor o cancela su invitación (lib/campanas/revisores.ts, 2026-10-22).
  | "revisor.quitar"
  | "revisor.cancelar_invitacion"
  | "root.acceso"
  | "root.acceso_fallido"
  | "root.token_api"
  | "usuario.contrasena_cambiar"
  // "¿Olvidaste tu contraseña?" (lib/usuarios/recuperacion.ts).
  | "usuario.contrasena_recuperar"
  // Cuenta de Google que crea su contraseña desde /cuenta (lib/usuarios/recuperacion.ts).
  | "usuario.contrasena_crear"
  // Baja voluntaria de cuenta (lib/usuarios/baja.ts).
  | "usuario.baja_solicitar"
  | "usuario.baja_cancelar"
  | "usuario.baja_ejecutar"
  // Aportes sin cuenta y sus sanciones (lib/aportes/sanciones-anonimas.ts).
  | "aporte.anonimo_enviar"
  | "aporte.inapropiado"
  // "Reportar a supervisión" del revisor (lib/aportes/reporte.ts).
  | "aporte.reportar"
  | "aporte.archivo_borrar"
  | "campana.anonimos_cambiar"
  | "campana.bloquear_dispositivo"
  | "campana.desbloquear_dispositivo"
  | "sancion.dispositivo_bloquear"
  | "sancion.dispositivo_restaurar"
  // Catálogo de temáticas (lib/tematicas/acciones-tematicas.ts).
  | "tematica.ocultar"
  | "tematica.mostrar"
  | "tematica.aprobar"
  | "tematica.rechazar"
  | "tematica.crear"
  | "tematica.editar"
  | "tematica.borrar"
  // Etiquetas: subtemáticas de una temática (lib/etiquetas/acciones-etiquetas.ts, 2026-10-27).
  | "etiqueta.crear"
  | "etiqueta.editar"
  | "etiqueta.borrar"
  | "etiqueta.ocultar"
  | "etiqueta.mostrar"
  | "etiqueta.aprobar"
  | "etiqueta.rechazar"
  // Catálogo de especialidades (lib/usuarios/acciones-especialidades.ts).
  | "especialidad.crear"
  | "especialidad.editar"
  | "especialidad.borrar"
  // Catálogo de organizaciones (lib/usuarios/acciones-organizaciones.ts).
  | "organizacion.crear"
  | "organizacion.editar"
  | "organizacion.borrar";

export async function registrarAuditoria(entrada: {
  actor: ActorDeAuditoria;
  accion: AccionAuditada;
  objetivo?: { tipo: string; id: string | number };
  detalle?: Record<string, unknown>;
  /** false: no guardar la IP. Lo usa el actor anónimo, cuya IP nunca se guarda en claro. */
  guardarIp?: boolean;
}): Promise<void> {
  try {
    let ip: string | null = null;
    if (entrada.guardarIp !== false) {
      try {
        ip = ipDelCliente(await headers());
      } catch {
        // Fuera de una petición (no debería pasar) no hay encabezados.
      }
    }

    await pool.query(
      `INSERT INTO audit_log (actor_tipo, actor_id, accion, objetivo_tipo, objetivo_id, detalle, ip)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        entrada.actor.tipo,
        entrada.actor.tipo === "usuario" ? entrada.actor.id : null,
        entrada.accion,
        entrada.objetivo?.tipo ?? null,
        entrada.objetivo ? String(entrada.objetivo.id) : null,
        JSON.stringify(entrada.detalle ?? {}),
        ip,
      ]
    );
  } catch (error) {
    console.error(`No se pudo registrar en audit_log (${entrada.accion}):`, error);
  }
}
