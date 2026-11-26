// Pantalla /supervisar/campanas: todas las campañas aceptadas (por el SuperUsuario o por cualquier supervisor;
// 2026-10-15), en dos listas (2026-10-16; renglones desde el 2026-11-25): las que supervisa el SuperUsuario y las de
// los otros supervisores, con quién las supervisa. Filtros (2026-11-22): ?q= (campaña, creador, temática o supervisor)
// y ?estado=. Server Component. Datos: listarCampanasParaRoot().

import Link from "next/link";
import Tag from "@/components/ui/Tag";
import { ListaDeRenglones, Renglon } from "@/components/sistema/Renglones";
import { listarCampanasParaRoot, type CampanaSupervisable } from "@/lib/supervision/root";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { BackLink } from "../_ui";
import type { Metadata } from "next";
import { exigirSesionRoot } from "@/lib/supervision/root";
import FiltrosEnLaUrl from "@/components/sistema/FiltrosEnLaUrl";
import { busquedaDeLaUrl, coincideConLaBusqueda, cuantosDeCuantos, opcionDeLaUrl } from "@/lib/filtros-en-la-url";

export const metadata: Metadata = { title: "Campañas supervisadas" };

const ESTADOS = [
  { valor: "activa", etiqueta: "Activas" },
  { valor: "aceptada", etiqueta: "Aceptadas, sin empezar" },
  { valor: "pausada", etiqueta: "Pausadas" },
] as const;

export default async function SupervisedCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  await exigirSesionRoot();
  const { supervisadas } = await listarCampanasParaRoot();
  const filtros = await searchParams;
  const q = busquedaDeLaUrl(filtros.q);
  const estado = opcionDeLaUrl(filtros.estado, ESTADOS.map((e) => e.valor));
  const todas = supervisadas.filter((c) => c.status === "activa" || c.status === "aceptada" || c.status === "pausada");
  const campaigns = todas.filter(
    (c) =>
      (!estado || c.status === estado) &&
      coincideConLaBusqueda(q, c.name, c.creatorName, c.tag, c.supervisadaPor, c.id),
  );
  const mias = campaigns.filter((c) => c.supervision === "mia");
  const deOtros = campaigns.filter((c) => c.supervision !== "mia");

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/supervisar">Volver a supervisar</BackLink>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Modo supervisor · SuperUsuario</p><h1 className="mt-2 text-2xl font-extrabold text-system-900">Campañas supervisadas</h1><p className="mt-1 text-[13px] text-system-600">Las campañas aceptadas que siguen en curso, tuyas y de los otros supervisores. Abre una para ver su avance, sus participantes y sus aportes.</p><p className="mt-1 text-[13px] text-system-500">{cuantosDeCuantos(campaigns.length, todas.length)} registradas · {mias.length} tuyas · {deOtros.length} de otros supervisores</p></div>
      </div>
      <FiltrosEnLaUrl
        busqueda={{ etiqueta: "Buscar campañas", placeholder: "Buscar por campaña, creador, temática o supervisor" }}
        listas={[{ clave: "estado", etiqueta: "Filtrar por estado", todas: "Estado: todos", opciones: [...ESTADOS] }]}
      />
      <div className="space-y-6">
        <TablaDeSupervisadas titulo="Supervisadas por ti" campaigns={mias} vacio="Todavía no supervisas ninguna campaña aceptada." />
        <TablaDeSupervisadas titulo="Supervisadas por otros supervisores" campaigns={deOtros} vacio="Ningún supervisor tiene campañas aceptadas todavía." conSupervisor />
      </div>
    </div>
  );
}

const CLASE_ENLACE = "rounded-pill border border-system-300 bg-white px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600";

/**
 * Una lista de campañas supervisadas; `conSupervisor` agrega quién la supervisa (en las tuyas sobra). Desde el
 * 2026-11-25 son renglones como la vista de lista de Mis aportes (antes una tabla); sin tarjetas propias para el
 * teléfono, así que se ven igual en todos los anchos.
 */
function TablaDeSupervisadas({
  titulo,
  campaigns,
  vacio,
  conSupervisor = false,
}: {
  titulo: string;
  campaigns: CampanaSupervisable[];
  vacio: string;
  conSupervisor?: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-system-900">{titulo}</h2>
        <Tag tone="ok">{campaigns.length}</Tag>
      </div>
      {campaigns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-system-300 p-5 text-[13px] text-system-600">{vacio}</p>
      ) : (
        <ListaDeRenglones etiqueta={titulo}>
          {campaigns.map((campaign) => {
            const pct = porcentajeDeMeta(campaign.approvedContributions, campaign.goalContributions);
            return (
              <Renglon
                key={campaign.id}
                titulo={campaign.name}
                detalles={[
                  campaign.tag || "Sin temática",
                  conSupervisor ? `Supervisa: ${campaign.supervisadaPor ?? "Nadie"}` : null,
                  `${campaign.currentContributions} / ${campaign.goalContributions} aportes`,
                  `${campaign.participants} ${campaign.participants === 1 ? "participante" : "participantes"}`,
                ]}
                debajo={
                  <div className="h-1.5 max-w-xs overflow-hidden rounded-pill bg-system-100">
                    <div className="h-full rounded-pill bg-success-700" style={{ width: `${pct}%` }} />
                  </div>
                }
                lateral={
                  <>
                    <Tag tone={campaign.status === "activa" ? "ok" : campaign.status === "pausada" ? "default" : "warn"}>
                      {campaign.status === "activa" ? "Activa" : campaign.status === "pausada" ? "Pausada" : "Aceptada"}
                    </Tag>
                    {campaign.status === "aceptada" ? (
                      <Link href={`/supervisar/${campaign.id}`} className={CLASE_ENLACE}>
                        Ver detalle<span className="sr-only"> de {campaign.name}</span>
                      </Link>
                    ) : (
                      <>
                        <Link href={`/supervisar/${campaign.id}/usuarios`} className={CLASE_ENLACE}>
                          Usuarios<span className="sr-only"> de {campaign.name}</span>
                        </Link>
                        <Link href={`/supervisar/${campaign.id}/panel`} className={CLASE_ENLACE}>
                          Panel<span className="sr-only"> de {campaign.name}</span>
                        </Link>
                      </>
                    )}
                  </>
                }
              />
            );
          })}
        </ListaDeRenglones>
      )}
    </section>
  );
}
