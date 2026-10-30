import { pool } from "@/lib/db";
import { RENOMBRES_DE_TEMATICAS_BASE, TEMAS_DE_INTERES } from "@/lib/intereses";
import { ESPECIALIDADES, claveDeCatalogo, validarEspecialidad, validarOrganizacion } from "@/lib/perfil-opciones";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { ETIQUETAS_BASE } from "@/lib/etiquetas/base";
import { ensureAvisosDeCambios } from "@/lib/en-vivo-postgres";

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
      -- Organización a la que pertenece (2026-10-26, opcional; catálogo en lib/usuarios/organizaciones.ts).
      organizacion VARCHAR(160),
      intereses JSONB NOT NULL DEFAULT '[]'::jsonb,
      -- Lo que la persona escribió sobre sus gustos; de ahí salen sus intereses (lib/tematicas/analizar.ts).
      intereses_texto VARCHAR(500),
      -- Los roles están en usuario_roles desde el 2026-10-30 (ensureUsuarioRolesTable).
      xp_total INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      streak_days INTEGER NOT NULL DEFAULT 0,
      bienvenida_vista BOOLEAN NOT NULL DEFAULT false,
      email_verificado BOOLEAN NOT NULL DEFAULT false,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      google_id VARCHAR(255) UNIQUE,
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
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS organizacion VARCHAR(160);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intereses JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intereses_texto VARCHAR(500);
    -- Solo las cuentas nuevas muestran la bienvenida en /inicio la primera vez.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bienvenida_vista BOOLEAN;
    UPDATE usuarios SET bienvenida_vista = true WHERE bienvenida_vista IS NULL;
    ALTER TABLE usuarios ALTER COLUMN bienvenida_vista SET DEFAULT false;
    ALTER TABLE usuarios ALTER COLUMN bienvenida_vista SET NOT NULL;
    -- Las Preferencias de /cuenta y el último envío de los avisos periódicos están en
    -- usuario_preferencias desde el 2026-10-30 (ensureUsuarioPreferenciasTable).
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
    ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baja_solicitada_en TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baja_efectiva_en TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baja_destino_aportes VARCHAR(20);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eliminada_en TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar VARCHAR(12);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_foto VARCHAR(500);
  `);
}

/**
 * Preferencias de /cuenta (2026-10-30, tercera tanda de la rama cambios-bd; lib/usuarios/preferencias-opciones.ts):
 * una fila por usuario, que crea un trigger al insertar en usuarios. "Campañas nuevas" (2026-10-14),
 * "Aportes", "Recordatorios" (apagado por defecto) y "Newsletter", más el interruptor general
 * "Notificaciones" (2026-10-19: apagado, notificar() solo deja pasar NOTIFICACIONES_ESENCIALES).
 * ultimo_recordatorio y ultimo_resumen son el estado de lib/notificaciones/periodicas.ts (último envío).
 * Antes eran columnas de usuarios: la primera vez se copian y se borran.
 */
export async function ensureUsuarioPreferenciasTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuario_preferencias (
      usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      avisos_campanas_nuevas BOOLEAN NOT NULL DEFAULT true,
      avisos_aportes BOOLEAN NOT NULL DEFAULT true,
      recordatorio_semanal BOOLEAN NOT NULL DEFAULT false,
      resumen_mensual BOOLEAN NOT NULL DEFAULT true,
      notificaciones_activas BOOLEAN NOT NULL DEFAULT true,
      ultimo_recordatorio DATE,
      ultimo_resumen DATE
    );
    CREATE OR REPLACE FUNCTION dfg_crear_preferencias() RETURNS trigger AS $$
    BEGIN
      INSERT INTO usuario_preferencias (usuario_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    CREATE OR REPLACE TRIGGER dfg_crear_preferencias AFTER INSERT ON usuarios
      FOR EACH ROW EXECUTE FUNCTION dfg_crear_preferencias();
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'usuarios' AND column_name = 'avisos_campanas_nuevas') THEN
        INSERT INTO usuario_preferencias (usuario_id, avisos_campanas_nuevas, avisos_aportes, recordatorio_semanal,
                                          resumen_mensual, notificaciones_activas, ultimo_recordatorio, ultimo_resumen)
        SELECT id, avisos_campanas_nuevas, avisos_aportes, recordatorio_semanal,
               resumen_mensual, notificaciones_activas, ultimo_recordatorio, ultimo_resumen
          FROM usuarios
        ON CONFLICT (usuario_id) DO NOTHING;
        ALTER TABLE usuarios DROP COLUMN avisos_campanas_nuevas;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS avisos_aportes;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS recordatorio_semanal;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS resumen_mensual;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS notificaciones_activas;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS ultimo_recordatorio;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS ultimo_resumen;
      END IF;
    END $$;
    -- Por si una cuenta se creó sin el trigger.
    INSERT INTO usuario_preferencias (usuario_id) SELECT id FROM usuarios ON CONFLICT DO NOTHING;
  `);
}

/**
 * Códigos de 6 dígitos que se mandan por correo (2026-10-30), guardados como hash: uno vigente
 * por persona y propósito. 'verificacion' confirma el correo (lib/verification.ts) y 'contrasena'
 * pone o recupera la contraseña (lib/usuarios/recuperacion.ts). La fila se borra al usarse.
 * enviado_en marca la espera entre correos. Antes eran 7 columnas de usuarios
 * (verification_* y recuperacion_*): los códigos vigentes se copian aquí y las columnas se borran.
 */
export async function ensureCodigosUsuarioTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS codigos_usuario (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      proposito VARCHAR(20) NOT NULL CHECK (proposito IN ('verificacion', 'contrasena')),
      codigo_hash VARCHAR(64) NOT NULL,
      vence_en TIMESTAMPTZ NOT NULL,
      intentos INTEGER NOT NULL DEFAULT 0,
      enviado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (usuario_id, proposito)
    );
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'usuarios' AND column_name = 'verification_code_hash') THEN
        INSERT INTO codigos_usuario (usuario_id, proposito, codigo_hash, vence_en, intentos, enviado_en)
        SELECT id, 'verificacion', verification_code_hash, verification_code_expires_at, verification_attempts,
               verification_code_expires_at - INTERVAL '15 minutes'
          FROM usuarios
         WHERE verification_code_hash IS NOT NULL AND verification_code_expires_at IS NOT NULL
        ON CONFLICT DO NOTHING;
        ALTER TABLE usuarios DROP COLUMN verification_code_hash;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS verification_code_expires_at;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS verification_attempts;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'usuarios' AND column_name = 'recuperacion_codigo_hash') THEN
        INSERT INTO codigos_usuario (usuario_id, proposito, codigo_hash, vence_en, intentos, enviado_en)
        SELECT id, 'contrasena', recuperacion_codigo_hash, recuperacion_vence_en, recuperacion_intentos,
               COALESCE(recuperacion_enviada_en, NOW())
          FROM usuarios
         WHERE recuperacion_codigo_hash IS NOT NULL AND recuperacion_vence_en IS NOT NULL
        ON CONFLICT DO NOTHING;
        ALTER TABLE usuarios DROP COLUMN recuperacion_codigo_hash;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS recuperacion_vence_en;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS recuperacion_intentos;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS recuperacion_enviada_en;
      END IF;
    END $$;
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
      collection_mode VARCHAR(20) NOT NULL DEFAULT 'checklist',
      -- Los checklists están en campana_checklists desde el 2026-10-30 (ensureChecklistsTables).
      goal_contributions INTEGER NOT NULL DEFAULT 0,
      quota_per_user INTEGER NOT NULL DEFAULT 1,
      start_date DATE,
      start_time TIME,
      end_date DATE,
      end_time TIME,
      location_city VARCHAR(120),
      location_state VARCHAR(120),
      location_colonia VARCHAR(150),
      -- Para todo el país (lib/campanas/ubicacion.ts): estado, municipio y colonia vacíos.
      todo_el_pais BOOLEAN NOT NULL DEFAULT false,
      -- Propósito: ¿para qué se usarán los datos? (2026-10-27, lib/campanas/proposito.ts).
      proposito VARCHAR(40),
      proposito_otro VARCHAR(80),
      organizer VARCHAR(160),
      xp_per_contribution INTEGER NOT NULL DEFAULT 0,
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
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS collection_mode VARCHAR(20) NOT NULL DEFAULT 'checklist';
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS goal_contributions INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS quota_per_user INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS start_date DATE;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS start_time TIME;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS end_date DATE;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS end_time TIME;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS location_city VARCHAR(120);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS location_state VARCHAR(120);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS location_colonia VARCHAR(150);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS todo_el_pais BOOLEAN NOT NULL DEFAULT false;
    -- Propósito (2026-10-27): uno de PROPOSITOS (lib/campanas/proposito.ts) y la frase de "Otro".
    -- NULL en las campañas de antes; obligatorio al enviar a revisión desde ese día.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS proposito VARCHAR(40);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS proposito_otro VARCHAR(80);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS organizer VARCHAR(160);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS xp_per_contribution INTEGER NOT NULL DEFAULT 0;
    -- El SuperUsuario no tiene fila en usuarios: cuando dictamina desde
    -- /supervisar, supervisor_id queda NULL y se marca aquí.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS supervisado_por_root BOOLEAN NOT NULL DEFAULT false;
    -- Interruptor del creador: si es false, /c/[token] no acepta aportes sin cuenta.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS permite_anonimos BOOLEAN NOT NULL DEFAULT true;
    -- Quién la pausó y por qué (2026-10-15, lib/campanas/pausa.ts): 'creador' (sin motivo) o
    -- 'supervision' (supervisor o SuperUsuario, motivo obligatorio; solo la supervisión la reanuda).
    -- Se escriben al pasar a pausada; con otro estado no se leen.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS pausa_por VARCHAR(20);
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS pausa_motivo TEXT;
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS pausada_en TIMESTAMPTZ;
    -- Columnas sin uso, borradas el 2026-10-30: cuota_por_tipo (reparto por tipo, quitado el
    -- 2026-10-27), days_remaining (se calcula de end_date), share_token y share_token_expires_at
    -- (campana_enlaces) y aportes (la tabla aportes).
    ALTER TABLE campanas DROP COLUMN IF EXISTS cuota_por_tipo;
    ALTER TABLE campanas DROP COLUMN IF EXISTS days_remaining;
    ALTER TABLE campanas DROP COLUMN IF EXISTS share_token;
    ALTER TABLE campanas DROP COLUMN IF EXISTS share_token_expires_at;
    ALTER TABLE campanas DROP COLUMN IF EXISTS aportes;
    -- has_reviewer_assigned (borrada el 2026-10-30, segunda tanda): se calcula de campana_revisores
    -- (columnasCalculadas de lib/campanas/tipos-de-campana.ts). data_types, limite_por_tipo,
    -- enviados_por_tipo y formatos_de_documento pasan a campana_tipos (ensureCampanaTiposTable).
    ALTER TABLE campanas DROP COLUMN IF EXISTS has_reviewer_assigned;
    -- Contadores, descargas y último hito avisado pasan a campana_estadisticas, y los incentivos de
    -- campaña especial a campana_especial (2026-10-30, tercera tanda): ver esas dos funciones.
  `);
}

/**
 * Contadores de cada campaña (2026-10-30, tercera tanda de la rama cambios-bd): una fila por campaña,
 * que crea un trigger al insertar en campanas. Cambian con cada aporte (los recalcula
 * recalcularContadores, lib/aportes/comun.ts) y con cada descarga, mientras que la campaña casi no
 * cambia: así cada aporte ya no reescribe la fila de campanas. Mismos nombres que tenían en campanas;
 * al leer una campaña llegan con columnasCalculadas() de lib/campanas/tipos-de-campana.ts.
 * ultimo_hito_avisado: último 25/50/75/100 % avisado a quienes participan (lib/notificaciones/socializacion.ts).
 * La primera vez copia los valores de campanas y borra esas columnas.
 */
export async function ensureCampanaEstadisticasTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_estadisticas (
      campana_id INTEGER PRIMARY KEY REFERENCES campanas(id) ON DELETE CASCADE,
      current_contributions INTEGER NOT NULL DEFAULT 0,
      approved_contributions INTEGER NOT NULL DEFAULT 0,
      pending_contributions INTEGER NOT NULL DEFAULT 0,
      rejected_contributions INTEGER NOT NULL DEFAULT 0,
      participants INTEGER NOT NULL DEFAULT 0,
      downloads_count INTEGER NOT NULL DEFAULT 0,
      ultimo_hito_avisado SMALLINT NOT NULL DEFAULT 0
    );
    CREATE OR REPLACE FUNCTION dfg_crear_estadisticas() RETURNS trigger AS $$
    BEGIN
      INSERT INTO campana_estadisticas (campana_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    CREATE OR REPLACE TRIGGER dfg_crear_estadisticas AFTER INSERT ON campanas
      FOR EACH ROW EXECUTE FUNCTION dfg_crear_estadisticas();
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'campanas' AND column_name = 'current_contributions') THEN
        INSERT INTO campana_estadisticas (campana_id, current_contributions, approved_contributions, pending_contributions,
                                          rejected_contributions, participants, downloads_count, ultimo_hito_avisado)
        SELECT id, current_contributions, approved_contributions, pending_contributions,
               rejected_contributions, participants, downloads_count, COALESCE(ultimo_hito_avisado, 0)
          FROM campanas
        ON CONFLICT (campana_id) DO NOTHING;
        ALTER TABLE campanas DROP COLUMN current_contributions;
        ALTER TABLE campanas DROP COLUMN IF EXISTS approved_contributions;
        ALTER TABLE campanas DROP COLUMN IF EXISTS pending_contributions;
        ALTER TABLE campanas DROP COLUMN IF EXISTS rejected_contributions;
        ALTER TABLE campanas DROP COLUMN IF EXISTS participants;
        ALTER TABLE campanas DROP COLUMN IF EXISTS downloads_count;
        ALTER TABLE campanas DROP COLUMN IF EXISTS ultimo_hito_avisado;
      END IF;
    END $$;
    -- Por si una campaña se creó sin el trigger.
    INSERT INTO campana_estadisticas (campana_id) SELECT id FROM campanas ON CONFLICT DO NOTHING;
  `);
}

