--
-- PostgreSQL database dump
--

\restrict 28EcfWBnltS9tjquyUpYk6qQGq66p74wX4joTrJOYfIvBDb96vTkTSLTgNmIAm1

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: dfg_avisar_cambio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dfg_avisar_cambio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM pg_notify('dfg_cambios', TG_TABLE_NAME);
      RETURN NULL;
    END;
    $$;


--
-- Name: dfg_borrar_archivo_del_aporte(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dfg_borrar_archivo_del_aporte() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF OLD.archivo_id IS NOT NULL THEN
        DELETE FROM archivos WHERE id = OLD.archivo_id;
      END IF;
      RETURN NULL;
    END;
    $$;


--
-- Name: dfg_copiar_envio_a_revision(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dfg_copiar_envio_a_revision() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.en_revision_desde IS NULL THEN
        SELECT c.en_revision_desde INTO NEW.en_revision_desde FROM campanas c WHERE c.id = NEW.campana_id;
      END IF;
      RETURN NEW;
    END;
    $$;


--
-- Name: dfg_crear_estadisticas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dfg_crear_estadisticas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO campana_estadisticas (campana_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
      RETURN NULL;
    END;
    $$;


--
-- Name: dfg_crear_preferencias(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dfg_crear_preferencias() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO usuario_preferencias (usuario_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
      RETURN NULL;
    END;
    $$;


--
-- Name: dfg_crear_progreso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dfg_crear_progreso() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO usuario_progreso (usuario_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
      RETURN NULL;
    END;
    $$;


--
-- Name: dfg_crear_rol_usuario(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dfg_crear_rol_usuario() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO usuario_roles (usuario_id, rol)
      VALUES (NEW.id, 'usuario'), (NEW.id, 'creador'), (NEW.id, 'aportador') ON CONFLICT DO NOTHING;
      RETURN NULL;
    END;
    $$;


--
-- Name: dfg_exp_movimientos_inalterable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dfg_exp_movimientos_inalterable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
    $$;


--
-- Name: dfg_marcar_envio_a_revision(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dfg_marcar_envio_a_revision() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.status = 'en_revision' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'en_revision') THEN
        NEW.en_revision_desde := NOW();
      END IF;
      RETURN NEW;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: apelaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apelaciones (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    sancion_id integer,
    baneo_id integer,
    campana_id integer,
    decision jsonb NOT NULL,
    motivo text NOT NULL,
    estado character varying(10) DEFAULT 'pendiente'::character varying NOT NULL,
    respuesta text,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    resuelta_en timestamp with time zone,
    CONSTRAINT apelaciones_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aceptada'::character varying, 'rechazada'::character varying])::text[]))),
    CONSTRAINT apelaciones_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['sancion'::character varying, 'baneo_campana'::character varying])::text[])))
);


--
-- Name: apelaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.apelaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: apelaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.apelaciones_id_seq OWNED BY public.apelaciones.id;


--
-- Name: aporte_respuestas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aporte_respuestas (
    aporte_id integer NOT NULL,
    opcion_id integer NOT NULL
);


--
-- Name: aportes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aportes (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    user_id integer,
    participant_name character varying(160) NOT NULL,
    participant_email character varying(200),
    description text NOT NULL,
    file_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    rejection_reason text,
    first_pass_by character varying(160),
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_pass_by_user_id integer,
    enlace_id integer,
    anonimo_id character(64),
    inapropiado boolean DEFAULT false NOT NULL,
    inapropiado_por integer,
    inapropiado_en timestamp with time zone,
    consentimiento_en timestamp with time zone,
    calificacion smallint,
    archivo_id integer,
    calidad character varying(12),
    calidad_origen character varying(15),
    calidad_asignada_en timestamp with time zone,
    exp_otorgada integer,
    invalidado_en timestamp with time zone,
    invalidacion_motivo text,
    CONSTRAINT aportes_calificacion_check CHECK (((calificacion >= 1) AND (calificacion <= 5))),
    CONSTRAINT aportes_status_check CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'espera_final'::character varying, 'aceptado'::character varying, 'rechazado'::character varying])::text[])))
);


--
-- Name: COLUMN aportes.calificacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aportes.calificacion IS 'Calificación de 1 a 5 (SRS v1.2): su multiplicador da la EXP del aporte (lib/gamificacion/recompensas.ts).';


--
-- Name: COLUMN aportes.calidad; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aportes.calidad IS 'OBSOLETA (SRS v1.2): la escala que da EXP es aportes.calificacion.';


--
-- Name: COLUMN aportes.exp_otorgada; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aportes.exp_otorgada IS 'EXP que dio el aporte al aceptarse; 0 si no le tocaba; NULL si aún no se procesa (lib/gamificacion/recompensas.ts).';


--
-- Name: aportes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aportes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aportes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aportes_id_seq OWNED BY public.aportes.id;


--
-- Name: archivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archivos (
    id integer NOT NULL,
    ruta character varying(500) NOT NULL,
    nombre_original character varying(255),
    mime character varying(100),
    tamano_bytes integer,
    borrado_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: archivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.archivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: archivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.archivos_id_seq OWNED BY public.archivos.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    actor_tipo character varying(20) NOT NULL,
    actor_id integer,
    accion character varying(60) NOT NULL,
    objetivo_tipo character varying(30),
    objetivo_id character varying(40),
    detalle jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_actor_tipo_check CHECK (((actor_tipo)::text = ANY (ARRAY[('usuario'::character varying)::text, ('superusuario'::character varying)::text, ('anonimo'::character varying)::text])))
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: campana_baneados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_baneados (
    id integer NOT NULL,
    campana_id integer NOT NULL,
    usuario_id integer NOT NULL,
    motivo text NOT NULL,
    baneado_por integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campana_baneados_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campana_baneados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campana_baneados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campana_baneados_id_seq OWNED BY public.campana_baneados.id;


--
-- Name: campana_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_checklists (
    id integer NOT NULL,
    campana_id integer NOT NULL,
    titulo character varying(120) DEFAULT ''::character varying NOT NULL,
    tipo character varying(20),
    orden smallint DEFAULT 1 NOT NULL,
    retirado_en timestamp with time zone,
    CONSTRAINT campana_checklists_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('texto'::character varying)::text, ('foto'::character varying)::text, ('video'::character varying)::text, ('audio'::character varying)::text, ('documento'::character varying)::text])))
);


--
-- Name: campana_checklists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campana_checklists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campana_checklists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campana_checklists_id_seq OWNED BY public.campana_checklists.id;


--
-- Name: campana_cuota_bonos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_cuota_bonos (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    campana_id integer NOT NULL,
    cuota integer NOT NULL,
    exp_referencia integer DEFAULT 0 NOT NULL,
    bono integer DEFAULT 0 NOT NULL,
    estado character varying(10) DEFAULT 'concedido'::character varying NOT NULL,
    exp_movimiento_id bigint,
    completada_en timestamp with time zone DEFAULT now() NOT NULL,
    revertida_en timestamp with time zone,
    CONSTRAINT campana_cuota_bonos_bono_check CHECK ((bono >= 0)),
    CONSTRAINT campana_cuota_bonos_cuota_check CHECK ((cuota > 0)),
    CONSTRAINT campana_cuota_bonos_estado_check CHECK (((estado)::text = ANY (ARRAY[('concedido'::character varying)::text, ('revertido'::character varying)::text]))),
    CONSTRAINT campana_cuota_bonos_exp_referencia_check CHECK ((exp_referencia >= 0))
);


--
-- Name: campana_cuota_bonos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campana_cuota_bonos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campana_cuota_bonos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campana_cuota_bonos_id_seq OWNED BY public.campana_cuota_bonos.id;


--
-- Name: campana_datos_abiertos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_datos_abiertos (
    campana_id integer NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    motivo text,
    decidido_por integer,
    por_superusuario boolean DEFAULT false NOT NULL,
    decidido_en timestamp with time zone,
    CONSTRAINT campana_datos_abiertos_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('publicada'::character varying)::text, ('no_publicada'::character varying)::text])))
);


--
-- Name: campana_enlaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_enlaces (
    id integer NOT NULL,
    campana_id integer NOT NULL,
    token character varying(32) NOT NULL,
    creado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    revocado_en timestamp with time zone,
    visitas integer DEFAULT 0 NOT NULL
);


--
-- Name: campana_enlaces_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campana_enlaces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campana_enlaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campana_enlaces_id_seq OWNED BY public.campana_enlaces.id;


--
-- Name: campana_especial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_especial (
    campana_id integer NOT NULL,
    inicio date NOT NULL,
    fin date NOT NULL,
    multiplicador smallint NOT NULL,
    insignia character varying(40),
    CONSTRAINT campana_especial_check CHECK ((fin >= inicio)),
    CONSTRAINT campana_especial_multiplicador_check CHECK (((multiplicador >= 1) AND (multiplicador <= 3)))
);


--
-- Name: campana_estadisticas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_estadisticas (
    campana_id integer NOT NULL,
    current_contributions integer DEFAULT 0 NOT NULL,
    approved_contributions integer DEFAULT 0 NOT NULL,
    pending_contributions integer DEFAULT 0 NOT NULL,
    rejected_contributions integer DEFAULT 0 NOT NULL,
    participants integer DEFAULT 0 NOT NULL,
    downloads_count integer DEFAULT 0 NOT NULL,
    ultimo_hito_avisado smallint DEFAULT 0 NOT NULL
);


--
-- Name: campana_etiquetas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_etiquetas (
    campana_id integer NOT NULL,
    etiqueta_id integer NOT NULL
);


--
-- Name: campana_inscripciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_inscripciones (
    campana_id integer NOT NULL,
    usuario_id integer NOT NULL,
    aceptada_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campana_revisores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_revisores (
    id integer NOT NULL,
    campana_id integer NOT NULL,
    usuario_id integer NOT NULL,
    estado character varying(20) DEFAULT 'invitado'::character varying NOT NULL,
    invitado_en timestamp with time zone DEFAULT now() NOT NULL,
    aceptado_en timestamp with time zone,
    CONSTRAINT campana_revisores_estado_check CHECK (((estado)::text = ANY (ARRAY[('invitado'::character varying)::text, ('aceptado'::character varying)::text, ('rechazado'::character varying)::text])))
);


--
-- Name: campana_revisores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campana_revisores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campana_revisores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campana_revisores_id_seq OWNED BY public.campana_revisores.id;


--
-- Name: campana_supervisores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_supervisores (
    id integer NOT NULL,
    campana_id integer NOT NULL,
    supervisor_id integer,
    accion character varying(30) NOT NULL,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    por_superusuario boolean DEFAULT false NOT NULL,
    en_revision_desde timestamp with time zone,
    CONSTRAINT campana_supervisores_accion_check CHECK (((accion)::text = ANY (ARRAY[('aceptada'::character varying)::text, ('rechazada'::character varying)::text, ('reportada'::character varying)::text, ('reasignada'::character varying)::text]))),
    CONSTRAINT campana_supervisores_autor_check CHECK (((supervisor_id IS NOT NULL) OR por_superusuario))
);


--
-- Name: campana_supervisores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campana_supervisores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campana_supervisores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campana_supervisores_id_seq OWNED BY public.campana_supervisores.id;


--
-- Name: campana_tipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campana_tipos (
    campana_id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    orden smallint DEFAULT 1 NOT NULL,
    limite integer,
    enviados integer DEFAULT 0 NOT NULL,
    formatos jsonb,
    cuota_por_persona integer,
    CONSTRAINT campana_tipos_check CHECK ((((tipo)::text = 'documento'::text) OR (formatos IS NULL))),
    CONSTRAINT campana_tipos_cuota_por_persona_check CHECK ((cuota_por_persona > 0)),
    CONSTRAINT campana_tipos_limite_check CHECK ((limite > 0)),
    CONSTRAINT campana_tipos_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('texto'::character varying)::text, ('foto'::character varying)::text, ('video'::character varying)::text, ('audio'::character varying)::text, ('documento'::character varying)::text])))
);


