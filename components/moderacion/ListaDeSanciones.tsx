"use client";

// Lista de sanciones de la moderación (2026-10-08; desde el 2026-10-13 en /supervisar/sanciones y
// /supervision/sanciones; en el panel, /usuarios/sanciones solo consulta). Igual que la bandeja /aportes
// (app/(panel)/aportes/lista.tsx, 2026-10-13): cada usuario ocupa un renglón resumen (cuántas, de qué tipo,
// cuántas vigentes, la más reciente), aunque tenga una sola, y al hacer clic se despliegan sus sanciones.
// En escritorio, renglones como la vista de lista de Mis aportes (components/sistema/Renglones, 2026-11-25): uno por
// usuario y, al desplegar, uno por sanción; en móvil, tarjetas.

import Link from "next/link";
import { useState } from "react";

import Tag from "@/components/sistema/Tag";
import { ListaDeRenglones, Renglon, RenglonDesplegable } from "@/components/sistema/Renglones";
import type { RegistroDeSancion } from "@/lib/usuarios/directorio";
import { rutasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";
import BotonRestaurar from "./BotonRestaurar";

/**
 * La zona y la cuenta de quien modera (un supervisor no se modera a sí mismo; null si es el SuperUsuario).
 * `soloLectura`: /usuarios/sanciones del panel (el SuperUsuario fuera del modo supervisor solo consulta):
 * sin "Restaurar", y el nombre lleva a la ficha /usuarios/[id] en vez de a sancionar.
 */
type Contexto = { zona: ZonaDeModeracion; cuentaPropia: string | null; soloLectura?: boolean };

/** Lo que llega del servidor: la fecha ya formateada (en hora de Tepic). */
export type SancionParaLista = Omit<RegistroDeSancion, "fecha"> & { fechaTexto: string };

const ETIQUETA: Record<RegistroDeSancion["tipo"], { texto: string; plural: string; tono: "warn" | "danger" }> = {
  STRIKE: { texto: "Aviso", plural: "Avisos", tono: "warn" },
  SUSPENSION: { texto: "Suspensión", plural: "Suspensiones", tono: "warn" },
  BANEO: { texto: "Baneo", plural: "Baneos", tono: "danger" },
  BANEO_EN_CAMPANA: { texto: "Baneo en campaña", plural: "Baneos en campaña", tono: "danger" },
};

/** Aviso (con su número), Suspensión (con sus días), Baneo o Baneo en campaña. */
function EtiquetaDeSancion({ s }: { s: SancionParaLista }) {
  const e = ETIQUETA[s.tipo];
  return (
    <Tag tone={s.vigente || s.tipo === "STRIKE" ? e.tono : "default"}>
      {e.texto}
      {s.tipo === "STRIKE" && s.aviso ? ` ${s.aviso}` : ""}
      {s.tipo === "SUSPENSION" ? ` · ${s.dias} ${s.dias === 1 ? "día" : "días"}` : ""}
    </Tag>
  );
}

/**
 * La campaña y el aporte que la originaron, o "Toda la cuenta" (con los reportes que la originaron).
 * `enLinea` (renglones de escritorio, 2026-11-25): todo en una línea, separado por " · ", en vez de un renglón por dato.
 */
function DondeSeAplico({ s, zona, enLinea = false }: { s: SancionParaLista; zona: ZonaDeModeracion; enLinea?: boolean }) {
  const rutas = rutasDeModeracion(zona);
  const otroDato = enLinea ? "" : "block ";
  if (s.tipo !== "BANEO_EN_CAMPANA") {
    return (
      <>
        <span className="text-system-500">Toda la cuenta</span>
        {s.porReportes && (
          <span className={`${otroDato}text-[11px] text-system-500`}>
            {enLinea ? " · " : ""}Por {s.porReportes.reportes} {s.porReportes.reportes === 1 ? "reporte" : "reportes"}
            {s.porReportes.tipo === "aporte" ? ` del aporte ${s.porReportes.aporteId ? `#${s.porReportes.aporteId}` : "borrado"} en` : " de"}{" "}
            {s.porReportes.campana ? (
              <Link href={rutas.campana(s.porReportes.campana.id)} className="hover:text-brand-600">
                {s.porReportes.campana.nombre}
              </Link>
            ) : (
              "una campaña eliminada"
            )}
          </span>
        )}
      </>
    );
  }
  return (
    <>
      {s.campana ? (
        <Link href={rutas.campana(s.campana.id)} className="hover:text-brand-600">
          {s.campana.nombre}
        </Link>
      ) : (
        "Campaña eliminada"
      )}
      {s.aporteId && (
        <span className={`${otroDato}font-mono text-[11px] text-system-500`}>
          {enLinea ? " · " : ""}Por el aporte #{s.aporteId}
        </span>
      )}
    </>
  );
}

/** Etiquetas por tipo con su cantidad ("2 Avisos", "1 Baneo en campaña"), en el orden de ETIQUETA. */
function Tipos({ sanciones }: { sanciones: SancionParaLista[] }) {
  return (
    <>
      {(Object.keys(ETIQUETA) as RegistroDeSancion["tipo"][]).map((tipo) => {
        const n = sanciones.filter((s) => s.tipo === tipo).length;
        if (n === 0) return null;
        return (
          <Tag key={tipo} tone={ETIQUETA[tipo].tono}>
            {n} {n === 1 ? ETIQUETA[tipo].texto : ETIQUETA[tipo].plural}
          </Tag>
        );
      })}
    </>
  );
}

const cuantas = (n: number) => `${n} ${n === 1 ? "sanción" : "sanciones"}`;

/** "1 vigente" (en rojo) o "Ninguna vigente". */
function Vigentes({ n }: { n: number }) {
  return n > 0 ? <Tag tone="danger">{n} {n === 1 ? "vigente" : "vigentes"}</Tag> : <Tag>Ninguna vigente</Tag>;
}

/** El enlace del renglón: la ficha (solo consulta), sancionar, o nada si es la cuenta de quien modera. */
function EnlaceDelGrupo({ g, zona, cuentaPropia, soloLectura, enMovil = false }: { g: Grupo; enMovil?: boolean } & Contexto) {
  const clase = enMovil
    ? "block text-[12px] font-semibold text-brand-600 hover:underline"
    : "whitespace-nowrap text-[12.5px] font-semibold text-brand-600 hover:underline";
  if (soloLectura) {
    return (
      <Link href={`/usuarios/${g.usuarioId}`} className={clase}>
        {enMovil ? `Ver ficha de ${g.usuario}` : "Ver ficha"}
        {!enMovil && <span className="sr-only"> de {g.usuario}</span>}
      </Link>
    );
  }
  if (g.usuarioId === cuentaPropia) return enMovil ? null : <span className="text-[12px] text-system-500">Tu cuenta</span>;
  return (
    <Link href={rutasDeModeracion(zona).sancionar(g.usuarioId)} className={clase}>
      {enMovil ? `Dar aviso o banear a ${g.usuario}` : "Sancionar"}
      {!enMovil && <span className="sr-only"> a {g.usuario}</span>}
    </Link>
  );
}

/** ¿Esta sanción muestra "Restaurar"? Si ninguna del grupo lo hace, la tabla no lleva esa columna. */
const puedeRestaurar = (s: SancionParaLista, { cuentaPropia, soloLectura }: Contexto) =>
  !soloLectura && s.restaurable && Boolean(s.sancionId) && s.usuarioId !== cuentaPropia;

type Grupo = { usuarioId: string; usuario: string; sanciones: SancionParaLista[] };

/** Agrupa por usuario conservando el orden: primero quien tiene la sanción más reciente. */
function agrupar(sanciones: SancionParaLista[]): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const s of sanciones) {
    const g = grupos.get(s.usuarioId) ?? { usuarioId: s.usuarioId, usuario: s.usuario, sanciones: [] };
    g.sanciones.push(s);
    grupos.set(s.usuarioId, g);
  }
  return [...grupos.values()];
}

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <span aria-hidden="true" className={`inline-block transition-transform motion-reduce:transition-none ${abierto ? "rotate-90" : ""}`}>
      ▸
    </span>
  );
}