/**
 * Campaña especial (2026-10-14, SCR-WEB-13; tabla propia desde el 2026-10-30, lib/campanas/especial.ts):
 * 0 o 1 fila por campaña con el periodo, el multiplicador de XP (1 a 3) y la insignia opcional.
 * Si la fila existe, la campaña es especial (antes campanas.is_special); quitar los incentivos la borra.
 * La primera vez copia las especiales de campanas y borra is_special y especial_*.
 */
export async function ensureCampanaEspecialTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_especial (
      campana_id INTEGER PRIMARY KEY REFERENCES campanas(id) ON DELETE CASCADE,
      inicio DATE NOT NULL,
      fin DATE NOT NULL CHECK (fin >= inicio),
      multiplicador SMALLINT NOT NULL CHECK (multiplicador BETWEEN 1 AND 3),
      insignia VARCHAR(40)
    );
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'campanas' AND column_name = 'is_special') THEN
        INSERT INTO campana_especial (campana_id, inicio, fin, multiplicador, insignia)
        SELECT id, especial_inicio, especial_fin, COALESCE(especial_multiplicador, 1), especial_insignia
          FROM campanas
         WHERE is_special AND especial_inicio IS NOT NULL AND especial_fin IS NOT NULL
        ON CONFLICT (campana_id) DO NOTHING;
        ALTER TABLE campanas DROP COLUMN is_special;
        ALTER TABLE campanas DROP COLUMN IF EXISTS especial_inicio;
        ALTER TABLE campanas DROP COLUMN IF EXISTS especial_fin;
        ALTER TABLE campanas DROP COLUMN IF EXISTS especial_multiplicador;
        ALTER TABLE campanas DROP COLUMN IF EXISTS especial_insignia;
      END IF;
    END $$;
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
 * campanas.share_token / share_token_expires_at (borradas el 2026-10-30).
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
      -- Lo que marcó en los checklists está en aporte_respuestas desde el 2026-10-30.
      calificacion VARCHAR(20),
      status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      rejection_reason TEXT,
      first_pass_by VARCHAR(160),
      first_pass_by_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      enlace_id INTEGER REFERENCES campana_enlaces(id) ON DELETE SET NULL,
      anonimo_id CHAR(64),
      inapropiado BOOLEAN NOT NULL DEFAULT false,
      inapropiado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      inapropiado_en TIMESTAMPTZ,
      consentimiento_en TIMESTAMPTZ,
      submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS calificacion VARCHAR(20);
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
    -- El archivo (ruta en MinIO, MIME, tamaño y si se borró) está en la tabla archivos desde el
    -- 2026-10-30 (ensureArchivosTable): archivo_id NULL = aporte de solo texto.
  `);
}

/**
 * Archivos subidos a MinIO (2026-10-30, tercera tanda de la rama cambios-bd; lib/aportes/tabla-archivos.ts):
 * ruta (clave en MinIO), nombre original (los aportes no lo guardan: puede traer datos personales), MIME,
 * tamaño y borrado_en (el creador o la moderación lo borró de MinIO; la fila se conserva). Hoy solo los
 * aportes apuntan aquí (aportes.archivo_id); las medallas siguen con sus columnas file_* (gamificación).
 * Un trigger borra la fila al borrarse el aporte. La primera vez copia los file_* de aportes y los borra.
 */
export async function ensureArchivosTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS archivos (
      id SERIAL PRIMARY KEY,
      ruta VARCHAR(500) NOT NULL,
      nombre_original VARCHAR(255),
      mime VARCHAR(100),
      tamano_bytes INTEGER,
      borrado_en TIMESTAMPTZ,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS archivo_id INTEGER REFERENCES archivos(id) ON DELETE SET NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS aportes_archivo_idx ON aportes (archivo_id) WHERE archivo_id IS NOT NULL;
    CREATE OR REPLACE FUNCTION dfg_borrar_archivo_del_aporte() RETURNS trigger AS $$
    BEGIN
      IF OLD.archivo_id IS NOT NULL THEN
        DELETE FROM archivos WHERE id = OLD.archivo_id;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    CREATE OR REPLACE TRIGGER dfg_borrar_archivo_del_aporte AFTER DELETE ON aportes
      FOR EACH ROW EXECUTE FUNCTION dfg_borrar_archivo_del_aporte();
    DO $$
    DECLARE
      fila RECORD;
      nuevo INTEGER;
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'aportes' AND column_name = 'file_path') THEN
        FOR fila IN SELECT id, file_path, file_original_name, file_mime_type, file_size_bytes, archivo_borrado_en
                      FROM aportes WHERE COALESCE(file_path, '') <> '' AND archivo_id IS NULL LOOP
          INSERT INTO archivos (ruta, nombre_original, mime, tamano_bytes, borrado_en)
          VALUES (fila.file_path, fila.file_original_name, fila.file_mime_type, fila.file_size_bytes, fila.archivo_borrado_en)
          RETURNING id INTO nuevo;
          UPDATE aportes SET archivo_id = nuevo WHERE id = fila.id;
        END LOOP;
        ALTER TABLE aportes DROP COLUMN file_path;
        ALTER TABLE aportes DROP COLUMN IF EXISTS file_original_name;
        ALTER TABLE aportes DROP COLUMN IF EXISTS file_mime_type;
        ALTER TABLE aportes DROP COLUMN IF EXISTS file_size_bytes;
        ALTER TABLE aportes DROP COLUMN IF EXISTS archivo_borrado_en;
      END IF;
    END $$;
  `);
}

