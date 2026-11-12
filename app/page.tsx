// Pantalla / (landing pública). Server Component.
// Datos: cifras con SQL directo (lib/db.ts) y conjuntos destacados de lib/open-data.ts.
// Se arma en cada visita y se actualiza en vivo (ActualizacionEnVivo, 2026-10-31; antes revalidate = 300). Las
// consultas van en try/catch: si la BD no responde, las cifras salen en 0 en vez de tumbar la página.
// Diseño del 2026-11-06 (a pedido del usuario, con kaggle.com como referencia de estructura y estilo): portada
// centrada con ilustración propia, secciones con etiqueta en mono y mucho aire, tarjetas con pie y pestañas.

import Link from "next/link";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import ButtonLink from "@/components/ui/ButtonLink";
import ContadorAnimado from "@/components/ui/ContadorAnimado";
import Tag from "@/components/ui/Tag";
import FranjaDeCampo from "@/components/landing/FranjaDeCampo";
import TarjetaDeConjunto from "@/components/landing/TarjetaDeConjunto";
import PalabraRotativa from "@/components/landing/PalabraRotativa";
import PestanasDeCampanas, { type CampanaDePortada, type PestanaDeCampanas } from "@/components/landing/PestanasDeCampanas";
import FilaDeTematicas from "@/components/landing/FilaDeTematicas";
import TarjetaDeCampanaPublica from "@/components/campanas/TarjetaDeCampanaPublica";
import { buscarCampanasParaExplorar, obtenerTematicasParaExplorar } from "@/lib/campanas/publicas";
import { retraso } from "@/lib/animaciones";
import { pool } from "@/lib/db";
import { activateScheduledCampaigns, finalizeExpiredCampaigns } from "@/lib/campaign-date";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { quienOrganiza } from "@/lib/campanas/organizacion";
import { sqlDatosPublicados } from "@/lib/campanas/datos-abiertos";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import TablaDeLideres from "@/components/gamificacion/TablaDeLideres";
import { obtenerTablasPorPeriodo, tablaTieneDatos } from "@/lib/gamificacion/clasificacion";
import { DATA_TYPE_LABELS, buscarConjuntosAbiertos, contarConjuntosPublicados } from "@/lib/open-data";
import type { DataType } from "@/types";

// En vivo (2026-10-31): se arma en cada visita, sin la caché de cinco minutos de antes.
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("es-MX");

const PASOS = [
  {
    numero: "01",
    titulo: "Crea una campaña",
    texto: "Define qué información necesitas, a quién va dirigida y bajo qué reglas de consentimiento.",
  },
  {
    numero: "02",
    titulo: "La comunidad participa",
    texto: "Desde la app, desde el navegador o con un enlace y código QR, sin necesidad de registro.",
  },
  {
    numero: "03",
    titulo: "Recibe y valida los datos",
    texto: "Consulta, aprueba y sigue los resultados en tiempo real desde tu panel.",
  },
];

/** Campañas de "Lo más reciente" (2026-11-12): dos filas de 3 en escritorio. */
const CAMPANAS_RECIENTES = 6;
/** Temáticas en la fila de "Lo más reciente": las que más campañas activas tienen. */
const TEMATICAS_EN_PORTADA = 10;

const PUBLICOS = ["organizaciones", "voluntarios", "investigadores", "comunidades"];

// Solo promesas que el sistema cumple (dominio.md § 5 y § 9).
const GARANTIAS = [
  "Cada aporte lo revisa una persona antes de contar",
  "Los datos abiertos no incluyen quién aportó",
  "La supervisión decide qué se publica",
];

const ANCHO = "mx-auto max-w-[1180px] px-6";
const TITULO_DE_SECCION = "text-[28px] font-semibold leading-tight tracking-tight text-system-900 md:text-[34px]";
const ETIQUETA_DE_SECCION = "mb-3 font-mono text-[13px] text-system-600";

interface CifrasReales {
  campanasActivas: number;
  campanasCreadas: number;
  usuariosRegistrados: number;
  datosRecolectados: number;
  organizaciones: number;
}

