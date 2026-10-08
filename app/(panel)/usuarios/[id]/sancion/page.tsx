// Pantalla /usuarios/[id]/sancion: aplicar una sanción.
// Server Component. Datos: obtenerReporteDeSancion(). Formulario en formulario.tsx.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Identidad, Tarjeta, Volver } from "@/components/sistema/ui";
import { obtenerUsuario } from "@/lib/usuarios/directorio";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await obtenerUsuario(id);
  if (!u) notFound();

  return (
    <div>
      <Volver href={`/usuarios/${u.id}`}>Volver a la ficha</Volver>

      <header className="mb-6">
        <Identidad nombre={u.nombre} detalle={u.correo} riesgo={u.estado !== "ACTIVA"} />
        {u.strikes > 0 ? (
          <p className="mt-2 text-[12.5px] text-system-600">
            Ya acumula {u.strikes} de 3 strikes.
          </p>
        ) : null}
      </header>

      <Tarjeta className="max-w-xl">
        <FormularioDeSancion usuarioId={u.id} usuario={u.nombre} />
      </Tarjeta>
    </div>
  );
}
