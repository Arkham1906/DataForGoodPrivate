import { pool } from "@/lib/db";
import { RENOMBRES_DE_TEMATICAS_BASE, TEMAS_DE_INTERES } from "@/lib/intereses";
import { ESPECIALIDADES, claveDeCatalogo, validarEspecialidad, validarOrganizacion } from "@/lib/perfil-opciones";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { ETIQUETAS_BASE } from "@/lib/etiquetas/base";
import { ensureAvisosDeCambios } from "@/lib/en-vivo-postgres";
import { ESTRELLAS_MAXIMAS } from "@/lib/aportes/calificacion";
import {
  MEDALLAS_DEL_CATALOGO,
  MISIONES_DEL_CATALOGO,
  RANGOS_DEL_CATALOGO,
  erroresDeMedallas,
  erroresDeMisiones,
  erroresDeRangos,
  type MedallaDelCatalogo,
} from "@/lib/gamificacion/catalogos";
import { PARAMETROS_GAMIFICACION_V2 } from "@/lib/gamificacion/exp-reglas";
import { PROPOSITOS } from "@/lib/campanas/proposito";
import { TIPOS_DE_SANCION } from "@/lib/sanciones";
import { DESTINOS_DE_APORTES } from "@/lib/usuarios/baja-opciones";

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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
      ajustes_en TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    -- Cuándo guardó el creador sus últimos ajustes tras una pausa de la supervisión (2026-11-04);
    -- sin ellos no se reanuda. Se limpia al pausar otra vez.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS ajustes_en TIMESTAMPTZ;
    -- Aprobada por la supervisión y esperando a que el creador la active (2026-10-31, a pedido del usuario):
    -- mientras sea true, una "aceptada" no se activa sola (activateScheduledCampaigns). Las de antes, false.
    ALTER TABLE campanas ADD COLUMN IF NOT EXISTS espera_activacion BOOLEAN NOT NULL DEFAULT false;
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

/**
 * Zona donde está la persona según el GPS del navegador (2026-10-31, a pedido del usuario;
 * lib/ubicacion/zona-detectada.ts). Solo estado y municipio: las coordenadas no se guardan.
 * - usuario_zona_detectada: la última zona (una fila por persona). Sin fila, no compartió su ubicación.
 * - usuario_avisos_de_zona: cuándo se le avisó de cada zona, para no repetir la misma en 24 horas.
 */
export async function ensureZonaDetectadaTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuario_zona_detectada (
      usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      estado VARCHAR(80) NOT NULL,
      municipio VARCHAR(120) NOT NULL,
      detectada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS usuario_avisos_de_zona (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      estado VARCHAR(80) NOT NULL,
      municipio VARCHAR(120) NOT NULL,
      avisado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (usuario_id, estado, municipio)
    );
  `);
}

export async function ensureCampanasGuardadasTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campanas_guardadas (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
      calificacion SMALLINT,
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
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS calificacion SMALLINT;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS first_pass_by VARCHAR(160);
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS first_pass_by_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS enlace_id INTEGER REFERENCES campana_enlaces(id) ON DELETE SET NULL;
    -- Aporte sin cuenta (desde /c/[token]): sha256 del identificador de dispositivo
    -- (cookie anonimo_id). Sirve para la cuota por dispositivo; nunca se guarda el valor.
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS anonimo_id CHAR(64);
    CREATE INDEX IF NOT EXISTS aportes_anonimo_idx ON aportes (campaign_id, anonimo_id) WHERE anonimo_id IS NOT NULL;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    -- Cuándo aceptó la persona los avisos de "Antes de enviar" (uso del aporte y contenido acorde,
    -- lib/aportes/consentimiento.ts). NULL en los aportes enviados antes del 2026-10-13.
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS consentimiento_en TIMESTAMPTZ;
    -- La IP de un aporte sin cuenta ya no se guarda de ninguna forma (2026-10-01): se quita
    -- la columna del HMAC que existió unas horas, con los hashes que alcanzó a guardar.
    DROP INDEX IF EXISTS aportes_ip_fecha_idx;
    ALTER TABLE aportes DROP COLUMN IF EXISTS ip_hmac;
    -- Espera entre aportes anónimos: último aporte del dispositivo, en cualquier campaña.
    CREATE INDEX IF NOT EXISTS aportes_anonimo_fecha_idx ON aportes (anonimo_id, submitted_at) WHERE anonimo_id IS NOT NULL;
    -- Cifra "Participantes" de la landing (2026-11-03): cuentas y dispositivos con aportes aprobados. La
    -- expresión y la condición deben ser idénticas a las de obtenerCifras() en app/page.tsx.
    CREATE INDEX IF NOT EXISTS aportes_participante_aprobado_idx ON aportes ((COALESCE(user_id::text, anonimo_id))) WHERE status = 'aceptado';
    -- Marca "Contenido inapropiado" (creador o revisor) de un aporte anónimo. Solo
    -- estos cuentan para el bloqueo global del dispositivo (lib/aportes/sanciones-anonimas.ts).
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS inapropiado BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS inapropiado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS inapropiado_en TIMESTAMPTZ;
    -- El archivo (ruta en MinIO, MIME, tamaño y si se borró) está en la tabla archivos desde el
    -- 2026-10-30 (ensureArchivosTable): archivo_id NULL = aporte de solo texto.
  `);

  // Calificación en estrellas (2026-10-31, lib/aportes/calificacion.ts): la columna de texto pasa a número
  // una sola vez (bien → 3, muy_bueno → 4, excelente → 5). Antes se quita la regla CHECK de los textos;
  // ensureRestricciones pone la nueva (1 a 5).
  await pool.query(`
    DO $$
    BEGIN
      IF (SELECT data_type FROM information_schema.columns
           WHERE table_name = 'aportes' AND column_name = 'calificacion') <> 'smallint' THEN
        ALTER TABLE aportes DROP CONSTRAINT IF EXISTS aportes_calificacion_check;
        ALTER TABLE aportes ALTER COLUMN calificacion TYPE SMALLINT USING
          CASE calificacion WHEN 'bien' THEN 3 WHEN 'muy_bueno' THEN 4 WHEN 'excelente' THEN 5 END;
      END IF;
    END $$;
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
 * (NULL = sin límite; lib/campanas/limite-por-tipo.ts), el tope POR PERSONA (cuota_por_persona,
 * 2026-10-31; lib/campanas/cuota-por-tipo.ts), los no rechazados que lleva (los recalcula
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
    -- Tope por persona de este tipo (2026-10-31, a pedido del usuario; lib/campanas/cuota-por-tipo.ts):
    -- además de la cuota general, cuántos aportes de este tipo puede mandar cada persona. NULL = sin tope.
    ALTER TABLE campana_tipos ADD COLUMN IF NOT EXISTS cuota_por_persona INTEGER CHECK (cuota_por_persona > 0);
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
/**
 * Fechas con zona horaria (2026-10-30, quinta tanda de la rama cambios-bd). Estas columnas nacieron
 * como TIMESTAMP (sin zona) con la hora UTC del servidor, y cada consulta tenía que decir "esto es UTC"
 * antes de pasarlo a la hora de Tepic. Como TIMESTAMPTZ son un instante exacto: `col AT TIME ZONE zona`
 * da la hora de pared. Solo convierte las que siguen sin zona, así que repetirlo es inofensivo.
 */
const COLUMNAS_CON_ZONA: ReadonlyArray<[tabla: string, columna: string]> = [
  ["usuarios", "created_at"],
  ["usuarios", "updated_at"],
  ["sessions", "created_at"],
  ["campanas", "created_at"],
  ["campanas", "updated_at"],
  ["campanas_guardadas", "created_at"],
  ["aportes", "submitted_at"],
  ["aportes", "reviewed_at"],
  ["aportes", "created_at"],
  ["aportes", "updated_at"],
];

export async function ensureFechasConZona(): Promise<void> {
  for (const [tabla, columna] of COLUMNAS_CON_ZONA) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
          AND data_type = 'timestamp without time zone'`,
      [tabla, columna],
    );
    if (rowCount) {
      // Nombres de una lista fija (no vienen del usuario): se pueden interpolar.
      await pool.query(`ALTER TABLE ${tabla} ALTER COLUMN ${columna} TYPE TIMESTAMPTZ USING ${columna} AT TIME ZONE 'UTC'`);
    }
  }
}

