// Pantalla / (landing pública). Server Component.
// Datos: cifras con SQL directo (lib/db.ts) y conjuntos destacados de lib/open-data.ts.
// Se prerrenderiza (revalidate = 300): el build corre sin BD, por eso las consultas van en try/catch.

import Link from "next/link";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import ButtonLink from "@/components/ui/ButtonLink";
import ContadorAnimado from "@/components/ui/ContadorAnimado";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import { retraso } from "@/lib/animaciones";
import { pool } from "@/lib/db";
import { activateScheduledCampaigns, finalizeExpiredCampaigns } from "@/lib/campaign-date";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import TablaDeLideres from "@/components/gamificacion/TablaDeLideres";
import { mostrarTablaDeLideres, obtenerTablaDeLideres } from "@/lib/gamificacion/clasificacion";
import { DATA_TYPE_LABELS, buscarConjuntosAbiertos, contarConjuntosPublicados } from "@/lib/open-data";

// Página pública: se regenera cada cinco minutos y el resto del tiempo se
// sirve estática, para no golpear la base de datos en cada visita.
export const revalidate = 300;

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

const COVER_GRADIENTS = [
  "from-brand-600 to-brand-600/40",
  "from-success-700 to-success-700/40",
  "from-warning-500 to-warning-500/40",
];

interface CifrasReales {
  campanasCreadas: number;
  participantes: number;
  datosRecolectados: number;
  organizaciones: number;
}

const CIFRAS_VACIAS: CifrasReales = {
  campanasCreadas: 0,
  participantes: 0,
  datosRecolectados: 0,
  organizaciones: 0,
};

/**
 * Tracción real de la plataforma: sin "+" ni cifras redondeadas, son conteos
 * exactos de la BD. Esta página se prerrenderiza en el build (revalidate =
 * 300) y ese build corre sin Postgres disponible (imagen de Docker, sin la
 * red de docker-compose); igual que contarFilas en metricas.ts, si la BD no
 * responde se muestra en 0 en vez de tumbar el build o la página.
 */
