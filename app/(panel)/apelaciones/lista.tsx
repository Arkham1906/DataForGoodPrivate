"use client";

// Lista de /apelaciones del panel (2026-11-22): cada apelación con la decisión apelada, lo que escribió la persona y,
// si está pendiente, la respuesta y los botones "Aceptar apelación" / "No procede", que preguntan antes
// (components/sistema/useConfirmacion) y llaman a resolverApelacionDelPanel (lib/apelaciones/acciones.ts).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import Button from "@/components/sistema/Button";
import { ListaDeRenglones, RenglonDesplegable } from "@/components/sistema/Renglones";
import Tag from "@/components/sistema/Tag";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import { resolverApelacionDelPanel } from "@/lib/apelaciones/acciones";
import {
  NOMBRE_DE_DECISION,
  NOMBRE_DE_ESTADO,
  RESPUESTA_MAXIMA,
  RESPUESTA_MINIMA,
  efectoDeAceptar,
  tituloDeDecision,
  type DecisionApelada,
  type EstadoDeApelacion,
} from "@/lib/apelaciones/reglas";

export type ApelacionParaPanel = {
  id: string;
  estado: EstadoDeApelacion;
  decision: DecisionApelada;
  decisionTexto: string;
  motivo: string;
  respuesta: string | null;
  fechaTexto: string;
  resueltaTexto: string | null;
  persona: { id: string; nombre: string };
  sigueVigente: boolean;
};

const TONO: Record<EstadoDeApelacion, "warn" | "ok" | "danger"> = { pendiente: "warn", aceptada: "ok", rechazada: "danger" };

function Resolver({ a }: { a: ApelacionParaPanel }) {
  const router = useRouter();
  const id = useId();
  const [respuesta, setRespuesta] = useState("");
  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();
  const largo = respuesta.trim().length;
  const corta = largo < RESPUESTA_MINIMA;

  function resolver(aceptar: boolean) {
    pedirConfirmacion(
      aceptar
        ? {
            pregunta: `¿Seguro que quieres aceptar la apelación de ${a.persona.nombre}?`,
            detalle: (
              <>
                <p>{a.sigueVigente ? efectoDeAceptar(a.decision.clase) : "La decisión ya no está en pie (se levantó o terminó): solo queda constancia."}</p>
                <p>{a.persona.nombre} recibe tu respuesta. No se puede deshacer.</p>
              </>
            ),
            textoConfirmar: "Sí, aceptar",
            textoOcupado: "Aceptando…",
            accion: () => resolverApelacionDelPanel(a.id, true, respuesta),
            alTerminar: () => router.refresh(),
          }
        : {
            pregunta: `¿Seguro que quieres rechazar la apelación de ${a.persona.nombre}?`,
            detalle: (
              <p>
                La decisión se mantiene y {a.persona.nombre} recibe tu respuesta. No puede volver a apelarla. No se puede
                deshacer.
              </p>
            ),
            textoConfirmar: "Sí, no procede",
            textoOcupado: "Guardando…",
            peligro: true,
            accion: () => resolverApelacionDelPanel(a.id, false, respuesta),
            alTerminar: () => router.refresh(),
          },
    );
  }

  return (
    <div className="mt-4 border-t border-system-200 pt-4">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-system-900">
        Respuesta para {a.persona.nombre}
      </label>
      <textarea
        id={id}
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        maxLength={RESPUESTA_MAXIMA}
        rows={3}
        placeholder="Explica por qué la aceptas o por qué no procede. La persona la lee tal cual."
        className="w-full rounded border border-system-300 bg-white px-3.5 py-2.5 text-sm text-system-900 outline-none transition-colors focus:border-brand-600"
      />
      <p className={`mt-1 text-[12px] ${corta ? "text-system-500" : "text-success-700"}`}>
        {largo} / {RESPUESTA_MINIMA} caracteres mínimos
      </p>
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="danger" disabled={ocupado || corta} onClick={() => resolver(false)}>
          No procede
        </Button>
        <Button size="sm" variant="primary" disabled={ocupado || corta} onClick={() => resolver(true)}>
          Aceptar apelación
        </Button>
      </div>
      {ventana}
    </div>
  );
}

/**
 * Renglones como la vista de lista de Mis aportes (2026-11-26, a pedido del usuario; antes una tarjeta grande por
 * apelación): cada apelación es un renglón que se despliega con la decisión, lo que escribió la persona y la respuesta.
 * Las pendientes empiezan abiertas para tener a la vista el formulario de respuesta.
 */
export default function ListaDeApelaciones({ apelaciones }: { apelaciones: ApelacionParaPanel[] }) {
  // Solo se guardan las que se abrieron o cerraron a mano: así una pendiente que llega en vivo también sale abierta.
  const [cambiadas, setCambiadas] = useState<Set<string>>(new Set());
  const abierta = (a: ApelacionParaPanel) => (a.estado === "pendiente") !== cambiadas.has(a.id);
  const alternar = (id: string) =>
    setCambiadas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  return (
    <ListaDeRenglones etiqueta="Apelaciones">
      {apelaciones.map((a) => (
        <RenglonDesplegable
          key={a.id}
          abierto={abierta(a)}
          alAlternar={() => alternar(a.id)}
          idPanel={`apelacion-${a.id}`}
          titulo={a.persona.nombre}
          rotulo={NOMBRE_DE_DECISION[a.decision.clase]}
          detalles={[
            // Sin repetir el rótulo cuando la decisión no dice más ("Baneo de la cuenta • Baneo de la cuenta").
            tituloDeDecision(a.decision) !== NOMBRE_DE_DECISION[a.decision.clase] ? tituloDeDecision(a.decision) : null,
            `Apelada el ${a.fechaTexto}`,
            a.resueltaTexto ? `Resuelta el ${a.resueltaTexto}` : null,
          ]}
          lateral={<Tag tone={TONO[a.estado]}>{NOMBRE_DE_ESTADO[a.estado]}</Tag>}
        >
          {/* El enlace va aquí: dentro del botón del renglón no cabe un enlace. */}
          <Link href={`/usuarios/${a.persona.id}`} className="text-[12px] font-semibold text-brand-600 hover:underline">
            Ver ficha de {a.persona.nombre}
          </Link>

          <div className="mt-3">
            <h3 className="text-[13px] font-semibold text-system-900">La decisión: {tituloDeDecision(a.decision)}</h3>
            <p className="mt-0.5 text-[12px] text-system-500">
              {a.decisionTexto} · {a.decision.aplicadaPor}
            </p>
            <p className="mt-1.5 rounded-lg border border-system-200 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-system-900">
              {a.decision.motivo || "No se registró un motivo."}
            </p>
          </div>

          <div className="mt-3">
            <h3 className="text-[13px] font-semibold text-system-900">Lo que escribió</h3>
            <p className="mt-1.5 whitespace-pre-line rounded-lg border-l-4 border-brand-600 bg-brand-50 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-system-900">
              {a.motivo}
            </p>
          </div>

          {a.estado === "pendiente" ? (
            <>
              {!a.sigueVigente && (
                <p className="mt-3 text-[12.5px] text-warning-800">
                  Esta decisión ya no está en pie (se levantó o terminó) mientras esperaba: aceptar solo deja constancia.
                </p>
              )}
              <Resolver a={a} />
            </>
          ) : (
            <div className="mt-3">
              <h3 className="text-[13px] font-semibold text-system-900">Tu respuesta</h3>
              <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-system-900">{a.respuesta}</p>
            </div>
          )}
        </RenglonDesplegable>
      ))}
    </ListaDeRenglones>
  );
}
