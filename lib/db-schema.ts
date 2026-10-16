import { pool } from "@/lib/db";
import { TEMAS_DE_INTERES } from "@/lib/intereses";
import { claveDeTematica } from "@/lib/tematicas/analizar";

/**
 * Único lugar donde se define el DDL de cada tabla. Antes estaba duplicado
 * (y ya divergido) en cada ruta/módulo que la usaba — p. ej. `usuarios` tenía
 * cuatro copias distintas del CREATE TABLE, una de ellas sin `email_verificado`
 * ni `locked_until`.
 *
 * `ensureCoreSchema()` corre UNA vez al arrancar el servidor (ver
 * instrumentation.ts), no en cada petición. Las funciones son idempotentes
 * (`IF NOT EXISTS`), así que repetirlas en cada arranque es inofensivo. Una
 * tabla nueva se agrega aquí y en `ensureCoreSchema()`.
 */

export async function ensureUsuariosTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      apellidos VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      state VARCHAR(100),
      city VARCHAR(100),
      specialty VARCHAR(150),
      intereses JSONB NOT NULL DEFAULT '[]'::jsonb,
      -- Lo que la persona escribió sobre sus gustos; de ahí salen sus intereses (lib/tematicas/analizar.ts).
      intereses_texto VARCHAR(500),
      role JSONB NOT NULL DEFAULT '["usuario"]'::jsonb,
      xp_total INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      streak_days INTEGER NOT NULL DEFAULT 0,
      email_verificado BOOLEAN NOT NULL DEFAULT false,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      google_id VARCHAR(255) UNIQUE,
      verification_code_hash VARCHAR(64),
      verification_code_expires_at TIMESTAMPTZ,
      verification_attempts INTEGER NOT NULL DEFAULT 0,
      -- Recuperación de contraseña (lib/usuarios/recuperacion.ts): código de 6 dígitos como hash.
      recuperacion_codigo_hash VARCHAR(64),
      recuperacion_vence_en TIMESTAMPTZ,
      recuperacion_intentos INTEGER NOT NULL DEFAULT 0,
      recuperacion_enviada_en TIMESTAMPTZ,
      -- Baja voluntaria (lib/usuarios/baja.ts): se pide, corre un plazo de gracia y al
      -- vencer la fila se vacía de datos personales (eliminada_en). Nunca se borra la fila:
      -- campanas.creator_id es ON DELETE CASCADE y se llevaría aportes de otras personas.
      baja_solicitada_en TIMESTAMPTZ,
      baja_efectiva_en TIMESTAMPTZ,
      baja_destino_aportes VARCHAR(20),
      eliminada_en TIMESTAMPTZ,
      -- Ícono del perfil (lib/usuarios/avatar.ts): NULL = iniciales; masculino, femenino, otro o foto.
      avatar VARCHAR(12),
      -- Clave en MinIO de la foto propia (perfiles/<id>/<uuid>.jpg), si la eligió.
      avatar_foto VARCHAR(500),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Parches para tablas creadas antes de que existiera alguna de estas
  // columnas: IF NOT EXISTS hace que repetirlos sea inofensivo.
  await pool.query(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre VARCHAR(120);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apellidos VARCHAR(120);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS state VARCHAR(100);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS city VARCHAR(100);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS specialty VARCHAR(150);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intereses JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intereses_texto VARCHAR(500);
    -- Preferencias de /cuenta: "Campañas nuevas" (avisos por temática y ubicación, 2026-10-14).
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avisos_campanas_nuevas BOOLEAN NOT NULL DEFAULT true;
    -- El resto de Preferencias (lib/usuarios/preferencias-opciones.ts) y el último envío de los
    -- avisos periódicos (lib/notificaciones/periodicas.ts), para mandar uno por semana o por mes.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avisos_aportes BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recordatorio_semanal BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS resumen_mensual BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_recordatorio DATE;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_resumen DATE;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verification_code_hash VARCHAR(64);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recuperacion_codigo_hash VARCHAR(64);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recuperacion_vence_en TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recuperacion_intentos INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recuperacion_enviada_en TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baja_solicitada_en TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baja_efectiva_en TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baja_destino_aportes VARCHAR(20);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eliminada_en TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar VARCHAR(12);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_foto VARCHAR(500);
  `);
}

export async function ensureSessionsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);
}

export async function ensureRootSessionsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS root_sessions (
      id SERIAL PRIMARY KEY,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);
}

export async function ensureCampanasTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campanas (
      id SERIAL PRIMARY KEY,
      creator_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      creator_name VARCHAR(120) NOT NULL,
      supervisor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      name VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      tematica VARCHAR(120) NOT NULL,
      tag VARCHAR(120) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'borrador',
      data_types JSONB NOT NULL DEFAULT '[]'::jsonb,
      collection_mode VARCHAR(20) NOT NULL DEFAULT 'checklist',
      checklist_opciones JSONB NOT NULL DEFAULT '[]'::jsonb,
      checklist_secciones JSONB NOT NULL DEFAULT '[]'::jsonb,
      goal_contributions INTEGER NOT NULL DEFAULT 0,
      quota_per_user INTEGER NOT NULL DEFAULT 1,
      current_contributions INTEGER NOT NULL DEFAULT 0,
      approved_contributions INTEGER NOT NULL DEFAULT 0,
      pending_contributions INTEGER NOT NULL DEFAULT 0,
      rejected_contributions INTEGER NOT NULL DEFAULT 0,
      participants INTEGER NOT NULL DEFAULT 0,
      start_date DATE,
      start_time TIME,
      end_date DATE,
      end_time TIME,
      location_city VARCHAR(120),
      location_state VARCHAR(120),
      location_colonia VARCHAR(150),
      organizer VARCHAR(160),
      xp_per_contribution INTEGER NOT NULL DEFAULT 0,
      is_special BOOLEAN NOT NULL DEFAULT false,
      days_remaining INTEGER,
      has_reviewer_assigned BOOLEAN NOT NULL DEFAULT false,
      share_token VARCHAR(80),
      share_token_expires_at TIMESTAMPTZ,
      aportes JSONB NOT NULL DEFAULT '[]'::jsonb,
      downloads_count INTEGER NOT NULL DEFAULT 0,
      permite_anonimos BOOLEAN NOT NULL DEFAULT true,
      pausa_por VARCHAR(20),
      pausa_motivo TEXT,
      pausada_en TIMESTAMPTZ,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS creator_id INTEGER;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS creator_name VARCHAR(120);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS name VARCHAR(200);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS tematica VARCHAR(120);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS tag VARCHAR(120);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'borrador';
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS data_types JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS collection_mode VARCHAR(20) NOT NULL DEFAULT 'checklist';
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS checklist_opciones JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS checklist_secciones JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS goal_contributions INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS quota_per_user INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS current_contributions INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS approved_contributions INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS pending_contributions INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS rejected_contributions INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS participants INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS start_date DATE;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS start_time TIME;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS end_date DATE;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS end_time TIME;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS location_city VARCHAR(120);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS location_state VARCHAR(120);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS location_colonia VARCHAR(150);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS organizer VARCHAR(160);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS xp_per_contribution INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS is_special BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS days_remaining INTEGER;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS has_reviewer_assigned BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS share_token VARCHAR(80);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMPTZ;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS aportes JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS downloads_count INTEGER NOT NULL DEFAULT 0;
    -- El SuperUsuario no tiene fila en usuarios: cuando dictamina desde
    -- /supervisar, supervisor_id queda NULL y se marca aquí.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS supervisado_por_root BOOLEAN NOT NULL DEFAULT false;
    -- Campaña especial (2026-10-14, lib/campanas/especial.ts): periodo, multiplicador de XP
    -- (1 a 3) e insignia opcional. is_special dice si los tiene; al quitarlos vuelven a NULL.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS especial_inicio DATE;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS especial_fin DATE;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS especial_multiplicador SMALLINT;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS especial_insignia VARCHAR(40);
    -- Interruptor del creador: si es false, /c/[token] no acepta aportes sin cuenta.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS permite_anonimos BOOLEAN NOT NULL DEFAULT true;
    -- Quién la pausó y por qué (2026-10-15, lib/campanas/pausa.ts): 'creador' (sin motivo) o
    -- 'supervision' (supervisor o SuperUsuario, motivo obligatorio; solo la supervisión la reanuda).
    -- Se escriben al pasar a pausada; con otro estado no se leen.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS pausa_por VARCHAR(20);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS pausa_motivo TEXT;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS pausada_en TIMESTAMPTZ;
  `);
}

export async function ensureCampanaSupervisoresTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_supervisores (
      id SERIAL PRIMARY KEY,
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      supervisor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      accion VARCHAR(30) NOT NULL CHECK (accion IN ('aceptada', 'rechazada', 'reportada', 'reasignada')),
      motivo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Decisiones del SuperUsuario (sin fila en usuarios): supervisor_id NULL y
  // por_superusuario = true. El CHECK exige uno de los dos.
  await pool.query(`
    ALTER TABLE campana_supervisores ALTER COLUMN supervisor_id DROP NOT NULL;
    ALTER TABLE campana_supervisores ADD COLUMN IF NOT EXISTS por_superusuario BOOLEAN NOT NULL DEFAULT false;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campana_supervisores_autor_check') THEN
        ALTER TABLE campana_supervisores ADD CONSTRAINT campana_supervisores_autor_check
          CHECK (supervisor_id IS NOT NULL OR por_superusuario);
      END IF;
    END $$;
  `);
}

export async function ensureCampanaRevisoresTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_revisores (
      id SERIAL PRIMARY KEY,
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      estado VARCHAR(20) NOT NULL DEFAULT 'invitado' CHECK (estado IN ('invitado', 'aceptado', 'rechazado')),
      invitado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      aceptado_en TIMESTAMPTZ,
      UNIQUE (campana_id, usuario_id)
    );
  `);
}

export async function ensureCampanaBaneadosTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_baneados (
      id SERIAL PRIMARY KEY,
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      motivo TEXT NOT NULL,
      baneado_por INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (campana_id, usuario_id)
    );
  `);
}