--
-- Name: campanas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campanas (
    id integer NOT NULL,
    creator_id integer NOT NULL,
    creator_name character varying(120) NOT NULL,
    supervisor_id integer,
    name character varying(200) NOT NULL,
    description text NOT NULL,
    tag character varying(120) NOT NULL,
    status character varying(50) DEFAULT 'borrador'::character varying NOT NULL,
    collection_mode character varying(20) DEFAULT 'checklist'::character varying NOT NULL,
    goal_contributions integer DEFAULT 0 NOT NULL,
    quota_per_user integer DEFAULT 1 NOT NULL,
    start_date date,
    end_date date,
    location_city character varying(120),
    location_state character varying(120),
    location_colonia character varying(150),
    organizer character varying(160),
    xp_per_contribution integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    supervisado_por_root boolean DEFAULT false NOT NULL,
    permite_anonimos boolean DEFAULT false NOT NULL,
    pausa_por character varying(20),
    pausa_motivo text,
    pausada_en timestamp with time zone,
    todo_el_pais boolean DEFAULT false NOT NULL,
    tematica character varying(120) NOT NULL,
    proposito character varying(40),
    proposito_otro character varying(80),
    espera_activacion boolean DEFAULT false NOT NULL,
    ajustes_en timestamp with time zone,
    banner_path character varying(500),
    banner_scale numeric(4,2) DEFAULT 1 NOT NULL,
    banner_position_x numeric(5,2) DEFAULT 50 NOT NULL,
    banner_position_y numeric(5,2) DEFAULT 50 NOT NULL,
    en_revision_desde timestamp with time zone,
    porcentaje_anonimos smallint,
    CONSTRAINT campanas_collection_mode_check CHECK (((collection_mode)::text = ANY ((ARRAY['checklist'::character varying, 'texto_libre'::character varying])::text[]))),
    CONSTRAINT campanas_pausa_por_check CHECK (((pausa_por)::text = ANY ((ARRAY['creador'::character varying, 'supervision'::character varying])::text[]))),
    CONSTRAINT campanas_porcentaje_anonimos_check CHECK (((porcentaje_anonimos IS NULL) OR ((porcentaje_anonimos >= 1) AND (porcentaje_anonimos <= 100)))),
    CONSTRAINT campanas_proposito_check CHECK (((proposito)::text = ANY ((ARRAY['investigacion_cientifica'::character varying, 'desarrollo_ia'::character varying, 'monitoreo'::character varying, 'prevencion'::character varying, 'diagnostico'::character varying, 'educacion'::character varying, 'planeacion'::character varying, 'toma_de_decisiones'::character varying, 'concientizacion'::character varying, 'desarrollo_tecnologico'::character varying, 'politicas_publicas'::character varying, 'otro'::character varying])::text[]))),
    CONSTRAINT campanas_status_check CHECK (((status)::text = ANY ((ARRAY['borrador'::character varying, 'en_revision'::character varying, 'aceptada'::character varying, 'activa'::character varying, 'pausada'::character varying, 'rechazada'::character varying, 'finalizada'::character varying])::text[])))
);


--
-- Name: COLUMN campanas.xp_per_contribution; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campanas.xp_per_contribution IS 'OBSOLETA (gamificación SRS v1.1): la EXP base sale de parametros_gamificacion.';


--
-- Name: campanas_guardadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campanas_guardadas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    campana_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campanas_guardadas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campanas_guardadas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campanas_guardadas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campanas_guardadas_id_seq OWNED BY public.campanas_guardadas.id;


--
-- Name: campanas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campanas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campanas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campanas_id_seq OWNED BY public.campanas.id;


--
-- Name: checklist_opciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_opciones (
    id integer NOT NULL,
    checklist_id integer NOT NULL,
    texto character varying(255) NOT NULL,
    orden smallint DEFAULT 1 NOT NULL,
    retirada_en timestamp with time zone
);


--
-- Name: checklist_opciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checklist_opciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checklist_opciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checklist_opciones_id_seq OWNED BY public.checklist_opciones.id;


--
-- Name: codigos_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codigos_usuario (
    usuario_id integer NOT NULL,
    proposito character varying(20) NOT NULL,
    codigo_hash character varying(64) NOT NULL,
    vence_en timestamp with time zone NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    enviado_en timestamp with time zone DEFAULT now() NOT NULL,
    ficha_hash character varying(64),
    ficha_creada_en timestamp with time zone,
    envios_en_hora integer DEFAULT 0 NOT NULL,
    envios_desde timestamp with time zone,
    CONSTRAINT codigos_usuario_proposito_check CHECK (((proposito)::text = ANY (ARRAY[('verificacion'::character varying)::text, ('contrasena'::character varying)::text])))
);


--
-- Name: dispositivos_bloqueados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispositivos_bloqueados (
    id integer NOT NULL,
    anonimo_id character(64) NOT NULL,
    campana_id integer,
    motivo text NOT NULL,
    bloqueado_por integer,
    aporte_id integer,
    hasta timestamp with time zone,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    restaurado_en timestamp with time zone
);


--
-- Name: dispositivos_bloqueados_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dispositivos_bloqueados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispositivos_bloqueados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dispositivos_bloqueados_id_seq OWNED BY public.dispositivos_bloqueados.id;


--
-- Name: especialidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.especialidades (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    clave character varying(150) NOT NULL,
    origen character varying(10) DEFAULT 'usuario'::character varying NOT NULL,
    creada_por integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT especialidades_origen_check CHECK (((origen)::text = ANY ((ARRAY['base'::character varying, 'usuario'::character varying, 'panel'::character varying])::text[])))
);


--
-- Name: especialidades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.especialidades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: especialidades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.especialidades_id_seq OWNED BY public.especialidades.id;


--
-- Name: etiquetas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etiquetas (
    id integer NOT NULL,
    tematica_id integer NOT NULL,
    nombre character varying(60) NOT NULL,
    clave character varying(60) NOT NULL,
    origen character varying(10) DEFAULT 'usuario'::character varying NOT NULL,
    creada_por integer,
    aprobada boolean DEFAULT false NOT NULL,
    oculta boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT etiquetas_origen_check CHECK (((origen)::text = ANY (ARRAY[('panel'::character varying)::text, ('usuario'::character varying)::text])))
);


--
-- Name: etiquetas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.etiquetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: etiquetas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.etiquetas_id_seq OWNED BY public.etiquetas.id;


--
-- Name: exp_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exp_movimientos (
    id bigint NOT NULL,
    usuario_id integer,
    anonimizado_en timestamp with time zone,
    tipo character varying(25) NOT NULL,
    exp integer NOT NULL,
    motivo text,
    aporte_id integer,
    campana_id integer,
    mision_instancia_id bigint,
    movimiento_original_id bigint,
    exp_base integer,
    calidad character varying(12),
    mult_calidad numeric(4,2),
    mult_campana numeric(4,2),
    potenciador_id integer,
    bonificacion_potenciador numeric(3,2),
    factor numeric(4,2),
    parametros_version integer,
    clave_idempotencia character varying(120) NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    calificacion smallint,
    CONSTRAINT exp_movimientos_calidad_check CHECK (((calidad)::text = ANY (ARRAY[('buena'::character varying)::text, ('excelente'::character varying)::text, ('excepcional'::character varying)::text]))),
    CONSTRAINT exp_movimientos_calificacion_check CHECK (((calificacion >= 1) AND (calificacion <= 5))),
    CONSTRAINT exp_movimientos_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('aporte'::character varying)::text, ('mision'::character varying)::text, ('bono_campana'::character varying)::text, ('ajuste_invalidacion'::character varying)::text, ('ajuste_calidad'::character varying)::text, ('ajuste_admin'::character varying)::text])))
);


--
-- Name: exp_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exp_movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exp_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exp_movimientos_id_seq OWNED BY public.exp_movimientos.id;


--
-- Name: lideres_posiciones_semanales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lideres_posiciones_semanales (
    semana_inicio date NOT NULL,
    categoria character varying(15) NOT NULL,
    usuario_id integer NOT NULL,
    posicion integer NOT NULL,
    calculada_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lideres_posiciones_semanales_categoria_check CHECK (((categoria)::text = ANY (ARRAY[('aportes'::character varying)::text, ('rango'::character varying)::text, ('excelentes'::character varying)::text, ('excepcionales'::character varying)::text]))),
    CONSTRAINT lideres_posiciones_semanales_posicion_check CHECK ((posicion > 0))
);