/**
 * Tipos de dato de cada campaña (2026-10-30, segunda tanda de la rama cambios-bd; lib/campanas/tipos-de-campana.ts):
 * una fila por tipo que pide, con su orden en el formulario, el límite TOTAL de aportes de ese tipo
 * (NULL = sin límite; lib/campanas/limite-por-tipo.ts), los no rechazados que lleva (los recalcula
 * recalcularContadores) y, solo en "documento", los formatos de "Archivo" que acepta ([] = todos).
 * Reemplaza a campanas.data_types, limite_por_tipo, enviados_por_tipo y formatos_de_documento: la
 * primera vez copia lo que tenían (los enviados, contados desde aportes) y borra esas columnas.
 */
export async function ensureCampanaTiposTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_tipos (
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('texto', 'foto', 'video', 'audio', 'documento')),
      orden SMALLINT NOT NULL DEFAULT 1,
      limite INTEGER CHECK (limite > 0),
      enviados INTEGER NOT NULL DEFAULT 0,
      formatos JSONB CHECK (tipo = 'documento' OR formatos IS NULL),
      PRIMARY KEY (campana_id, tipo)
    );
    CREATE INDEX IF NOT EXISTS campana_tipos_tipo_idx ON campana_tipos (tipo);
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'campanas' AND column_name = 'data_types') THEN
        INSERT INTO campana_tipos (campana_id, tipo, orden, limite, formatos)
        SELECT c.id, t.tipo, t.orden,
               NULLIF((c.limite_por_tipo ->> t.tipo)::int, 0),
               CASE WHEN t.tipo = 'documento' THEN COALESCE(c.formatos_de_documento, '[]'::jsonb) END
        FROM campanas c, jsonb_array_elements_text(c.data_types) WITH ORDINALITY AS t(tipo, orden)
        WHERE t.tipo IN ('texto', 'foto', 'video', 'audio', 'documento')
        ON CONFLICT (campana_id, tipo) DO NOTHING;
        UPDATE campana_tipos ct
           SET enviados = (SELECT COUNT(*)::int FROM aportes a
                            WHERE a.campaign_id = ct.campana_id AND a.file_type = ct.tipo AND a.status <> 'rechazado');
        ALTER TABLE campanas DROP COLUMN data_types;
        ALTER TABLE campanas DROP COLUMN IF EXISTS limite_por_tipo;
        ALTER TABLE campanas DROP COLUMN IF EXISTS enviados_por_tipo;
        ALTER TABLE campanas DROP COLUMN IF EXISTS formatos_de_documento;
      END IF;
    END $$;
  `);
}

/**
 * Roles de cada persona (2026-10-30, cuarta tanda de la rama cambios-bd; lib/usuarios/tabla-roles.ts):
 * una fila por rol, con la fecha en que se dio. "usuario" lo pone un trigger al crear la cuenta.
 * Revisor se da al aceptar una invitación y se quita con la última campaña (lib/campanas/revisores.ts);
 * supervisor lo da y lo quita el SuperUsuario. Antes era la columna JSONB usuarios.role: la primera
 * vez se copia y se borra.
 */
export async function ensureUsuarioRolesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuario_roles (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      rol VARCHAR(20) NOT NULL CHECK (rol IN ('usuario', 'supervisor', 'revisor', 'admin')),
      asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (usuario_id, rol)
    );
    CREATE INDEX IF NOT EXISTS usuario_roles_rol_idx ON usuario_roles (rol);
    CREATE OR REPLACE FUNCTION dfg_crear_rol_usuario() RETURNS trigger AS $$
    BEGIN
      INSERT INTO usuario_roles (usuario_id, rol) VALUES (NEW.id, 'usuario') ON CONFLICT DO NOTHING;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    CREATE OR REPLACE TRIGGER dfg_crear_rol_usuario AFTER INSERT ON usuarios
      FOR EACH ROW EXECUTE FUNCTION dfg_crear_rol_usuario();
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'usuarios' AND column_name = 'role') THEN
        INSERT INTO usuario_roles (usuario_id, rol)
        SELECT u.id, r.rol
          FROM usuarios u
         CROSS JOIN LATERAL jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(u.role) = 'array' THEN u.role ELSE '[]'::jsonb END) AS r(rol)
         WHERE r.rol IN ('usuario', 'supervisor', 'revisor', 'admin')
        ON CONFLICT DO NOTHING;
        -- El trigger de avisos en vivo mira OLD.role: se quita y ensureAvisosDeCambios lo vuelve a poner sin ella.
        DROP TRIGGER IF EXISTS dfg_avisar_cambio_visible ON usuarios;
        ALTER TABLE usuarios DROP COLUMN role;
      END IF;
    END $$;
    -- Toda cuenta es "usuario", aunque su arreglo viejo no lo dijera.
    INSERT INTO usuario_roles (usuario_id, rol) SELECT id, 'usuario' FROM usuarios ON CONFLICT DO NOTHING;
  `);
}

/**
 * Checklists de campaña y lo que marca cada aporte (2026-10-30, cuarta tanda de la rama cambios-bd;
 * lib/campanas/tabla-checklists.ts y lib/campanas/checklist.ts):
 *   - campana_checklists: título, tipo de dato (NULL = vale para todos, campañas anteriores al 2026-10-28)
 *     y orden. Se reconoce por campaña, tipo y título sin mayúsculas. retirado_en: el creador lo quitó
 *     pero hay aportes que lo marcaron.
 *   - checklist_opciones: texto y orden de cada opción; retirada_en igual que arriba.
 *   - aporte_respuestas: una fila por opción marcada.
 * Antes eran campanas.checklist_secciones (JSONB), campanas.checklist_opciones (la lista plana de antes de
 * los títulos) y aportes.caracteristicas (las respuestas como texto "Título: opción"). La primera vez se
 * copian y se borran; una respuesta que ya no coincide con ninguna opción queda en una opción retirada
 * con ese texto, para no perderla.
 */