export async function ensureNotificacionesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo VARCHAR(50) NOT NULL,
      titulo VARCHAR(180) NOT NULL,
      mensaje TEXT NOT NULL,
      campana_id INTEGER REFERENCES campanas(id) ON DELETE CASCADE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      leida_en TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    -- La campana y /notificaciones leen las de una persona, de la más nueva a la más vieja.
    CREATE INDEX IF NOT EXISTS notificaciones_usuario_idx ON notificaciones (usuario_id, created_at DESC);
  `);
}

/**
 * Suscripciones de notificaciones push (Web Push): una por navegador o teléfono en el que la
 * persona activó los avisos. endpoint es la URL del servicio de push (Google, Apple, Mozilla) y
 * p256dh/auth cifran el contenido. Se borran solas si el servicio responde que ya no existen.
 */
export async function ensurePushSuscripcionesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_suscripciones (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent VARCHAR(300),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ultimo_envio_en TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS push_suscripciones_usuario_idx ON push_suscripciones (usuario_id);
  `);
}

export async function ensureCampanasGuardadasTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campanas_guardadas (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (usuario_id, campana_id)
    );
  `);
}

/**
 * Inscripción a una campaña para aportar (2026-10-15, lib/campanas/inscripciones.ts): la persona acepta
 * una sola vez los acuerdos de confirmación y de uso del aporte (lib/aportes/consentimiento.ts), en vez
 * de aceptarlos en cada aporte. POST /api/aportes la exige. Se crea después de aportes: quien ya había
 * aportado aceptando los avisos queda inscrita con la hora de su primer consentimiento.
 */
export async function ensureCampanaInscripcionesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_inscripciones (
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      aceptada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (campana_id, usuario_id)
    );
    INSERT INTO campana_inscripciones (campana_id, usuario_id, aceptada_en)
    SELECT campaign_id, user_id, MIN(consentimiento_en)
      FROM aportes
     WHERE user_id IS NOT NULL AND consentimiento_en IS NOT NULL
     GROUP BY campaign_id, user_id
    ON CONFLICT DO NOTHING;
  `);
}

/**
 * Enlaces públicos de participación (/c/[token]). Cada regeneración inserta
 * una fila nueva y marca la anterior como revocada, sin borrarla: así se
 * conserva cuántas visitas y aportes entraron por cada token. Vigente =
 * revocado_en IS NULL y expira_en > NOW(). Reemplaza a las columnas viejas
 * campanas.share_token / share_token_expires_at, que ya no se escriben.
 */
