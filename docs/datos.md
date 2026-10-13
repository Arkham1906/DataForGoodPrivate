# Datos: PostgreSQL y MinIO

## Contenido
1. Conexión y esquema
2. Tablas
3. Ciclo de vida de una campaña
4. Ciclo de vida de un aporte
5. Archivos en MinIO
6. Convenciones y trampas

---

## 1. Conexión y esquema

- **Conexión:** `lib/db.ts` exporta `pool` (un `pg.Pool`). Lee `DATABASE_URL` (o `POSTGRES_URL`). Se crea en el primer uso, no al importar, porque `next build` importa el archivo sin variables de entorno.
- **Consultas:** SQL a mano y siempre parametrizado:
  ```ts
  const { rows } = await pool.query("SELECT * FROM campanas WHERE id = $1", [id]);
  ```
- **No hay ORM ni migraciones.** El esquema completo vive en **`lib/db-schema.ts`**: una función `ensureXTable()` por tabla, con `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. `ensureCoreSchema()` las llama todas en orden.
- **Cuándo corre:** una vez al arrancar el servidor (`instrumentation.ts` → `instrumentation-node.ts`). Si Postgres no responde, reintenta 30 veces cada 2 s y luego termina el proceso para que Docker lo reinicie. **No llames a `ensure*()` desde rutas ni acciones.**
- **`sql/*.sql` son scripts viejos** que ya no coinciden con el esquema. No los uses.
- **Diagrama:** `database-schema.mmd` (Mermaid) en la raíz.

### Cambiar el esquema

1. **Columna nueva:** agrégala dentro del `CREATE TABLE` (para bases nuevas) **y** como `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (para bases existentes).
2. **Tabla nueva:** crea su `ensureXTable()` y llámala desde `ensureCoreSchema()` después de las tablas a las que referencia.
3. **Restricciones o cambios que no son idempotentes:** envuélvelos en un bloque `DO $$ ... IF NOT EXISTS (...) $$` (hay un ejemplo en `campana_supervisores`).
4. **Renombrar o borrar columnas** no tiene camino seguro: coméntalo con el equipo.

## 2. Tablas

| Tabla | Para qué | Columnas clave |
| --- | --- | --- |
| `usuarios` | Cuenta y perfil | `nombre`, `apellidos`, `email`, `password_hash`, `role` (JSONB, p. ej. `["usuario","supervisor"]`), `state`, `city`, `specialty`, `intereses` (JSONB, nombres de temáticas), `intereses_texto` (lo que escribió sobre sus gustos), `xp_total`, `level`, `streak_days`, `email_verificado`, `failed_login_attempts`, `locked_until`, `google_id`, código de verificación (hash, vencimiento, intentos), código de recuperación de contraseña (`recuperacion_codigo_hash`, `recuperacion_vence_en`, `recuperacion_intentos`, `recuperacion_enviada_en`), baja voluntaria (`baja_solicitada_en`, `baja_efectiva_en`, `baja_destino_aportes`, `eliminada_en`: la fila se vacía, nunca se borra) · `avatar` (ícono del perfil: NULL = iniciales; `masculino`, `femenino`, `otro` o `foto`) y `avatar_foto` (clave en MinIO de la foto propia, `perfiles/<id>/<uuid>.jpg`), desde el 2026-10-13 |
| `tematicas` | Catálogo de temáticas (intereses y temática de campaña) | `nombre`, `clave` (única, sin acentos ni mayúsculas), `origen` (`base` o `usuario`), `creada_por`, `oculta`. Se siembra con las 23 de `lib/intereses.ts` al arrancar |
| `sessions` | Sesiones de usuario | `token_hash` (sha256 del token de la cookie), `usuario_id`, `expires_at` |
| `root_sessions` | Sesiones del SuperUsuario | `token_hash`, `expires_at` (sin usuario) |
| `campanas` | Campañas | `creator_id`, `name`, `description`, `tag` (temática), `data_types` (JSONB), `goal_contributions`, `quota_per_user`, `status`, `start_date`/`start_time`, `end_date`/`end_time`, ubicación (`location_state` obligatorio fuera de borrador; `location_city` opcional: vacío = todo el estado; `location_colonia` solo con municipio), `checklist_secciones` (JSONB), `supervisor_id`, `supervisado_por_root`, `share_token`, `downloads_count`. **Contadores desnormalizados:** `current_contributions`, `approved_contributions`, `pending_contributions`, `rejected_contributions`, `participants` |
| `campana_supervisores` | Historial de dictámenes | `campana_id`, `supervisor_id` (NULL si fue el SuperUsuario), `por_superusuario`, `accion` (`aceptada`, `rechazada`, `reportada`, `reasignada`), `motivo` |
| `campana_revisores` | Revisores por campaña | `campana_id`, `usuario_id`, `estado` (`invitado`, `aceptado`, `rechazado`) |
| `campana_baneados` | Participantes baneados de una campaña | `campana_id`, `usuario_id`, `motivo`, `baneado_por` |
| `dispositivos_bloqueados` | Bloqueos de personas sin cuenta | `anonimo_id`, `campana_id` (NULL = global), `motivo`, `bloqueado_por`, `aporte_id`, `hasta`, `activo`, `restaurado_en` |
| `campana_enlaces` | Enlaces públicos `/c/[token]` (historial: una fila por token) | `campana_id`, `token` (único), `creado_por`, `creado_en`, `expira_en` (24 h), `revocado_en` (al regenerar), `visitas`. Vigente = sin revocar y sin vencer. Reemplaza a `campanas.share_token`, que ya no se usa |
| `campanas_guardadas` | Favoritos | `usuario_id`, `campana_id` |
| `push_suscripciones` | Navegadores o teléfonos con los avisos push activos (`lib/notificaciones/push.ts`). Se borran solas si el servicio de push responde 404/410, al cerrar sesión y en la baja definitiva | `usuario_id`, `endpoint` (único), `p256dh`, `auth`, `user_agent`, `ultimo_envio_en` |
| `notificaciones` | Avisos para el usuario. Se crean con `notificar()` (`lib/notificaciones/notificaciones.ts`); los 16 tipos están en `TipoDeNotificacion` (`lib/notificaciones/tipos.ts`). Índice `(usuario_id, created_at DESC)` | `usuario_id`, `tipo` (p. ej. `invitacion_revisor`, `aporte_rechazado`), `titulo`, `mensaje`, `campana_id`, `metadata` (JSONB; `metadata.enlace` es la ruta a la que lleva), `leida_en` |
| `aportes` | Aportes | `campaign_id`, `user_id` (NULL = anónimo), `participant_name`/`participant_email`, `description`, `file_path` (clave en MinIO), `file_original_name`, `file_mime_type`, `file_size_bytes`, `file_type`, `caracteristicas` (JSONB: respuestas de checklists), `status`, `rejection_reason`, `first_pass_by`/`first_pass_by_user_id` (revisor), `enlace_id` (enlace público por el que llegó, o NULL), `anonimo_id` (aporte sin cuenta: sha256 de la cookie del dispositivo, para su cuota; NULL si tiene cuenta), `inapropiado`/`inapropiado_por`/`inapropiado_en`, `archivo_borrado_en`, `consentimiento_en` (cuándo aceptó los avisos de uso y contenido; NULL antes del 2026-10-13), `reporte_motivo`/`reporte_por`/`reporte_en` ("Reportar al creador" del revisor; uno por aporte), `submitted_at`, `reviewed_at`. Un aporte anónimo tiene `user_id` NULL, `participant_name` "Anónimo" y ni correo ni `file_original_name` |
| `sanciones` | Sanciones de cuenta | `usuario_id`, `tipo` (`STRIKE` = aviso; `SUSPENSION_TEMPORAL` y `BANEO_DE_CAMPANA` = lo que bloquea), `detalle`, `dias`, `activa`, `aplicada_en`, `aplicada_por` (`Automático` = la consecuencia de un aviso), `restaurada_en` |
| `reportes` | Reportes a la plataforma (bandejas `/supervisar/reportes` y `/supervision/reportes`): de una campaña (contra su creador) o de un aporte (contra quien lo envió). Índices únicos parciales: uno por persona y campaña, uno por persona y aporte | `tipo` (`campana`, `aporte`), `campana_id`, `aporte_id` (NULL si es de campaña o si el aporte se borró), `reportado_id`, `reportado_por`, `motivo` y/o `descripcion`, `estado` (`pendiente`, `descartado`, `sancionado`), `nota_de_resolucion`, `sancion_id`, `resuelto_en` |
| `lista_negra_correos` | Correos de cuentas baneadas (al 4.º aviso o con baneo inmediato): no pueden registrarse ni entrar con Google como cuenta nueva. Restaurar el baneo saca el correo | `email` (PK, minúsculas), `usuario_id`, `sancion_id`, `motivo`, `creado_en` |
| `audit_log` | Bitácora de acciones sensibles (solo inserción) | `actor_tipo`, `actor_id`, `accion`, `objetivo_tipo`, `objetivo_id`, `detalle` (JSONB), `ip`, `created_at` |

Nombres mezclados: hay tablas y columnas en español (`campanas`, `motivo`) y en inglés (`status`, `campaign_id`). Al tocar una tabla, sigue lo que ya usa.

`campanas.aportes` (JSONB) y `campanas.checklist_opciones` son **columnas heredadas**: los aportes reales están en la tabla `aportes`, y los checklists en `checklist_secciones`.

## 3. Ciclo de vida de una campaña

```
                  ┌──────────────► rechazada ──(el creador edita y reenvía)──┐
                  │                                                          │
borrador ──► en_revision ──(supervisor acepta)──► aceptada ──(llega start_date)──► activa ⇄ pausada
   ▲              ▲                                   │                             │
   └──────────────┴───────────────────────────────────┘                             ▼
                                                     (si start_date ya pasó, directo a activa)  finalizada
                                                                                    │
                                                                (el creador la reactiva) ──► activa
```

| Estado | Qué significa | Quién lo pone |
| --- | --- | --- |
| `borrador` | Guardada sin enviar; puede estar incompleta | El creador (`POST`/`PATCH /api/campanas`) |
| `en_revision` | Enviada, esperando supervisor | El creador al enviar o reenviar |
| `aceptada` | Aprobada, pero su fecha de inicio es futura | El supervisor (`lib/supervision/decision.ts`) |
| `activa` | Recibe aportes | El supervisor (si ya empezó) o la activación automática |
| `pausada` | Detenida temporalmente | El creador |
| `finalizada` | Cerrada; aparece en `/datos` como dato abierto | El creador (botón "Finalizar") o automático al vencer `end_date` |
| `rechazada` | El supervisor la rechazó con un motivo | El supervisor |

- **Transiciones automáticas sin cron.** `activateScheduledCampaigns()` (`aceptada` → `activa`) y `finalizeExpiredCampaigns()` (`activa` → `finalizada`) de `lib/campaign-date.ts` se ejecutan **cada vez que se lee `GET /api/campanas`**. Una `pausada` no se finaliza sola.
- **Enlace público automático.** Cada vez que una campaña **pasa a `activa`** (el supervisor la acepta y ya empezó, llega su fecha de inicio o se reactiva) se le genera un enlace `/c/[token]` de 24 h si no tiene uno vigente (`asegurarEnlaceVigente` de `lib/campanas/enlaces.ts`). Si la acepta con inicio futuro, el enlace se crea el día que arranca, no antes, para que no venza sin usarse. Después solo el creador lo regenera.
- **"Reportada"** no cambia el estado: queda registrada en `campana_supervisores`.
- **Tomar una campaña:** un supervisor la reserva con un `UPDATE ... WHERE supervisor_id IS NULL AND NOT supervisado_por_root`. Si dos la toman a la vez, solo uno gana; el otro recibe 409.
- **Qué se puede editar según el estado** (`PATCH /api/campanas/[id]`):
  - `borrador`, `en_revision`, `rechazada`: todo.
  - `aceptada`, `activa`, `pausada`: solo la meta y la fecha de fin. Desde `activa` o `pausada` también se puede finalizar.
  - `finalizada`: solo reactivar (`status: "activa"`) con una fecha de fin nueva, y si la persona tiene menos de 5 campañas activas.

## 4. Ciclo de vida de un aporte

| Estado | Significado |
| --- | --- |
| `pendiente` | Recién enviado, sin revisar |
| `espera_final` | Ya no se usa (2026-10-06): era la espera de la segunda instancia. Si queda alguno, el creador o el revisor lo deciden como un `pendiente` |
| `aceptado` | Aprobado; cuenta para la meta y para los datos abiertos |
| `rechazado` | Rechazado con `rejection_reason`; **sigue contando para la cuota** de la persona hasta que ella lo borra (puede borrar uno rechazado, no uno aceptado) |

Reglas al enviar (`POST /api/aportes`): campaña `activa`, no ser el creador, no estar baneado (`campana_baneados`), tener cuota disponible, archivo JPG/PNG de hasta 10 MB (se comprueba la firma real y se quitan los metadatos) y descripción obligatoria (máx. 1000 caracteres). La cuota se cuenta dentro de una transacción con candado, así que dos envíos simultáneos no la pasan.

**Contadores:** cuando un aporte se crea, cambia de estado o se borra, el handler actualiza los contadores de `campanas` (`pending_contributions`, `approved_contributions`...). Si escribes código que cambia aportes, actualiza también los contadores.

## 5. Archivos en MinIO

- **Módulo:** `lib/minio.ts`.
  - `guardarArchivo(buffer, { subdir, extension, mimeType })` guarda el objeto como `<subdir>/<uuid><ext>` y devuelve la clave, el mime y el tamaño. Los aportes usan `subdir = campanas/<campaignId>` y llegan ya limpios desde `guardarFotoDelAporte()` (`lib/aportes/comun.ts`).
  - `borrarArchivo(key)` borra el objeto (archivo de un aporte anónimo que el creador quitó).
  - `readUploadedFile(key)` descarga el objeto completo a un `Buffer`.
- **El archivo pasa por el servidor.** El navegador sube `multipart/form-data` a `POST /api/aportes`, y el handler lo sube a MinIO. No hay URLs firmadas.
- **Para mostrarlo**, usa `GET /api/aportes/[id]/archivo` como `src`: verifica permisos y lo sirve con `Cache-Control: private`. **Nunca armes URLs directas a MinIO:** el bucket es privado y no se publica.
- **Datos abiertos:** `GET /api/datos/[id]/descarga` arma un ZIP (`archiver`) con los aportes aceptados de una campaña finalizada, renombrados `aporte-001.jpg`... sin datos personales.
- **Credenciales:** la app usa un usuario de MinIO limitado al bucket (`MINIO_ACCESS_KEY`). El usuario root solo lo usa el servicio `minio-init` de `docker-compose.yml`, que crea el bucket, la política y ese usuario. Si necesitas una operación nueva de S3, amplía la política ahí.

## 6. Convenciones y trampas

- **IDs:** `SERIAL` en la BD, `string` en el frontend.
- **JSONB** para listas cortas que se leen completas (`role`, `intereses`, `data_types`, `checklist_secciones`, `caracteristicas`, `metadata`). Para filtrar: `role @> '["supervisor"]'::jsonb` o `data_types ? $1`.
- **Carreras:** resuélvelas con `UPDATE ... WHERE <condición> RETURNING` y revisa `rowCount`, no leyendo y luego escribiendo.
- **Fechas:** todo instante nuevo debe ser `TIMESTAMPTZ`. Algunas columnas viejas son `TIMESTAMP` sin zona (`created_at` de varias tablas, `aportes.submitted_at`, `aportes.reviewed_at`): cuidado al compararlas con `NOW()`. Las fechas de campaña son `DATE` + `TIME` separados y se interpretan con `lib/campaign-date.ts`.
- **Páginas prerenderizadas** (`revalidate` o estáticas) que leen la BD deben envolver sus consultas en `try/catch`: el build de Docker corre sin base de datos.
- **Solo PostgreSQL**, también para pruebas.
