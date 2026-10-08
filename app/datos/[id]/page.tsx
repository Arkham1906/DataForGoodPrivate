// Pantalla /datos/[id] (pública): ficha de un conjunto de datos abierto.
// Datos: obtenerConjuntoAbierto() de lib/open-data.ts. Descarga: GET /api/datos/[id]/descarga (ZIP con los
// archivos y la tabla aportes.csv).

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import ButtonLink from "@/components/ui/ButtonLink";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";
import { DATA_TYPE_LABELS, obtenerConjuntoAbierto } from "@/lib/open-data";

export const revalidate = 300;

const nf = new Intl.NumberFormat("es-MX");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const conjunto = await obtenerConjuntoAbierto(id);
  if (!conjunto) return { title: "Conjunto no encontrado" };
  return {
    title: conjunto.name,
    description: conjunto.description || undefined,
  };
}

export default async function ConjuntoAbiertoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conjunto = await obtenerConjuntoAbierto(id);
  if (!conjunto) notFound();

  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14">
        <Link href="/datos" className="text-[12.5px] font-medium text-brand-600 hover:underline">
          ← Volver al catálogo
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-system-900">
              {conjunto.name}
            </h1>
            {conjunto.verified && <Tag tone="ok">Verificado</Tag>}
          </div>
          <Tag tone="ok">{nf.format(conjunto.approvedContributions)} aportes aprobados</Tag>
        </div>
        <p className="mt-2 text-[13.5px] text-system-600">
          {conjunto.organizer || "Sin organización"}
          {conjunto.closedAt
            ? ` · cerró el ${new Date(conjunto.closedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`
            : ""}
        </p>

        {conjunto.description && (
          <p className="mt-5 max-w-2xl text-[14.5px] leading-relaxed text-system-600">
            {conjunto.description}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-1.5">
          <Tag>{conjunto.tematica || "Sin temática"}</Tag>
          <Tag>{conjunto.license}</Tag>
          {(conjunto.locationCity || conjunto.locationState) && (
            <Tag>{[conjunto.locationCity, conjunto.locationState].filter(Boolean).join(", ")}</Tag>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <p className="text-[11px] text-system-600">Tamaño</p>
            <p className="font-mono text-[15px] font-bold text-system-900">{conjunto.sizeLabel}</p>
          </Card>
          <Card>
            <p className="text-[11px] text-system-600">Descargas</p>
            <p className="font-mono text-[15px] font-bold text-system-900">{nf.format(conjunto.downloads)}</p>
          </Card>
          <Card>
            <p className="text-[11px] text-system-600">Calidad</p>
            <p className="font-mono text-[15px] font-bold text-system-900">
              {conjunto.quality != null ? `${conjunto.quality.toFixed(1)}/10` : "—"}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] text-system-600">Formatos</p>
            <p className="font-mono text-[15px] font-bold text-system-900">{conjunto.formats.length || "—"}</p>
          </Card>
        </div>

        <Card className="mt-4">
          <p className="mb-3 text-[13px] font-semibold text-system-900">Tipos de dato incluidos</p>
          <div className="flex flex-wrap gap-1.5">
            {conjunto.dataTypes.length > 0 ? (
              conjunto.dataTypes.map((dt) => <Tag key={dt}>{DATA_TYPE_LABELS[dt] ?? dt}</Tag>)
            ) : (
              <p className="text-[12.5px] text-system-400">Sin especificar</p>
            )}
          </div>
        </Card>

        <Card className="mt-4 bg-system-100">
          <p className="text-[13px] font-semibold text-system-900">Descarga del conjunto</p>
          {conjunto.approvedContributions > 0 ? (
            <>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-system-600">
                ZIP con la tabla <span className="font-mono">aportes.csv</span> (cada aporte aprobado
                con su campaña, ubicación, descripción y tipo; quien participó aparece como
                “Participante 1”, “Participante 2”… o “Anónimo”, nunca con su nombre ni correo)
                {conjunto.sizeBytes > 0
                  ? ` y los archivos de los aportes (${conjunto.formats.join(", ")}), ${conjunto.sizeLabel} en total.`
                  : ". Esta campaña no tiene archivos que descargar: sus aportes son de texto o sus archivos se eliminaron por moderación."}
              </p>
              <ButtonLink
                href={`/api/datos/${conjunto.id}/descarga`}
                variant="primary"
                className="mt-3 inline-flex"
              >
                {conjunto.sizeBytes > 0 ? `Descargar ZIP (${conjunto.sizeLabel})` : "Descargar ZIP"}
              </ButtonLink>
            </>
          ) : (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-system-600">
              Esta campaña todavía no tiene aportes aprobados, así que no hay nada que descargar.
            </p>
          )}
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
}