export async function ensureCampanaEnlacesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_enlaces (
      id SERIAL PRIMARY KEY,
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      token VARCHAR(32) NOT NULL UNIQUE,
      creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expira_en TIMESTAMPTZ NOT NULL,
      revocado_en TIMESTAMPTZ,
      visitas INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS campana_enlaces_campana_idx ON campana_enlaces (campana_id, creado_en DESC);
  `);
}

export async function ensureAportesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aportes (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      participant_name VARCHAR(160) NOT NULL,
      participant_email VARCHAR(200),
      description TEXT NOT NULL,
      file_type VARCHAR(20) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_original_name VARCHAR(255),
      file_mime_type VARCHAR(100),
      file_size_bytes INTEGER,
      caracteristicas JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      rejection_reason TEXT,
      first_pass_by VARCHAR(160),
      first_pass_by_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      enlace_id INTEGER REFERENCES campana_enlaces(id) ON DELETE SET NULL,
      anonimo_id CHAR(64),
      inapropiado BOOLEAN NOT NULL DEFAULT false,
      inapropiado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      inapropiado_en TIMESTAMPTZ,
      archivo_borrado_en TIMESTAMPTZ,
      reporte_motivo TEXT,
      reporte_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      reporte_en TIMESTAMPTZ,
      consentimiento_en TIMESTAMPTZ,
      submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS caracteristicas JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS first_pass_by VARCHAR(160);
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS first_pass_by_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS enlace_id INTEGER REFERENCES campana_enlaces(id) ON DELETE SET NULL;
    -- Aporte sin cuenta (desde /c/[token]): sha256 del identificador de dispositivo
    -- (cookie anonimo_id). Sirve para la cuota por dispositivo; nunca se guarda el valor.
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS anonimo_id CHAR(64);
    CREATE INDEX IF NOT EXISTS aportes_anonimo_idx ON aportes (campaign_id, anonimo_id) WHERE anonimo_id IS NOT NULL;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
    -- Cuándo aceptó la persona los avisos de "Antes de enviar" (uso del aporte y contenido acorde,
    -- lib/aportes/consentimiento.ts). NULL en los aportes enviados antes del 2026-10-13.
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS consentimiento_en TIMESTAMPTZ;
    -- La IP de un aporte sin cuenta ya no se guarda de ninguna forma (2026-10-01): se quita
    -- la columna del HMAC que existió unas horas, con los hashes que alcanzó a guardar.
    DROP INDEX IF EXISTS aportes_ip_fecha_idx;
    ALTER TABLE aportes DROP COLUMN IF EXISTS ip_hmac;
    -- Espera entre aportes anónimos: último aporte del dispositivo, en cualquier campaña.
    CREATE INDEX IF NOT EXISTS aportes_anonimo_fecha_idx ON aportes (anonimo_id, submitted_at) WHERE anonimo_id IS NOT NULL;
    -- Marca "Contenido inapropiado" (creador o revisor) de un aporte anónimo. Solo
    -- estos cuentan para el bloqueo global del dispositivo (lib/aportes/sanciones-anonimas.ts).
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS inapropiado BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS inapropiado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS inapropiado_en TIMESTAMPTZ;
    -- El creador borró el archivo de MinIO (ilegal o dañino). La fila se conserva.
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS archivo_borrado_en TIMESTAMPTZ;
    -- "Reportar a supervisión" (2026-10-06 como "Reportar al creador"): el revisor reporta el aporte o a
    -- quien lo envió. Uno por aporte. Desde el 2026-10-15 también entra a reportes y no avisa al creador.
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS reporte_motivo TEXT;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS reporte_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS reporte_en TIMESTAMPTZ;
  `);
}

/**
 * Bloqueos de dispositivos anónimos (aportes sin cuenta). Dos alcances:
 *   - campana_id con valor: el creador bloqueó ese dispositivo en su campaña.
 *     No vence; se quita desde "Participantes baneados". Solo por dispositivo.
 *   - campana_id NULL: bloqueo global automático al juntar aportes inapropiados.
 *     Vence en `hasta`. Lo ve y lo quita quien modera, en /supervisar/sanciones o /supervision/sanciones.
 * anonimo_id es el hash de la cookie, nunca su valor. No se guarda la IP.
 */
export async function ensureDispositivosBloqueadosTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispositivos_bloqueados (
      id SERIAL PRIMARY KEY,
      anonimo_id CHAR(64) NOT NULL,
      campana_id INTEGER REFERENCES campanas(id) ON DELETE CASCADE,
      motivo TEXT NOT NULL,
      bloqueado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      aporte_id INTEGER REFERENCES aportes(id) ON DELETE SET NULL,
      hasta TIMESTAMPTZ,
      activo BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      restaurado_en TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS dispositivos_bloqueados_anonimo_idx ON dispositivos_bloqueados (anonimo_id) WHERE activo;
    -- Sin bloqueo por red desde el 2026-10-01: fuera el HMAC de la IP.
    DROP INDEX IF EXISTS dispositivos_bloqueados_ip_idx;
    ALTER TABLE dispositivos_bloqueados DROP COLUMN IF EXISTS ip_hmac;
  `);
}

export async function ensureSancionesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sanciones (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo VARCHAR(30) NOT NULL,
      detalle TEXT NOT NULL,
      dias INTEGER,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      aplicada_por VARCHAR(120) NOT NULL DEFAULT 'SuperUsuario',
      activa BOOLEAN NOT NULL DEFAULT true,
      restaurada_en TIMESTAMPTZ
    );
  `);
}

/**
 * Reportes (2026-10-12): de una campaña (contra quien la creó; cualquiera con sesión menos el creador)
 * o de un aporte (contra quien lo envió; lo reportan el creador o un revisor aceptado). `reportado_id`
 * es la cuenta reportada, copiada al reportar. Llegan a la bandeja del SuperUsuario (/reportes), que los
 * descarta o aplica un aviso (o banea); la sanción queda en `sanciones` y aquí en `sancion_id`.
 * Uno por persona y campaña, o por persona y aporte. Se crea después de `sanciones` y `aportes`.
 * Desde el 2026-10-16 también los deja la supervisión al rechazar una campaña con sanción
 * (`origen = 'rechazo'`, ya resueltos como `sancionado`; ver lib/supervision/decision.ts).
 */
export async function ensureReportesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reportes (
      id SERIAL PRIMARY KEY,
      -- campana | aporte
      tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('campana', 'aporte')),
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      -- SET NULL: si quien aportó borra el aporte, el reporte en su contra se conserva.
      aporte_id INTEGER REFERENCES aportes(id) ON DELETE SET NULL,
      reportado_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      reportado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      motivo VARCHAR(120),
      descripcion TEXT,
      -- pendiente | descartado | sancionado
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      nota_de_resolucion TEXT,
      sancion_id INTEGER REFERENCES sanciones(id) ON DELETE SET NULL,
      resuelto_en TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- Lo levantó el SuperUsuario (no tiene fila en usuarios: reportado_por queda NULL).
      por_superusuario BOOLEAN NOT NULL DEFAULT false,
      -- usuario: lo hizo alguien con "Reportar"; rechazo: lo dejó la supervisión al rechazar la campaña con sanción (2026-10-16).
      origen VARCHAR(20) NOT NULL DEFAULT 'usuario',
      CHECK (motivo IS NOT NULL OR descripcion IS NOT NULL),
      CHECK (tipo = 'aporte' OR aporte_id IS NULL)
    );
    ALTER TABLE reportes ADD COLUMN IF NOT EXISTS por_superusuario BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE reportes ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'usuario';
    CREATE UNIQUE INDEX IF NOT EXISTS reportes_campana_una_por_persona
      ON reportes (campana_id, reportado_por) WHERE tipo = 'campana';
    CREATE UNIQUE INDEX IF NOT EXISTS reportes_aporte_uno_por_persona
      ON reportes (aporte_id, reportado_por) WHERE tipo = 'aporte';
    CREATE INDEX IF NOT EXISTS reportes_estado_idx ON reportes (estado, created_at DESC);
  `);
}

/**
 * Lista negra de correos (2026-10-12): al cuarto aviso o con un baneo inmediato, el correo de la cuenta
 * entra aquí y ya no puede registrarse ni entrar con Google como cuenta nueva
 * (lib/usuarios/lista-negra.ts). Restaurar ese baneo lo saca. Correo en minúsculas.
 */
export async function ensureListaNegraTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lista_negra_correos (
      email VARCHAR(255) PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      sancion_id INTEGER REFERENCES sanciones(id) ON DELETE SET NULL,
      motivo TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Bitácora de acciones sensibles (roles, sanciones, dictámenes, baneos,
 * accesos raíz). Solo se inserta, nunca se edita. `actor_id` es NULL cuando
 * el actor es el SuperUsuario (no tiene fila en usuarios).
 */
export async function ensureAuditLogTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_tipo VARCHAR(20) NOT NULL CHECK (actor_tipo IN ('usuario', 'superusuario', 'anonimo')),
      actor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      accion VARCHAR(60) NOT NULL,
      objetivo_tipo VARCHAR(30),
      objetivo_id VARCHAR(40),
      detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_log_objetivo_idx ON audit_log (objetivo_tipo, objetivo_id);
    -- Una decisión de supervisor se revierte una sola vez (lib/usuarios/acciones-supervisor.ts):
    -- si dos SuperUsuarios la revierten a la vez, el segundo INSERT choca aquí.
    CREATE UNIQUE INDEX IF NOT EXISTS audit_log_reversion_unica ON audit_log ((detalle->>'accionId'))
      WHERE accion = 'supervision.revertir';
  `);
}