export async function ensureChecklistsTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_checklists (
      id SERIAL PRIMARY KEY,
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      titulo VARCHAR(120) NOT NULL DEFAULT '',
      tipo VARCHAR(20) CHECK (tipo IN ('texto', 'foto', 'video', 'audio', 'documento')),
      orden SMALLINT NOT NULL DEFAULT 1,
      retirado_en TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS campana_checklists_clave_idx
      ON campana_checklists (campana_id, (COALESCE(tipo, '')), (lower(titulo)));
    CREATE TABLE IF NOT EXISTS checklist_opciones (
      id SERIAL PRIMARY KEY,
      checklist_id INTEGER NOT NULL REFERENCES campana_checklists(id) ON DELETE CASCADE,
      -- 255 y no 120: una respuesta vieja sin opción se guarda entera ("Título: opción").
      texto VARCHAR(255) NOT NULL,
      orden SMALLINT NOT NULL DEFAULT 1,
      retirada_en TIMESTAMPTZ,
      UNIQUE (checklist_id, texto)
    );
    CREATE TABLE IF NOT EXISTS aporte_respuestas (
      aporte_id INTEGER NOT NULL REFERENCES aportes(id) ON DELETE CASCADE,
      opcion_id INTEGER NOT NULL REFERENCES checklist_opciones(id) ON DELETE CASCADE,
      PRIMARY KEY (aporte_id, opcion_id)
    );
    CREATE INDEX IF NOT EXISTS aporte_respuestas_opcion_idx ON aporte_respuestas (opcion_id);
    DO $$
    DECLARE
      fila RECORD;
      lista INTEGER;
      opcion INTEGER;
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'campanas' AND column_name = 'checklist_secciones') THEN
        -- Checklists con título (y tipo desde el 2026-10-28).
        INSERT INTO campana_checklists (campana_id, titulo, tipo, orden)
        SELECT c.id, LEFT(TRIM(COALESCE(s.valor ->> 'titulo', '')), 120),
               CASE WHEN s.valor ->> 'tipo' IN ('texto', 'foto', 'video', 'audio', 'documento') THEN s.valor ->> 'tipo' END,
               s.n
          FROM campanas c
         CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(c.checklist_secciones) = 'array' THEN c.checklist_secciones ELSE '[]'::jsonb END)
                WITH ORDINALITY AS s(valor, n)
         WHERE jsonb_typeof(s.valor) = 'object'
        ON CONFLICT DO NOTHING;
        INSERT INTO checklist_opciones (checklist_id, texto, orden)
        SELECT cc.id, LEFT(TRIM(o.texto), 255), o.n
          FROM campanas c
         CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(c.checklist_secciones) = 'array' THEN c.checklist_secciones ELSE '[]'::jsonb END)
                AS s(valor)
         CROSS JOIN LATERAL jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(s.valor -> 'opciones') = 'array' THEN s.valor -> 'opciones' ELSE '[]'::jsonb END)
                WITH ORDINALITY AS o(texto, n)
          JOIN campana_checklists cc
            ON cc.campana_id = c.id
           AND COALESCE(cc.tipo, '') = CASE WHEN s.valor ->> 'tipo' IN ('texto', 'foto', 'video', 'audio', 'documento')
                                            THEN s.valor ->> 'tipo' ELSE '' END
           AND lower(cc.titulo) = lower(LEFT(TRIM(COALESCE(s.valor ->> 'titulo', '')), 120))
         WHERE jsonb_typeof(s.valor) = 'object' AND TRIM(o.texto) <> ''
        ON CONFLICT DO NOTHING;
        -- Lista plana de antes de los títulos: un checklist sin título (como lo leía seccionesDesdeFila).
        INSERT INTO campana_checklists (campana_id, titulo, orden)
        SELECT c.id, '', 1 FROM campanas c
         WHERE NOT EXISTS (SELECT 1 FROM campana_checklists cc WHERE cc.campana_id = c.id)
           AND c.collection_mode <> 'texto_libre'
           AND jsonb_typeof(c.checklist_opciones) = 'array' AND jsonb_array_length(c.checklist_opciones) > 0
        ON CONFLICT DO NOTHING;
        INSERT INTO checklist_opciones (checklist_id, texto, orden)
        SELECT cc.id, LEFT(TRIM(o.texto), 255), o.n
          FROM campanas c
          JOIN campana_checklists cc ON cc.campana_id = c.id AND cc.titulo = '' AND cc.tipo IS NULL
         CROSS JOIN LATERAL jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(c.checklist_opciones) = 'array' THEN c.checklist_opciones ELSE '[]'::jsonb END)
                WITH ORDINALITY AS o(texto, n)
         WHERE TRIM(o.texto) <> ''
        ON CONFLICT DO NOTHING;
        -- Los checklists vacíos no se veían (seccionesDesdeFila los quitaba).
        DELETE FROM campana_checklists cc WHERE NOT EXISTS (SELECT 1 FROM checklist_opciones o WHERE o.checklist_id = cc.id);
        ALTER TABLE campanas DROP COLUMN checklist_secciones;
        ALTER TABLE campanas DROP COLUMN IF EXISTS checklist_opciones;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'aportes' AND column_name = 'caracteristicas') THEN
        -- Cada respuesta va a la opción con la misma etiqueta: primero la del tipo del aporte, luego la general.
        FOR fila IN
          SELECT a.id AS aporte_id, a.campaign_id, a.file_type, r.etiqueta
            FROM aportes a
           CROSS JOIN LATERAL (SELECT DISTINCT x.e AS etiqueta FROM jsonb_array_elements_text(
                  CASE WHEN jsonb_typeof(a.caracteristicas) = 'array' THEN a.caracteristicas ELSE '[]'::jsonb END) AS x(e)) r
           WHERE TRIM(r.etiqueta) <> ''
        LOOP
          opcion := NULL;
          SELECT o.id INTO opcion
            FROM checklist_opciones o
            JOIN campana_checklists cc ON cc.id = o.checklist_id
           WHERE cc.campana_id = fila.campaign_id
             AND (CASE WHEN cc.titulo = '' THEN o.texto ELSE cc.titulo || ': ' || o.texto END) = fila.etiqueta
           ORDER BY (cc.tipo = fila.file_type) IS NOT TRUE, cc.tipo IS NOT NULL, cc.orden, o.orden
           LIMIT 1;
          IF opcion IS NULL THEN
            -- Ya no existe esa opción: se guarda retirada, con la etiqueta entera, en un checklist sin título.
            INSERT INTO campana_checklists (campana_id, titulo, orden, retirado_en)
            VALUES (fila.campaign_id, '', 0, NOW())
            ON CONFLICT (campana_id, (COALESCE(tipo, '')), (lower(titulo))) DO UPDATE SET titulo = EXCLUDED.titulo
            RETURNING id INTO lista;
            INSERT INTO checklist_opciones (checklist_id, texto, orden, retirada_en)
            VALUES (lista, LEFT(fila.etiqueta, 255), 0, NOW())
            ON CONFLICT (checklist_id, texto) DO UPDATE SET texto = EXCLUDED.texto
            RETURNING id INTO opcion;
          END IF;
          INSERT INTO aporte_respuestas (aporte_id, opcion_id) VALUES (fila.aporte_id, opcion) ON CONFLICT DO NOTHING;
        END LOOP;
        ALTER TABLE aportes DROP COLUMN caracteristicas;
      END IF;
    END $$;
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
      -- usuario: lo hizo alguien con "Reportar"; rechazo: lo dejó la supervisión al rechazar la campaña con sanción (2026-10-16);
      -- supervision: "Reportar a supervisión" de un aporte (2026-10-30; antes en aportes.reporte_*).
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
    -- "Reportar a supervisión" (lib/aportes/reporte.ts): origen = 'supervision', uno por aporte aunque lo
    -- intenten dos personas a la vez. Hasta el 2026-10-30 ese candado eran aportes.reporte_motivo,
    -- reporte_por y reporte_en: la primera vez se marcan sus reportes (o se crean) y se borran las columnas.
    CREATE UNIQUE INDEX IF NOT EXISTS reportes_aporte_uno_a_supervision
      ON reportes (aporte_id) WHERE tipo = 'aporte' AND origen = 'supervision';
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'aportes' AND column_name = 'reporte_en') THEN
        UPDATE reportes r SET origen = 'supervision'
          FROM aportes a
         WHERE a.reporte_en IS NOT NULL AND r.tipo = 'aporte' AND r.aporte_id = a.id
           AND r.reportado_por IS NOT DISTINCT FROM a.reporte_por;
        INSERT INTO reportes (tipo, campana_id, aporte_id, reportado_id, reportado_por, descripcion, created_at, origen)
        SELECT 'aporte', a.campaign_id, a.id, a.user_id, a.reporte_por, COALESCE(a.reporte_motivo, 'Sin motivo'), a.reporte_en, 'supervision'
          FROM aportes a
         WHERE a.reporte_en IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM reportes r WHERE r.tipo = 'aporte' AND r.aporte_id = a.id AND r.origen = 'supervision');
        ALTER TABLE aportes DROP COLUMN reporte_en;
        ALTER TABLE aportes DROP COLUMN IF EXISTS reporte_motivo;
        ALTER TABLE aportes DROP COLUMN IF EXISTS reporte_por;
      END IF;
    END $$;
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
 * Renombra una temática base (2026-10-27, RENOMBRES_DE_TEMATICAS_BASE de lib/intereses.ts) en el
 * catálogo, en los intereses de los perfiles (sin repetir, en el mismo lugar) y en las campañas
 * (`tematica` y su copia `tag`). Sus etiquetas la siguen por id. Si el nombre nuevo ya existía
 * (una temática de usuario o del panel), se juntan: perfiles y campañas pasan a la existente, que
 * queda como base, y las etiquetas de la vieja se mueven a ella. Sin la vieja, no hace nada.
 */