--
-- Name: lista_negra_correos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lista_negra_correos (
    email character varying(255) NOT NULL,
    usuario_id integer,
    sancion_id integer,
    motivo text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: medalla_ascensos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medalla_ascensos (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    medalla_id integer NOT NULL,
    nivel smallint NOT NULL,
    alcanzado_en timestamp with time zone DEFAULT now() NOT NULL,
    celebracion_vista_en timestamp with time zone
);


--
-- Name: medalla_ascensos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medalla_ascensos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medalla_ascensos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medalla_ascensos_id_seq OWNED BY public.medalla_ascensos.id;


--
-- Name: medalla_niveles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medalla_niveles (
    id integer NOT NULL,
    medalla_id integer NOT NULL,
    nivel smallint NOT NULL,
    nombre character varying(60) NOT NULL,
    umbral integer NOT NULL,
    ilustracion_path character varying(500),
    CONSTRAINT medalla_niveles_nivel_check CHECK ((nivel >= 1)),
    CONSTRAINT medalla_niveles_umbral_check CHECK ((umbral > 0))
);


--
-- Name: medalla_niveles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medalla_niveles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medalla_niveles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medalla_niveles_id_seq OWNED BY public.medalla_niveles.id;


--
-- Name: medallas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medallas (
    id integer NOT NULL,
    nombre character varying(160) NOT NULL,
    descripcion text NOT NULL,
    file_type character varying(20),
    file_path character varying(500),
    file_original_name character varying(255),
    file_mime_type character varying(100),
    file_size_bytes integer,
    criterio jsonb NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    clave character varying(60),
    mide character varying(40),
    grupo character varying(20),
    orden smallint
);


--
-- Name: medallas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medallas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medallas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medallas_id_seq OWNED BY public.medallas.id;


--
-- Name: medallas_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medallas_usuario (
    usuario_id integer NOT NULL,
    medalla_id integer NOT NULL,
    fecha_obtencion timestamp with time zone DEFAULT now() NOT NULL,
    nivel_actual smallint DEFAULT 1 NOT NULL,
    valor_actual integer DEFAULT 0 NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mision_instancia_aportes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mision_instancia_aportes (
    instancia_id bigint NOT NULL,
    aporte_id integer NOT NULL
);


--
-- Name: mision_instancias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mision_instancias (
    id bigint NOT NULL,
    usuario_id integer NOT NULL,
    mision_id integer NOT NULL,
    periodo_inicio timestamp with time zone NOT NULL,
    periodo_fin timestamp with time zone NOT NULL,
    objetivo integer NOT NULL,
    progreso integer DEFAULT 0 NOT NULL,
    completada_en timestamp with time zone,
    recompensa_entregada_en timestamp with time zone,
    recompensa jsonb,
    recompensa_resultado character varying(10),
    objeto_celebrado_en timestamp with time zone,
    CONSTRAINT mision_instancias_check CHECK ((periodo_fin > periodo_inicio)),
    CONSTRAINT mision_instancias_objetivo_check CHECK ((objetivo > 0)),
    CONSTRAINT mision_instancias_progreso_check CHECK ((progreso >= 0)),
    CONSTRAINT mision_instancias_recompensa_resultado_check CHECK (((recompensa_resultado)::text = ANY ((ARRAY['entregada'::character varying, 'cambiada'::character varying, 'perdida'::character varying])::text[])))
);


--
-- Name: mision_instancias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mision_instancias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mision_instancias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mision_instancias_id_seq OWNED BY public.mision_instancias.id;


--
-- Name: misiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.misiones (
    id integer NOT NULL,
    clave character varying(60) NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion text,
    periodicidad character varying(10) NOT NULL,
    condicion jsonb NOT NULL,
    recompensa jsonb DEFAULT '{}'::jsonb NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    grupo character varying(40),
    dificultad character varying(10) DEFAULT 'normal'::character varying NOT NULL,
    CONSTRAINT misiones_dificultad_check CHECK (((dificultad)::text = ANY ((ARRAY['normal'::character varying, 'dificil'::character varying])::text[]))),
    CONSTRAINT misiones_periodicidad_check CHECK (((periodicidad)::text = ANY ((ARRAY['diaria'::character varying, 'semanal'::character varying, 'inicio'::character varying])::text[])))
);


--
-- Name: misiones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.misiones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: misiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.misiones_id_seq OWNED BY public.misiones.id;


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    titulo character varying(180) NOT NULL,
    mensaje text NOT NULL,
    campana_id integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    leida_en timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notificaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notificaciones_id_seq OWNED BY public.notificaciones.id;


--
-- Name: objetos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objetos (
    id integer NOT NULL,
    clave character varying(60) NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion text,
    categoria character varying(30),
    imagen_path character varying(500),
    rango_exclusivo smallint,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: objetos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.objetos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: objetos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.objetos_id_seq OWNED BY public.objetos.id;


--
-- Name: organizaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizaciones (
    id integer NOT NULL,
    nombre character varying(160) NOT NULL,
    clave character varying(160) NOT NULL,
    origen character varying(10) DEFAULT 'usuario'::character varying NOT NULL,
    creada_por integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organizaciones_origen_check CHECK (((origen)::text = ANY (ARRAY[('base'::character varying)::text, ('usuario'::character varying)::text, ('panel'::character varying)::text])))
);


--
-- Name: organizaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizaciones_id_seq OWNED BY public.organizaciones.id;


--
-- Name: parametros_gamificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parametros_gamificacion (
    id integer NOT NULL,
    version integer NOT NULL,
    vigente_desde timestamp with time zone DEFAULT now() NOT NULL,
    lanzamiento_en timestamp with time zone,
    valores jsonb NOT NULL,
    nota text,
    creado_por integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parametros_gamificacion_version_check CHECK ((version > 0))
);


--
-- Name: parametros_gamificacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.parametros_gamificacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parametros_gamificacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.parametros_gamificacion_id_seq OWNED BY public.parametros_gamificacion.id;


--
-- Name: potenciadores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.potenciadores (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    estado character varying(10) DEFAULT 'espera'::character varying NOT NULL,
    bonificacion numeric(3,2) DEFAULT 0.50 NOT NULL,
    duracion_minutos smallint DEFAULT 15 NOT NULL,
    origen character varying(40),
    obtenido_en timestamp with time zone DEFAULT now() NOT NULL,
    activado_en timestamp with time zone,
    vence_en timestamp with time zone,
    clave_idempotencia character varying(120) NOT NULL,
    CONSTRAINT potenciadores_bonificacion_check CHECK ((bonificacion > (0)::numeric)),
    CONSTRAINT potenciadores_check CHECK ((((estado)::text <> ALL (ARRAY[('activo'::character varying)::text, ('expirado'::character varying)::text])) OR ((activado_en IS NOT NULL) AND (vence_en IS NOT NULL)))),
    CONSTRAINT potenciadores_check1 CHECK (((vence_en IS NULL) OR (vence_en > activado_en))),
    CONSTRAINT potenciadores_duracion_minutos_check CHECK ((duracion_minutos > 0)),
    CONSTRAINT potenciadores_estado_check CHECK (((estado)::text = ANY ((ARRAY['espera'::character varying, 'guardado'::character varying, 'activo'::character varying, 'expirado'::character varying, 'perdido'::character varying])::text[])))
);


--
-- Name: potenciadores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.potenciadores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: potenciadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.potenciadores_id_seq OWNED BY public.potenciadores.id;


--
-- Name: push_suscripciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_suscripciones (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent character varying(300),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_envio_en timestamp with time zone
);


--
-- Name: push_suscripciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_suscripciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_suscripciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_suscripciones_id_seq OWNED BY public.push_suscripciones.id;


--
-- Name: racha_dias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.racha_dias (
    usuario_id integer NOT NULL,
    dia date NOT NULL,
    estado character varying(15) NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT racha_dias_estado_check CHECK (((estado)::text = ANY ((ARRAY['confirmado'::character varying, 'protegido'::character varying, 'sin_actividad'::character varying, 'suspendido'::character varying])::text[])))
);


--
-- Name: racha_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.racha_eventos (
    id bigint NOT NULL,
    usuario_id integer NOT NULL,
    tipo character varying(25) NOT NULL,
    dia date,
    aporte_id integer,
    detalle jsonb DEFAULT '{}'::jsonb NOT NULL,
    clave_idempotencia character varying(120) NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT racha_eventos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['protector_consumido'::character varying, 'racha_interrumpida'::character varying, 'racha_recuperada'::character varying])::text[])))
);


--
-- Name: racha_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.racha_eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: racha_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.racha_eventos_id_seq OWNED BY public.racha_eventos.id;


--
-- Name: rango_ascensos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rango_ascensos (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    rango smallint NOT NULL,
    alcanzado_en timestamp with time zone DEFAULT now() NOT NULL,
    requisitos jsonb NOT NULL,
    recompensas jsonb DEFAULT '[]'::jsonb NOT NULL,
    celebracion_vista_en timestamp with time zone
);


--
-- Name: rango_ascensos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rango_ascensos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rango_ascensos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rango_ascensos_id_seq OWNED BY public.rango_ascensos.id;


--
-- Name: rangos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rangos (
    numero smallint NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    insignia_path character varying(500),
    etapa_avatar smallint,
    req_exp integer DEFAULT 0 NOT NULL,
    req_aportes integer DEFAULT 0 NOT NULL,
    req_excelentes integer DEFAULT 0 NOT NULL,
    req_excepcionales integer DEFAULT 0 NOT NULL,
    req_racha integer DEFAULT 0 NOT NULL,
    req_misiones integer DEFAULT 0 NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rangos_check CHECK (((req_excepcionales <= req_excelentes) AND (req_excelentes <= req_aportes))),
    CONSTRAINT rangos_numero_check CHECK ((numero > 0)),
    CONSTRAINT rangos_req_aportes_check CHECK ((req_aportes >= 0)),
    CONSTRAINT rangos_req_excelentes_check CHECK ((req_excelentes >= 0)),
    CONSTRAINT rangos_req_excepcionales_check CHECK ((req_excepcionales >= 0)),
    CONSTRAINT rangos_req_exp_check CHECK ((req_exp >= 0)),
    CONSTRAINT rangos_req_misiones_check CHECK ((req_misiones >= 0)),
    CONSTRAINT rangos_req_racha_check CHECK ((req_racha >= 0))
);


--
-- Name: rechazo_campanas_similares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rechazo_campanas_similares (
    dictamen_id integer NOT NULL,
    campana_id integer NOT NULL,
    orden smallint DEFAULT 0 NOT NULL
);


--
-- Name: reportes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reportes (
    id integer NOT NULL,
    tipo character varying(10) NOT NULL,
    campana_id integer NOT NULL,
    aporte_id integer,
    reportado_id integer,
    reportado_por integer,
    motivo character varying(120),
    descripcion text,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    nota_de_resolucion text,
    sancion_id integer,
    resuelto_en timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    por_superusuario boolean DEFAULT false NOT NULL,
    origen character varying(20) DEFAULT 'usuario'::character varying NOT NULL,
    ticket_id integer,
    CONSTRAINT reportes_check CHECK (((motivo IS NOT NULL) OR (descripcion IS NOT NULL))),
    CONSTRAINT reportes_check1 CHECK ((((tipo)::text = 'aporte'::text) OR (aporte_id IS NULL))),
    CONSTRAINT reportes_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'descartado'::character varying, 'sancionado'::character varying])::text[]))),
    CONSTRAINT reportes_origen_check CHECK (((origen)::text = ANY ((ARRAY['usuario'::character varying, 'rechazo'::character varying, 'supervision'::character varying])::text[]))),
    CONSTRAINT reportes_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('campana'::character varying)::text, ('aporte'::character varying)::text])))
);


--
-- Name: reportes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reportes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reportes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reportes_id_seq OWNED BY public.reportes.id;


--
-- Name: root_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.root_sessions (
    id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: root_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.root_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: root_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.root_sessions_id_seq OWNED BY public.root_sessions.id;


--
-- Name: sanciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sanciones (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    tipo character varying(30) NOT NULL,
    detalle text NOT NULL,
    dias integer,
    aplicada_en timestamp with time zone DEFAULT now() NOT NULL,
    aplicada_por character varying(120) DEFAULT 'SuperUsuario'::character varying NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    restaurada_en timestamp with time zone,
    anulada_en timestamp with time zone,
    CONSTRAINT sanciones_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['STRIKE'::character varying, 'SUSPENSION_TEMPORAL'::character varying, 'BANEO_DE_CAMPANA'::character varying])::text[])))
);


--
-- Name: sanciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sanciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sanciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sanciones_id_seq OWNED BY public.sanciones.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    usuario_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: tematicas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tematicas (
    id integer NOT NULL,
    nombre character varying(60) NOT NULL,
    clave character varying(60) NOT NULL,
    origen character varying(10) DEFAULT 'usuario'::character varying NOT NULL,
    creada_por integer,
    oculta boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    aprobada boolean DEFAULT true NOT NULL,
    etiquetas_sembradas boolean DEFAULT false NOT NULL,
    CONSTRAINT tematicas_origen_check CHECK (((origen)::text = ANY ((ARRAY['base'::character varying, 'usuario'::character varying, 'panel'::character varying])::text[])))
);