/**
 * Catálogo de temáticas (2026-10-07): intereses de los perfiles y temática de las campañas son
 * la misma lista. Empieza con las 23 de lib/intereses.ts (origen 'base') y crece con las palabras
 * clave que salen de lo que escriben los usuarios (origen 'usuario', lib/tematicas/catalogo.ts).
 * `clave` es el nombre sin acentos ni mayúsculas: evita "Ciclismo" y "ciclismo" duplicadas.
 * El SuperUsuario puede ocultar una (`oculta`): deja de ofrecerse, pero no se quita de los perfiles
 * ni de las campañas que ya la tienen.
 */
export async function ensureTematicasTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tematicas (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(60) NOT NULL,
      clave VARCHAR(60) NOT NULL UNIQUE,
      origen VARCHAR(10) NOT NULL DEFAULT 'usuario' CHECK (origen IN ('base', 'usuario')),
      creada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      oculta BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // Las 23 de siempre, en su orden (id). ON CONFLICT: repetirlo en cada arranque es inofensivo.
  await pool.query(
    `INSERT INTO tematicas (nombre, clave, origen)
     SELECT nombre, clave, 'base' FROM unnest($1::text[], $2::text[]) AS t(nombre, clave)
     ON CONFLICT (clave) DO NOTHING`,
    [TEMAS_DE_INTERES, TEMAS_DE_INTERES.map(claveDeTematica)],
  );
}

/**
 * Medallas de la gamificación (2026-10-13, diagrama del usuario; la lógica la hace quien lleva la
 * gamificación). `medallas` es el catálogo: nombre único, imagen en MinIO (file_*, como en aportes),
 * `criterio` con la regla para ganarla (su forma la define la gamificación) y `activa` para retirar
 * una sin borrarla. `medallas_usuario` dice quién ganó cuál y cuándo; una vez por persona.
 * Una medalla con ganadores no se puede borrar (FK sin cascada): se desactiva.
 */
export async function ensureMedallasTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS medallas (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(160) NOT NULL UNIQUE,
      descripcion TEXT NOT NULL,
      file_type VARCHAR(20) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_original_name VARCHAR(255),
      file_mime_type VARCHAR(100),
      file_size_bytes INTEGER,
      criterio JSONB NOT NULL,
      activa BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS medallas_usuario (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      medalla_id INTEGER NOT NULL REFERENCES medallas(id),
      fecha_obtencion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (usuario_id, medalla_id)
    );
    CREATE INDEX IF NOT EXISTS medallas_usuario_medalla_idx ON medallas_usuario (medalla_id);
  `);
}

/** Crea (si falta) todo el esquema. Lo llama instrumentation.ts al arrancar. */
export async function ensureCoreSchema(): Promise<void> {
  await ensureUsuariosTable();
  await ensureSessionsTable();
  await ensureRootSessionsTable();
  await ensureCampanasTable();
  await ensureCampanaSupervisoresTable();
  await ensureCampanaRevisoresTable();
  await ensureCampanaBaneadosTable();
  await ensureNotificacionesTable();
  await ensurePushSuscripcionesTable();
  await ensureCampanasGuardadasTable();
  await ensureCampanaEnlacesTable(); // antes de aportes: aportes.enlace_id la referencia
  await ensureAportesTable();
  await ensureCampanaInscripcionesTable(); // después de aportes: toma de ahí a quien ya había aceptado
  await ensureDispositivosBloqueadosTable(); // después de aportes: aporte_id la referencia
  await ensureSancionesTable();
  await ensureReportesTable(); // después de sanciones y aportes: los referencia
  await ensureListaNegraTable();
  await ensureAuditLogTable();
  await ensureTematicasTable(); // después de usuarios: creada_por la referencia
  await ensureMedallasTables(); // después de usuarios: medallas_usuario.usuario_id la referencia
}
