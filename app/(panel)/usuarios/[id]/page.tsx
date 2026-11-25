// Pantalla /usuarios/[id]: ficha de un usuario (roles, sanciones, baneos por campaña).
// Server Component. Datos: obtenerUsuario() (lib/usuarios/directorio.ts) y baneosDeUsuario() (lib/campanas/baneos.ts).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AVISOS_PARA_BANEO, consecuenciaDelAviso, describirConsecuencia } from "@/lib/usuarios/escala-de-avisos";

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
import { exigirSesionRoot } from "@/lib/supervision/root";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await exigirSesionRoot();
  const { id } = await params;
  const u = await obtenerUsuario(id);
  return { title: u ? u.nombre : "Usuario" };
}

export default async function FichaDeUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirSesionRoot();
  const { id } = await params;
  const u = await obtenerUsuario(id);
  if (!u) notFound();
  // Baneos que le pusieron los creadores de campañas (distintos de las sanciones de cuenta).
  const baneosEnCampanas = await baneosDeUsuario(u.id);

  const baneado = u.estado === "BANEADA";
  // El siguiente aviso banea y manda el correo a la lista negra.
  const alLimite = u.strikes >= AVISOS_PARA_BANEO - 1;
  const siguiente = consecuenciaDelAviso(u.strikes + 1);

  return (
    <div>
      <Volver href="/usuarios">Volver al directorio</Volver>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <Identidad
          nombre={u.nombre}
          detalle={u.correo}
          descripcion="Ficha de la cuenta: sus datos, su historial de sanciones y los baneos que tiene en campañas."
          riesgo={baneado}
        />
        <div className="flex flex-wrap items-center gap-2">
          {/* Sancionar ya no está aquí (2026-10-13): se hace en modo supervisor (/supervisar/sanciones/[id]); en el
              panel, /usuarios/sanciones solo se consulta. */}
          <EnlaceBoton href={`/usuarios/${u.id}/roles`}>Cambiar rol</EnlaceBoton>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        <section>
          <TituloDeSeccion>Datos de la cuenta</TituloDeSeccion>
          <ListaClaveValor
            filas={[
              { clave: "Rol", valor: u.rol },
              // Permisos del usuario común (2026-11-22): toda cuenta los tiene hasta que el SuperUsuario los quita.
              {
                clave: "Permisos",
                valor:
                  u.rolesRetirados.length === 0
                    ? "Crea campañas y aporta"
                    : u.rolesRetirados.join(" · "),
              },
              { clave: "Organización", valor: u.organizacion ?? "Sin organización" },
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

          <MedidorDeStrikes acumulados={u.strikes} limite={AVISOS_PARA_BANEO} />
          <p className={`mb-3 text-[12px] ${u.strikes > 0 ? "text-warning-800" : "text-system-500"}`}>
            {u.strikes} de {AVISOS_PARA_BANEO} avisos · el siguiente trae: {describirConsecuencia(siguiente)}
          </p>

          {u.historialDeStrikes.length === 0 ? (
            <p className="text-[13px] text-system-600">Sin sanciones registradas.</p>
          ) : (
            <Tarjeta tenue>
              <ListaClaveValor
                filas={u.historialDeStrikes.map((s) => ({
                  clave: s.motivo,
                  valor: (
                    <span className="text-[12.5px] text-system-500">
                      {formatearFecha(s.fecha)} · {s.campana}
                    </span>
                  ),
                }))}
              />
            </Tarjeta>
          )}

          {alLimite ? (
            <Aviso tono="aviso" className="mt-3">
              Un aviso más banea la cuenta y pone su correo en la lista negra.
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
                      <span className="text-[12.5px] text-system-500">
                        {formatearFecha(b.baneadoEn)} · {b.baneadoPor}
                      </span>
                    ),
                  }))}
                />
              </Tarjeta>
            )}
            <p className="mt-2 text-[12px] text-system-500">
              Los aplica y los quita quien creó cada campaña; solo impiden aportar a esa campaña.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
