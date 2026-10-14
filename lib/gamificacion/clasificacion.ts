// Tabla de líderes de la landing (2026-10-13): de dónde salen los datos. Server-only: aquí van las
// consultas a Postgres. HOY DEVUELVE DATOS DE EJEMPLO (datos-de-ejemplo.ts): la lógica real la hace
// quien lleva la gamificación. El contrato (tipos y reglas) está en lib/gamificacion/tipos.ts.

import { TABLA_DE_EJEMPLO } from "./datos-de-ejemplo";
import type { TablaDeLideres } from "./tipos";

/**
 * La sección solo se pinta en la landing con MOSTRAR_TABLA_DE_LIDERES=si en el entorno (.env y
 * docker-compose.yml). Decisión del usuario (2026-10-13): oculta hasta que lea datos reales, para que
 * nadie vea a las personas de ejemplo como si fueran reales. Al conectarla, quitar este interruptor.
 * Es una función (no una constante) para leer el entorno al regenerar la página, no en el build.
 */
export function mostrarTablaDeLideres(): boolean {
  return process.env.MOSTRAR_TABLA_DE_LIDERES === "si";
}

/**
 * Las 6 primeras personas de cada categoría, ya ordenadas de mayor a menor.
 *
 * TODO(gamificación): reemplazar TABLA_DE_EJEMPLO por consultas reales con pool.query (lib/db.ts),
 * SQL parametrizado y en try/catch con una tabla vacía, porque la landing se prerrenderiza en el
 * build sin base de datos (regla 12 de la skill). Reglas ya decididas por el usuario:
 * - Aportes: COUNT de `aportes` con status = 'aceptado' por user_id (solo aprobados; los anónimos,
 *   user_id NULL, no cuentan). Desde siempre.
 * - Nivel: usuarios.level (y xp_total en `detalle`). Ojo: hoy nada sube xp_total ni level (todos en
 *   nivel 1 con 0 XP); otorgar el XP es parte de esta tarea (reglas en references/dominio.md § 7).
 * - Temática: aportes aprobados por persona dentro de las campañas de cada temática (campanas.tematica;
 *   las viejas pueden traerla solo en campanas.tag, ver lib/campanas/enlaces.ts),
 *   una entrada por temática que tenga aportes; ordenar las temáticas como se quiera mostrar.
 * - Quiénes no salen: cuentas dadas de baja (usuarios.eliminada_en) y suspendidas o baneadas
 *   (lib/sanciones.ts). El SuperUsuario no tiene fila en `usuarios`.
 * - Nombre con nombreParaMostrar(nombre, apellidos) y avatar con usuarios.avatar, mandando "foto"
 *   como null (la foto de perfil es privada).
 * TODO(dominio): desempate entre personas con el mismo valor (¿quién llegó primero?, ¿XP?).
 */
export async function obtenerTablaDeLideres(): Promise<TablaDeLideres> {
  return TABLA_DE_EJEMPLO;
}