/**
 * Índices en las llaves foráneas (2026-10-30, quinta tanda). Postgres no los crea solo: sin ellos,
 * buscar por esa columna ("mis aportes", "mis campañas") o borrar en cascada recorre la tabla entera.
 * Solo las que no estaban cubiertas por otro índice que empiece con esa columna.
 */
const INDICES_DE_LLAVES: ReadonlyArray<[tabla: string, columna: string]> = [
  ["sessions", "usuario_id"],
  ["campanas", "creator_id"],
  ["campanas", "supervisor_id"],
  ["campana_supervisores", "campana_id"],
  ["campana_supervisores", "supervisor_id"],
  ["campana_revisores", "usuario_id"],
  ["campana_baneados", "usuario_id"],
  ["campana_baneados", "baneado_por"],
  ["campana_inscripciones", "usuario_id"],
  ["campana_enlaces", "creado_por"],
  ["campanas_guardadas", "campana_id"],
  ["notificaciones", "campana_id"],
  ["aportes", "user_id"],
  ["aportes", "enlace_id"],
  ["aportes", "first_pass_by_user_id"],
  ["aportes", "inapropiado_por"],
  ["sanciones", "usuario_id"],
  ["reportes", "reportado_id"],
  ["reportes", "reportado_por"],
  ["reportes", "sancion_id"],
  ["lista_negra_correos", "usuario_id"],
  ["lista_negra_correos", "sancion_id"],
  ["dispositivos_bloqueados", "campana_id"],
  ["dispositivos_bloqueados", "aporte_id"],
  ["dispositivos_bloqueados", "bloqueado_por"],
  ["audit_log", "actor_id"],
  ["tematicas", "creada_por"],
  ["etiquetas", "creada_por"],
  ["especialidades", "creada_por"],
  ["organizaciones", "creada_por"],
];

export async function ensureIndicesDeLlaves(): Promise<void> {
  await pool.query(
    INDICES_DE_LLAVES.map(([tabla, columna]) => `CREATE INDEX IF NOT EXISTS ${tabla}_${columna}_idx ON ${tabla} (${columna});`).join("\n"),
  );
}

const lista = (valores: Iterable<string>) => Array.from(valores, (v) => `'${v.replace(/'/g, "''")}'`).join(", ");

// ---------------------------------------------------------------------------------------------
// Gamificación (2026-11-02): SRS v1.1 + claude/propuesta-bd-gamificacion.md. Este bloque va en
// lib/db-schema.ts, justo después de ensureMedallasTables() y antes del comentario de
// ensureCoreSchema(); ensureCoreSchema() llama a ensureGamificacion() después de ensureMedallasTables().
// Solo usa `pool`, que db-schema.ts ya importa.
//
// Reglas que sigue (propuesta § 5): funciones idempotentes, todo con IF NOT EXISTS, siembras con
// ON CONFLICT DO NOTHING (el SuperUsuario puede editar los catálogos sin que el arranque los pise),
// fechas TIMESTAMPTZ y cada tabla después de las que referencia.
//
// Terminología (RA-GAM-16): todo lo nuevo dice rango, EXP y medalla. Las columnas heredadas
// usuarios.xp_total, level y streak_days se conservan como histórico no funcional (RF-GAM-68, 70).
// ---------------------------------------------------------------------------------------------

/**
 * Parámetros de la versión 1 (SRS v1.1, secciones 3 y 4). Son JSON porque son parámetros
 * configurables y versionados (RF-GAM-64, RNF-GAM-05): el SuperUsuario agrega una versión nueva en
 * lugar de editar la anterior, y cada movimiento de EXP guarda la versión con la que se calculó.
 * Los límites que garantiza la base (un potenciador activo por persona, 0 a 3 protectores) están en
 * las tablas, no aquí. No hay tipo "ubicación": se descartó (propuesta P1).
 */
/** Versión 1 (SRS v1.1, tres calidades): se conserva sembrada como histórico; la vigente es la v2 (exp-reglas.ts). */
const PARAMETROS_GAMIFICACION_V1 = {
  expBase: { texto: 10, foto: 20, documento: 20, audio: 30, video: 30 },
  multiplicadorCalidad: { buena: 1.0, excelente: 1.5, excepcional: 2.0 },
  potenciador: { bonificacion: 0.5, duracionMinutos: 15, enEspera: 3 },
  factorMaximo: 5,
  ventanasHoras: { correccionCalidad: 24, racha: 72 },
  bonoCuota: { porcentaje: 25, minimo: 10, maximo: 150, cuotaMinima: 3 },
};

/**
 * Columnas nuevas en tablas que ya existen. Van aquí, juntas, y no dentro de cada ensure*, para que
 * toda la gamificación se lea (y se revierta) en un solo lugar.
 *   - usuarios.primer_inicio_sesion_en: ancla de los periodos de misión (RF-GAM-41, RA-GAM-18). Las
 *     cuentas existentes quedan en NULL: su valor está pendiente en DA-GAM-17 (b).
 *   - usuarios.intereses_actualizados_en: fecha de la encuesta de intereses, para misiones (RF-GAM-43).
 *   - usuario_preferencias.avisos_gamificacion: un booleano por tipo de aviso (RF-GAM-61, RA-GAM-08);
 *     '{}' = todos con su valor por defecto. oculto_en_lideres: RF-GAM-95.
 *   - aportes.calidad: buena | excelente | excepcional (RF-GAM-09). Es una columna aparte de
 *     calificacion (1 a 5 estrellas desde el 2026-10-31) porque son escalas distintas: las
 *     estrellas no dan EXP; calificacion queda como histórico (RN-GAM-27: no hay EXP retroactiva).
 *     Quien aprobó es first_pass_by_user_id (solo lo escribe un REV; con el creador queda NULL).
 *   - aportes.invalidado_en y invalidacion_motivo (RF-GAM-53): columnas propias y no un valor nuevo
 *     de status, para no cambiar los conteos de campaña ni las pantallas de revisión.
 *   - medallas: clave y mide; la ilustración va por nivel (medalla_niveles), así que file_* ya no
 *     es obligatorio. medallas_usuario: nivel y valor actuales.
 */
