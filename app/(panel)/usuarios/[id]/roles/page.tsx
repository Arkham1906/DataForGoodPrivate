// Pantalla /usuarios/[id]/roles: asignar o revocar roles.
// Server Component. Datos: obtenerUsuario(). Botones en botones-de-rol.tsx.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Aviso,
  EnlaceBoton,
  Tarjeta,
  TituloDeSeccion,
  Volver,
  formatearNumero,
} from "@/components/sistema/ui";
import Tag from "@/components/sistema/Tag";
import {
  NOMBRE_DE_ROL,
  QUIEN_ASIGNA,
  formatearFecha,
  obtenerUsuario,
  type RolAsignable,
} from "@/lib/usuarios/directorio";
import { BotonAsignar, BotonRevocar } from "./botones-de-rol";

export const dynamic = "force-dynamic";

const ASIGNABLES: RolAsignable[] = ["SUPERVISOR", "REVISOR_DE_APORTES"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const u = await obtenerUsuario(id);
  return { title: u ? `Roles de ${u.nombre}` : "Roles" };
}

export default async function RolesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await obtenerUsuario(id);
  if (!u) notFound();

  const esSupervisor = u.rolesVigentes.includes("SUPERVISOR");
  const esRevisor = u.rolesVigentes.includes("REVISOR_DE_APORTES");
  const detalle =
    u.rolesVigentes.length > 0
      ? `${u.correo} · ${u.rolesVigentes.map((r) => NOMBRE_DE_ROL[r]).join(" y ")}${
          u.rolDesde ? ` desde ${formatearFecha(u.rolDesde)}` : ""
        }`
      : `${u.correo} · actualmente usuario común`;

  return (
    <div>
      <Volver href={`/usuarios/${u.id}`}>Volver a la ficha</Volver>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">Roles de {u.nombre}</h1>
          <p className="mt-1 font-mono text-[13px] text-system-600">{detalle}</p>
        </div>
        <EnlaceBoton href={`/usuarios/${u.id}`}>Ver ficha completa</EnlaceBoton>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <TituloDeSeccion>Asignar rol</TituloDeSeccion>
          <div className="mb-4 flex flex-col gap-2">
            {ASIGNABLES.map((rol) => {
              const asignado = u.rolesVigentes.includes(rol);
              return (
                <Tarjeta
                  key={rol}
                  className={`flex items-center justify-between gap-3 ${
                    asignado ? "border-brand-600" : ""
                  }`}
                >
                  <div>
                    <p className="text-[13.5px] font-semibold text-system-900">{NOMBRE_DE_ROL[rol]}</p>
                    <p className="text-[12.5px] text-system-400">{QUIEN_ASIGNA[rol]}</p>
                  </div>
                  {rol === "REVISOR_DE_APORTES" ? (
                    <Tag tone={asignado ? "ok" : "default"}>
                      {asignado ? "Asignado" : "Por invitación"}
                    </Tag>
                  ) : (
                    <BotonAsignar usuarioId={u.id} rol={rol} asignado={asignado} />
                  )}
                </Tarjeta>
              );
            })}
          </div>
        </section>

        <section>
          {esSupervisor && (
            <>
              <TituloDeSeccion>Campañas bajo supervisión</TituloDeSeccion>
              <p className="mb-2.5 text-[13px] text-system-600">
                Cada supervisor escoge qué campañas en revisión supervisa; su
                especialidad es solo informativa.
              </p>
            </>
          )}

          {esRevisor && (
            <>
              <TituloDeSeccion>Revisor de aportes</TituloDeSeccion>
              <Tarjeta className="mb-4">
                <p className="mb-1 text-[13.5px] font-semibold text-system-900">Revisor de aportes</p>
                <p className="text-[12.5px] text-system-600">
                  Aceptó una invitación de al menos una campaña. Revocar aquí lo
                  retira de todas las campañas donde esté aceptado.
                </p>
              </Tarjeta>
            </>
          )}

          {!esSupervisor && !esRevisor && (
            <>
              <TituloDeSeccion>Rol vigente</TituloDeSeccion>
              <Tarjeta tenue className="mb-4">
                <p className="mb-1 text-[13.5px] font-semibold text-system-900">Sin rol asignado</p>
                <p className="text-[12.5px] text-system-600">
                  Es usuario común. Ha creado {formatearNumero(u.campanasCreadas)}{" "}
                  campañas, cosa que no requiere rol alguno, y lleva{" "}
                  {formatearNumero(u.aportesEnviados)} aportes enviados.
                </p>
              </Tarjeta>

              <TituloDeSeccion>Intereses declarados</TituloDeSeccion>
              <p className="mb-2.5 text-[13px] text-system-600">
                Si se le asigna Supervisor, las campañas se reparten por
                especialidad declarada; si no tiene, por estos intereses.
              </p>
            </>
          )}

          <div className="flex flex-col gap-2">
            {u.interesesDeclarados.map((i) => (
              <div
                key={i.tema}
                className="flex items-center justify-between rounded border border-system-300 bg-white px-3.5 py-2.5 text-[13px] text-system-900"
              >
                <span>{i.tema}</span>
                <span className="font-mono text-[12px] text-system-400">{i.campanas} campañas</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {esSupervisor && (
              <div>
                <Aviso tono="aviso">
                  Al revocar el rol, sus campañas activas siguen corriendo y pasan
                  a la tutela del supervisor del área.
                </Aviso>
                <BotonRevocar usuarioId={u.id} rol="SUPERVISOR" />
              </div>
            )}
            {esRevisor && (
              <div>
                <Aviso tono="aviso">
                  Al revocar, deja de ser revisor en todas las campañas donde esté
                  aceptado; el creador de cada una deberá invitar a alguien más.
                </Aviso>
                <BotonRevocar usuarioId={u.id} rol="REVISOR_DE_APORTES" />
              </div>
            )}
            {!esSupervisor && !esRevisor && u.strikes > 0 && (
              <Aviso tono="aviso">
                Acumula {u.strikes} de 3 strikes. Conviene revisar el historial de
                sanciones en su ficha antes de asignarle un rol.
              </Aviso>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
