// Pantalla /usuarios/supervisores/[id]/revertir/[accionId]: revertir un dictamen.
// Server Component. Datos: obtenerAccion(). La acción revertirAccion aún NO hace nada (TODO).

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Aviso, ListaClaveValor, TituloDeSeccion, Volver } from "@/components/sistema/ui";
import Tag from "@/components/sistema/Tag";
import {
  ETIQUETA_DE_ACCION,
  describirReversion,
  formatearFechaHoraSup,
  obtenerAccion,
  obtenerActividad,
} from "@/lib/usuarios/supervisores";
import FormularioDeReversion from "./formulario";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; accionId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, accionId } = await params;
  const a = await obtenerAccion(id, accionId);
  return { title: a ? describirReversion(a).titulo : "Revertir acción" };
}

export default async function RevertirAccionPage({ params }: { params: Params }) {
  const { id, accionId } = await params;
  const [supervisor, accion] = await Promise.all([
    obtenerActividad(id),
    obtenerAccion(id, accionId),
  ]);

  if (!supervisor || !accion) notFound();

  if (accion.revertidaEn) {
    return (
      <div>
        <Volver href={`/usuarios/supervisores/${id}`}>
          Volver a la actividad de {supervisor.nombre}
        </Volver>
        <Aviso tono="neutro" titulo="Esta decisión ya fue revertida">
          Se revirtió el {formatearFechaHoraSup(accion.revertidaEn)}. El historial
          conserva tanto la decisión original como su reversión.
        </Aviso>
      </div>
    );
  }

  const d = describirReversion(accion);
  const et = ETIQUETA_DE_ACCION[accion.tipo];
  const c = accion.contexto;

  return (
    <div>
      <Volver href={`/usuarios/supervisores/${id}`}>
        Volver a la actividad de {supervisor.nombre}
      </Volver>

      <header className="mb-6">
        <h1 className="text-xl font-extrabold text-system-900">{d.titulo}</h1>
        <p className="mt-1 text-[13px] text-system-600">
          Decisión de {supervisor.nombre} · {formatearFechaHoraSup(accion.ejecutadaEn)}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <TituloDeSeccion>La decisión original</TituloDeSeccion>
          <ListaClaveValor
            filas={[
              { clave: "Acción", valor: <Tag tone={et.tono}>{et.texto}</Tag> },
              { clave: "Supervisor", valor: supervisor.nombre },
              ...(c.personaAfectada
                ? [{ clave: "Persona afectada", valor: c.personaAfectada }]
                : []),
              ...(c.campana ? [{ clave: "Campaña", valor: c.campana }] : []),
              ...(c.creadorDeCampana
                ? [{ clave: "Creador", valor: c.creadorDeCampana }]
                : []),
              { clave: "Ejecutada", valor: formatearFechaHoraSup(accion.ejecutadaEn) },
            ]}
          />

          <div className="mt-3.5">
            <span className="mb-1.5 block text-[13px] font-medium text-system-900">
              Motivo que registró el supervisor
            </span>
            <div className="rounded-lg border border-system-200 bg-system-100 p-4">
              <p className="text-[12.5px] text-system-600">«{accion.motivo}»</p>
            </div>
          </div>

          <Aviso tono="aviso" titulo="Qué pasa al revertir" className="mt-4">
            {d.efecto}
          </Aviso>
        </div>

        <div>
          <FormularioDeReversion
            supervisorId={id}
            accionId={accionId}
            supervisor={supervisor.nombre}
            notificable={d.notificable}
          />
        </div>
      </div>

      <Aviso tono="neutro" className="mt-5">
        Revertir no retira el rol. Si el patrón se repite, la vía es gestionar el
        rol de Supervisor o aplicar una sanción, ambas desde la sección de
        usuarios.
      </Aviso>
    </div>
  );
}