async function ensureGamificacionColumnas(): Promise<void> {
  await pool.query(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS primer_inicio_sesion_en TIMESTAMPTZ;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intereses_actualizados_en TIMESTAMPTZ;
    ALTER TABLE usuario_preferencias ADD COLUMN IF NOT EXISTS avisos_gamificacion JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE usuario_preferencias ADD COLUMN IF NOT EXISTS oculto_en_lideres BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS calidad VARCHAR(12);
    -- rev: la asignó un revisor; admin_campana: aceptó el creador (Buena fija, RF-GAM-10).
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS calidad_origen VARCHAR(15);
    -- Inicio de la ventana de 24 horas para corregirla (RF-GAM-13), con la hora del servidor.
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS calidad_asignada_en TIMESTAMPTZ;
    -- Resumen de lo que dio el aporte; el detalle está en exp_movimientos (RF-GAM-15).
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS exp_otorgada INTEGER;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS invalidado_en TIMESTAMPTZ;
    ALTER TABLE aportes ADD COLUMN IF NOT EXISTS invalidacion_motivo TEXT;
    -- Racha y misiones leen los aportes de una persona por fecha de envío.
    CREATE INDEX IF NOT EXISTS aportes_usuario_envio_idx ON aportes (user_id, submitted_at);
    ALTER TABLE medallas ADD COLUMN IF NOT EXISTS clave VARCHAR(60) UNIQUE;
    ALTER TABLE medallas ADD COLUMN IF NOT EXISTS mide VARCHAR(40);
    -- Sección de la pantalla (hitos o adicionales) y orden de lib/datos/medallas.json (2026-11-09).
    ALTER TABLE medallas ADD COLUMN IF NOT EXISTS grupo VARCHAR(20);
    ALTER TABLE medallas ADD COLUMN IF NOT EXISTS orden SMALLINT;
    ALTER TABLE medallas ALTER COLUMN file_type DROP NOT NULL;
    ALTER TABLE medallas ALTER COLUMN file_path DROP NOT NULL;
    ALTER TABLE medallas_usuario ADD COLUMN IF NOT EXISTS nivel_actual SMALLINT NOT NULL DEFAULT 1;
    ALTER TABLE medallas_usuario ADD COLUMN IF NOT EXISTS valor_actual INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE medallas_usuario ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW();
    -- Obsoletas (RF-GAM-68): se conservan como histórico y el código deja de leerlas.
    COMMENT ON COLUMN usuarios.xp_total IS 'OBSOLETA (gamificación SRS v1.1): histórico. La EXP está en usuario_progreso.exp_total.';
    COMMENT ON COLUMN usuarios.level IS 'OBSOLETA (gamificación SRS v1.1): histórico. El rango está en usuario_progreso.rango_actual.';
    COMMENT ON COLUMN usuarios.streak_days IS 'OBSOLETA (gamificación SRS v1.1): histórico. La racha está en usuario_progreso.racha_actual.';
    COMMENT ON COLUMN campanas.xp_per_contribution IS 'OBSOLETA (gamificación SRS v1.1): la EXP base sale de parametros_gamificacion.';
    COMMENT ON COLUMN aportes.calificacion IS 'Calificación de 1 a 5 (SRS v1.2): su multiplicador da la EXP del aporte (lib/gamificacion/recompensas.ts).';
    COMMENT ON COLUMN aportes.calidad IS 'OBSOLETA (SRS v1.2): la escala que da EXP es aportes.calificacion.';
    COMMENT ON COLUMN aportes.exp_otorgada IS 'EXP que dio el aporte al aceptarse; 0 si no le tocaba; NULL si aún no se procesa (lib/gamificacion/recompensas.ts).';
  `);
}

/**
 * Versiones de los parámetros del módulo (RF-GAM-64, RNF-GAM-05): EXP base por tipo, multiplicadores
 * de calidad, bonificación del potenciador (decimal: 0.5), factor máximo, ventanas de tiempo y bono
 * por cuota. Una versión nueva no cambia lo ya calculado: exp_movimientos guarda con cuál se hizo.
 * lanzamiento_en NULL = el módulo aún no se activa; con valor, los aportes enviados antes de esa
 * fecha no dan EXP (RF-GAM-67). La versión vigente es la de mayor vigente_desde que ya empezó.
 */
export async function ensureParametrosGamificacionTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS parametros_gamificacion (
      id SERIAL PRIMARY KEY,
      version INTEGER NOT NULL UNIQUE CHECK (version > 0),
      vigente_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lanzamiento_en TIMESTAMPTZ,
      valores JSONB NOT NULL,
      nota TEXT,
      creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `INSERT INTO parametros_gamificacion (version, valores, nota)
     VALUES (1, $1::jsonb, 'Valores iniciales del SRS v1.1')
     ON CONFLICT (version) DO NOTHING`,
    [JSON.stringify(PARAMETROS_GAMIFICACION_V1)],
  );
  // Versión 2 (2026-11-09, SRS v1.2: calificación de 1 a 5 con cinco multiplicadores). Es la primera que usa el
  // cálculo de EXP (lib/gamificacion/recompensas.ts), así que al sembrarla se activa el módulo: lanzamiento_en es ese
  // momento si ninguna versión lo tenía. Lo aceptado antes no da EXP (RF-GAM-67).
  await pool.query(
    `INSERT INTO parametros_gamificacion (version, valores, nota, lanzamiento_en)
     VALUES (2, $1::jsonb, 'SRS v1.2: calificación de 1 a 5 (tabla 4.2a)',
             COALESCE((SELECT MIN(lanzamiento_en) FROM parametros_gamificacion), NOW()))
     ON CONFLICT (version) DO NOTHING`,
    [JSON.stringify(PARAMETROS_GAMIFICACION_V2)],
  );
}

/**
 * Catálogo de los 20 rangos (RF-GAM-16, 82; tabla 4.3). Requisitos, nombre, descripción, insignia y
 * etapa del avatar. descripcion, insignia_path y etapa_avatar quedan en NULL hasta tener el contenido
 * (DA-GAM-23 y los recursos gráficos de la tabla 4.5); el coleccionable exclusivo está en
 * objetos.rango_exclusivo. Cambiar un requisito no afecta a los rangos ya alcanzados: cada ascenso
 * guarda los requisitos que se pidieron (rango_ascensos.requisitos). «Insignia» solo aparece aquí (RA-GAM-16).
 */
export async function ensureRangosTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rangos (
      numero SMALLINT PRIMARY KEY CHECK (numero > 0),
      nombre VARCHAR(80) NOT NULL,
      descripcion TEXT,
      insignia_path VARCHAR(500),
      etapa_avatar SMALLINT,
      req_exp INTEGER NOT NULL DEFAULT 0 CHECK (req_exp >= 0),
      req_aportes INTEGER NOT NULL DEFAULT 0 CHECK (req_aportes >= 0),
      req_excelentes INTEGER NOT NULL DEFAULT 0 CHECK (req_excelentes >= 0),
      req_excepcionales INTEGER NOT NULL DEFAULT 0 CHECK (req_excepcionales >= 0),
      req_racha INTEGER NOT NULL DEFAULT 0 CHECK (req_racha >= 0),
      req_misiones INTEGER NOT NULL DEFAULT 0 CHECK (req_misiones >= 0),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- Los excepcionales cuentan también como excelentes o superiores (RN-GAM-07).
      CHECK (req_excepcionales <= req_excelentes AND req_excelentes <= req_aportes)
    );
  `);
  await sincronizarRangos();
}

/**
 * Estado de gamificación de cada persona (RF-GAM-06, 17, 30; anexo A.3-3): una fila por usuario,
 * que crea un trigger al insertar en usuarios (CA-GAM-14: rango 1 con 0 EXP). Rango, EXP, contadores
 * de aportes (los excepcionales cuentan también como excelentes o superiores), misiones y campañas
 * completadas, racha actual y máxima, último día con actividad válida y protectores. Los protectores
 * son un contador de 0 a 3 y no filas de inventario: el límite lo garantiza esta sola fila, que el
 * código bloquea con SELECT ... FOR UPDATE (RNF-GAM-03). La EXP nunca baja de 0 (RF-GAM-54).
 * Inicialización (RF-GAM-66): todas las cuentas existentes empiezan en el rango 1 con 0; las dadas de
 * baja definitiva (eliminada_en) no se vuelven a crear porque RF-GAM-60 borra su perfil.
 */
export async function ensureUsuarioProgresoTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuario_progreso (
      usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      rango_actual SMALLINT NOT NULL DEFAULT 1 REFERENCES rangos(numero),
      exp_total INTEGER NOT NULL DEFAULT 0 CHECK (exp_total >= 0),
      aportes_aceptados INTEGER NOT NULL DEFAULT 0 CHECK (aportes_aceptados >= 0),
      aportes_excelentes INTEGER NOT NULL DEFAULT 0 CHECK (aportes_excelentes >= 0),
      aportes_excepcionales INTEGER NOT NULL DEFAULT 0 CHECK (aportes_excepcionales >= 0),
      misiones_completadas INTEGER NOT NULL DEFAULT 0 CHECK (misiones_completadas >= 0),
      campanas_completadas INTEGER NOT NULL DEFAULT 0 CHECK (campanas_completadas >= 0),
      racha_actual INTEGER NOT NULL DEFAULT 0 CHECK (racha_actual >= 0),
      racha_maxima INTEGER NOT NULL DEFAULT 0 CHECK (racha_maxima >= 0),
      ultimo_dia_activo DATE,
      protectores SMALLINT NOT NULL DEFAULT 0 CHECK (protectores BETWEEN 0 AND 3),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE OR REPLACE FUNCTION dfg_crear_progreso() RETURNS trigger AS $$
    BEGIN
      INSERT INTO usuario_progreso (usuario_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    CREATE OR REPLACE TRIGGER dfg_crear_progreso AFTER INSERT ON usuarios
      FOR EACH ROW EXECUTE FUNCTION dfg_crear_progreso();
    -- Por si una cuenta se creó sin el trigger (y para las cuentas existentes, RF-GAM-66).
    INSERT INTO usuario_progreso (usuario_id) SELECT id FROM usuarios WHERE eliminada_en IS NULL ON CONFLICT DO NOTHING;
    CREATE INDEX IF NOT EXISTS usuario_progreso_rango_idx ON usuario_progreso (rango_actual);
  `);
}

/**
 * Contadores por dimensión (RF-GAM-06, medallas, RF-GAM-89): cuántos aportes aceptados y válidos tiene
 * la persona por tipo de dato, por campaña y por temática. Alimentan Orquesta de Datos (tipos
 * distintos), Brújula de Causas (campañas distintas), Aliado de Causas (temáticas distintas) y la
 * tabla de líderes por temática. `clave` es el tipo ('texto', 'foto', ...), el id de la campaña o el
 * id de la temática (tematicas.id y no su nombre: renombrarTematicaBase cambia el nombre).
 */
export async function ensureUsuarioContadoresTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuario_contadores (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      dimension VARCHAR(10) NOT NULL CHECK (dimension IN ('tipo', 'campana', 'tematica')),
      clave VARCHAR(120) NOT NULL,
      valor INTEGER NOT NULL DEFAULT 0 CHECK (valor >= 0),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (usuario_id, dimension, clave),
      CHECK (dimension <> 'tipo' OR clave IN ('texto', 'foto', 'video', 'audio', 'documento'))
    );
    -- Tabla de líderes por temática: quién tiene más en una clave.
    CREATE INDEX IF NOT EXISTS usuario_contadores_clave_idx ON usuario_contadores (dimension, clave, valor DESC);
  `);
}

/**
 * Historial de ascensos de rango (RF-GAM-20, 83, 84): fecha, requisitos que se pidieron y
 * recompensas de cada ascenso (etapa del avatar, insignia, coleccionable, otras), y si ya se vio la
 * celebración. Un ascenso múltiple registra una fila por rango intermedio.
 */
export async function ensureRangoAscensosTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rango_ascensos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      rango SMALLINT NOT NULL REFERENCES rangos(numero),
      alcanzado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      requisitos JSONB NOT NULL,
      recompensas JSONB NOT NULL DEFAULT '[]'::jsonb,
      celebracion_vista_en TIMESTAMPTZ,
      UNIQUE (usuario_id, rango)
    );
    -- Celebraciones que faltan por mostrar al volver a la aplicación.
    CREATE INDEX IF NOT EXISTS rango_ascensos_pendientes_idx ON rango_ascensos (usuario_id) WHERE celebracion_vista_en IS NULL;
    CREATE INDEX IF NOT EXISTS rango_ascensos_rango_idx ON rango_ascensos (rango);
  `);
}

/**
 * Historial de moderación de aportes (RF-GAM-27, 72; RA-GAM-15) y de calidad (RF-GAM-71, 65).
 *   - aporte_eventos: enviado, aceptado, rechazado y cancelado, con la hora del servidor. Resuelve la
 *     ventana de 72 horas y las decisiones fuera de orden. aporte_id NO es llave foránea a propósito:
 *     borrar un aporte pendiente es su "cancelación" (propuesta P8) y el evento tiene que sobrevivir.
 *     Por eso guarda también el tipo y cuándo se envió. Los aportes anónimos no se registran.
 *   - aporte_calidad_historial: cada asignación y corrección de calidad, con valor anterior, quién
 *     (un REV, o el creador con Buena fija), motivo (obligatorio al corregir) y fecha.
 */
export async function ensureAporteHistorialTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aporte_eventos (
      id BIGSERIAL PRIMARY KEY,
      aporte_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      campana_id INTEGER REFERENCES campanas(id) ON DELETE SET NULL,
      evento VARCHAR(12) NOT NULL CHECK (evento IN ('enviado', 'aceptado', 'rechazado', 'cancelado')),
      tipo_aporte VARCHAR(20) CHECK (tipo_aporte IN ('texto', 'foto', 'video', 'audio', 'documento')),
      enviado_en TIMESTAMPTZ NOT NULL,
      decidido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      motivo TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aporte_eventos_aporte_idx ON aporte_eventos (aporte_id, creado_en);
    CREATE INDEX IF NOT EXISTS aporte_eventos_usuario_idx ON aporte_eventos (usuario_id, enviado_en);
    CREATE INDEX IF NOT EXISTS aporte_eventos_campana_idx ON aporte_eventos (campana_id);
    CREATE INDEX IF NOT EXISTS aporte_eventos_decidido_por_idx ON aporte_eventos (decidido_por);
    -- Un aporte se envía una sola vez.
    CREATE UNIQUE INDEX IF NOT EXISTS aporte_eventos_enviado_unico_idx ON aporte_eventos (aporte_id) WHERE evento = 'enviado';

    CREATE TABLE IF NOT EXISTS aporte_calidad_historial (
      id SERIAL PRIMARY KEY,
      aporte_id INTEGER NOT NULL REFERENCES aportes(id) ON DELETE CASCADE,
      calidad_anterior VARCHAR(12) CHECK (calidad_anterior IN ('buena', 'excelente', 'excepcional')),
      calidad_nueva VARCHAR(12) NOT NULL CHECK (calidad_nueva IN ('buena', 'excelente', 'excepcional')),
      origen VARCHAR(15) NOT NULL CHECK (origen IN ('rev', 'admin_campana')),
      asignada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      motivo TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- Corregir (hay valor anterior) exige motivo (RF-GAM-13).
      CHECK (calidad_anterior IS NULL OR length(trim(COALESCE(motivo, ''))) > 0)
    );
    CREATE INDEX IF NOT EXISTS aporte_calidad_historial_aporte_idx ON aporte_calidad_historial (aporte_id, creado_en);
    CREATE INDEX IF NOT EXISTS aporte_calidad_historial_asignada_por_idx ON aporte_calidad_historial (asignada_por);
  `);
}

/**
 * Racha por día y sus eventos (RF-GAM-85, 86).
 *   - racha_dias: estado de cada día para el calendario: confirmado, provisional (aportes pendientes
 *     dentro de su ventana de 72 horas), protegido (cubierto con protector), sin_actividad o
 *     suspendido. El día se determina con la zona horaria del servidor (SRS 1.5).
 *   - racha_eventos: protector consumido o devuelto, día consolidado a las 72 horas, día descartado
 *     por un rechazo e interrupción, con el aporte relacionado. clave_idempotencia evita duplicados
 *     ante reintentos (RF-GAM-08).
 */