const CIFRAS_VACIAS: CifrasReales = {
  campanasActivas: 0,
  campanasCreadas: 0,
  usuariosRegistrados: 0,
  datosRecolectados: 0,
  organizaciones: 0,
};

/**
 * Tracción real de la plataforma: sin "+" ni cifras redondeadas, son conteos
 * exactos de la BD. Igual que contarFilas en metricas.ts, si la BD no responde
 * se muestra en 0 en vez de tumbar la página.
 */
async function obtenerCifras(): Promise<CifrasReales> {
  try {
    // Qué cuenta cada cifra (2026-10-24, decisiones del usuario; antes contaba todas las campañas, todos
    // los aportes, solo personas con cuenta y creadores distintos):
    //   - campañas activas (2026-11-12, a pedido del usuario): solo las de estado `activa`, las que reciben
    //     aportes ahora (sin las pausadas);
    //   - bases de datos disponibles (antes "Campañas publicadas"; nombre del 2026-11-12, a pedido del
    //     usuario): solo las finalizadas cuyos datos publicó su supervisor o el SuperUsuario, igual que
    //     /datos (2026-11-09, decisión del usuario; antes activa, pausada y finalizada);
    //   - usuarios registrados: todas las cuentas con el correo verificado, sin las ya eliminadas (2026-11-09,
    //     a pedido del usuario: "todos", no solo quienes aportaron o crearon una campaña; antes "Participantes",
    //     personas y dispositivos sin cuenta con al menos un aporte aprobado). Las que están en baja todavía
    //     cuentan: siguen registradas hasta que se eliminan;
    //   - datos: solo aportes aprobados, como la meta y los datos abiertos;
    //   - organizaciones: quién organiza las campañas activas y finalizadas (2026-11-09, decisión del usuario;
    //     antes también las pausadas): la organización escrita o, si no hay, el nombre del creador, como
    //     quienOrganiza(), sin distinguir mayúsculas.
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM campanas WHERE status = 'activa') AS campanas_activas,
        (SELECT COUNT(*)::int FROM campanas WHERE ${sqlDatosPublicados("campanas")}) AS campanas_creadas,
        (SELECT COUNT(*)::int FROM usuarios WHERE email_verificado AND eliminada_en IS NULL) AS usuarios_registrados,
        (SELECT COUNT(*)::int FROM aportes WHERE status = 'aceptado') AS datos_recolectados,
        (SELECT COUNT(DISTINCT lower(COALESCE(NULLIF(trim(organizer), ''), NULLIF(trim(creator_name), ''))))::int
           FROM campanas WHERE status IN ('activa', 'finalizada')) AS organizaciones
    `);
    const row = result.rows[0] ?? {};
    return {
      campanasActivas: Number(row.campanas_activas ?? 0),
      campanasCreadas: Number(row.campanas_creadas ?? 0),
      usuariosRegistrados: Number(row.usuarios_registrados ?? 0),
      datosRecolectados: Number(row.datos_recolectados ?? 0),
      organizaciones: Number(row.organizaciones ?? 0),
    };
  } catch {
    return CIFRAS_VACIAS;
  }
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

/** Las 4 campañas activas de cada pestaña. Los ORDER BY son constantes, no vienen del usuario. */
const ORDENES_DE_LA_VITRINA = [
  { clave: "participacion", nombre: "Más participación", sql: "est.participants DESC, est.current_contributions DESC" },
  { clave: "recientes", nombre: "Recientes", sql: "c.start_date DESC NULLS LAST, c.id DESC" },
  { clave: "por-cerrar", nombre: "Por cerrar", sql: "c.end_date ASC NULLS LAST, c.id" },
];

async function campanasDeLaVitrina(orden: string): Promise<CampanaDePortada[]> {
  const result = await pool.query(
    `SELECT c.id, c.name, c.description, c.organizer, c.creator_name, c.goal_contributions,
            to_char(c.end_date, 'YYYY-MM-DD') AS cierre, est.approved_contributions, est.participants,
            to_char(c.created_at AT TIME ZONE $1, 'YYYY-MM-DD') AS creada,
            (SELECT COALESCE(array_agg(t.tipo ORDER BY t.tipo), '{}') FROM campana_tipos t WHERE t.campana_id = c.id) AS tipos
     FROM campanas c
     JOIN campana_estadisticas est ON est.campana_id = c.id
     WHERE c.status = 'activa'
     ORDER BY ${orden}
     LIMIT 4`,
    [ZONA_DE_CAMPANAS]
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    organizer: quienOrganiza({ organizer: row.organizer, creatorName: row.creator_name }),
    tipos: (row.tipos as DataType[]).map((tipo) => DATA_TYPE_LABELS[tipo] ?? tipo),
    pct: porcentajeDeMeta(Number(row.approved_contributions ?? 0), Number(row.goal_contributions ?? 0)),
    participants: Number(row.participants ?? 0),
    cierre: row.cierre ? FECHA_CORTA.format(new Date(`${row.cierre}T00:00:00Z`)) : null,
    // Fecha de creación (2026-11-09, a pedido del usuario), en el día de Tepic.
    creada: FECHA_CORTA.format(new Date(`${row.creada}T00:00:00Z`)),
  }));
}

/** Pestañas de la vitrina; vacío si no hay campañas activas o la BD no responde. */
async function obtenerVitrina(): Promise<PestanaDeCampanas[]> {
  try {
    // Una programada cuya hora de inicio ya llegó entra sin esperar a la tarea de cada minuto.
    await activateScheduledCampaigns();
    await finalizeExpiredCampaigns();
    const listas = await Promise.all(ORDENES_DE_LA_VITRINA.map((o) => campanasDeLaVitrina(o.sql)));
    if (listas[0].length === 0) return [];
    return ORDENES_DE_LA_VITRINA.map((o, i) => ({ clave: o.clave, nombre: o.nombre, campanas: listas[i] }));
  } catch {
    return [];
  }
}

interface AporteReciente {
  id: string;
  tag: string;
  description: string;
  submittedAt: string; // ISO
}

function comoHashtag(texto: string): string {
  const limpio = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `#${limpio || "campana"}`;
}

