# Base de datos: PostgreSQL con `pg` y SQL directo

## Contenido
1. Solo PostgreSQL, sin ORM
2. Dónde vive el esquema
3. Tablas actuales
4. Convenciones
5. JSONB
6. Fechas y zonas horarias

## 1. Solo PostgreSQL, sin ORM

- **Conexión:** `lib/db.ts` exporta `pool` (un `pg.Pool` con `connectionTimeoutMillis: 5000` y listener de `error`) y `dbQuery()`. Lee `POSTGRES_URL` o `DATABASE_URL`.
- **No hay Drizzle, Prisma ni Knex.** Las consultas son SQL a mano, parametrizadas (`$1, $2...`).
- **No agregues otro motor** (SQLite, MySQL, MongoDB, `pg-mem`, PGlite), tampoco para pruebas.

## 2. Dónde vive el esquema

**`lib/db-schema.ts` es la única fuente del DDL.** Cada tabla tiene su `ensureXTable()`, y `ensureCoreSchema()` las llama todas en orden de dependencias. Son idempotentes (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

**Corre una sola vez, al arrancar el servidor:** `instrumentation.ts` llama a `ensureCoreSchema()` antes de atender peticiones. Si falta `DATABASE_URL`/`POSTGRES_URL`, termina de inmediato en producción (es un error de configuración, reintentar no sirve). Si Postgres no responde, reintenta 30 veces cada 2 s; si sigue sin responder, en producción termina el proceso para que Docker lo reinicie. No se ejecuta durante `next build`. **No llames `ensure*()` en rutas ni acciones.** El usuario de la base necesita permisos de DDL al arrancar.

**No hay migraciones versionadas.** Para cambiar el esquema:

1. **Columna nueva:** agrégala al `CREATE TABLE` (para instalaciones nuevas) **y** como `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (para bases existentes).
2. **Cambios no idempotentes** (restricciones, `DROP NOT NULL`, CHECK): envuélvelos para que repetirlos no falle. Por ejemplo, `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...) ... $$` como en `campana_supervisores`.
3. **Renombrar o borrar columnas** no tiene camino seguro con este esquema: coméntalo con el equipo antes de hacerlo.
4. **`sql/*.sql` son scripts viejos** que ya no coinciden con `db-schema.ts`. No los uses como referencia ni los actualices.

## 3. Tablas actuales

| Tabla | Para qué |
| --- | --- |
| `usuarios` | Cuenta y perfil (`nombre`, `apellidos`, `email`, `state`, `city`, `specialty`, `intereses` JSONB, `intereses_texto`: lo que escribió sobre sus gustos), `role` JSONB (`["usuario", "supervisor", ...]`), XP/nivel/racha, `email_verificado`, bloqueo por intentos (`failed_login_attempts`, `locked_until`), `google_id`, código de verificación (hash, vencimiento, intentos), código de recuperación de contraseña (`recuperacion_codigo_hash`, `recuperacion_vence_en`, `recuperacion_intentos`, `recuperacion_enviada_en`; `lib/usuarios/recuperacion.ts`) · `avatar` y `avatar_foto` (ícono del perfil, 2026-10-13: NULL = iniciales; `masculino`/`femenino`/`otro`/`foto`; la foto en MinIO `perfiles/<id>/<uuid>.jpg`; la baja la borra) |
| `sessions` | Sesión de usuario: `token_hash` (sha256), `usuario_id`, `expires_at` |
| `tematicas` | Catálogo de temáticas (intereses y temática de campaña, 2026-10-07): `nombre`, `clave` (única: sin acentos ni mayúsculas), `origen` (`base`: las 23 de `lib/intereses.ts`, sembradas al arrancar; `usuario`: salió del texto de alguien), `creada_por`, `oculta` (el SuperUsuario la quitó de las opciones). `usuarios.intereses` y `campanas.tematica` guardan el **nombre**, no el id |
| `root_sessions` | Sesión del SuperUsuario (sin `usuario_id`) |
| `campanas` | Campaña completa. Contadores desnormalizados (`current_/approved_/pending_/rejected_contributions`, `participants`), fechas y horas separadas (`start_date`, `start_time`...), ubicación textual, `supervisor_id` + `supervisado_por_root`, `share_token` + `share_token_expires_at` (**obsoletas**: el enlace público vive en `campana_enlaces`), `downloads_count`. Tiene una columna `aportes` JSONB **heredada**: los aportes reales están en la tabla `aportes` |
| `campana_supervisores` | Historial de dictámenes (`aceptada`, `rechazada`, `reportada`, `reasignada`) con `motivo`. `supervisor_id` NULL + `por_superusuario` si lo hizo el SuperUsuario |
| `campana_revisores` | Revisor por campaña: `invitado`, `aceptado` o `rechazado` |
| `campana_baneados` | Baneo de un usuario en una campaña, con motivo y quién baneó |
| `campana_enlaces` | Enlace público `/c/[token]`: `token` único, `expira_en` (24 h), `revocado_en` (al regenerar; no se borra), `visitas`, `creado_por`. Se crea antes que `aportes` porque `aportes.enlace_id` la referencia (`lib/campanas/enlaces.ts`) |
| `campanas_guardadas` | Favoritos del usuario |
| `push_suscripciones` | Navegadores con avisos push activos: `usuario_id`, `endpoint` único, `p256dh`, `auth`. Ver `dominio.md` § 11 |
| `notificaciones` | Avisos por usuario (`tipo`, `titulo`, `mensaje`, `metadata` JSONB con `enlace`, `leida_en`). Se crean solo con `notificar()` (`lib/notificaciones/notificaciones.ts`); índice `(usuario_id, created_at DESC)`. Eventos y reglas en `dominio.md` § 11 |
| `aportes` | Aporte: `campaign_id`, `user_id` (NULL si fue anónimo), datos del participante, `file_*` (clave en MinIO, nombre, mime, tamaño), `caracteristicas` JSONB, `status`, `rejection_reason`, primera revisión (`first_pass_by`, `first_pass_by_user_id`), `enlace_id` (enlace público por el que llegó), `anonimo_id` (aporte sin cuenta: sha256 de la cookie del dispositivo, para la cuota; nunca el valor), `inapropiado` + `inapropiado_por` + `inapropiado_en` (marca de contenido inapropiado en un aporte anónimo), `archivo_borrado_en` (el creador borró el archivo de MinIO), `consentimiento_en` (TIMESTAMPTZ: aceptó los avisos de "Antes de enviar", 2026-10-13; NULL en los de antes), `reporte_motivo` + `reporte_por` + `reporte_en` ("Reportar al creador" del revisor, uno por aporte). Un aporte anónimo va como "Anónimo", sin correo ni `file_original_name` |
| `dispositivos_bloqueados` | Bloqueos de personas sin cuenta (`lib/aportes/sanciones-anonimas.ts`): `anonimo_id`, `campana_id` (con valor: bloqueo del creador en su campaña, sin vencimiento; NULL: bloqueo global automático, vence en `hasta`), `motivo`, `bloqueado_por`, `aporte_id`, `activo`, `restaurado_en`. Se crea después de `aportes` |
| `sanciones` | Sanciones de cuenta (`tipo`, `detalle`, `dias`, `activa`, `restaurada_en`, `aplicada_por`). `STRIKE` = aviso; `SUSPENSION_TEMPORAL`/`BANEO_DE_CAMPANA` bloquean la cuenta (`lib/sanciones.ts`); con `aplicada_por = 'Automático'` son la consecuencia de un aviso |
| `reportes` | Reportes a la plataforma (2026-10-12, `lib/reportes/reportes.ts`): `tipo` (`campana` contra su creador, `aporte` contra quien lo envió), `campana_id`, `aporte_id` (SET NULL si se borra el aporte: el reporte se conserva), `reportado_id`, `reportado_por`, `motivo` y/o `descripcion`, `estado` (`pendiente`, `descartado`, `sancionado`), `nota_de_resolucion`, `sancion_id`, `resuelto_en`. Índices únicos parciales: uno por persona y campaña, uno por persona y aporte. Se crea después de `sanciones` y `aportes` |
| `lista_negra_correos` | Correos baneados (2026-10-12, `lib/usuarios/lista-negra.ts`): `email` (PK, minúsculas), `usuario_id`, `sancion_id` (el baneo que lo puso; restaurarlo lo saca), `motivo`. Lo consultan `POST /api/usuarios` y el callback de Google |
| `audit_log` | Bitácora de acciones sensibles, solo de inserción: `actor_tipo` (`usuario`, `superusuario`, `anonimo`), `actor_id`, `accion`, `objetivo_tipo` + `objetivo_id`, `detalle` JSONB, `ip`. Se escribe con `registrarAuditoria()` (`lib/auditoria.ts`). Índice único parcial `audit_log_reversion_unica` sobre `detalle->>'accionId'` donde `accion = 'supervision.revertir'`: una decisión de supervisor se revierte una sola vez (`lib/usuarios/acciones-supervisor.ts`) |

## 4. Convenciones

- **Nombres:** tablas y columnas en snake_case. Mezclan español (`campanas`, `usuarios`, `motivo`) e inglés (`status`, `created_at`, `campaign_id`). Sigue lo que ya usa la tabla que tocas.
- **Claves:** `SERIAL`. Los IDs llegan al frontend como `string`.
- **Estados:** `VARCHAR` con valores en español (`borrador`, `en_revision`, `aceptada`, `activa`, `finalizada`...; `pendiente`, `aceptado`, `rechazado`...). Revisa `types/index.ts` antes de agregar uno.
- **Contadores desnormalizados** en `campanas`: si insertas, cambias de estado o borras un aporte, actualiza los contadores **en la misma transacción** (ver `app/api/aportes/[id]/route.ts`).
- **Carreras:** resuélvelas con un `UPDATE ... WHERE <condición> RETURNING` y revisa `rowCount` (ejemplo: tomar una campaña en `lib/supervision/decision.ts`).
- **Transición perezosa de estados:** `activateScheduledCampaigns()` y `finalizeExpiredCampaigns()` (`lib/campaign-date.ts`) pasan `aceptada → activa` y `activa → finalizada` al leer. No hay cron.

## 5. JSONB

Se usa JSONB para listas cortas que se leen completas: `usuarios.role`, `usuarios.intereses`, `campanas.data_types`, `campanas.checklist_secciones` (`[{ titulo, opciones }]`; `checklist_opciones` es el formato viejo, solo lectura), `aportes.caracteristicas` y `notificaciones.metadata`. Para filtrar usa `@>` o `?`. Por ejemplo, `role @> '["supervisor"]'::jsonb` o `data_types ? $1`. Si algo necesita relaciones, contadores o historial, va en tabla propia.

## 6. Fechas y zonas horarias

- **Todo instante nuevo es `TIMESTAMPTZ`.** Algunas columnas viejas siguen como `TIMESTAMP` sin zona (`created_at`/`updated_at` de varias tablas, `aportes.submitted_at`, `aportes.reviewed_at`). Ya se corrigieron cinco columnas que causaban desfases. Si comparas un `TIMESTAMP` con `NOW()` o lo conviertes a `Date` en JS, revisa que no se desfase.
- **Fechas de campaña:** `DATE` + `TIME` por separado. Se interpretan con `lib/campaign-date.ts` (`normalizeCampaignDate`, `hasCampaignStarted`, `hasCampaignEnded`).
  - Son **hora de pared de Tepic** (`ZONA_DE_CAMPANAS = "America/Mazatlan"`). "Ahora" y "hoy" se calculan en esa zona con `Intl`, **nunca con la zona del proceso ni con `NOW()`**: dentro de Docker los dos son UTC. Hasta el 2026-10-07 se usaba la hora local del proceso y una campaña de 15:00 a 20:00 aceptada a mediodía se finalizaba al instante (en UTC ya eran más de las 20:00). Para "hoy" en cualquier otro cálculo, usa la misma zona.
  - Pendiente: las gráficas de aportes por día de `lib/campanas/panel.ts` y `/api/campanas/[id]/recoleccion-diaria` agrupan los días en UTC (desde las 17:00 de Tepic ya cuentan el día siguiente).