export async function ensureRachaTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS racha_dias (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      dia DATE NOT NULL,
      estado VARCHAR(15) NOT NULL CHECK (estado IN ('confirmado', 'provisional', 'protegido', 'sin_actividad', 'suspendido')),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (usuario_id, dia)
    );

    CREATE TABLE IF NOT EXISTS racha_eventos (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo VARCHAR(25) NOT NULL CHECK (tipo IN ('protector_consumido', 'protector_devuelto', 'dia_consolidado', 'dia_descartado', 'racha_interrumpida')),
      dia DATE,
      aporte_id INTEGER REFERENCES aportes(id) ON DELETE SET NULL,
      detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
      clave_idempotencia VARCHAR(120) NOT NULL UNIQUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS racha_eventos_usuario_idx ON racha_eventos (usuario_id, creado_en DESC);
    CREATE INDEX IF NOT EXISTS racha_eventos_aporte_idx ON racha_eventos (aporte_id);
  `);
}

/**
 * Potenciadores de EXP (RF-GAM-32 a 36): cola por persona con un activo y hasta tres en espera.
 * El índice único parcial garantiza un solo activo por persona (sin solapamientos); el máximo de tres
 * en espera lo cuida el código con el mismo bloqueo de usuario_progreso. Qué pasa al obtener uno con la
 * capacidad llena NO está definido (DA-GAM-13) y no debe implementarse hasta cerrarse; por eso el estado
 * 'perdido' solo existe para registrar el aviso de RF-GAM-61. `bonificacion` es decimal (0.5) y se copia al
 * obtenerlo, para que cambiar el parámetro no altere uno ya obtenido. Elegibilidad (RF-GAM-36): un aporte
 * es elegible si su submitted_at cae entre activado_en y vence_en.
 */
export async function ensurePotenciadoresTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS potenciadores (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      estado VARCHAR(10) NOT NULL DEFAULT 'espera' CHECK (estado IN ('espera', 'activo', 'expirado', 'perdido')),
      bonificacion NUMERIC(3, 2) NOT NULL DEFAULT 0.50 CHECK (bonificacion > 0),
      duracion_minutos SMALLINT NOT NULL DEFAULT 15 CHECK (duracion_minutos > 0),
      origen VARCHAR(40),
      obtenido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activado_en TIMESTAMPTZ,
      vence_en TIMESTAMPTZ,
      clave_idempotencia VARCHAR(120) NOT NULL UNIQUE,
      CHECK (estado NOT IN ('activo', 'expirado') OR (activado_en IS NOT NULL AND vence_en IS NOT NULL)),
      CHECK (vence_en IS NULL OR vence_en > activado_en)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS potenciadores_un_activo_idx ON potenciadores (usuario_id) WHERE estado = 'activo';
    CREATE INDEX IF NOT EXISTS potenciadores_cola_idx ON potenciadores (usuario_id, estado, obtenido_en, id);
    CREATE INDEX IF NOT EXISTS potenciadores_vigencia_idx ON potenciadores (usuario_id, activado_en, vence_en) WHERE activado_en IS NOT NULL;
  `);
}

/**
 * Objetos coleccionables e inventario (RF-GAM-50 a 52, 82). El catálogo está pendiente (DA-GAM-09),
 * así que `categoria` es texto libre y no hay siembra. rango_exclusivo (único) marca el coleccionable
 * exclusivo de un rango y evita una llave circular con rangos. usuario_objetos no limita los duplicados
 * (DA-GAM-09 aún no define su regla): lo que impide entregar dos veces el mismo premio es
 * clave_idempotencia (RF-GAM-08).
 */
export async function ensureObjetosTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS objetos (
      id SERIAL PRIMARY KEY,
      clave VARCHAR(60) NOT NULL UNIQUE,
      nombre VARCHAR(120) NOT NULL,
      descripcion TEXT,
      categoria VARCHAR(30),
      imagen_path VARCHAR(500),
      rango_exclusivo SMALLINT UNIQUE REFERENCES rangos(numero) ON DELETE SET NULL,
      activo BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS usuario_objetos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      objeto_id INTEGER NOT NULL REFERENCES objetos(id),
      obtenido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      equipado BOOLEAN NOT NULL DEFAULT false,
      clave_idempotencia VARCHAR(120) NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS usuario_objetos_usuario_idx ON usuario_objetos (usuario_id);
    CREATE INDEX IF NOT EXISTS usuario_objetos_objeto_idx ON usuario_objetos (objeto_id);
  `);
}

/** Copia lib/datos/rangos.json a la tabla. Con un error en el JSON, la tabla se queda como estaba. */
async function sincronizarRangos(): Promise<void> {
  const errores = erroresDeRangos(RANGOS_DEL_CATALOGO);
  if (errores.length > 0) {
    console.error(`lib/datos/rangos.json no se aplicó:\n${errores.join("\n")}`);
    return;
  }
  for (const r of RANGOS_DEL_CATALOGO) {
    const q = r.requisitos;
    await pool.query(
      `INSERT INTO rangos (numero, nombre, descripcion, req_exp, req_aportes, req_excelentes, req_excepcionales, req_racha, req_misiones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (numero) DO UPDATE SET
         nombre = EXCLUDED.nombre, descripcion = COALESCE(EXCLUDED.descripcion, rangos.descripcion),
         req_exp = EXCLUDED.req_exp, req_aportes = EXCLUDED.req_aportes, req_excelentes = EXCLUDED.req_excelentes,
         req_excepcionales = EXCLUDED.req_excepcionales, req_racha = EXCLUDED.req_racha, req_misiones = EXCLUDED.req_misiones,
         actualizado_en = NOW()`,
      [r.numero, r.nombre, r.descripcion, q.exp, q.aportes, q.sobresalientes, q.excepcionales, q.racha, q.misiones],
    );
  }
}

/** Copia lib/datos/misiones.json a la tabla. Una misión que sale del JSON se desactiva: su historial se conserva. */
async function sincronizarMisiones(): Promise<void> {
  const errores = erroresDeMisiones(MISIONES_DEL_CATALOGO);
  if (errores.length > 0) {
    console.error(`lib/datos/misiones.json no se aplicó:\n${errores.join("\n")}`);
    return;
  }
  for (const m of MISIONES_DEL_CATALOGO) {
    await pool.query(
      `INSERT INTO misiones (clave, nombre, descripcion, periodicidad, grupo, condicion, recompensa, activa)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       ON CONFLICT (clave) DO UPDATE SET
         nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, periodicidad = EXCLUDED.periodicidad, grupo = EXCLUDED.grupo,
         condicion = EXCLUDED.condicion, recompensa = EXCLUDED.recompensa, activa = EXCLUDED.activa`,
      [m.clave, m.nombre, m.descripcion ?? null, m.periodicidad, m.grupo, JSON.stringify(m.condicion), JSON.stringify(m.recompensa ?? {}), m.activa],
    );
  }
  await pool.query(`UPDATE misiones SET activa = false WHERE activa AND clave <> ALL($1::text[])`, [
    MISIONES_DEL_CATALOGO.map((m) => m.clave),
  ]);
}

/**
 * Misiones (RF-GAM-40 a 45, 75). El catálogo vive en lib/datos/misiones.json (lib/gamificacion/catalogos.ts).
 *   - misiones: periodicidad diaria o semanal, condición y recompensa en JSON (la forma la define el catálogo).
 *   - mision_instancias: una por persona, misión y periodo. El periodo tiene inicio y fin explícitos,
 *     calculados desde primer_inicio_sesion_en (RF-GAM-41); el UNIQUE impide contar dos veces la misma
 *     finalización (RF-GAM-42). recompensa_entregada_en separa "completada" de "recompensa concedida"
 *     (RF-GAM-74, DA-GAM-17).
 *   - mision_instancia_aportes: los aportes que sumaron a cada instancia, para ajustar el progreso al invalidar.
 */
export async function ensureMisionesTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS misiones (
      id SERIAL PRIMARY KEY,
      clave VARCHAR(60) NOT NULL UNIQUE,
      nombre VARCHAR(120) NOT NULL,
      descripcion TEXT,
      periodicidad VARCHAR(10) NOT NULL CHECK (periodicidad IN ('diaria', 'semanal')),
      condicion JSONB NOT NULL,
      recompensa JSONB NOT NULL DEFAULT '{}'::jsonb,
      activa BOOLEAN NOT NULL DEFAULT true,
      creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    -- Variedad de la selección aleatoria (lib/gamificacion/misiones-reglas.ts, 2026-11-04).
    ALTER TABLE misiones ADD COLUMN IF NOT EXISTS grupo VARCHAR(40);

    CREATE TABLE IF NOT EXISTS mision_instancias (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      mision_id INTEGER NOT NULL REFERENCES misiones(id),
      periodo_inicio TIMESTAMPTZ NOT NULL,
      periodo_fin TIMESTAMPTZ NOT NULL,
      objetivo INTEGER NOT NULL CHECK (objetivo > 0),
      progreso INTEGER NOT NULL DEFAULT 0 CHECK (progreso >= 0),
      completada_en TIMESTAMPTZ,
      recompensa_entregada_en TIMESTAMPTZ,
      CHECK (periodo_fin > periodo_inicio),
      UNIQUE (usuario_id, mision_id, periodo_inicio)
    );
    CREATE INDEX IF NOT EXISTS mision_instancias_mision_idx ON mision_instancias (mision_id);
    -- Total histórico de misiones completadas (requisito de rango) y recompensas por entregar.
    CREATE INDEX IF NOT EXISTS mision_instancias_completadas_idx ON mision_instancias (usuario_id) WHERE completada_en IS NOT NULL;
    CREATE INDEX IF NOT EXISTS mision_instancias_sin_recompensa_idx ON mision_instancias (usuario_id)
      WHERE completada_en IS NOT NULL AND recompensa_entregada_en IS NULL;

    CREATE TABLE IF NOT EXISTS mision_instancia_aportes (
      instancia_id BIGINT NOT NULL REFERENCES mision_instancias(id) ON DELETE CASCADE,
      aporte_id INTEGER NOT NULL REFERENCES aportes(id) ON DELETE CASCADE,
      PRIMARY KEY (instancia_id, aporte_id)
    );
    CREATE INDEX IF NOT EXISTS mision_instancia_aportes_aporte_idx ON mision_instancia_aportes (aporte_id);
  `);
  await sincronizarMisiones();
}