async function obtenerCifras(): Promise<CifrasReales> {
  try {
    // Qué cuenta cada cifra (2026-10-24, decisiones del usuario; antes contaba todas las campañas, todos
    // los aportes, solo personas con cuenta y creadores distintos):
    //   - campañas: solo las publicadas (activa, pausada, finalizada), sin borradores, en revisión,
    //     programadas ni rechazadas;
    //   - participantes: personas con cuenta y dispositivos sin cuenta (anonimo_id) que aportaron;
    //   - datos: solo aportes aprobados, como la meta y los datos abiertos;
    //   - organizaciones: quién organiza las campañas publicadas (la organización escrita o, si no hay,
    //     el nombre del creador, como quienOrganiza()), sin distinguir mayúsculas.
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM campanas WHERE status IN ('activa', 'pausada', 'finalizada')) AS campanas_creadas,
        (SELECT COUNT(DISTINCT COALESCE(user_id::text, anonimo_id))::int FROM aportes) AS participantes,
        (SELECT COUNT(*)::int FROM aportes WHERE status = 'aceptado') AS datos_recolectados,
        (SELECT COUNT(DISTINCT lower(COALESCE(NULLIF(trim(organizer), ''), NULLIF(trim(creator_name), ''))))::int
           FROM campanas WHERE status IN ('activa', 'pausada', 'finalizada')) AS organizaciones
    `);
    const row = result.rows[0] ?? {};
    return {
      campanasCreadas: Number(row.campanas_creadas ?? 0),
      participantes: Number(row.participantes ?? 0),
      datosRecolectados: Number(row.datos_recolectados ?? 0),
      organizaciones: Number(row.organizaciones ?? 0),
    };
  } catch {
    return CIFRAS_VACIAS;
  }
}

interface CampanaDestacada {
  id: string;
  name: string;
  tag: string;
  approvedContributions: number;
  goalContributions: number;
  participants: number;
}

/** Campañas activas con más participación, para la vitrina de la landing. */
async function obtenerCampanasDestacadas(): Promise<CampanaDestacada[]> {
  try {
    // Una programada cuya hora de inicio ya llegó entra sin esperar a la tarea de cada minuto.
    await activateScheduledCampaigns();
    await finalizeExpiredCampaigns();
    const result = await pool.query(
      `SELECT id, name, COALESCE(NULLIF(tag, ''), tematica) AS tag, approved_contributions, goal_contributions, participants
       FROM campanas
       WHERE status = 'activa'
       ORDER BY participants DESC, current_contributions DESC
       LIMIT 3`
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      tag: String(row.tag ?? ""),
      approvedContributions: Number(row.approved_contributions ?? 0),
      goalContributions: Number(row.goal_contributions ?? 0),
      participants: Number(row.participants ?? 0),
    }));
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
    .replace(/[̀-ͯ]/g, "")
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
      // submitted_at es TIMESTAMP en UTC: sale como ISO con "Z" para no depender de la zona
      // del proceso (UTC en Docker, la de la máquina en `next dev`).
      `SELECT a.id, COALESCE(NULLIF(c.tag, ''), c.tematica) AS tag, a.description,
              to_char(a.submitted_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS submitted_at
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
      submittedAt: row.submitted_at ? String(row.submitted_at) : new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const [{ conjuntos: destacados }, totalConjuntos, aportesRecientes, cifras, campanasDestacadas] = await Promise.all([
    buscarConjuntosAbiertos({ orden: "cobertura" }),
    contarConjuntosPublicados(),
    obtenerAportesRecientes(),
    obtenerCifras(),
    obtenerCampanasDestacadas(),
  ]);
  // Tabla de líderes: oculta hasta que lea datos reales (MOSTRAR_TABLA_DE_LIDERES=si para verla).
  const tablaDeLideres = mostrarTablaDeLideres() ? await obtenerTablaDeLideres() : null;

  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />

      {/* Todo el contenido va en <main> (antes las secciones de abajo quedaban fuera de toda región). */}
      <main id="contenido">
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-center">
        <p className="landing-entrada mb-4 font-mono text-[10.5px] uppercase tracking-widest text-brand-600">
          Plataforma de crowdsourcing de datos
        </p>
        <h1 style={retraso(90)} className="landing-entrada mx-auto max-w-2xl text-[46px] font-extrabold leading-[1.08] tracking-tight text-system-900">
          Cada dato cuenta, cuando lo cuenta la comunidad
        </h1>
        <p style={retraso(180)} className="landing-entrada mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-system-600">
          <span className="marca-animada">DataForGood</span> conecta organizaciones con personas dispuestas a aportar
          información en campo —fotos, audio o texto— para causas sociales,
          ambientales y comunitarias.
        </p>

        <div style={retraso(270)} className="landing-entrada mt-8 flex flex-wrap justify-center gap-2.5">
          <ButtonLink href="/registro" variant="primary">
            Crear una campaña
          </ButtonLink>
          <ButtonLink href="/explorar" variant="secondary">
            Explorar campañas
          </ButtonLink>
        </div>

        {aportesRecientes.length > 0 ? (
          <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4">
            {aportesRecientes.map((post, i) => (
              <div
                key={post.id}
                className="landing-entrada landing-tarjeta flex flex-col justify-between rounded-lg border border-system-200 bg-white p-4 text-left"
                style={{ minHeight: 140, ...retraso(380 + i * 90) }}
              >
                <p className="text-[13px] leading-snug text-system-900">
                  &ldquo;{post.description.length > 90 ? `${post.description.slice(0, 90)}…` : post.description}&rdquo;
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-medium text-brand-600">{comoHashtag(post.tag)}</p>
                    <p className="font-mono text-[11px] text-system-500">
                      {new Date(post.submittedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: ZONA_DE_CAMPANAS })}
                    </p>
                  </div>
                  <Tag tone="ok">Aprobado</Tag>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-14 text-[13px] text-system-500">
            Todavía no hay aportes aprobados que mostrar aquí.
          </p>
        )}
      </section>

      <section className="w-full bg-system-900" aria-label="La plataforma en cifras">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4">
          {[
            { valor: cifras.campanasCreadas, etiqueta: "Campañas publicadas" },
            { valor: cifras.participantes, etiqueta: "Participantes" },
            { valor: cifras.datosRecolectados, etiqueta: "Aportes aprobados" },
            { valor: cifras.organizaciones, etiqueta: "Organizaciones" },
          ].map((k) => (
            <div key={k.etiqueta}>
              <ContadorAnimado valor={k.valor} className="block font-mono text-2xl font-extrabold text-white" />
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-widest text-white/60">
                {k.etiqueta}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-4xl px-6 pb-24 pt-16">
        <div className="landing-revelar mb-9 text-center">
          <p className="mb-2.5 font-mono text-[10.5px] uppercase tracking-widest text-system-500">
            El proceso
          </p>
          <h2 className="text-[28px] font-extrabold tracking-tight text-system-900">
            Tres pasos, de la idea al dato
          </h2>
        </div>
        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PASOS.map((p) => (
            <li key={p.numero} className="landing-revelar">
              <p className="mb-1.5 font-mono text-[11px] text-system-500" aria-hidden="true">
                {p.numero}
              </p>
              <h3 className="mb-1 text-[13.5px] font-semibold text-system-900">{p.titulo}</h3>
              <p className="text-[13px] leading-relaxed text-system-600">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {campanasDestacadas.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 pb-24" aria-label="Campañas destacadas">
          <div className="landing-revelar mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-extrabold text-system-900">Campañas destacadas</h2>
            <Link href="/explorar" className="text-[13px] font-semibold text-brand-600 hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {campanasDestacadas.map((c, i) => {
              const pct = porcentajeDeMeta(c.approvedContributions, c.goalContributions);
              return (
                <Link key={c.id} href={`/campanas/${c.id}`} className="landing-revelar block rounded-lg">
                  <Card className="landing-tarjeta h-full hover:border-brand-600">
                    <div className={`-mx-4 -mt-4 mb-3 h-24 rounded-t-lg bg-gradient-to-br ${COVER_GRADIENTS[i % COVER_GRADIENTS.length]}`} />
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-[15px] font-bold text-system-900">{c.name}</p>
                      <Tag tone="ok">Activa</Tag>
                    </div>
                    <ProgressBar pct={pct} tone="ok" />
                    <p className="mt-2 font-mono text-[11px] text-system-500">
                      {nf.format(c.participants)} participantes · {pct}% de la meta
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {tablaDeLideres && (
        <section className="mx-auto max-w-4xl px-6 pb-24" aria-labelledby="tabla-de-lideres">
          <div className="landing-revelar mb-5">
            <h2 id="tabla-de-lideres" className="text-2xl font-extrabold text-system-900">Tabla de líderes</h2>
            <p className="mt-1 max-w-md text-[13.5px] text-system-600">
              Quienes más aportan a la comunidad. Solo cuentan los aportes aprobados.
            </p>
          </div>
          <div className="landing-revelar">
            <TablaDeLideres tabla={tablaDeLideres} />
          </div>
        </section>
      )}

      {destacados.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 pb-24" aria-label="Datos abiertos">
          <div className="landing-revelar mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-system-900">Datos abiertos</h2>
              <p className="mt-1 max-w-md text-left text-[13.5px] text-system-600">
                Cuando una campaña cierra, sus aportes aprobados se publican como un conjunto
                consultable. {nf.format(totalConjuntos)}{" "}
                {totalConjuntos === 1 ? "conjunto disponible" : "conjuntos disponibles"}.
              </p>
            </div>
            <Link href="/datos" className="text-[13px] font-semibold text-brand-600 hover:underline">
              Explorar el catálogo →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {destacados.slice(0, 3).map((c) => (
              <Link key={c.id} href={`/datos/${c.id}`} className="landing-revelar block rounded-lg">
                <Card className="landing-tarjeta h-full hover:border-brand-600">
                  <p className="text-[14px] font-bold text-system-900">{c.name}</p>
                  <p className="mt-1 text-[12px] text-system-600">
                    {c.organizer}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(c.formats.length > 0 ? c.formats : c.dataTypes.map((dt) => DATA_TYPE_LABELS[dt] ?? dt))
                      .slice(0, 3)
                      .map((f) => (
                        <Tag key={f}>{f}</Tag>
                      ))}
                  </div>
                  <p className="mt-2.5 font-mono text-[11px] text-system-500">
                    {nf.format(c.approvedContributions)} aportes · {c.sizeLabel} ·{" "}
                    {nf.format(c.downloads)} descargas
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="landing-brillo w-full bg-system-900 px-6 py-16 text-center">
        <h2 className="mx-auto max-w-xl text-[26px] font-extrabold tracking-tight text-white">
          ¿Tienes un proyecto con impacto social?
        </h2>
        <p className="mt-2.5 text-[13px] text-white/65">
          Publica tu primera campaña y empieza a recolectar datos en minutos.
        </p>
        <ButtonLink href="/registro" variant="primary" className="mt-6 inline-flex">
          Comenzar ahora
        </ButtonLink>
      </section>

      </main>

      <PublicFooter />
    </div>
  );
}
