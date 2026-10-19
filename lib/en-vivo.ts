// Actualización en vivo (2026-10-19). Dos clases de aviso, que GET /api/eventos (long polling) entrega
// al navegador al instante, sin esperar a recargar la página:
//  - Avisos personales: notificar() publica cada notificación nueva para su destinatario
//    (publicarAviso). Si cambia el rol o hay una sanción, la página se refresca sola.
//  - Cambios de contenido: cualquier escritura en las tablas de campañas, aportes, revisión,
//    supervisión o moderación (triggers de Postgres → NOTIFY, lib/en-vivo-postgres.ts) sube
//    `versionDeCambios`, y todas las pantallas abiertas vuelven a leer sus datos.
//
// Vive en la memoria del proceso: sirve porque la app corre en un solo proceso (Docker Compose).
// Con varias réplicas, cada una escucha el NOTIFY por su cuenta (los cambios sí llegarían), pero los
// avisos personales habría que pasarlos también por Postgres.

import { EventEmitter } from "node:events";
import type { TipoDeNotificacion } from "@/lib/notificaciones/tipos";

export type AvisoEnVivo = { tipo: TipoDeNotificacion };

// En globalThis: instrumentation, route handlers y server actions pueden cargar este módulo en
// paquetes distintos, y todos deben compartir el mismo emisor y la misma versión.
const global = globalThis as typeof globalThis & { __enVivo?: { emisor: EventEmitter; version: number } };
const estado = (global.__enVivo ??= { emisor: new EventEmitter(), version: 0 });
// Una escucha por pestaña abierta: sin tope, para no llenar el log de advertencias.
estado.emisor.setMaxListeners(0);

export function publicarAviso(usuarioId: number | string, aviso: AvisoEnVivo): void {
  estado.emisor.emit(`usuario:${usuarioId}`, aviso);
}

/** Escucha los avisos de una persona. Devuelve la función para dejar de escuchar. */
export function escucharAvisos(usuarioId: number | string, alRecibir: (aviso: AvisoEnVivo) => void): () => void {
  const canal = `usuario:${usuarioId}`;
  estado.emisor.on(canal, alRecibir);
  return () => estado.emisor.off(canal, alRecibir);
}

/**
 * Número que sube con cada cambio de contenido. Empieza en la hora de arranque: si el servidor se
 * reinicia, ningún navegador se queda con una versión "del futuro" que no vuelva a cambiar.
 */
export function versionDeCambios(): number {
  if (estado.version === 0) estado.version = Date.now();
  return estado.version;
}

/** Lo llama lib/en-vivo-postgres.ts con cada NOTIFY de la base (`tabla` = la que cambió). */
export function publicarCambio(tabla: string): void {
  estado.version = versionDeCambios() + 1;
  estado.emisor.emit("cambios", tabla);
}

/** Escucha los cambios de contenido. Devuelve la función para dejar de escuchar. */
export function escucharCambios(alCambiar: () => void): () => void {
  estado.emisor.on("cambios", alCambiar);
  return () => estado.emisor.off("cambios", alCambiar);
}