/**
 * Registro de EXP (RF-GAM-07, 08, 60; RNF-GAM-04, 10, 11): cada movimiento de EXP, con su origen
 * (tipo), motivo y entidad relacionada. Es inalterable: un trigger impide borrar filas y cambiar lo
 * que se calculó; un error se corrige con un ajuste nuevo (movimiento_original_id apunta al corregido),
 * nunca editando. Guarda lo usado en el cálculo: EXP base, calidad, multiplicadores, bonificación del
 * potenciador (decimales), factor, resultado y versión de parámetros. clave_idempotencia UNIQUE hace que
 * repetir un evento no conceda dos veces (RF-GAM-08). En la baja definitiva usuario_id pasa a NULL y se
 * marca anonimizado_en: el trigger solo permite ese cambio y los de las llaves foráneas (SET NULL).
 */
export async function ensureExpMovimientosTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exp_movimientos (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      anonimizado_en TIMESTAMPTZ,
      tipo VARCHAR(25) NOT NULL CHECK (tipo IN ('aporte', 'mision', 'bono_campana', 'ajuste_invalidacion', 'ajuste_calidad', 'ajuste_admin')),
      exp INTEGER NOT NULL,
      motivo TEXT,
      aporte_id INTEGER REFERENCES aportes(id) ON DELETE SET NULL,
      campana_id INTEGER REFERENCES campanas(id) ON DELETE SET NULL,
      mision_instancia_id BIGINT REFERENCES mision_instancias(id) ON DELETE SET NULL,
      movimiento_original_id BIGINT REFERENCES exp_movimientos(id),
      exp_base INTEGER,
      calidad VARCHAR(12) CHECK (calidad IN ('buena', 'excelente', 'excepcional')),
      calificacion SMALLINT CHECK (calificacion BETWEEN 1 AND 5),
      mult_calidad NUMERIC(4, 2),
      mult_campana NUMERIC(4, 2),
      potenciador_id INTEGER REFERENCES potenciadores(id) ON DELETE SET NULL,
      bonificacion_potenciador NUMERIC(3, 2),
      factor NUMERIC(4, 2),
      parametros_version INTEGER REFERENCES parametros_gamificacion(version),
      clave_idempotencia VARCHAR(120) NOT NULL UNIQUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS exp_movimientos_usuario_idx ON exp_movimientos (usuario_id, creado_en DESC);
    CREATE INDEX IF NOT EXISTS exp_movimientos_aporte_idx ON exp_movimientos (aporte_id);
    CREATE INDEX IF NOT EXISTS exp_movimientos_campana_idx ON exp_movimientos (campana_id);
    CREATE INDEX IF NOT EXISTS exp_movimientos_mision_idx ON exp_movimientos (mision_instancia_id);
    CREATE INDEX IF NOT EXISTS exp_movimientos_potenciador_idx ON exp_movimientos (potenciador_id);
    CREATE INDEX IF NOT EXISTS exp_movimientos_original_idx ON exp_movimientos (movimiento_original_id);
    -- Calificación de 1 a 5 usada en el cálculo (SRS v1.2, anexo A.5; 2026-11-09). calidad queda como histórico.
    ALTER TABLE exp_movimientos ADD COLUMN IF NOT EXISTS calificacion SMALLINT CHECK (calificacion BETWEEN 1 AND 5);
    CREATE OR REPLACE FUNCTION dfg_exp_movimientos_inalterable() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'exp_movimientos es inalterable: registra un ajuste en vez de borrar';
      END IF;
      IF (OLD.tipo, OLD.exp, OLD.motivo, OLD.exp_base, OLD.calidad, OLD.calificacion, OLD.mult_calidad, OLD.mult_campana,
          OLD.bonificacion_potenciador, OLD.factor, OLD.parametros_version, OLD.clave_idempotencia, OLD.creado_en)
         IS DISTINCT FROM
         (NEW.tipo, NEW.exp, NEW.motivo, NEW.exp_base, NEW.calidad, NEW.calificacion, NEW.mult_calidad, NEW.mult_campana,
          NEW.bonificacion_potenciador, NEW.factor, NEW.parametros_version, NEW.clave_idempotencia, NEW.creado_en) THEN
        RAISE EXCEPTION 'exp_movimientos es inalterable: registra un ajuste en vez de editar';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE OR REPLACE TRIGGER dfg_exp_movimientos_inalterable BEFORE UPDATE OR DELETE ON exp_movimientos
      FOR EACH ROW EXECUTE FUNCTION dfg_exp_movimientos_inalterable();
  `);
}

/**
 * Niveles de medalla y su historial (RF-GAM-46 a 49; tabla 4.4).
 *   - medalla_niveles: nivel, nombre, umbral e ilustración (una por nivel; NULL hasta tener los
 *     recursos gráficos, tabla 4.5). El catálogo sale de lib/datos/medallas.json (sincronizarMedallas).
 *   - medalla_ascensos: cuándo se alcanzó cada nivel y si ya se vio la celebración (RF-GAM-84). Un nivel
 *     alcanzado no se retira (RF-GAM-47): la llave foránea a medalla_niveles no tiene cascada.
 */
export async function ensureMedallaNivelesTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS medalla_niveles (
      id SERIAL PRIMARY KEY,
      medalla_id INTEGER NOT NULL REFERENCES medallas(id) ON DELETE CASCADE,
      nivel SMALLINT NOT NULL CHECK (nivel >= 1),
      nombre VARCHAR(60) NOT NULL,
      umbral INTEGER NOT NULL CHECK (umbral > 0),
      ilustracion_path VARCHAR(500),
      UNIQUE (medalla_id, nivel)
    );

    CREATE TABLE IF NOT EXISTS medalla_ascensos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      medalla_id INTEGER NOT NULL,
      nivel SMALLINT NOT NULL,
      alcanzado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      celebracion_vista_en TIMESTAMPTZ,
      UNIQUE (usuario_id, medalla_id, nivel),
      FOREIGN KEY (medalla_id, nivel) REFERENCES medalla_niveles (medalla_id, nivel)
    );
    CREATE INDEX IF NOT EXISTS medalla_ascensos_pendientes_idx ON medalla_ascensos (usuario_id) WHERE celebracion_vista_en IS NULL;
  `);
  await sincronizarMedallas();
}