--
-- Name: tematicas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tematicas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tematicas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tematicas_id_seq OWNED BY public.tematicas.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    estado character varying(10) DEFAULT 'pendiente'::character varying NOT NULL,
    supervisor_id integer,
    usuario_id integer,
    campana_id integer,
    datos jsonb NOT NULL,
    respuesta text,
    resultado jsonb,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    resuelto_en timestamp with time zone,
    CONSTRAINT tickets_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobado'::character varying, 'rechazado'::character varying])::text[]))),
    CONSTRAINT tickets_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['sancion'::character varying, 'datos_abiertos'::character varying])::text[])))
);


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: usuario_avisos_de_zona; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_avisos_de_zona (
    usuario_id integer NOT NULL,
    estado character varying(80) NOT NULL,
    municipio character varying(120) NOT NULL,
    avisado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuario_contadores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_contadores (
    usuario_id integer NOT NULL,
    dimension character varying(10) NOT NULL,
    clave character varying(120) NOT NULL,
    valor integer DEFAULT 0 NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT usuario_contadores_check CHECK ((((dimension)::text <> 'tipo'::text) OR ((clave)::text = ANY (ARRAY[('texto'::character varying)::text, ('foto'::character varying)::text, ('video'::character varying)::text, ('audio'::character varying)::text, ('documento'::character varying)::text])))),
    CONSTRAINT usuario_contadores_dimension_check CHECK (((dimension)::text = ANY (ARRAY[('tipo'::character varying)::text, ('campana'::character varying)::text, ('tematica'::character varying)::text]))),
    CONSTRAINT usuario_contadores_valor_check CHECK ((valor >= 0))
);


--
-- Name: usuario_etiquetas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_etiquetas (
    usuario_id integer NOT NULL,
    etiqueta_id integer NOT NULL
);


--
-- Name: usuario_objetos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_objetos (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    objeto_id integer NOT NULL,
    obtenido_en timestamp with time zone DEFAULT now() NOT NULL,
    equipado boolean DEFAULT false NOT NULL,
    clave_idempotencia character varying(120) NOT NULL
);


--
-- Name: usuario_objetos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_objetos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_objetos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_objetos_id_seq OWNED BY public.usuario_objetos.id;


--
-- Name: usuario_preferencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_preferencias (
    usuario_id integer NOT NULL,
    avisos_campanas_nuevas boolean DEFAULT true NOT NULL,
    avisos_aportes boolean DEFAULT true NOT NULL,
    recordatorio_semanal boolean DEFAULT false NOT NULL,
    resumen_mensual boolean DEFAULT true NOT NULL,
    notificaciones_activas boolean DEFAULT true NOT NULL,
    ultimo_recordatorio date,
    ultimo_resumen date,
    avisos_gamificacion jsonb DEFAULT '{}'::jsonb NOT NULL,
    oculto_en_lideres boolean DEFAULT false NOT NULL
);


--
-- Name: usuario_progreso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_progreso (
    usuario_id integer NOT NULL,
    rango_actual smallint DEFAULT 1 NOT NULL,
    exp_total integer DEFAULT 0 NOT NULL,
    aportes_aceptados integer DEFAULT 0 NOT NULL,
    aportes_excelentes integer DEFAULT 0 NOT NULL,
    aportes_excepcionales integer DEFAULT 0 NOT NULL,
    misiones_completadas integer DEFAULT 0 NOT NULL,
    campanas_completadas integer DEFAULT 0 NOT NULL,
    racha_actual integer DEFAULT 0 NOT NULL,
    racha_maxima integer DEFAULT 0 NOT NULL,
    ultimo_dia_activo date,
    protectores smallint DEFAULT 0 NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    aviso_racha_dia date,
    CONSTRAINT usuario_progreso_aportes_aceptados_check CHECK ((aportes_aceptados >= 0)),
    CONSTRAINT usuario_progreso_aportes_excelentes_check CHECK ((aportes_excelentes >= 0)),
    CONSTRAINT usuario_progreso_aportes_excepcionales_check CHECK ((aportes_excepcionales >= 0)),
    CONSTRAINT usuario_progreso_campanas_completadas_check CHECK ((campanas_completadas >= 0)),
    CONSTRAINT usuario_progreso_exp_total_check CHECK ((exp_total >= 0)),
    CONSTRAINT usuario_progreso_misiones_completadas_check CHECK ((misiones_completadas >= 0)),
    CONSTRAINT usuario_progreso_protectores_check CHECK (((protectores >= 0) AND (protectores <= 3))),
    CONSTRAINT usuario_progreso_racha_actual_check CHECK ((racha_actual >= 0)),
    CONSTRAINT usuario_progreso_racha_maxima_check CHECK ((racha_maxima >= 0))
);


--
-- Name: usuario_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_roles (
    usuario_id integer NOT NULL,
    rol character varying(20) NOT NULL,
    asignado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT usuario_roles_rol_check CHECK (((rol)::text = ANY ((ARRAY['usuario'::character varying, 'creador'::character varying, 'aportador'::character varying, 'supervisor'::character varying, 'revisor'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: usuario_zona_detectada; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_zona_detectada (
    usuario_id integer NOT NULL,
    estado character varying(80) NOT NULL,
    municipio character varying(120) NOT NULL,
    detectada_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    apellidos character varying(120) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    state character varying(100),
    city character varying(100),
    specialty character varying(150),
    intereses jsonb DEFAULT '[]'::jsonb NOT NULL,
    xp_total integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    streak_days integer DEFAULT 0 NOT NULL,
    email_verificado boolean DEFAULT false NOT NULL,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    google_id character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    baja_solicitada_en timestamp with time zone,
    baja_efectiva_en timestamp with time zone,
    baja_destino_aportes character varying(20),
    eliminada_en timestamp with time zone,
    intereses_texto character varying(500),
    avatar character varying(12),
    avatar_foto character varying(500),
    organizacion character varying(160),
    bienvenida_vista boolean DEFAULT false NOT NULL,
    primer_inicio_sesion_en timestamp with time zone,
    intereses_actualizados_en timestamp with time zone,
    CONSTRAINT usuarios_avatar_check CHECK (((avatar)::text = ANY ((ARRAY['masculino'::character varying, 'femenino'::character varying, 'otro'::character varying, 'foto'::character varying])::text[]))),
    CONSTRAINT usuarios_baja_destino_aportes_check CHECK (((baja_destino_aportes)::text = ANY ((ARRAY['eliminar'::character varying, 'anonimizar'::character varying, 'autoria'::character varying])::text[])))
);


--
-- Name: COLUMN usuarios.xp_total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usuarios.xp_total IS 'OBSOLETA (gamificación SRS v1.1): histórico. La EXP está en usuario_progreso.exp_total.';


--
-- Name: COLUMN usuarios.level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usuarios.level IS 'OBSOLETA (gamificación SRS v1.1): histórico. El rango está en usuario_progreso.rango_actual.';


--
-- Name: COLUMN usuarios.streak_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usuarios.streak_days IS 'OBSOLETA (gamificación SRS v1.1): histórico. La racha está en usuario_progreso.racha_actual.';


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: verificaciones_senuelo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verificaciones_senuelo (
    ficha_hash character varying(64) NOT NULL,
    email character varying(255) NOT NULL,
    vence_en timestamp with time zone NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    enviado_en timestamp with time zone DEFAULT now() NOT NULL,
    envios_en_hora integer DEFAULT 1 NOT NULL,
    envios_desde timestamp with time zone DEFAULT now() NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: apelaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apelaciones ALTER COLUMN id SET DEFAULT nextval('public.apelaciones_id_seq'::regclass);


--
-- Name: aportes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aportes ALTER COLUMN id SET DEFAULT nextval('public.aportes_id_seq'::regclass);


--
-- Name: archivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos ALTER COLUMN id SET DEFAULT nextval('public.archivos_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: campana_baneados id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_baneados ALTER COLUMN id SET DEFAULT nextval('public.campana_baneados_id_seq'::regclass);


--
-- Name: campana_checklists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_checklists ALTER COLUMN id SET DEFAULT nextval('public.campana_checklists_id_seq'::regclass);


--
-- Name: campana_cuota_bonos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_cuota_bonos ALTER COLUMN id SET DEFAULT nextval('public.campana_cuota_bonos_id_seq'::regclass);


--
-- Name: campana_enlaces id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_enlaces ALTER COLUMN id SET DEFAULT nextval('public.campana_enlaces_id_seq'::regclass);


--
-- Name: campana_revisores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_revisores ALTER COLUMN id SET DEFAULT nextval('public.campana_revisores_id_seq'::regclass);


--
-- Name: campana_supervisores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_supervisores ALTER COLUMN id SET DEFAULT nextval('public.campana_supervisores_id_seq'::regclass);


--
-- Name: campanas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanas ALTER COLUMN id SET DEFAULT nextval('public.campanas_id_seq'::regclass);


--
-- Name: campanas_guardadas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanas_guardadas ALTER COLUMN id SET DEFAULT nextval('public.campanas_guardadas_id_seq'::regclass);


--
-- Name: checklist_opciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_opciones ALTER COLUMN id SET DEFAULT nextval('public.checklist_opciones_id_seq'::regclass);


--
-- Name: dispositivos_bloqueados id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos_bloqueados ALTER COLUMN id SET DEFAULT nextval('public.dispositivos_bloqueados_id_seq'::regclass);


--
-- Name: especialidades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades ALTER COLUMN id SET DEFAULT nextval('public.especialidades_id_seq'::regclass);


--
-- Name: etiquetas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etiquetas ALTER COLUMN id SET DEFAULT nextval('public.etiquetas_id_seq'::regclass);


--
-- Name: exp_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos ALTER COLUMN id SET DEFAULT nextval('public.exp_movimientos_id_seq'::regclass);


--
-- Name: medalla_ascensos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medalla_ascensos ALTER COLUMN id SET DEFAULT nextval('public.medalla_ascensos_id_seq'::regclass);


--
-- Name: medalla_niveles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medalla_niveles ALTER COLUMN id SET DEFAULT nextval('public.medalla_niveles_id_seq'::regclass);


--
-- Name: medallas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medallas ALTER COLUMN id SET DEFAULT nextval('public.medallas_id_seq'::regclass);


--
-- Name: mision_instancias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mision_instancias ALTER COLUMN id SET DEFAULT nextval('public.mision_instancias_id_seq'::regclass);


--
-- Name: misiones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.misiones ALTER COLUMN id SET DEFAULT nextval('public.misiones_id_seq'::regclass);


--
-- Name: notificaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_id_seq'::regclass);


--
-- Name: objetos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objetos ALTER COLUMN id SET DEFAULT nextval('public.objetos_id_seq'::regclass);


--
-- Name: organizaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizaciones ALTER COLUMN id SET DEFAULT nextval('public.organizaciones_id_seq'::regclass);


--
-- Name: parametros_gamificacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros_gamificacion ALTER COLUMN id SET DEFAULT nextval('public.parametros_gamificacion_id_seq'::regclass);


--
-- Name: potenciadores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potenciadores ALTER COLUMN id SET DEFAULT nextval('public.potenciadores_id_seq'::regclass);


--
-- Name: push_suscripciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_suscripciones ALTER COLUMN id SET DEFAULT nextval('public.push_suscripciones_id_seq'::regclass);


--
-- Name: racha_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racha_eventos ALTER COLUMN id SET DEFAULT nextval('public.racha_eventos_id_seq'::regclass);


--
-- Name: rango_ascensos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rango_ascensos ALTER COLUMN id SET DEFAULT nextval('public.rango_ascensos_id_seq'::regclass);


--
-- Name: reportes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes ALTER COLUMN id SET DEFAULT nextval('public.reportes_id_seq'::regclass);


--
-- Name: root_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.root_sessions ALTER COLUMN id SET DEFAULT nextval('public.root_sessions_id_seq'::regclass);


--
-- Name: sanciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sanciones ALTER COLUMN id SET DEFAULT nextval('public.sanciones_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: tematicas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tematicas ALTER COLUMN id SET DEFAULT nextval('public.tematicas_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: usuario_objetos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_objetos ALTER COLUMN id SET DEFAULT nextval('public.usuario_objetos_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: apelaciones apelaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apelaciones
    ADD CONSTRAINT apelaciones_pkey PRIMARY KEY (id);


--
-- Name: aporte_respuestas aporte_respuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aporte_respuestas
    ADD CONSTRAINT aporte_respuestas_pkey PRIMARY KEY (aporte_id, opcion_id);


--
-- Name: aportes aportes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aportes
    ADD CONSTRAINT aportes_pkey PRIMARY KEY (id);


--
-- Name: archivos archivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos
    ADD CONSTRAINT archivos_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: campana_baneados campana_baneados_campana_id_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_baneados
    ADD CONSTRAINT campana_baneados_campana_id_usuario_id_key UNIQUE (campana_id, usuario_id);


--
-- Name: campana_baneados campana_baneados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_baneados
    ADD CONSTRAINT campana_baneados_pkey PRIMARY KEY (id);


--
-- Name: campana_checklists campana_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_checklists
    ADD CONSTRAINT campana_checklists_pkey PRIMARY KEY (id);


--
-- Name: campana_cuota_bonos campana_cuota_bonos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_cuota_bonos
    ADD CONSTRAINT campana_cuota_bonos_pkey PRIMARY KEY (id);


--
-- Name: campana_cuota_bonos campana_cuota_bonos_usuario_id_campana_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_cuota_bonos
    ADD CONSTRAINT campana_cuota_bonos_usuario_id_campana_id_key UNIQUE (usuario_id, campana_id);


--
-- Name: campana_datos_abiertos campana_datos_abiertos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_datos_abiertos
    ADD CONSTRAINT campana_datos_abiertos_pkey PRIMARY KEY (campana_id);


--
-- Name: campana_enlaces campana_enlaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_enlaces
    ADD CONSTRAINT campana_enlaces_pkey PRIMARY KEY (id);


--
-- Name: campana_enlaces campana_enlaces_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_enlaces
    ADD CONSTRAINT campana_enlaces_token_key UNIQUE (token);


--
-- Name: campana_especial campana_especial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_especial
    ADD CONSTRAINT campana_especial_pkey PRIMARY KEY (campana_id);


--
-- Name: campana_estadisticas campana_estadisticas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_estadisticas
    ADD CONSTRAINT campana_estadisticas_pkey PRIMARY KEY (campana_id);


--
-- Name: campana_etiquetas campana_etiquetas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_etiquetas
    ADD CONSTRAINT campana_etiquetas_pkey PRIMARY KEY (campana_id, etiqueta_id);


--
-- Name: campana_inscripciones campana_inscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_inscripciones
    ADD CONSTRAINT campana_inscripciones_pkey PRIMARY KEY (campana_id, usuario_id);


--
-- Name: campana_revisores campana_revisores_campana_id_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_revisores
    ADD CONSTRAINT campana_revisores_campana_id_usuario_id_key UNIQUE (campana_id, usuario_id);


--
-- Name: campana_revisores campana_revisores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_revisores
    ADD CONSTRAINT campana_revisores_pkey PRIMARY KEY (id);


--
-- Name: campana_supervisores campana_supervisores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_supervisores
    ADD CONSTRAINT campana_supervisores_pkey PRIMARY KEY (id);


--
-- Name: campana_tipos campana_tipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_tipos
    ADD CONSTRAINT campana_tipos_pkey PRIMARY KEY (campana_id, tipo);


--
-- Name: campanas_guardadas campanas_guardadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanas_guardadas
    ADD CONSTRAINT campanas_guardadas_pkey PRIMARY KEY (id);


--
-- Name: campanas_guardadas campanas_guardadas_usuario_id_campana_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanas_guardadas
    ADD CONSTRAINT campanas_guardadas_usuario_id_campana_id_key UNIQUE (usuario_id, campana_id);


--
-- Name: campanas campanas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanas
    ADD CONSTRAINT campanas_pkey PRIMARY KEY (id);


--
-- Name: checklist_opciones checklist_opciones_checklist_id_texto_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_opciones
    ADD CONSTRAINT checklist_opciones_checklist_id_texto_key UNIQUE (checklist_id, texto);


--
-- Name: checklist_opciones checklist_opciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_opciones
    ADD CONSTRAINT checklist_opciones_pkey PRIMARY KEY (id);


--
-- Name: codigos_usuario codigos_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_usuario
    ADD CONSTRAINT codigos_usuario_pkey PRIMARY KEY (usuario_id, proposito);


--
-- Name: dispositivos_bloqueados dispositivos_bloqueados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos_bloqueados
    ADD CONSTRAINT dispositivos_bloqueados_pkey PRIMARY KEY (id);


--
-- Name: especialidades especialidades_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades
    ADD CONSTRAINT especialidades_clave_key UNIQUE (clave);


--
-- Name: especialidades especialidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades
    ADD CONSTRAINT especialidades_pkey PRIMARY KEY (id);


--
-- Name: etiquetas etiquetas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etiquetas
    ADD CONSTRAINT etiquetas_pkey PRIMARY KEY (id);


--
-- Name: etiquetas etiquetas_tematica_id_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etiquetas
    ADD CONSTRAINT etiquetas_tematica_id_clave_key UNIQUE (tematica_id, clave);


--
-- Name: exp_movimientos exp_movimientos_clave_idempotencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos
    ADD CONSTRAINT exp_movimientos_clave_idempotencia_key UNIQUE (clave_idempotencia);


--
-- Name: exp_movimientos exp_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos
    ADD CONSTRAINT exp_movimientos_pkey PRIMARY KEY (id);


--
-- Name: lideres_posiciones_semanales lideres_posiciones_semanales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lideres_posiciones_semanales
    ADD CONSTRAINT lideres_posiciones_semanales_pkey PRIMARY KEY (semana_inicio, categoria, usuario_id);


--
-- Name: lista_negra_correos lista_negra_correos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lista_negra_correos
    ADD CONSTRAINT lista_negra_correos_pkey PRIMARY KEY (email);


--
-- Name: medalla_ascensos medalla_ascensos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medalla_ascensos
    ADD CONSTRAINT medalla_ascensos_pkey PRIMARY KEY (id);


--
-- Name: medalla_ascensos medalla_ascensos_usuario_id_medalla_id_nivel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medalla_ascensos
    ADD CONSTRAINT medalla_ascensos_usuario_id_medalla_id_nivel_key UNIQUE (usuario_id, medalla_id, nivel);


--
-- Name: medalla_niveles medalla_niveles_medalla_id_nivel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medalla_niveles
    ADD CONSTRAINT medalla_niveles_medalla_id_nivel_key UNIQUE (medalla_id, nivel);


--
-- Name: medalla_niveles medalla_niveles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medalla_niveles
    ADD CONSTRAINT medalla_niveles_pkey PRIMARY KEY (id);


--
-- Name: medallas medallas_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medallas
    ADD CONSTRAINT medallas_clave_key UNIQUE (clave);


--
-- Name: medallas medallas_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medallas
    ADD CONSTRAINT medallas_nombre_key UNIQUE (nombre);


--
-- Name: medallas medallas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medallas
    ADD CONSTRAINT medallas_pkey PRIMARY KEY (id);


--
-- Name: medallas_usuario medallas_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medallas_usuario
    ADD CONSTRAINT medallas_usuario_pkey PRIMARY KEY (usuario_id, medalla_id);


--
-- Name: mision_instancia_aportes mision_instancia_aportes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mision_instancia_aportes
    ADD CONSTRAINT mision_instancia_aportes_pkey PRIMARY KEY (instancia_id, aporte_id);


--
-- Name: mision_instancias mision_instancias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mision_instancias
    ADD CONSTRAINT mision_instancias_pkey PRIMARY KEY (id);


--
-- Name: mision_instancias mision_instancias_usuario_id_mision_id_periodo_inicio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mision_instancias
    ADD CONSTRAINT mision_instancias_usuario_id_mision_id_periodo_inicio_key UNIQUE (usuario_id, mision_id, periodo_inicio);


--
-- Name: misiones misiones_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.misiones
    ADD CONSTRAINT misiones_clave_key UNIQUE (clave);


--
-- Name: misiones misiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.misiones
    ADD CONSTRAINT misiones_pkey PRIMARY KEY (id);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);


--
-- Name: objetos objetos_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objetos
    ADD CONSTRAINT objetos_clave_key UNIQUE (clave);


--
-- Name: objetos objetos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objetos
    ADD CONSTRAINT objetos_pkey PRIMARY KEY (id);


--
-- Name: objetos objetos_rango_exclusivo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objetos
    ADD CONSTRAINT objetos_rango_exclusivo_key UNIQUE (rango_exclusivo);


--
-- Name: organizaciones organizaciones_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizaciones
    ADD CONSTRAINT organizaciones_clave_key UNIQUE (clave);


--
-- Name: organizaciones organizaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizaciones
    ADD CONSTRAINT organizaciones_pkey PRIMARY KEY (id);


--
-- Name: parametros_gamificacion parametros_gamificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros_gamificacion
    ADD CONSTRAINT parametros_gamificacion_pkey PRIMARY KEY (id);


--
-- Name: parametros_gamificacion parametros_gamificacion_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros_gamificacion
    ADD CONSTRAINT parametros_gamificacion_version_key UNIQUE (version);


--
-- Name: potenciadores potenciadores_clave_idempotencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potenciadores
    ADD CONSTRAINT potenciadores_clave_idempotencia_key UNIQUE (clave_idempotencia);


--
-- Name: potenciadores potenciadores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potenciadores
    ADD CONSTRAINT potenciadores_pkey PRIMARY KEY (id);


--
-- Name: push_suscripciones push_suscripciones_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_suscripciones
    ADD CONSTRAINT push_suscripciones_endpoint_key UNIQUE (endpoint);


--
-- Name: push_suscripciones push_suscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_suscripciones
    ADD CONSTRAINT push_suscripciones_pkey PRIMARY KEY (id);


--
-- Name: racha_dias racha_dias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racha_dias
    ADD CONSTRAINT racha_dias_pkey PRIMARY KEY (usuario_id, dia);


--
-- Name: racha_eventos racha_eventos_clave_idempotencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racha_eventos
    ADD CONSTRAINT racha_eventos_clave_idempotencia_key UNIQUE (clave_idempotencia);


--
-- Name: racha_eventos racha_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racha_eventos
    ADD CONSTRAINT racha_eventos_pkey PRIMARY KEY (id);


--
-- Name: rango_ascensos rango_ascensos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rango_ascensos
    ADD CONSTRAINT rango_ascensos_pkey PRIMARY KEY (id);


--
-- Name: rango_ascensos rango_ascensos_usuario_id_rango_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rango_ascensos
    ADD CONSTRAINT rango_ascensos_usuario_id_rango_key UNIQUE (usuario_id, rango);


--
-- Name: rangos rangos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rangos
    ADD CONSTRAINT rangos_pkey PRIMARY KEY (numero);


--
-- Name: rechazo_campanas_similares rechazo_campanas_similares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechazo_campanas_similares
    ADD CONSTRAINT rechazo_campanas_similares_pkey PRIMARY KEY (dictamen_id, campana_id);


--
-- Name: reportes reportes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_pkey PRIMARY KEY (id);


--
-- Name: root_sessions root_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.root_sessions
    ADD CONSTRAINT root_sessions_pkey PRIMARY KEY (id);


--
-- Name: root_sessions root_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.root_sessions
    ADD CONSTRAINT root_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: sanciones sanciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sanciones
    ADD CONSTRAINT sanciones_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: tematicas tematicas_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tematicas
    ADD CONSTRAINT tematicas_clave_key UNIQUE (clave);


--
-- Name: tematicas tematicas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tematicas
    ADD CONSTRAINT tematicas_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: usuario_avisos_de_zona usuario_avisos_de_zona_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_avisos_de_zona
    ADD CONSTRAINT usuario_avisos_de_zona_pkey PRIMARY KEY (usuario_id, estado, municipio);


--
-- Name: usuario_contadores usuario_contadores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_contadores
    ADD CONSTRAINT usuario_contadores_pkey PRIMARY KEY (usuario_id, dimension, clave);


--
-- Name: usuario_etiquetas usuario_etiquetas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_etiquetas
    ADD CONSTRAINT usuario_etiquetas_pkey PRIMARY KEY (usuario_id, etiqueta_id);


--
-- Name: usuario_objetos usuario_objetos_clave_idempotencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_objetos
    ADD CONSTRAINT usuario_objetos_clave_idempotencia_key UNIQUE (clave_idempotencia);


--
-- Name: usuario_objetos usuario_objetos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_objetos
    ADD CONSTRAINT usuario_objetos_pkey PRIMARY KEY (id);


--
-- Name: usuario_preferencias usuario_preferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_preferencias
    ADD CONSTRAINT usuario_preferencias_pkey PRIMARY KEY (usuario_id);


--
-- Name: usuario_progreso usuario_progreso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_progreso
    ADD CONSTRAINT usuario_progreso_pkey PRIMARY KEY (usuario_id);


--
-- Name: usuario_roles usuario_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_roles
    ADD CONSTRAINT usuario_roles_pkey PRIMARY KEY (usuario_id, rol);


--
-- Name: usuario_zona_detectada usuario_zona_detectada_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_zona_detectada
    ADD CONSTRAINT usuario_zona_detectada_pkey PRIMARY KEY (usuario_id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_google_id_key UNIQUE (google_id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: verificaciones_senuelo verificaciones_senuelo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verificaciones_senuelo
    ADD CONSTRAINT verificaciones_senuelo_pkey PRIMARY KEY (ficha_hash);


--
-- Name: apelaciones_campana_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX apelaciones_campana_id_idx ON public.apelaciones USING btree (campana_id);


--
-- Name: apelaciones_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX apelaciones_estado_idx ON public.apelaciones USING btree (estado, creada_en);


--
-- Name: apelaciones_una_por_baneo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX apelaciones_una_por_baneo ON public.apelaciones USING btree (baneo_id) WHERE (baneo_id IS NOT NULL);


--
-- Name: apelaciones_una_por_sancion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX apelaciones_una_por_sancion ON public.apelaciones USING btree (sancion_id) WHERE (sancion_id IS NOT NULL);


--
-- Name: apelaciones_usuario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX apelaciones_usuario_id_idx ON public.apelaciones USING btree (usuario_id);


--
-- Name: aporte_respuestas_opcion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aporte_respuestas_opcion_idx ON public.aporte_respuestas USING btree (opcion_id);


--
-- Name: aportes_anonimo_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aportes_anonimo_fecha_idx ON public.aportes USING btree (anonimo_id, submitted_at) WHERE (anonimo_id IS NOT NULL);


--
-- Name: aportes_anonimo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aportes_anonimo_idx ON public.aportes USING btree (campaign_id, anonimo_id) WHERE (anonimo_id IS NOT NULL);


--
-- Name: aportes_archivo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX aportes_archivo_idx ON public.aportes USING btree (archivo_id) WHERE (archivo_id IS NOT NULL);


--
-- Name: aportes_enlace_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aportes_enlace_id_idx ON public.aportes USING btree (enlace_id);


--
-- Name: aportes_first_pass_by_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aportes_first_pass_by_user_id_idx ON public.aportes USING btree (first_pass_by_user_id);


--
-- Name: aportes_inapropiado_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aportes_inapropiado_por_idx ON public.aportes USING btree (inapropiado_por);


--
-- Name: aportes_participante_aprobado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aportes_participante_aprobado_idx ON public.aportes USING btree (COALESCE((user_id)::text, (anonimo_id)::text)) WHERE ((status)::text = 'aceptado'::text);


--
-- Name: aportes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aportes_user_id_idx ON public.aportes USING btree (user_id);


--
-- Name: aportes_usuario_envio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aportes_usuario_envio_idx ON public.aportes USING btree (user_id, submitted_at);


--
-- Name: audit_log_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_actor_id_idx ON public.audit_log USING btree (actor_id);


--
-- Name: audit_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at DESC);


--
-- Name: audit_log_objetivo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_objetivo_idx ON public.audit_log USING btree (objetivo_tipo, objetivo_id);


--
-- Name: audit_log_reversion_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX audit_log_reversion_unica ON public.audit_log USING btree (((detalle ->> 'accionId'::text))) WHERE ((accion)::text = 'supervision.revertir'::text);


--
-- Name: campana_baneados_baneado_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_baneados_baneado_por_idx ON public.campana_baneados USING btree (baneado_por);


--
-- Name: campana_baneados_usuario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_baneados_usuario_id_idx ON public.campana_baneados USING btree (usuario_id);


--
-- Name: campana_checklists_clave_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campana_checklists_clave_idx ON public.campana_checklists USING btree (campana_id, COALESCE(tipo, ''::character varying), lower((titulo)::text));


--
-- Name: campana_cuota_bonos_campana_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_cuota_bonos_campana_idx ON public.campana_cuota_bonos USING btree (campana_id);


--
-- Name: campana_cuota_bonos_movimiento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_cuota_bonos_movimiento_idx ON public.campana_cuota_bonos USING btree (exp_movimiento_id);


--
-- Name: campana_datos_abiertos_decidido_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_datos_abiertos_decidido_por_idx ON public.campana_datos_abiertos USING btree (decidido_por);


--
-- Name: campana_datos_abiertos_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_datos_abiertos_estado_idx ON public.campana_datos_abiertos USING btree (estado);


--
-- Name: campana_enlaces_campana_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_enlaces_campana_idx ON public.campana_enlaces USING btree (campana_id, creado_en DESC);


--
-- Name: campana_enlaces_creado_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_enlaces_creado_por_idx ON public.campana_enlaces USING btree (creado_por);


--
-- Name: campana_etiquetas_etiqueta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_etiquetas_etiqueta_idx ON public.campana_etiquetas USING btree (etiqueta_id);


--
-- Name: campana_inscripciones_usuario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_inscripciones_usuario_id_idx ON public.campana_inscripciones USING btree (usuario_id);


--
-- Name: campana_revisores_usuario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_revisores_usuario_id_idx ON public.campana_revisores USING btree (usuario_id);


--
-- Name: campana_supervisores_campana_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_supervisores_campana_id_idx ON public.campana_supervisores USING btree (campana_id);


--
-- Name: campana_supervisores_supervisor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_supervisores_supervisor_id_idx ON public.campana_supervisores USING btree (supervisor_id);


--
-- Name: campana_tipos_tipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campana_tipos_tipo_idx ON public.campana_tipos USING btree (tipo);


--
-- Name: campanas_creator_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campanas_creator_id_idx ON public.campanas USING btree (creator_id);


--
-- Name: campanas_guardadas_campana_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campanas_guardadas_campana_id_idx ON public.campanas_guardadas USING btree (campana_id);


--
-- Name: campanas_supervisor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campanas_supervisor_id_idx ON public.campanas USING btree (supervisor_id);


--
-- Name: codigos_usuario_ficha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX codigos_usuario_ficha_idx ON public.codigos_usuario USING btree (ficha_hash) WHERE (ficha_hash IS NOT NULL);


--
-- Name: dispositivos_bloqueados_anonimo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispositivos_bloqueados_anonimo_idx ON public.dispositivos_bloqueados USING btree (anonimo_id) WHERE activo;


--
-- Name: dispositivos_bloqueados_aporte_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispositivos_bloqueados_aporte_id_idx ON public.dispositivos_bloqueados USING btree (aporte_id);


--
-- Name: dispositivos_bloqueados_bloqueado_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispositivos_bloqueados_bloqueado_por_idx ON public.dispositivos_bloqueados USING btree (bloqueado_por);


--
-- Name: dispositivos_bloqueados_campana_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispositivos_bloqueados_campana_id_idx ON public.dispositivos_bloqueados USING btree (campana_id);


--
-- Name: especialidades_creada_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX especialidades_creada_por_idx ON public.especialidades USING btree (creada_por);


--
-- Name: etiquetas_creada_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX etiquetas_creada_por_idx ON public.etiquetas USING btree (creada_por);


--
-- Name: exp_movimientos_aporte_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exp_movimientos_aporte_idx ON public.exp_movimientos USING btree (aporte_id);


--
-- Name: exp_movimientos_campana_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exp_movimientos_campana_idx ON public.exp_movimientos USING btree (campana_id);


--
-- Name: exp_movimientos_mision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exp_movimientos_mision_idx ON public.exp_movimientos USING btree (mision_instancia_id);


--
-- Name: exp_movimientos_original_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exp_movimientos_original_idx ON public.exp_movimientos USING btree (movimiento_original_id);


--
-- Name: exp_movimientos_potenciador_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exp_movimientos_potenciador_idx ON public.exp_movimientos USING btree (potenciador_id);


--
-- Name: exp_movimientos_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exp_movimientos_usuario_idx ON public.exp_movimientos USING btree (usuario_id, creado_en DESC);


--
-- Name: lideres_posiciones_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lideres_posiciones_usuario_idx ON public.lideres_posiciones_semanales USING btree (usuario_id, semana_inicio DESC);


--
-- Name: lista_negra_correos_sancion_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lista_negra_correos_sancion_id_idx ON public.lista_negra_correos USING btree (sancion_id);


--
-- Name: lista_negra_correos_usuario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lista_negra_correos_usuario_id_idx ON public.lista_negra_correos USING btree (usuario_id);


--
-- Name: medalla_ascensos_pendientes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX medalla_ascensos_pendientes_idx ON public.medalla_ascensos USING btree (usuario_id) WHERE (celebracion_vista_en IS NULL);


--
-- Name: medallas_usuario_medalla_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX medallas_usuario_medalla_idx ON public.medallas_usuario USING btree (medalla_id);


--
-- Name: mision_instancia_aportes_aporte_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mision_instancia_aportes_aporte_idx ON public.mision_instancia_aportes USING btree (aporte_id);


--
-- Name: mision_instancias_completadas_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mision_instancias_completadas_idx ON public.mision_instancias USING btree (usuario_id) WHERE (completada_en IS NOT NULL);


--
-- Name: mision_instancias_mision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mision_instancias_mision_idx ON public.mision_instancias USING btree (mision_id);


--
-- Name: mision_instancias_objeto_sin_celebrar_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mision_instancias_objeto_sin_celebrar_idx ON public.mision_instancias USING btree (usuario_id) WHERE (((recompensa_resultado)::text = 'entregada'::text) AND (objeto_celebrado_en IS NULL));


--
-- Name: mision_instancias_sin_recompensa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mision_instancias_sin_recompensa_idx ON public.mision_instancias USING btree (usuario_id) WHERE ((completada_en IS NOT NULL) AND (recompensa_entregada_en IS NULL));


--
-- Name: notificaciones_campana_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notificaciones_campana_id_idx ON public.notificaciones USING btree (campana_id);


--
-- Name: notificaciones_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notificaciones_usuario_idx ON public.notificaciones USING btree (usuario_id, created_at DESC);


--
-- Name: organizaciones_creada_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizaciones_creada_por_idx ON public.organizaciones USING btree (creada_por);


--
-- Name: potenciadores_cola_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX potenciadores_cola_idx ON public.potenciadores USING btree (usuario_id, estado, obtenido_en, id);


--
-- Name: potenciadores_un_activo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX potenciadores_un_activo_idx ON public.potenciadores USING btree (usuario_id) WHERE ((estado)::text = 'activo'::text);


--
-- Name: potenciadores_vigencia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX potenciadores_vigencia_idx ON public.potenciadores USING btree (usuario_id, activado_en, vence_en) WHERE (activado_en IS NOT NULL);


--
-- Name: push_suscripciones_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_suscripciones_usuario_idx ON public.push_suscripciones USING btree (usuario_id);


--
-- Name: racha_eventos_aporte_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX racha_eventos_aporte_idx ON public.racha_eventos USING btree (aporte_id);


--
-- Name: racha_eventos_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX racha_eventos_usuario_idx ON public.racha_eventos USING btree (usuario_id, creado_en DESC);


--
-- Name: rango_ascensos_pendientes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rango_ascensos_pendientes_idx ON public.rango_ascensos USING btree (usuario_id) WHERE (celebracion_vista_en IS NULL);


--
-- Name: rango_ascensos_rango_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rango_ascensos_rango_idx ON public.rango_ascensos USING btree (rango);


--
-- Name: rechazo_campanas_similares_campana_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rechazo_campanas_similares_campana_id_idx ON public.rechazo_campanas_similares USING btree (campana_id);


--
-- Name: reportes_aporte_uno_a_supervision; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reportes_aporte_uno_a_supervision ON public.reportes USING btree (aporte_id) WHERE (((tipo)::text = 'aporte'::text) AND ((origen)::text = 'supervision'::text));


--
-- Name: reportes_aporte_uno_por_persona; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reportes_aporte_uno_por_persona ON public.reportes USING btree (aporte_id, reportado_por) WHERE ((tipo)::text = 'aporte'::text);


--
-- Name: reportes_campana_una_por_persona; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reportes_campana_una_por_persona ON public.reportes USING btree (campana_id, reportado_por) WHERE ((tipo)::text = 'campana'::text);


--
-- Name: reportes_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reportes_estado_idx ON public.reportes USING btree (estado, created_at DESC);


--
-- Name: reportes_reportado_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reportes_reportado_id_idx ON public.reportes USING btree (reportado_id);


--
-- Name: reportes_reportado_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reportes_reportado_por_idx ON public.reportes USING btree (reportado_por);


--
-- Name: reportes_sancion_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reportes_sancion_id_idx ON public.reportes USING btree (sancion_id);


--
-- Name: reportes_ticket_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reportes_ticket_id_idx ON public.reportes USING btree (ticket_id);


--
-- Name: sanciones_usuario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sanciones_usuario_id_idx ON public.sanciones USING btree (usuario_id);


--
-- Name: sessions_usuario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_usuario_id_idx ON public.sessions USING btree (usuario_id);


--
-- Name: tematicas_creada_por_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tematicas_creada_por_idx ON public.tematicas USING btree (creada_por);


--
-- Name: tickets_campana_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_campana_id_idx ON public.tickets USING btree (campana_id);


--
-- Name: tickets_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_estado_idx ON public.tickets USING btree (estado, creado_en);


--
-- Name: tickets_supervisor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_supervisor_id_idx ON public.tickets USING btree (supervisor_id);


--
-- Name: tickets_una_sancion_pendiente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tickets_una_sancion_pendiente ON public.tickets USING btree (usuario_id) WHERE (((tipo)::text = 'sancion'::text) AND ((estado)::text = 'pendiente'::text));


--
-- Name: tickets_unos_datos_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tickets_unos_datos_pendientes ON public.tickets USING btree (campana_id) WHERE (((tipo)::text = 'datos_abiertos'::text) AND ((estado)::text = 'pendiente'::text));


--
-- Name: tickets_usuario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_usuario_id_idx ON public.tickets USING btree (usuario_id);


--
-- Name: usuario_contadores_clave_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuario_contadores_clave_idx ON public.usuario_contadores USING btree (dimension, clave, valor DESC);


--
-- Name: usuario_etiquetas_etiqueta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuario_etiquetas_etiqueta_idx ON public.usuario_etiquetas USING btree (etiqueta_id);


--
-- Name: usuario_objetos_objeto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuario_objetos_objeto_idx ON public.usuario_objetos USING btree (objeto_id);


--
-- Name: usuario_objetos_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuario_objetos_usuario_idx ON public.usuario_objetos USING btree (usuario_id);


--
-- Name: usuario_progreso_rango_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuario_progreso_rango_idx ON public.usuario_progreso USING btree (rango_actual);


--
-- Name: usuario_roles_rol_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuario_roles_rol_idx ON public.usuario_roles USING btree (rol);


--
-- Name: verificaciones_senuelo_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verificaciones_senuelo_email_idx ON public.verificaciones_senuelo USING btree (email, creada_en);


--
-- Name: apelaciones dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.apelaciones FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: aporte_respuestas dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.aporte_respuestas FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: aportes dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.aportes FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: archivos dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.archivos FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_baneados dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_baneados FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_checklists dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_checklists FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_datos_abiertos dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_datos_abiertos FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_enlaces dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_enlaces FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_especial dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_especial FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_estadisticas dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_estadisticas FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_etiquetas dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_etiquetas FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_inscripciones dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_inscripciones FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_revisores dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_revisores FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_supervisores dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_supervisores FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campana_tipos dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campana_tipos FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campanas dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campanas FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: campanas_guardadas dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.campanas_guardadas FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: checklist_opciones dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.checklist_opciones FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: dispositivos_bloqueados dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.dispositivos_bloqueados FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: especialidades dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.especialidades FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: etiquetas dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.etiquetas FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: lista_negra_correos dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.lista_negra_correos FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: medallas dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.medallas FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: medallas_usuario dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.medallas_usuario FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: mision_instancias dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.mision_instancias FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: organizaciones dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.organizaciones FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: potenciadores dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.potenciadores FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: racha_dias dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.racha_dias FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: reportes dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.reportes FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: sanciones dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.sanciones FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: tematicas dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.tematicas FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: tickets dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: usuario_etiquetas dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.usuario_etiquetas FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: usuario_progreso dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.usuario_progreso FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: usuario_roles dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE OR UPDATE ON public.usuario_roles FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: usuarios dfg_avisar_cambio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: usuarios dfg_avisar_cambio_visible; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_avisar_cambio_visible AFTER UPDATE ON public.usuarios FOR EACH ROW WHEN ((((old.nombre)::text IS DISTINCT FROM (new.nombre)::text) OR ((old.apellidos)::text IS DISTINCT FROM (new.apellidos)::text) OR ((old.state)::text IS DISTINCT FROM (new.state)::text) OR ((old.city)::text IS DISTINCT FROM (new.city)::text) OR ((old.avatar)::text IS DISTINCT FROM (new.avatar)::text) OR ((old.avatar_foto)::text IS DISTINCT FROM (new.avatar_foto)::text) OR (old.xp_total IS DISTINCT FROM new.xp_total) OR (old.level IS DISTINCT FROM new.level) OR (old.email_verificado IS DISTINCT FROM new.email_verificado) OR (old.baja_solicitada_en IS DISTINCT FROM new.baja_solicitada_en) OR (old.eliminada_en IS DISTINCT FROM new.eliminada_en))) EXECUTE FUNCTION public.dfg_avisar_cambio();


--
-- Name: aportes dfg_borrar_archivo_del_aporte; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_borrar_archivo_del_aporte AFTER DELETE ON public.aportes FOR EACH ROW EXECUTE FUNCTION public.dfg_borrar_archivo_del_aporte();


--
-- Name: campana_supervisores dfg_copiar_envio_a_revision; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_copiar_envio_a_revision BEFORE INSERT ON public.campana_supervisores FOR EACH ROW EXECUTE FUNCTION public.dfg_copiar_envio_a_revision();


--
-- Name: campanas dfg_crear_estadisticas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_crear_estadisticas AFTER INSERT ON public.campanas FOR EACH ROW EXECUTE FUNCTION public.dfg_crear_estadisticas();


--
-- Name: usuarios dfg_crear_preferencias; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_crear_preferencias AFTER INSERT ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.dfg_crear_preferencias();


--
-- Name: usuarios dfg_crear_progreso; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_crear_progreso AFTER INSERT ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.dfg_crear_progreso();


--
-- Name: usuarios dfg_crear_rol_usuario; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_crear_rol_usuario AFTER INSERT ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.dfg_crear_rol_usuario();


--
-- Name: exp_movimientos dfg_exp_movimientos_inalterable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_exp_movimientos_inalterable BEFORE DELETE OR UPDATE ON public.exp_movimientos FOR EACH ROW EXECUTE FUNCTION public.dfg_exp_movimientos_inalterable();


--
-- Name: campanas dfg_marcar_envio_a_revision; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dfg_marcar_envio_a_revision BEFORE INSERT OR UPDATE OF status ON public.campanas FOR EACH ROW EXECUTE FUNCTION public.dfg_marcar_envio_a_revision();


--
-- Name: apelaciones apelaciones_baneo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apelaciones
    ADD CONSTRAINT apelaciones_baneo_id_fkey FOREIGN KEY (baneo_id) REFERENCES public.campana_baneados(id) ON DELETE SET NULL;


--
-- Name: apelaciones apelaciones_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apelaciones
    ADD CONSTRAINT apelaciones_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE SET NULL;


--
-- Name: apelaciones apelaciones_sancion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apelaciones
    ADD CONSTRAINT apelaciones_sancion_id_fkey FOREIGN KEY (sancion_id) REFERENCES public.sanciones(id) ON DELETE SET NULL;


--
-- Name: apelaciones apelaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apelaciones
    ADD CONSTRAINT apelaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: aporte_respuestas aporte_respuestas_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aporte_respuestas
    ADD CONSTRAINT aporte_respuestas_aporte_id_fkey FOREIGN KEY (aporte_id) REFERENCES public.aportes(id) ON DELETE CASCADE;


--
-- Name: aporte_respuestas aporte_respuestas_opcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aporte_respuestas
    ADD CONSTRAINT aporte_respuestas_opcion_id_fkey FOREIGN KEY (opcion_id) REFERENCES public.checklist_opciones(id) ON DELETE CASCADE;


--
-- Name: aportes aportes_archivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aportes
    ADD CONSTRAINT aportes_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES public.archivos(id) ON DELETE SET NULL;


--
-- Name: aportes aportes_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aportes
    ADD CONSTRAINT aportes_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: aportes aportes_enlace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aportes
    ADD CONSTRAINT aportes_enlace_id_fkey FOREIGN KEY (enlace_id) REFERENCES public.campana_enlaces(id) ON DELETE SET NULL;


--
-- Name: aportes aportes_first_pass_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aportes
    ADD CONSTRAINT aportes_first_pass_by_user_id_fkey FOREIGN KEY (first_pass_by_user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: aportes aportes_inapropiado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aportes
    ADD CONSTRAINT aportes_inapropiado_por_fkey FOREIGN KEY (inapropiado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: aportes aportes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aportes
    ADD CONSTRAINT aportes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: campana_baneados campana_baneados_baneado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_baneados
    ADD CONSTRAINT campana_baneados_baneado_por_fkey FOREIGN KEY (baneado_por) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: campana_baneados campana_baneados_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_baneados
    ADD CONSTRAINT campana_baneados_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_baneados campana_baneados_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_baneados
    ADD CONSTRAINT campana_baneados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: campana_checklists campana_checklists_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_checklists
    ADD CONSTRAINT campana_checklists_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_cuota_bonos campana_cuota_bonos_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_cuota_bonos
    ADD CONSTRAINT campana_cuota_bonos_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_cuota_bonos campana_cuota_bonos_exp_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_cuota_bonos
    ADD CONSTRAINT campana_cuota_bonos_exp_movimiento_id_fkey FOREIGN KEY (exp_movimiento_id) REFERENCES public.exp_movimientos(id) ON DELETE SET NULL;


--
-- Name: campana_cuota_bonos campana_cuota_bonos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_cuota_bonos
    ADD CONSTRAINT campana_cuota_bonos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: campana_datos_abiertos campana_datos_abiertos_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_datos_abiertos
    ADD CONSTRAINT campana_datos_abiertos_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_datos_abiertos campana_datos_abiertos_decidido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_datos_abiertos
    ADD CONSTRAINT campana_datos_abiertos_decidido_por_fkey FOREIGN KEY (decidido_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: campana_enlaces campana_enlaces_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_enlaces
    ADD CONSTRAINT campana_enlaces_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_enlaces campana_enlaces_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_enlaces
    ADD CONSTRAINT campana_enlaces_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: campana_especial campana_especial_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_especial
    ADD CONSTRAINT campana_especial_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_estadisticas campana_estadisticas_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_estadisticas
    ADD CONSTRAINT campana_estadisticas_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_etiquetas campana_etiquetas_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_etiquetas
    ADD CONSTRAINT campana_etiquetas_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_etiquetas campana_etiquetas_etiqueta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_etiquetas
    ADD CONSTRAINT campana_etiquetas_etiqueta_id_fkey FOREIGN KEY (etiqueta_id) REFERENCES public.etiquetas(id) ON DELETE CASCADE;


--
-- Name: campana_inscripciones campana_inscripciones_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_inscripciones
    ADD CONSTRAINT campana_inscripciones_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_inscripciones campana_inscripciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_inscripciones
    ADD CONSTRAINT campana_inscripciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: campana_revisores campana_revisores_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_revisores
    ADD CONSTRAINT campana_revisores_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_revisores campana_revisores_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_revisores
    ADD CONSTRAINT campana_revisores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: campana_supervisores campana_supervisores_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_supervisores
    ADD CONSTRAINT campana_supervisores_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campana_supervisores campana_supervisores_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_supervisores
    ADD CONSTRAINT campana_supervisores_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: campana_tipos campana_tipos_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campana_tipos
    ADD CONSTRAINT campana_tipos_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campanas campanas_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanas
    ADD CONSTRAINT campanas_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: campanas_guardadas campanas_guardadas_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanas_guardadas
    ADD CONSTRAINT campanas_guardadas_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: campanas_guardadas campanas_guardadas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanas_guardadas
    ADD CONSTRAINT campanas_guardadas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: campanas campanas_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanas
    ADD CONSTRAINT campanas_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: checklist_opciones checklist_opciones_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_opciones
    ADD CONSTRAINT checklist_opciones_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.campana_checklists(id) ON DELETE CASCADE;


--
-- Name: codigos_usuario codigos_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_usuario
    ADD CONSTRAINT codigos_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: dispositivos_bloqueados dispositivos_bloqueados_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos_bloqueados
    ADD CONSTRAINT dispositivos_bloqueados_aporte_id_fkey FOREIGN KEY (aporte_id) REFERENCES public.aportes(id) ON DELETE SET NULL;


--
-- Name: dispositivos_bloqueados dispositivos_bloqueados_bloqueado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos_bloqueados
    ADD CONSTRAINT dispositivos_bloqueados_bloqueado_por_fkey FOREIGN KEY (bloqueado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: dispositivos_bloqueados dispositivos_bloqueados_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos_bloqueados
    ADD CONSTRAINT dispositivos_bloqueados_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: especialidades especialidades_creada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades
    ADD CONSTRAINT especialidades_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: etiquetas etiquetas_creada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etiquetas
    ADD CONSTRAINT etiquetas_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: etiquetas etiquetas_tematica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etiquetas
    ADD CONSTRAINT etiquetas_tematica_id_fkey FOREIGN KEY (tematica_id) REFERENCES public.tematicas(id) ON DELETE CASCADE;


--
-- Name: exp_movimientos exp_movimientos_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos
    ADD CONSTRAINT exp_movimientos_aporte_id_fkey FOREIGN KEY (aporte_id) REFERENCES public.aportes(id) ON DELETE SET NULL;


--
-- Name: exp_movimientos exp_movimientos_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos
    ADD CONSTRAINT exp_movimientos_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE SET NULL;


--
-- Name: exp_movimientos exp_movimientos_mision_instancia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos
    ADD CONSTRAINT exp_movimientos_mision_instancia_id_fkey FOREIGN KEY (mision_instancia_id) REFERENCES public.mision_instancias(id) ON DELETE SET NULL;


--
-- Name: exp_movimientos exp_movimientos_movimiento_original_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos
    ADD CONSTRAINT exp_movimientos_movimiento_original_id_fkey FOREIGN KEY (movimiento_original_id) REFERENCES public.exp_movimientos(id);


--
-- Name: exp_movimientos exp_movimientos_parametros_version_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos
    ADD CONSTRAINT exp_movimientos_parametros_version_fkey FOREIGN KEY (parametros_version) REFERENCES public.parametros_gamificacion(version);


--
-- Name: exp_movimientos exp_movimientos_potenciador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos
    ADD CONSTRAINT exp_movimientos_potenciador_id_fkey FOREIGN KEY (potenciador_id) REFERENCES public.potenciadores(id) ON DELETE SET NULL;


--
-- Name: exp_movimientos exp_movimientos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exp_movimientos
    ADD CONSTRAINT exp_movimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: lideres_posiciones_semanales lideres_posiciones_semanales_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lideres_posiciones_semanales
    ADD CONSTRAINT lideres_posiciones_semanales_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: lista_negra_correos lista_negra_correos_sancion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lista_negra_correos
    ADD CONSTRAINT lista_negra_correos_sancion_id_fkey FOREIGN KEY (sancion_id) REFERENCES public.sanciones(id) ON DELETE SET NULL;


--
-- Name: lista_negra_correos lista_negra_correos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lista_negra_correos
    ADD CONSTRAINT lista_negra_correos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: medalla_ascensos medalla_ascensos_medalla_id_nivel_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medalla_ascensos
    ADD CONSTRAINT medalla_ascensos_medalla_id_nivel_fkey FOREIGN KEY (medalla_id, nivel) REFERENCES public.medalla_niveles(medalla_id, nivel);


--
-- Name: medalla_ascensos medalla_ascensos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medalla_ascensos
    ADD CONSTRAINT medalla_ascensos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: medalla_niveles medalla_niveles_medalla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medalla_niveles
    ADD CONSTRAINT medalla_niveles_medalla_id_fkey FOREIGN KEY (medalla_id) REFERENCES public.medallas(id) ON DELETE CASCADE;


--
-- Name: medallas_usuario medallas_usuario_medalla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medallas_usuario
    ADD CONSTRAINT medallas_usuario_medalla_id_fkey FOREIGN KEY (medalla_id) REFERENCES public.medallas(id);


--
-- Name: medallas_usuario medallas_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medallas_usuario
    ADD CONSTRAINT medallas_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: mision_instancia_aportes mision_instancia_aportes_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mision_instancia_aportes
    ADD CONSTRAINT mision_instancia_aportes_aporte_id_fkey FOREIGN KEY (aporte_id) REFERENCES public.aportes(id) ON DELETE CASCADE;


--
-- Name: mision_instancia_aportes mision_instancia_aportes_instancia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mision_instancia_aportes
    ADD CONSTRAINT mision_instancia_aportes_instancia_id_fkey FOREIGN KEY (instancia_id) REFERENCES public.mision_instancias(id) ON DELETE CASCADE;


--
-- Name: mision_instancias mision_instancias_mision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mision_instancias
    ADD CONSTRAINT mision_instancias_mision_id_fkey FOREIGN KEY (mision_id) REFERENCES public.misiones(id);


--
-- Name: mision_instancias mision_instancias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mision_instancias
    ADD CONSTRAINT mision_instancias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: notificaciones notificaciones_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: notificaciones notificaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: objetos objetos_rango_exclusivo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objetos
    ADD CONSTRAINT objetos_rango_exclusivo_fkey FOREIGN KEY (rango_exclusivo) REFERENCES public.rangos(numero) ON DELETE SET NULL;


--
-- Name: organizaciones organizaciones_creada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizaciones
    ADD CONSTRAINT organizaciones_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: parametros_gamificacion parametros_gamificacion_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametros_gamificacion
    ADD CONSTRAINT parametros_gamificacion_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: potenciadores potenciadores_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potenciadores
    ADD CONSTRAINT potenciadores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: push_suscripciones push_suscripciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_suscripciones
    ADD CONSTRAINT push_suscripciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: racha_dias racha_dias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racha_dias
    ADD CONSTRAINT racha_dias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: racha_eventos racha_eventos_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racha_eventos
    ADD CONSTRAINT racha_eventos_aporte_id_fkey FOREIGN KEY (aporte_id) REFERENCES public.aportes(id) ON DELETE SET NULL;


--
-- Name: racha_eventos racha_eventos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racha_eventos
    ADD CONSTRAINT racha_eventos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: rango_ascensos rango_ascensos_rango_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rango_ascensos
    ADD CONSTRAINT rango_ascensos_rango_fkey FOREIGN KEY (rango) REFERENCES public.rangos(numero);


--
-- Name: rango_ascensos rango_ascensos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rango_ascensos
    ADD CONSTRAINT rango_ascensos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: rechazo_campanas_similares rechazo_campanas_similares_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechazo_campanas_similares
    ADD CONSTRAINT rechazo_campanas_similares_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: rechazo_campanas_similares rechazo_campanas_similares_dictamen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechazo_campanas_similares
    ADD CONSTRAINT rechazo_campanas_similares_dictamen_id_fkey FOREIGN KEY (dictamen_id) REFERENCES public.campana_supervisores(id) ON DELETE CASCADE;


--
-- Name: reportes reportes_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_aporte_id_fkey FOREIGN KEY (aporte_id) REFERENCES public.aportes(id) ON DELETE SET NULL;


--
-- Name: reportes reportes_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: reportes reportes_reportado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_reportado_id_fkey FOREIGN KEY (reportado_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: reportes reportes_reportado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_reportado_por_fkey FOREIGN KEY (reportado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: reportes reportes_sancion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_sancion_id_fkey FOREIGN KEY (sancion_id) REFERENCES public.sanciones(id) ON DELETE SET NULL;


--
-- Name: reportes reportes_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes
    ADD CONSTRAINT reportes_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: sanciones sanciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sanciones
    ADD CONSTRAINT sanciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: tematicas tematicas_creada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tematicas
    ADD CONSTRAINT tematicas_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_campana_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_campana_id_fkey FOREIGN KEY (campana_id) REFERENCES public.campanas(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuario_avisos_de_zona usuario_avisos_de_zona_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_avisos_de_zona
    ADD CONSTRAINT usuario_avisos_de_zona_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuario_contadores usuario_contadores_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_contadores
    ADD CONSTRAINT usuario_contadores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuario_etiquetas usuario_etiquetas_etiqueta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_etiquetas
    ADD CONSTRAINT usuario_etiquetas_etiqueta_id_fkey FOREIGN KEY (etiqueta_id) REFERENCES public.etiquetas(id) ON DELETE CASCADE;


--
-- Name: usuario_etiquetas usuario_etiquetas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_etiquetas
    ADD CONSTRAINT usuario_etiquetas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuario_objetos usuario_objetos_objeto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_objetos
    ADD CONSTRAINT usuario_objetos_objeto_id_fkey FOREIGN KEY (objeto_id) REFERENCES public.objetos(id);


--
-- Name: usuario_objetos usuario_objetos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_objetos
    ADD CONSTRAINT usuario_objetos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuario_preferencias usuario_preferencias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_preferencias
    ADD CONSTRAINT usuario_preferencias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuario_progreso usuario_progreso_rango_actual_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_progreso
    ADD CONSTRAINT usuario_progreso_rango_actual_fkey FOREIGN KEY (rango_actual) REFERENCES public.rangos(numero);


--
-- Name: usuario_progreso usuario_progreso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_progreso
    ADD CONSTRAINT usuario_progreso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuario_roles usuario_roles_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_roles
    ADD CONSTRAINT usuario_roles_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuario_zona_detectada usuario_zona_detectada_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_zona_detectada
    ADD CONSTRAINT usuario_zona_detectada_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 28EcfWBnltS9tjquyUpYk6qQGq66p74wX4joTrJOYfIvBDb96vTkTSLTgNmIAm1

