// Pantalla /usuarios/[id]/sancion: dar un aviso (escala de lib/usuarios/escala-de-avisos.ts) o banear.
// Server Component. Datos: obtenerUsuario(). Formulario en formulario.tsx.
// Con ?reportes=<clave> ("campana-116" o "aporte-55", desde la bandeja /reportes) la sanción confirma los
// reportes pendientes de esa campaña o aporte contra la persona (reportesPendientesContra).

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Aviso, Identidad, Tarjeta, Volver } from "@/components/sistema/ui";
import { obtenerUsuario } from "@/lib/usuarios/directorio";
import { reportesPendientesContra } from "@/lib/reportes/reportes";
import { leerClaveDeReportes } from "@/lib/reportes/motivos";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { AVISOS_PARA_BANEO } from "@/lib/usuarios/escala-de-avisos";
import FormularioDeSancion from "./formulario";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const u = await obtenerUsuario(id);
  return { title: u ? `Sancionar a ${u.nombre}` : "Sancionar" };
}

export default async function SancionarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reportes?: string }>;
}) {
  await exigirSesionRoot();
  const { id } = await params;
  const { reportes: reportesDe } = await searchParams;
  const u = await obtenerUsuario(id);
  if (!u) notFound();

  const clave = leerClaveDeReportes(reportesDe);
  const reportes = clave ? await reportesPendientesContra(clave, Number(u.id)) : null;

  return (
    <div>
      {clave ? (
        <Volver href="/reportes">Volver a reportes</Volver>
      ) : (
        <Volver href={`/usuarios/${u.id}`}>Volver a la ficha</Volver>
      )}

      <header className="mb-6">
        <Identidad nombre={u.nombre} detalle={u.correo} riesgo={u.estado !== "ACTIVA"} />
        <p className="mt-2 text-[12.5px] text-system-600">
          Lleva {u.strikes} de {AVISOS_PARA_BANEO} avisos.
        </p>
      </header>

      {clave && reportes ? (
        <Aviso
          tono="aviso"
          titulo={`Por ${reportes.reportes} ${reportes.reportes === 1 ? "reporte" : "reportes"} ${reportes.titulo}`}
          className="mb-4 max-w-xl"
        >
          {reportes.motivos.length > 0 ? `Motivos: ${reportes.motivos.join(" · ")}. ` : ""}
          Al aplicar la sanción, esos reportes quedan resueltos con ella. {u.nombre} no sabrá quién lo reportó.
        </Aviso>
      ) : clave ? (
        <Aviso tono="neutro" className="mb-4 max-w-xl">
          Ya no quedan reportes pendientes de ese caso contra {u.nombre}. Si aplicas una sanción, no quedará ligada a ellos.
        </Aviso>
      ) : null}

      <Tarjeta className="max-w-xl">
        <FormularioDeSancion
          usuarioId={u.id}
          usuario={u.nombre}
          avisos={u.strikes}
          baneada={u.estado === "BANEADA"}
          reportes={clave && reportes ? reportesDe : undefined}
        />
      </Tarjeta>
    </div>
  );
}