async function renombrarTematicaBase(antes: string, ahora: string): Promise<void> {
  const claveAntes = claveDeTematica(antes);
  const claveAhora = claveDeTematica(ahora);
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const vieja = await cliente.query<{ id: number }>(`SELECT id FROM tematicas WHERE clave = $1 FOR UPDATE`, [claveAntes]);
    if (!vieja.rows[0]) {
      await cliente.query("ROLLBACK");
      return;
    }
    const idVieja = Number(vieja.rows[0].id);
    const nueva = await cliente.query<{ id: number }>(`SELECT id FROM tematicas WHERE clave = $1 FOR UPDATE`, [claveAhora]);
    if (nueva.rows[0]) {
      const idNueva = Number(nueva.rows[0].id);
      const hayEtiquetas = await cliente.query<{ existe: string | null }>(`SELECT to_regclass('etiquetas')::text AS existe`);
      if (hayEtiquetas.rows[0]?.existe) {
        await cliente.query(
          `UPDATE etiquetas SET tematica_id = $2
           WHERE tematica_id = $1 AND clave NOT IN (SELECT clave FROM etiquetas WHERE tematica_id = $2)`,
          [idVieja, idNueva],
        );
      }
      await cliente.query(`DELETE FROM tematicas WHERE id = $1`, [idVieja]);
      await cliente.query(`UPDATE tematicas SET nombre = $2, origen = 'base', aprobada = true, oculta = false WHERE id = $1`, [idNueva, ahora]);
    } else {
      await cliente.query(`UPDATE tematicas SET nombre = $2, clave = $3 WHERE id = $1`, [idVieja, ahora, claveAhora]);
    }
    await cliente.query(
      `UPDATE usuarios u SET
         intereses = (
           SELECT COALESCE(jsonb_agg(valor ORDER BY lugar), '[]'::jsonb)
           FROM (
             SELECT valor, MIN(lugar) AS lugar
             FROM (
               SELECT CASE WHEN e.valor = $1 THEN $2 ELSE e.valor END AS valor, e.lugar
               FROM jsonb_array_elements_text(u.intereses) WITH ORDINALITY AS e(valor, lugar)
             ) cambiados
             GROUP BY valor
           ) sin_repetir
         )
       WHERE u.intereses ? $1`,
      [antes, ahora],
    );
    await cliente.query(
      `UPDATE campanas SET
         tematica = CASE WHEN tematica = $1 THEN $2 ELSE tematica END,
         tag = CASE WHEN tag = $1 THEN $2 ELSE tag END
       WHERE tematica = $1 OR tag = $1`,
      [antes, ahora],
    );
    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Catálogo de temáticas (2026-10-07): intereses de los perfiles y temática de las campañas son
 * la misma lista. Empieza con las de lib/intereses.ts (origen 'base') y crece con las palabras
 * clave que salen de lo que escriben los usuarios (origen 'usuario', lib/tematicas/catalogo.ts).
 * `clave` es el nombre sin acentos ni mayúsculas: evita "Ciclismo" y "ciclismo" duplicadas.
 * El SuperUsuario puede ocultar una (`oculta`): deja de ofrecerse, pero no se quita de los perfiles
 * ni de las campañas que ya la tienen.
 * `aprobada` (2026-10-19): las que crean los usuarios entran en false y solo están en el perfil de
 * quien las escribió hasta que el SuperUsuario las aprueba en /sistema/tematicas. Las base y las que
 * ya existían quedan en true por el DEFAULT.
 */
export async function ensureTematicasTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tematicas (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(60) NOT NULL,
      clave VARCHAR(60) NOT NULL UNIQUE,
      origen VARCHAR(10) NOT NULL DEFAULT 'usuario' CHECK (origen IN ('base', 'usuario', 'panel')),
      creada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      oculta BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE tematicas ADD COLUMN IF NOT EXISTS aprobada BOOLEAN NOT NULL DEFAULT true;
    -- 'panel' (2026-10-26): las que crea el SuperUsuario en /sistema/tematicas.
    ALTER TABLE tematicas DROP CONSTRAINT IF EXISTS tematicas_origen_check;
    ALTER TABLE tematicas ADD CONSTRAINT tematicas_origen_check CHECK (origen IN ('base', 'usuario', 'panel'));
    -- Desde el 2026-10-22 rechazar borra la temática (lib/tematicas/catalogo.ts, rechazar); las que
    -- se rechazaron antes quedaban ocultas sin aprobar. Ya se quitaron de los perfiles al rechazarlas.
    -- Después de la primera vez no borra nada.
    DELETE FROM tematicas WHERE NOT aprobada AND oculta;
  `);
  // Antes de sembrar: las base que cambiaron de nombre (2026-10-27) se renombran, para que la siembra
  // no cree una nueva al lado de la vieja.
  for (const [antes, ahora] of RENOMBRES_DE_TEMATICAS_BASE) await renombrarTematicaBase(antes, ahora);
  // Las base, en el orden de lib/intereses.ts. ON CONFLICT: repetirlo en cada arranque es inofensivo.
  await pool.query(
    `INSERT INTO tematicas (nombre, clave, origen)
     SELECT nombre, clave, 'base' FROM unnest($1::text[], $2::text[]) AS t(nombre, clave)
     ON CONFLICT (clave) DO NOTHING`,
    [TEMAS_DE_INTERES, TEMAS_DE_INTERES.map(claveDeTematica)],
  );
}

/**
 * Etiquetas (2026-10-27): subtemáticas de una temática (Protección animal → Perros, Gatos...).
 * Reglas en lib/etiquetas/catalogo.ts.
 *   - `etiquetas`: catálogo por temática (`tematica_id`; el nombre no se repite dentro de la misma
 *     temática por `clave`). Las crea el SuperUsuario (origen 'panel', aprobadas) o las propone el
 *     creador al hacer su campaña (origen 'usuario', `aprobada` = false hasta que el SuperUsuario
 *     las revisa en /sistema/tematicas). `oculta`: deja de ofrecerse, pero se queda donde ya está.
 *     Borrar la temática borra sus etiquetas.
 *   - `campana_etiquetas`: hasta 5 por campaña (MAXIMO_DE_ETIQUETAS_POR_CAMPANA), opcionales.
 *   - `usuario_etiquetas`: subtemáticas que la persona marca en sus intereses (/bienvenida, /cuenta),
 *     solo de temáticas que tiene en `usuarios.intereses`. Desde el 2026-10-28 también puede proponer
 *     una nueva desde ahí (origen 'usuario', pendiente, como las de los creadores).
 *   - Etiquetas base (2026-10-28): lib/etiquetas/base.ts, sembradas una vez por temática.
 */
export async function ensureEtiquetasTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS etiquetas (
      id SERIAL PRIMARY KEY,
      tematica_id INTEGER NOT NULL REFERENCES tematicas(id) ON DELETE CASCADE,
      nombre VARCHAR(60) NOT NULL,
      clave VARCHAR(60) NOT NULL,
      origen VARCHAR(10) NOT NULL DEFAULT 'usuario' CHECK (origen IN ('panel', 'usuario')),
      creada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      aprobada BOOLEAN NOT NULL DEFAULT false,
      oculta BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tematica_id, clave)
    );
    CREATE TABLE IF NOT EXISTS campana_etiquetas (
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      etiqueta_id INTEGER NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
      PRIMARY KEY (campana_id, etiqueta_id)
    );
    -- Filtrar por etiqueta y contar sus campañas.
    CREATE INDEX IF NOT EXISTS campana_etiquetas_etiqueta_idx ON campana_etiquetas (etiqueta_id);
    CREATE TABLE IF NOT EXISTS usuario_etiquetas (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      etiqueta_id INTEGER NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
      PRIMARY KEY (usuario_id, etiqueta_id)
    );
    CREATE INDEX IF NOT EXISTS usuario_etiquetas_etiqueta_idx ON usuario_etiquetas (etiqueta_id);
    -- Ya recibió sus etiquetas base (2026-10-28, lib/etiquetas/base.ts): no se vuelven a sembrar.
    ALTER TABLE tematicas ADD COLUMN IF NOT EXISTS etiquetas_sembradas BOOLEAN NOT NULL DEFAULT false;
  `);
  // Etiquetas base: una sola vez por temática, marcándola en la misma sentencia. Las que ya existían
  // (ON CONFLICT) se respetan, y ninguna puede llamarse como una temática.
  for (const [tematica, nombres] of Object.entries(ETIQUETAS_BASE)) {
    await pool.query(
      `WITH t AS (
         UPDATE tematicas SET etiquetas_sembradas = true WHERE clave = $1 AND NOT etiquetas_sembradas RETURNING id
       )
       INSERT INTO etiquetas (tematica_id, nombre, clave, origen, aprobada)
       SELECT t.id, n.nombre, n.clave, 'panel', true
       FROM t, unnest($2::text[], $3::text[]) AS n(nombre, clave)
       WHERE n.clave NOT IN (SELECT clave FROM tematicas)
       ON CONFLICT (tematica_id, clave) DO NOTHING`,
      [claveDeTematica(tematica), nombres, nombres.map(claveDeTematica)],
    );
  }
}