/**
 * Copia lib/datos/medallas.json a `medallas` y `medalla_niveles` (2026-11-09). El JSON manda en nombre, descripción,
 * grupo, orden, medida, activa y niveles. Lo ganado no se toca (RF-GAM-47):
 *   - una medalla que sale del JSON se desactiva, no se borra: puede tener ganadores;
 *   - un nivel que sale del JSON se borra solo si nadie lo alcanzó; si alguien lo tiene se conserva y se avisa en el log;
 *   - un umbral nuevo vale para lo que se gane después: no retira niveles ya registrados.
 * Una medalla creada antes desde el panel con el mismo nombre (sin clave) recibe la clave del JSON.
 */
async function sincronizarMedallas(): Promise<void> {
  const errores = erroresDeMedallas(MEDALLAS_DEL_CATALOGO);
  if (errores.length > 0) {
    console.error(`lib/datos/medallas.json no se aplicó:\n${errores.join("\n")}`);
    return;
  }
  for (const [orden, m] of MEDALLAS_DEL_CATALOGO.entries()) {
    try {
      await sincronizarMedalla(m, orden + 1);
    } catch (error) {
      // P. ej. un nombre que ya usa otra medalla de la base (medallas.nombre es UNIQUE): no debe impedir el arranque.
      console.error(`medallas.json: no se pudo aplicar ${m.clave}; se queda como estaba.`, error);
    }
  }
  await pool.query(`UPDATE medallas SET activa = false WHERE activa AND clave IS NOT NULL AND clave <> ALL($1::text[])`, [
    MEDALLAS_DEL_CATALOGO.map((m) => m.clave),
  ]);
}

async function sincronizarMedalla(m: MedallaDelCatalogo, orden: number): Promise<void> {
  await pool.query(
    `UPDATE medallas SET clave = $1
      WHERE nombre = $2 AND clave IS NULL AND NOT EXISTS (SELECT 1 FROM medallas WHERE clave = $1)`,
    [m.clave, m.nombre],
  );
  await pool.query(
    `INSERT INTO medallas (clave, nombre, descripcion, mide, grupo, orden, criterio, activa)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     ON CONFLICT (clave) DO UPDATE SET
       nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, mide = EXCLUDED.mide, grupo = EXCLUDED.grupo,
       orden = EXCLUDED.orden, criterio = EXCLUDED.criterio, activa = EXCLUDED.activa`,
    [m.clave, m.nombre, m.descripcion, m.mide, m.grupo, orden, JSON.stringify({ mide: m.mide }), m.activa],
  );
  await pool.query(
    `INSERT INTO medalla_niveles (medalla_id, nivel, nombre, umbral)
     SELECT md.id, n.nivel, n.nombre, n.umbral
       FROM medallas md, unnest($2::smallint[], $3::text[], $4::int[]) AS n(nivel, nombre, umbral)
      WHERE md.clave = $1
     ON CONFLICT (medalla_id, nivel) DO UPDATE SET nombre = EXCLUDED.nombre, umbral = EXCLUDED.umbral`,
    [m.clave, m.niveles.map((_, i) => i + 1), m.niveles.map((n) => n.nombre), m.niveles.map((n) => n.umbral)],
  );
  const sobrantes = await pool.query<{ nivel: number; alcanzado: boolean }>(
    `SELECT n.nivel, EXISTS (SELECT 1 FROM medalla_ascensos a WHERE a.medalla_id = n.medalla_id AND a.nivel = n.nivel) AS alcanzado
       FROM medalla_niveles n JOIN medallas md ON md.id = n.medalla_id
      WHERE md.clave = $1 AND n.nivel > $2`,
    [m.clave, m.niveles.length],
  );
  const conservados = sobrantes.rows.filter((n) => n.alcanzado).map((n) => n.nivel);
  if (conservados.length > 0) {
    console.warn(`medallas.json: ${m.clave} ya no tiene los niveles ${conservados.join(", ")}, pero alguien los alcanzó: se conservan.`);
  }
  await pool.query(
    `DELETE FROM medalla_niveles n USING medallas md
      WHERE md.id = n.medalla_id AND md.clave = $1 AND n.nivel > $2
        AND NOT EXISTS (SELECT 1 FROM medalla_ascensos a WHERE a.medalla_id = n.medalla_id AND a.nivel = n.nivel)`,
    [m.clave, m.niveles.length],
  );
}

/**
 * Bono por completar la cuota de una campaña (RF-GAM-37 a 39): una fila por persona y campaña.
 * Guarda la cuota completada, la EXP de referencia (base × calidad, sin potenciador ni multiplicador
 * de campaña), el bono y el movimiento de EXP que lo concedió. Cuenta en campanas_completadas.
 * 'revertido' es la regla PROVISIONAL de DA-GAM-14 (se revierte si una invalidación o corrección deja
 * la cuota incompleta y se recalcula si se completa de nuevo). PENDIENTE: el SRS no dice si una campaña
 * con cuota menor a 3 (sin bono, RF-GAM-38) cuenta como completada; el bono 0 lo permite.
 */
export async function ensureCampanaCuotaBonosTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campana_cuota_bonos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      campana_id INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      cuota INTEGER NOT NULL CHECK (cuota > 0),
      exp_referencia INTEGER NOT NULL DEFAULT 0 CHECK (exp_referencia >= 0),
      bono INTEGER NOT NULL DEFAULT 0 CHECK (bono >= 0),
      estado VARCHAR(10) NOT NULL DEFAULT 'concedido' CHECK (estado IN ('concedido', 'revertido')),
      exp_movimiento_id BIGINT REFERENCES exp_movimientos(id) ON DELETE SET NULL,
      completada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revertida_en TIMESTAMPTZ,
      UNIQUE (usuario_id, campana_id)
    );
    CREATE INDEX IF NOT EXISTS campana_cuota_bonos_campana_idx ON campana_cuota_bonos (campana_id);
    CREATE INDEX IF NOT EXISTS campana_cuota_bonos_movimiento_idx ON campana_cuota_bonos (exp_movimiento_id);
  `);
}

/**
 * Posición semanal en la tabla de líderes, para mostrar el cambio respecto a la semana anterior en
 * Inicio (RF-GAM-96). Solo categorías sin sub-clave (aportes, rango, excelentes, excepcionales); las
 * posiciones por temática no se guardan. semana_inicio es el primer día de la semana: cómo se delimita
 * (calendario o móvil) y con qué zona horaria sigue abierto en DA-GAM-21. Quien tiene
 * usuario_preferencias.oculto_en_lideres no aparece (RF-GAM-95).
 */
export async function ensureLideresPosicionesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lideres_posiciones_semanales (
      semana_inicio DATE NOT NULL,
      categoria VARCHAR(15) NOT NULL CHECK (categoria IN ('aportes', 'rango', 'excelentes', 'excepcionales')),
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      posicion INTEGER NOT NULL CHECK (posicion > 0),
      calculada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (semana_inicio, categoria, usuario_id)
    );
    CREATE INDEX IF NOT EXISTS lideres_posiciones_usuario_idx ON lideres_posiciones_semanales (usuario_id, semana_inicio DESC);
  `);
}

