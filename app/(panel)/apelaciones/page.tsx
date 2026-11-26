// Pantalla /apelaciones del panel (2026-11-22, a pedido del usuario): las apelaciones de sanciones de la cuenta y de
// baneos en una campaña, que solo resuelve el SuperUsuario. Pendientes (las más viejas primero) o resueltas
// (?vista=resueltas); búsqueda por persona, motivo o campaña (?q=) y por qué se apeló (?clase=).
// Server Component. Datos: listarApelacionesDelPanel() de lib/apelaciones/apelaciones.ts. Lista y botones: lista.tsx.

import type { Metadata } from "next";

import FiltrosEnLaUrl from "@/components/sistema/FiltrosEnLaUrl";
import { Aviso, Encabezado, formatearNumero } from "@/components/sistema/ui";
import { contarApelacionesPendientes, listarApelacionesDelPanel } from "@/lib/apelaciones/apelaciones";
import { DIAS_PARA_APELAR, NOMBRE_DE_DECISION, type ClaseDeDecision } from "@/lib/apelaciones/reglas";
import { busquedaDeLaUrl, coincideConLaBusqueda, cuantosDeCuantos, opcionDeLaUrl } from "@/lib/filtros-en-la-url";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { formatearFecha } from "@/lib/usuarios/directorio";
import ListaDeApelaciones, { type ApelacionParaPanel } from "./lista";

export const metadata: Metadata = { title: "Apelaciones" };
export const dynamic = "force-dynamic";

const CLASES = Object.keys(NOMBRE_DE_DECISION) as ClaseDeDecision[];

export default async function ApelacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; q?: string; clase?: string }>;
}) {
  await exigirSesionRoot();
  const params = await searchParams;
  const vista = params.vista === "resueltas" ? "resueltas" : "pendientes";
  const [todas, pendientes] = await Promise.all([listarApelacionesDelPanel(vista), contarApelacionesPendientes()]);

  const q = busquedaDeLaUrl(params.q);
  const clase = opcionDeLaUrl(params.clase, CLASES);
  const filtradas = todas.filter(
    (a) =>
      (!clase || a.decision.clase === clase) &&
      coincideConLaBusqueda(q, a.persona.nombre, a.motivo, a.decision.motivo, a.decision.campana?.nombre, a.respuesta),
  );
  const paraLista: ApelacionParaPanel[] = filtradas.map((a) => ({
    id: a.id,
    estado: a.estado,
    decision: a.decision,
    decisionTexto: formatearFecha(new Date(a.decision.aplicadaEn)),
    motivo: a.motivo,
    respuesta: a.respuesta,
    fechaTexto: formatearFecha(a.creadaEn),
    resueltaTexto: a.resueltaEn ? formatearFecha(a.resueltaEn) : null,
    persona: a.persona,
    sigueVigente: a.sigueVigente,
  }));

  return (
    <div>
      <Encabezado
        titulo="Apelaciones"
        subtitulo={
          pendientes === 0
            ? "Sin apelaciones por resolver"
            : `${formatearNumero(pendientes)} ${pendientes === 1 ? "apelación espera" : "apelaciones esperan"} tu respuesta`
        }
      />

      <p className="-mt-3 mb-5 max-w-3xl text-[13px] text-system-600">
        Las personas apelan las sanciones de su cuenta y los baneos en una campaña, una sola vez y dentro de los{" "}
        {DIAS_PARA_APELAR} días siguientes. Solo tú las resuelves y tu respuesta es final: aceptar deshace la decisión;
        «No procede» la mantiene.
      </p>

      <FiltrosEnLaUrl
        tituloPanelMovil="Filtros de apelaciones"
        busqueda={{ etiqueta: "Buscar apelaciones", placeholder: "Buscar por persona, motivo o campaña" }}
        listas={[
          {
            clave: "vista",
            etiqueta: "Estado de la apelación",
            todas: "Estado: pendientes",
            opciones: [{ valor: "resueltas", etiqueta: "Resueltas" }],
          },
          {
            clave: "clase",
            etiqueta: "Filtrar por lo que se apeló",
            todas: "Todo lo apelado",
            opciones: CLASES.map((c) => ({ valor: c, etiqueta: NOMBRE_DE_DECISION[c] })),
          },
        ]}
        className="mb-4"
      />

      {todas.length === 0 ? (
        <Aviso tono="neutro">
          {vista === "pendientes" ? "No hay apelaciones por resolver." : "Todavía no se ha resuelto ninguna apelación."}
        </Aviso>
      ) : paraLista.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">Ninguna apelación coincide con los filtros.</p>
      ) : (
        <>
          {paraLista.length < todas.length && (
            <p className="mb-3 text-[12.5px] text-system-500">{cuantosDeCuantos(paraLista.length, todas.length)} apelaciones</p>
          )}
          <ListaDeApelaciones apelaciones={paraLista} />
        </>
      )}
    </div>
  );
}