const claseEstado = (vigente: boolean) =>
  `text-[12.5px] ${vigente ? "font-semibold text-system-900" : "text-system-500"}`;

export default function ListaDeSanciones({
  sanciones,
  zona,
  cuentaPropia,
  soloLectura = false,
}: { sanciones: SancionParaLista[] } & Contexto) {
  const grupos = agrupar(sanciones);
  const ctx: Contexto = { zona, cuentaPropia, soloLectura };
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const alternar = (usuarioId: string) =>
    setAbiertos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(usuarioId)) nuevo.delete(usuarioId);
      else nuevo.add(usuarioId);
      return nuevo;
    });

  return (
    <>
      {/* Móvil: una tarjeta por usuario; sus sanciones se despliegan dentro. */}
      <div className="space-y-3 md:hidden">
        {grupos.map((g) => {
          const abierto = abiertos.has(g.usuarioId);
          const vigentes = g.sanciones.filter((s) => s.vigente).length;
          const idPanel = `sanciones-movil-${g.usuarioId}`;
          return (
            <article key={g.usuarioId} className="rounded-lg border border-system-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => alternar(g.usuarioId)}
                aria-expanded={abierto}
                aria-controls={idPanel}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block break-words text-[14px] font-bold leading-snug text-system-900">{g.usuario}</span>
                  <span className="mt-1 block font-mono text-[11px] text-system-500">Última: {g.sanciones[0].fechaTexto}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <Tipos sanciones={g.sanciones} />
                    <Vigentes n={vigentes} />
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-brand-600">
                  {g.sanciones.length} <Chevron abierto={abierto} />
                </span>
              </button>
              {abierto && (
                <div id={idPanel} className="space-y-3 border-t border-system-200 bg-system-50 p-3">
                  <EnlaceDelGrupo g={g} {...ctx} enMovil />
                  {g.sanciones.map((s) => (
                    <TarjetaDeSancion key={s.id} s={s} {...ctx} />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Escritorio (2026-11-25): renglones como la vista de lista de Mis aportes. Cada usuario es un renglón que
          se despliega y, dentro, un renglón por sanción (antes una rejilla y una tabla con encabezados). */}
      <ListaDeRenglones etiqueta="Sanciones agrupadas por usuario" soloEscritorio>
        {grupos.map((g) => {
          const abierto = abiertos.has(g.usuarioId);
          const vigentes = g.sanciones.filter((s) => s.vigente).length;
          return (
            <RenglonDesplegable
              key={g.usuarioId}
              abierto={abierto}
              alAlternar={() => alternar(g.usuarioId)}
              idPanel={`sanciones-${g.usuarioId}`}
              titulo={g.usuario}
              rotulo={cuantas(g.sanciones.length)}
              detalles={[`Última: ${g.sanciones[0].fechaTexto}`]}
              lateral={
                <>
                  <Tipos sanciones={g.sanciones} />
                  <Vigentes n={vigentes} />
                  <EnlaceDelGrupo g={g} {...ctx} />
                </>
              }
            >
              <ListaDeRenglones etiqueta={`Sanciones de ${g.usuario}`}>
                {g.sanciones.map((s) => (
                  <RenglonDeSancion key={s.id} s={s} {...ctx} />
                ))}
              </ListaDeRenglones>
            </RenglonDesplegable>
          );
        })}
      </ListaDeRenglones>
    </>
  );
}

/** Una sanción dentro de un usuario desplegado: el motivo, de dónde, quién la aplicó y su estado; el tipo a la derecha. */
function RenglonDeSancion({ s, ...ctx }: { s: SancionParaLista } & Contexto) {
  return (
    <Renglon
      titulo={s.motivo}
      detalles={[
        s.fechaTexto,
        <DondeSeAplico key="donde" s={s} zona={ctx.zona} enLinea />,
        `Aplicó: ${s.quien}`,
        <span key="estado" className={s.vigente ? "font-semibold text-system-900" : undefined}>{s.estado}</span>,
      ]}
      lateral={
        <>
          <EtiquetaDeSancion s={s} />
          {puedeRestaurar(s, ctx) && s.sancionId && (
            <BotonRestaurar zona={ctx.zona} sancionId={s.sancionId} usuario={s.usuario} tipo={s.tipo} />
          )}
        </>
      }
    />
  );
}

/** Tarjeta de móvil, dentro de un usuario desplegado. */
function TarjetaDeSancion({ s, zona, cuentaPropia, soloLectura }: { s: SancionParaLista } & Contexto) {
  return (
    <article className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[11px] text-system-500">{s.fechaTexto}</p>
        <EtiquetaDeSancion s={s} />
      </div>

      <dl className="mt-3 space-y-3 border-t border-system-200 pt-3">
        <div>
          <dt className="text-[11px] text-system-600">Motivo</dt>
          <dd className="mt-1 break-words text-[13px] leading-relaxed text-system-900">{s.motivo}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-system-600">Campaña</dt>
          <dd className="mt-1 break-words text-[13px] text-system-900"><DondeSeAplico s={s} zona={zona} /></dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] text-system-600">Aplicó</dt>
          <dd className="text-right text-[13px] text-system-900">{s.quien}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] text-system-600">Estado</dt>
          <dd className={`text-right ${claseEstado(s.vigente)}`}>{s.estado}</dd>
        </div>
      </dl>

      {!soloLectura && s.restaurable && s.sancionId && s.usuarioId !== cuentaPropia && (
        <div className="mt-3 grid">
          <BotonRestaurar zona={zona} sancionId={s.sancionId} usuario={s.usuario} tipo={s.tipo} anchoCompleto />
        </div>
      )}
    </article>
  );
}