/**
 * Decisión de datos abiertos de cada campaña terminada (2026-11-04, lib/supervision/datos-abiertos.ts). Al
 * crear la tabla, las finalizadas que ya estaban publicadas se quedan publicadas (decisión del usuario).
 * Solo esa vez: repetirlo publicaría las que esperan la decisión.
 */
export async function ensureCampanaDatosAbiertosTable(): Promise<void> {
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.campana_datos_abiertos') IS NULL THEN
        CREATE TABLE campana_datos_abiertos (
          campana_id INTEGER PRIMARY KEY REFERENCES campanas(id) ON DELETE CASCADE,
          estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'publicada', 'no_publicada')),
          motivo TEXT,
          decidido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          por_superusuario BOOLEAN NOT NULL DEFAULT false,
          decidido_en TIMESTAMPTZ
        );
        CREATE INDEX campana_datos_abiertos_decidido_por_idx ON campana_datos_abiertos (decidido_por);
        CREATE INDEX campana_datos_abiertos_estado_idx ON campana_datos_abiertos (estado);
        INSERT INTO campana_datos_abiertos (campana_id, estado, decidido_en)
        SELECT id, 'publicada', NOW() FROM campanas WHERE status = 'finalizada';
      END IF;
    END $$;
  `);
}

/** Todo el esquema de la gamificación, en el orden de sus llaves foráneas. Lo llama ensureCoreSchema(). */
export async function ensureGamificacion(): Promise<void> {
  await ensureGamificacionColumnas(); // antes que todo: usa usuarios, aportes y medallas ya creadas
  await ensureParametrosGamificacionTable();
  await ensureRangosTable(); // antes de usuario_progreso, rango_ascensos y objetos: los referencian
  await ensureUsuarioProgresoTable();
  await ensureUsuarioContadoresTable();
  await ensureRangoAscensosTable();
  await ensureAporteHistorialTables();
  await ensureRachaTables();
  await ensurePotenciadoresTable(); // antes de exp_movimientos
  await ensureObjetosTables();
  await ensureMisionesTables(); // antes de exp_movimientos
  await ensureExpMovimientosTable();
  await ensureMedallaNivelesTables();
  await ensureCampanaCuotaBonosTable(); // después de exp_movimientos
  await ensureLideresPosicionesTable();
}


/**
 * Valores válidos de las columnas de estado y tipo (2026-10-30, quinta tanda): la base rechaza un
 * valor mal escrito en vez de guardarlo. Las listas salen de las mismas constantes que usa el código
 * cuando existen. NULL siempre pasa (las columnas que lo admiten siguen admitiéndolo).
 * Se vuelven a poner en cada arranque (así siguen a las constantes). Primero NOT VALID, que solo revisa
 * lo que se escriba de ahí en adelante; luego VALIDATE revisa lo guardado: si una fila vieja no cumple,
 * la regla se queda sin validar y avisa en el log de Postgres, en vez de impedir que arranque la app.
 */
function restricciones(): ReadonlyArray<[tabla: string, nombre: string, condicion: string]> {
  return [
    // Estados de la campaña (lib/campanas/sistema-opciones.ts, EstadoDeCampana).
    ["campanas", "campanas_status_check",
      `status IN ('borrador', 'en_revision', 'aceptada', 'activa', 'pausada', 'rechazada', 'finalizada')`],
    ["campanas", "campanas_collection_mode_check", `collection_mode IN ('checklist', 'texto_libre')`],
    // Quién la pausó (lib/campanas/pausa.ts).
    ["campanas", "campanas_pausa_por_check", `pausa_por IN ('creador', 'supervision')`],
    ["campanas", "campanas_proposito_check", `proposito IN (${lista(PROPOSITOS.map((p) => p.valor))})`],
    // espera_final: campañas de antes del 2026-10-06 (ESTADOS_SIN_DECISION de lib/aportes/decision.ts).
    ["aportes", "aportes_status_check", `status IN ('pendiente', 'espera_final', 'aceptado', 'rechazado')`],
    // Estrellas de 1 a 5 (2026-10-31, lib/aportes/calificacion.ts).
    ["aportes", "aportes_calificacion_check", `calificacion BETWEEN 1 AND ${ESTRELLAS_MAXIMAS}`],
    ["reportes", "reportes_estado_check", `estado IN ('pendiente', 'descartado', 'sancionado')`],
    ["reportes", "reportes_origen_check", `origen IN ('usuario', 'rechazo', 'supervision')`],
    ["sanciones", "sanciones_tipo_check", `tipo IN (${lista(TIPOS_DE_SANCION)})`],
    ["usuarios", "usuarios_avatar_check", `avatar IN ('masculino', 'femenino', 'otro', 'foto')`],
    // racha_recuperada (2026-11-09): un aporte reavivó la racha después de perderla (medalla Fénix, lib/gamificacion/racha.ts).
    ["racha_eventos", "racha_eventos_tipo_check",
      `tipo IN ('protector_consumido', 'protector_devuelto', 'dia_consolidado', 'dia_descartado', 'racha_interrumpida', 'racha_recuperada')`],
    ["usuarios", "usuarios_baja_destino_aportes_check",
      `baja_destino_aportes IN (${lista(DESTINOS_DE_APORTES.map((d) => d.valor))})`],
  ];
}

export async function ensureRestricciones(): Promise<void> {
  for (const [tabla, nombre, condicion] of restricciones()) {
    await pool.query(`
      ALTER TABLE ${tabla} DROP CONSTRAINT IF EXISTS ${nombre};
      ALTER TABLE ${tabla} ADD CONSTRAINT ${nombre} CHECK (${condicion}) NOT VALID;
      DO $$
      BEGIN
        ALTER TABLE ${tabla} VALIDATE CONSTRAINT ${nombre};
      EXCEPTION WHEN check_violation THEN
        RAISE WARNING 'Hay filas de ${tabla} que no cumplen ${nombre}: la regla vale solo para lo nuevo';
      END $$;
    `);
  }
}

/** Sin estado "incompleta" (2026-11-04, a pedido del usuario): las que quedaban pasan a finalizada. Sin avisos. */
export async function ensureSinCampanasFallidas(): Promise<void> {
  const { rowCount } = await pool.query(`UPDATE campanas SET status = 'finalizada' WHERE status = 'fallida'`);
  if (rowCount) console.log(`Campañas incompletas que pasaron a finalizadas: ${rowCount}`);
}

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
  await ensureZonaDetectadaTables();
  await ensureCampanasGuardadasTable();
  await ensureCampanaEnlacesTable(); // antes de aportes: aportes.enlace_id la referencia
  await ensureAportesTable();
  await ensureArchivosTable(); // después de aportes: copia sus file_* y borra esas columnas
  await ensureCampanaTiposTable(); // después de aportes: cuenta los enviados de cada tipo
  await ensureCampanaDatosAbiertosTable(); // después de campanas y usuarios: las referencia
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
  await ensureGamificacion(); // gamificación SRS v1.1: columnas, catálogos y tablas nuevas
  await ensureFechasConZona(); // después de crear las tablas: TIMESTAMP → TIMESTAMPTZ
  await ensureIndicesDeLlaves();
  await ensureSinCampanasFallidas(); // antes de las reglas: el CHECK ya no admite 'fallida'
  await ensureRestricciones();
  await ensureAvisosDeCambios(); // al final: pone triggers en las tablas de arriba
}