/**
 * Catálogo de especialidades del perfil (2026-10-26, lib/usuarios/especialidades.ts): empieza con
 * ESPECIALIDADES de lib/perfil-opciones.ts y crece con lo que escriben los usuarios, que se ofrece
 * a todos. `clave` sin acentos ni mayúsculas para no repetir. usuarios.specialty guarda el nombre.
 */
export async function ensureEspecialidadesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS especialidades (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      clave VARCHAR(150) NOT NULL UNIQUE,
      origen VARCHAR(10) NOT NULL DEFAULT 'usuario' CHECK (origen IN ('base', 'usuario', 'panel')),
      creada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    -- 'panel': las que crea el SuperUsuario en /sistema/especialidades.
    ALTER TABLE especialidades DROP CONSTRAINT IF EXISTS especialidades_origen_check;
    ALTER TABLE especialidades ADD CONSTRAINT especialidades_origen_check CHECK (origen IN ('base', 'usuario', 'panel'));
  `);
  // ON CONFLICT: repetirlo en cada arranque es inofensivo. Si alguien ya había escrito una que
  // ahora es base, se marca como base.
  await pool.query(
    `INSERT INTO especialidades (nombre, clave, origen)
     SELECT nombre, clave, 'base' FROM unnest($1::text[], $2::text[]) AS t(nombre, clave)
     ON CONFLICT (clave) DO UPDATE SET origen = 'base', nombre = EXCLUDED.nombre`,
    [ESPECIALIDADES, ESPECIALIDADES.map(claveDeCatalogo)],
  );
  // Las que ya estaban escritas en los perfiles (antes del catálogo) también se ofrecen, si pasan
  // la validación de hoy. Después de la primera vez no inserta nada.
  const escritas = await pool.query<{ specialty: string }>(
    `SELECT DISTINCT specialty FROM usuarios WHERE COALESCE(specialty, '') <> '' AND eliminada_en IS NULL`,
  );
  const validas = escritas.rows
    .map((r) => validarEspecialidad(r.specialty))
    .filter((v): v is { ok: true; nombre: string } => v.ok)
    .map((v) => v.nombre);
  if (validas.length > 0) {
    await pool.query(
      `INSERT INTO especialidades (nombre, clave, origen)
       SELECT nombre, clave, 'usuario' FROM unnest($1::text[], $2::text[]) AS t(nombre, clave)
       ON CONFLICT (clave) DO NOTHING`,
      [validas, validas.map(claveDeCatalogo)],
    );
  }
}

/**
 * Catálogo de organizaciones (2026-10-26, lib/usuarios/organizaciones.ts): a cuál pertenece cada
 * persona (usuarios.organizacion, una y opcional). Sin lista base. La primera vez (tabla vacía) se
 * siembra con las que ya usaban las campañas (campanas.organizer) y pasan la validación; después
 * crece con lo que escriben los usuarios, y el SuperUsuario la administra en /sistema/organizaciones.
 * Solo se siembra una vez para que una borrada en el panel no vuelva al arrancar.
 */
export async function ensureOrganizacionesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizaciones (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(160) NOT NULL,
      clave VARCHAR(160) NOT NULL UNIQUE,
      origen VARCHAR(10) NOT NULL DEFAULT 'usuario' CHECK (origen IN ('base', 'usuario', 'panel')),
      creada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const vacia = await pool.query(`SELECT 1 FROM organizaciones LIMIT 1`);
  if ((vacia.rowCount ?? 0) > 0) return;
  const escritas = await pool.query<{ organizer: string }>(
    `SELECT DISTINCT organizer FROM campanas WHERE COALESCE(organizer, '') <> ''`,
  );
  const validas = escritas.rows
    .map((r) => validarOrganizacion(r.organizer))
    .filter((v): v is { ok: true; nombre: string } => v.ok)
    .map((v) => v.nombre);
  if (validas.length > 0) {
    await pool.query(
      `INSERT INTO organizaciones (nombre, clave, origen)
       SELECT nombre, clave, 'usuario' FROM unnest($1::text[], $2::text[]) AS t(nombre, clave)
       ON CONFLICT (clave) DO NOTHING`,
      [validas, validas.map(claveDeCatalogo)],
    );
  }
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
  await ensureUsuarioPreferenciasTable(); // después de usuarios: copia sus preferencias y borra esas columnas
  await ensureUsuarioRolesTable(); // después de usuarios: copia sus roles y borra la columna
  await ensureCodigosUsuarioTable(); // después de usuarios: copia sus códigos y borra esas columnas
  await ensureSessionsTable();
  await ensureRootSessionsTable();
  await ensureCampanasTable();
  await ensureCampanaEstadisticasTable(); // después de campanas: copia sus contadores y borra esas columnas
  await ensureCampanaEspecialTable();
  await ensureCampanaSupervisoresTable();
  await ensureCampanaRevisoresTable();
  await ensureCampanaBaneadosTable();
  await ensureNotificacionesTable();
  await ensurePushSuscripcionesTable();
  await ensureCampanasGuardadasTable();
  await ensureCampanaEnlacesTable(); // antes de aportes: aportes.enlace_id la referencia
  await ensureAportesTable();
  await ensureArchivosTable(); // después de aportes: copia sus file_* y borra esas columnas
  await ensureCampanaTiposTable(); // después de aportes: cuenta los enviados de cada tipo
  await ensureChecklistsTables(); // después de campanas y aportes: copia checklists y respuestas y borra esas columnas
  await ensureCampanaInscripcionesTable(); // después de aportes: toma de ahí a quien ya había aceptado
  await ensureDispositivosBloqueadosTable(); // después de aportes: aporte_id la referencia
  await ensureSancionesTable();
  await ensureReportesTable(); // después de sanciones y aportes: los referencia
  await ensureListaNegraTable();
  await ensureAuditLogTable();
  await ensureTematicasTable(); // después de usuarios: creada_por la referencia
  await ensureEtiquetasTables(); // después de tematicas, campanas y usuarios: las referencian
  await ensureEspecialidadesTable(); // después de usuarios: creada_por la referencia
  await ensureOrganizacionesTable(); // después de usuarios y campanas: creada_por y la siembra
  await ensureMedallasTables(); // después de usuarios: medallas_usuario.usuario_id la referencia
  await ensureAvisosDeCambios(); // al final: pone triggers en las tablas de arriba
}