/**
 * Últimos aportes YA APROBADOS de campañas visibles públicamente (activa,
 * pausada o finalizada). Nunca incluye quién aportó (dominio.md § 9): solo
 * la temática de la campaña, la hora y una parte de la descripción.
 * Deliberadamente no se muestran aportes "pendiente" para no exhibir
 * contenido todavía sin revisar en la página pública.
 */
async function obtenerAportesRecientes(): Promise<AporteReciente[]> {
  try {
    const result = await pool.query(
      // Sale como ISO en UTC con "Z" para no depender de la zona del proceso (UTC en Docker,
      // la de la máquina en `next dev`).
      `SELECT a.id, COALESCE(NULLIF(c.tag, ''), c.tematica) AS tag, a.description,
              to_char(a.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS submitted_at
        FROM aportes a
        JOIN campanas c ON c.id = a.campaign_id
        WHERE a.status = 'aceptado' AND c.status IN ('activa', 'pausada', 'finalizada')
        ORDER BY a.submitted_at DESC
        LIMIT 4`
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      tag: String(row.tag ?? ""),
      description: String(row.description ?? ""),
      submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Encabezado de sección: etiqueta en mono, título, texto y un enlace a la derecha. */
function EncabezadoDeSeccion({
  id,
  etiqueta,
  titulo,
  texto,
  enlace,
}: {
  id: string;
  etiqueta?: string;
  titulo: string;
  texto: string;
  enlace?: { href: string; texto: string };
}) {
  return (
    <div className="landing-revelar mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {etiqueta && <p className={ETIQUETA_DE_SECCION}>{etiqueta}</p>}
        <h2 id={id} className={TITULO_DE_SECCION}>
          {titulo}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-system-600">{texto}</p>
      </div>
      {enlace && (
        <ButtonLink href={enlace.href} variant="secondary" size="sm">
          {enlace.texto} →
        </ButtonLink>
      )}
    </div>
  );
}

export default async function LandingPage() {
  const [{ conjuntos: destacados }, totalConjuntos, aportesRecientes, cifras, vitrina, recientes, tematicasConCampanas] = await Promise.all([
    buscarConjuntosAbiertos({ orden: "cobertura" }),
    contarConjuntosPublicados(),
    obtenerAportesRecientes(),
    obtenerCifras(),
    obtenerVitrina(),
    // "Lo más reciente" (2026-11-12): las mismas campañas y tarjetas que /explorar, de la más nueva a la más vieja.
    buscarCampanasParaExplorar({ orden: "recientes", limite: CAMPANAS_RECIENTES }),
    obtenerTematicasParaExplorar(),
  ]);
  // Tabla de líderes (datos reales de la BD). Sin datos (BD vacía o recién construida), la sección no se pinta.
  // Con datos desde siempre se pinta la sección; los periodos cortos pueden venir vacíos (lo dice la tabla).
  const tablas = await obtenerTablasPorPeriodo();
  const tablaDeLideres = tablaTieneDatos(tablas.siempre) ? tablas : null;
  const campanaDestacada = vitrina[0]?.campanas[0];

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader mostrarInicio={false} variante="portada" />

      {/* Todo el contenido va en <main> (antes las secciones de abajo quedaban fuera de toda región). */}
      <main id="contenido">
        <section className="pt-14 text-center md:pt-20">
          <div className="mx-auto max-w-3xl px-6">
            <p className="landing-entrada mb-4 font-mono text-[13px] text-system-600">
              <PalabraRotativa inicio="DataForGood es para" palabras={PUBLICOS} />
            </p>
            <h1
              style={retraso(90)}
              className="landing-entrada text-[36px] font-semibold leading-[1.1] tracking-tight text-system-900 md:text-[48px]"
            >
              Cada dato cuenta, cuando lo cuenta la comunidad
            </h1>
            <p style={retraso(180)} className="landing-entrada mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-system-600 md:text-[19px]">
              <span className="marca-animada">DataForGood</span> conecta a quienes quieren ayudar con quienes están en el lugar de los hechos.
              Crea una campaña y deja que tu comunidad la alimente con fotos, videos, audios, documentos o testimonios para causas
              sociales, ambientales y comunitarias.
            </p>
            <div style={retraso(270)} className="landing-entrada mt-8 flex flex-wrap justify-center gap-2.5">
              <ButtonLink href="/registro" variant="primary">
                Crear una campaña
              </ButtonLink>
              <ButtonLink href="/explorar" variant="secondary">
                Explorar campañas
              </ButtonLink>
            </div>
          </div>

          <FranjaDeCampo style={retraso(360)} className="landing-entrada mt-12 h-[260px] md:h-[300px]">
            {campanaDestacada && (
              <div className={`${ANCHO} relative flex h-full items-end justify-center pb-5 md:justify-end`}>
                <Link
                  href={`/campanas/${campanaDestacada.id}`}
                  className="landing-tarjeta w-full max-w-[320px] rounded-[18px] bg-white p-4 text-left shadow-sm"
                >
                  <span className="flex items-center justify-between gap-2">
                    <Tag tone="info">Campaña activa</Tag>
                    {campanaDestacada.cierre && (
                      <span className="font-mono text-[12px] text-system-500">Cierra el {campanaDestacada.cierre}</span>
                    )}
                  </span>
                  <span className="mt-2.5 block truncate text-[14.5px] font-medium text-system-900">{campanaDestacada.name}</span>
                  <span className="mt-1 block font-mono text-[12px] text-system-500">Creada el {campanaDestacada.creada}</span>
                </Link>
              </div>
            )}
          </FranjaDeCampo>
        </section>

        <section aria-label="La plataforma en cifras" className={`${ANCHO} py-12`}>
          <p className="mb-6 text-center font-mono text-[13px] text-system-600">DataForGood, en cifras reales</p>
          {/* 5 cifras: en 2 columnas la última ocupa la fila entera para quedar centrada. */}
          <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-5 max-sm:[&>*:last-child]:col-span-2">
            {[
              { valor: cifras.campanasActivas, etiqueta: "Campañas activas" },
              { valor: cifras.campanasCreadas, etiqueta: "Bases de datos disponibles" },
              { valor: cifras.usuariosRegistrados, etiqueta: "Usuarios registrados" },
              { valor: cifras.datosRecolectados, etiqueta: "Aportes aprobados" },
              { valor: cifras.organizaciones, etiqueta: "Organizaciones" },
            ].map((k) => (
              <div key={k.etiqueta}>
                <ContadorAnimado valor={k.valor} className="block text-[30px] font-semibold tracking-tight text-system-900" />
                <p className="mt-1 text-[13px] text-system-600">{k.etiqueta}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Lo más reciente (2026-11-12, a pedido del usuario, como el inicio de GoFundMe): las campañas activas
            más nuevas de todas las temáticas y, arriba, las temáticas: cada una lleva a /explorar/tematica/[slug]. */}
        {recientes.length > 0 && (
          <section aria-labelledby="campanas-recientes" className={`${ANCHO} py-12 md:py-20`}>
            <EncabezadoDeSeccion
              id="campanas-recientes"
              etiqueta="Lo más reciente"
              titulo="Campañas recién abiertas"
              texto="Las últimas campañas que empezaron a recibir aportes, de todas las temáticas. Elige una temática para ver todas sus campañas."
              enlace={{ href: "/explorar?orden=recientes", texto: "Ver todas" }}
            />
            {tematicasConCampanas.length > 0 && (
              <div className="landing-revelar mb-6">
                <FilaDeTematicas
                  tematicas={tematicasConCampanas.slice(0, TEMATICAS_EN_PORTADA)}
                  etiqueta="Campañas por temática"
                  final={tematicasConCampanas.length > TEMATICAS_EN_PORTADA ? { href: "/explorar", texto: "Más temáticas" } : undefined}
                />
              </div>
            )}
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recientes.map((c, i) => (
                // flex: la tarjeta toma el alto de la fila, como en /explorar (sin portada no queda más corta).
                <li key={c.id} className="flex min-w-0 *:w-full">
                  <TarjetaDeCampanaPublica campana={c} indice={i} nivel="h3" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {vitrina.length > 0 && (
          <section aria-labelledby="campanas-destacadas" className={`${ANCHO} py-12 md:py-20`}>
            <EncabezadoDeSeccion
              id="campanas-destacadas"
              etiqueta="Campañas destacadas"
              titulo="Súmate a lo que está pasando"
              texto="Campañas activas que reciben aportes ahora mismo."
              enlace={{ href: "/explorar", texto: "Ver todas" }}
            />
            <div className="landing-revelar">
              <PestanasDeCampanas pestanas={vitrina} />
            </div>
          </section>
        )}

        {destacados.length > 0 && (
          <section aria-labelledby="datos-abiertos" className={`${ANCHO} py-12 md:py-20`}>
            <EncabezadoDeSeccion
              id="datos-abiertos"
              etiqueta="Datos abiertos"
              titulo="Datos de campañas, abiertos para todos"
              texto={`Cuando una campaña termina y la supervisión lo aprueba, la información que reunió se publica como un conjunto de datos que cualquiera puede consultar y descargar. ${nf.format(totalConjuntos)} ${totalConjuntos === 1 ? "conjunto disponible" : "conjuntos disponibles"}.`}
              enlace={{ href: "/datos", texto: "Explorar el catálogo" }}
            />
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {destacados.slice(0, 4).map((c, i) => (
                <li key={c.id} className="landing-revelar">
                  <TarjetaDeConjunto conjunto={c} indice={i} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {tablaDeLideres && (
          <section aria-labelledby="tabla-de-lideres" className="bg-system-100">
            <div className={`${ANCHO} py-14 md:py-20`}>
              <EncabezadoDeSeccion
                id="tabla-de-lideres"
                titulo="Quienes más aportan a la comunidad"
                texto="Solo cuentan los aportes aprobados. Mira quién más aportó hoy, este mes, este año o desde siempre."
                enlace={{ href: "/progreso/leaderboard", texto: "Ver tabla completa" }}
              />
              <div className="landing-revelar">
                <TablaDeLideres tablas={tablaDeLideres} />
              </div>
            </div>
          </section>
        )}

        <section id="como-funciona" aria-labelledby="titulo-como-funciona" className={`${ANCHO} py-14 md:py-24`}>
          <div className="landing-revelar mx-auto max-w-2xl text-center">
            <h2 id="titulo-como-funciona" className={TITULO_DE_SECCION}>
              Tres pasos, de la idea al dato
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-system-600">
              Tú defines qué necesitas, la comunidad lo recolecta y tú decides qué sirve.
            </p>
            <ButtonLink href="/registro" variant="secondary" size="sm" className="mt-6">
              Crear una campaña →
            </ButtonLink>
          </div>
          <ol className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
            {PASOS.map((p, i) => (
              <li
                key={p.numero}
                className={`landing-revelar rounded-[18px] border-2 border-system-900 bg-white p-5 ${i === 1 ? "md:mt-8" : i === 2 ? "md:mt-16" : ""}`}
              >
                <p className="mb-6 font-mono text-[13px] text-system-600" aria-hidden="true">
                  {p.numero}
                </p>
                <h3 className="mb-1.5 text-[16px] font-semibold text-system-900">{p.titulo}</h3>
                <p className="text-[13.5px] leading-relaxed text-system-600">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {aportesRecientes.length > 0 && (
          <section aria-labelledby="aportes-recientes" className={`${ANCHO} pb-14 md:pb-24`}>
            <EncabezadoDeSeccion
              id="aportes-recientes"
              etiqueta="Desde el campo"
              titulo="Lo último que aportó la comunidad"
              texto="Aportes ya aprobados, sin datos de quién los envió."
            />
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {aportesRecientes.map((post) => (
                <li
                  key={post.id}
                  className="landing-revelar landing-tarjeta flex min-h-[150px] flex-col justify-between rounded-[18px] border border-system-200 bg-white p-4"
                >
                  <p className="text-[14px] leading-snug text-system-900">
                    &ldquo;{post.description.length > 90 ? `${post.description.slice(0, 90)}…` : post.description}&rdquo;
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-medium text-brand-600">{comoHashtag(post.tag)}</p>
                      <p className="font-mono text-[11px] text-system-500">
                        {new Date(post.submittedAt).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: ZONA_DE_CAMPANAS,
                        })}
                      </p>
                    </div>
                    <Tag tone="ok">Aprobado</Tag>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="sobre-dataforgood" className="border-t border-system-200">
          <div className={`${ANCHO} grid grid-cols-1 gap-10 py-14 md:grid-cols-2 md:py-20`}>
            <div className="landing-revelar">
              <p className={ETIQUETA_DE_SECCION}>Acerca de DataForGood</p>
              <h2 id="sobre-dataforgood" className={TITULO_DE_SECCION}>
                ¿Tienes un proyecto con impacto social?
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-system-600">
                Publica tu primera campaña y empieza a recolectar datos en minutos.
              </p>
              <ButtonLink href="/registro" variant="primary" className="mt-6">
                Comenzar ahora
              </ButtonLink>
            </div>
            <ul className="landing-revelar flex flex-col justify-center gap-3">
              {GARANTIAS.map((g) => (
                <li key={g} className="flex items-start gap-2.5 text-[15px] text-system-900">
                  <span aria-hidden="true" className="font-bold text-success-700">
                    ✓
                  </span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <ActualizacionEnVivo />
      <PublicFooter />
    </div>
  );
}
