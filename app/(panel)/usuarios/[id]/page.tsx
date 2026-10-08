// Pantalla /usuarios/[id]: ficha de un usuario (roles, sanciones, baneos por campaña).
// Server Component. Datos: obtenerUsuario() (lib/usuarios/directorio.ts) y baneosDeUsuario() (lib/campanas/baneos.ts).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Aviso,
  EnlaceBoton,
  Identidad,
  ListaClaveValor,
  MedidorDeStrikes,
  Tarjeta,
  TituloDeSeccion,
  Volver,
  formatearNumero,
} from "@/components/sistema/ui";
import { formatearFecha, obtenerUsuario } from "@/lib/usuarios/directorio";
import { baneosDeUsuario } from "@/lib/campanas/baneos";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const u = await obtenerUsuario(id);
  return { title: u ? u.nombre : "Usuario" };
}

export default async function FichaDeUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await obtenerUsuario(id);
  if (!u) notFound();
  // Baneos que le pusieron los creadores de campañas (distintos de las sanciones de cuenta).
  const baneosEnCampanas = await baneosDeUsuario(u.id);

  const baneado = u.estado === "BANEADA";
  const alLimite = u.strikes >= 2;

  return (
    <div>
      <Volver href="/usuarios">Volver al directorio</Volver>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <Identidad nombre={u.nombre} detalle={u.correo} riesgo={baneado} />
        <div className="flex flex-wrap items-center gap-2">
          <EnlaceBoton href={`/usuarios/${u.id}/roles`}>Cambiar rol</EnlaceBoton>
          <Link
            href={`/usuarios/${u.id}/sancion`}
            className="inline-flex items-center justify-center gap-1.5 rounded-pill border border-error-700 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-error-700 transition-colors hover:bg-error-50"
          >
            Sancionar
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <ListaClaveValor
            filas={[
              { clave: "Rol", valor: u.rol },
              { clave: "Ubicación", valor: u.ubicacion ?? "No declarada" },
              { clave: "Especialidad", valor: u.especialidad ?? "No declarada" },
              { clave: "Registro", valor: formatearFecha(u.registradoEn) },
              { clave: "Campañas creadas", valor: formatearNumero(u.campanasCreadas) },
              { clave: "Aportes enviados", valor: formatearNumero(u.aportesEnviados) },
            ]}
          />
        </section>

        <section>
          <TituloDeSeccion>Historial de sanciones</TituloDeSeccion>

          <MedidorDeStrikes acumulados={u.strikes} />
          <p className={`mb-3 text-[12px] ${u.strikes > 0 ? "text-warning-800" : "text-system-400"}`}>
            {u.strikes} de 3 strikes acumulados
          </p>

          {u.historialDeStrikes.length === 0 ? (
            <p className="text-[13px] text-system-600">Sin sanciones registradas.</p>
          ) : (
            <Tarjeta tenue>
              <ListaClaveValor
                filas={u.historialDeStrikes.map((s) => ({
                  clave: s.motivo,
                  valor: (
                    <span className="text-[12.5px] text-system-400">
                      {formatearFecha(s.fecha)} · {s.campana}
                    </span>
                  ),
                }))}
              />
            </Tarjeta>
          )}

          {alLimite ? (
            <Aviso tono="aviso" className="mt-3">
              Un strike más activa el baneo permanente.
            </Aviso>
          ) : null}

          <div className="mt-6">
            <TituloDeSeccion>Baneos en campañas</TituloDeSeccion>
            {baneosEnCampanas.length === 0 ? (
              <p className="text-[13px] text-system-600">No está baneado de ninguna campaña.</p>
            ) : (
              <Tarjeta tenue>
                <ListaClaveValor
                  filas={baneosEnCampanas.map((b) => ({
                    clave: (
                      <span>
                        <Link href={`/sistema/campanas/${b.campanaId}`} className="font-semibold text-system-900 hover:underline">
                          {b.campana}
                        </Link>
                        <span className="block text-[12.5px] text-system-600">{b.motivo}</span>
                      </span>
                    ),
                    valor: (
                      <span className="text-[12.5px] text-system-400">
                        {formatearFecha(b.baneadoEn)} · {b.baneadoPor}
                      </span>
                    ),
                  }))}
                />
              </Tarjeta>
            )}
            <p className="mt-2 text-[12px] text-system-400">
              Los aplica y los quita quien creó cada campaña; solo impiden aportar a esa campaña.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
