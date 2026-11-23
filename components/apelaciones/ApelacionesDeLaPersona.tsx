"use client";

// Apelaciones de la persona (2026-11-22, a pedido del usuario): lo que puede apelar (con el formulario) y las
// apelaciones que ya mandó, con la respuesta del SuperUsuario. Lo usan /mis-apelaciones y /cuenta-bloqueada.
// Reglas en lib/apelaciones/reglas.ts; envía con la server action apelar (lib/apelaciones/acciones.ts), que pregunta
// antes ("¿Seguro que quieres…?", components/sistema/useConfirmacion) porque cada decisión se apela una sola vez.

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import { apelar } from "@/lib/apelaciones/acciones";
import {
  DIAS_PARA_APELAR,
  MOTIVO_MAXIMO,
  MOTIVO_MINIMO,
  NOMBRE_DE_ESTADO,
  efectoDeAceptar,
  tituloDeDecision,
  type DecisionApelada,
  type EstadoDeApelacion,
} from "@/lib/apelaciones/reglas";

/** Lo que llega del servidor, con las fechas ya en texto (hora de Tepic). */
export type ApelableParaLista = { clave: string; decision: DecisionApelada; fechaTexto: string; venceTexto: string };
export type ApelacionParaLista = {
  id: string;
  estado: EstadoDeApelacion;
  decision: DecisionApelada;
  motivo: string;
  respuesta: string | null;
  fechaTexto: string;
  resueltaTexto: string | null;
  decisionTexto: string;
};

const TONO: Record<EstadoDeApelacion, "warn" | "ok" | "danger"> = { pendiente: "warn", aceptada: "ok", rechazada: "danger" };

function Decision({ decision, fechaTexto }: { decision: DecisionApelada; fechaTexto: string }) {
  return (
    <>
      <p className="text-[15px] font-bold text-system-900">{tituloDeDecision(decision)}</p>
      <p className="mt-0.5 text-[12.5px] text-system-500">
        {fechaTexto} · {decision.aplicadaPor}
      </p>
      <blockquote className="mt-2.5 rounded-lg border-l-4 border-system-300 bg-system-100 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-system-900">
        {decision.motivo || "No se registró un motivo."}
      </blockquote>
    </>
  );
}

function FormularioDeApelacion({ apelable }: { apelable: ApelableParaLista }) {
  const router = useRouter();
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();
  const largo = motivo.trim().length;

  if (!abierto) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-system-500">Puedes apelar hasta el {apelable.venceTexto}.</p>
        <Button size="sm" onClick={() => setAbierto(true)}>
          Apelar<span className="sr-only"> {tituloDeDecision(apelable.decision)}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-system-900">
        ¿Por qué crees que esta decisión no es correcta?
      </label>
      <textarea
        id={id}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={MOTIVO_MAXIMO}
        rows={5}
        className="w-full rounded-lg border border-system-300 bg-white px-3.5 py-2.5 text-[14px] text-system-900 outline-none focus:border-brand-600"
        placeholder="Cuenta qué pasó y por qué la decisión debería cambiar. Lo lee la administración de DataForGood."
      />
      <p className={`mt-1 text-[12px] ${largo < MOTIVO_MINIMO ? "text-system-500" : "text-success-700"}`}>
        {largo} / {MOTIVO_MINIMO} caracteres mínimos
      </p>
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={ocupado || largo < MOTIVO_MINIMO}
          onClick={() =>
            pedirConfirmacion({
              pregunta: "¿Seguro que quieres enviar tu apelación?",
              detalle: (
                <>
                  <p>
                    Solo puedes apelar esta decisión una vez y no podrás cambiar lo que escribiste. La revisa la
                    administración de DataForGood y te llega su respuesta como notificación.
                  </p>
                  <p>Si la acepta: {efectoDeAceptar(apelable.decision.clase)}</p>
                </>
              ),
              textoConfirmar: "Sí, enviar apelación",
              textoOcupado: "Enviando…",
              accion: () => apelar(apelable.clave, motivo),
              alTerminar: () => router.refresh(),
            })
          }
        >
          Enviar apelación
        </Button>
      </div>
      {ventana}
    </div>
  );
}

export default function ApelacionesDeLaPersona({
  apelables,
  apelaciones,
}: {
  apelables: ApelableParaLista[];
  apelaciones: ApelacionParaLista[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="puedes-apelar">
        <h2 id="puedes-apelar" className="text-[17px] font-extrabold text-system-900">
          Puedes apelar
        </h2>
        <p className="mt-1 text-[13px] text-system-600">
          Las sanciones de tu cuenta y los baneos en una campaña de los últimos {DIAS_PARA_APELAR} días; una suspensión,
          solo mientras sigue activa. Cada decisión se apela una sola vez.
        </p>
        {apelables.length === 0 ? (
          <p className="mt-3 rounded-lg border border-system-200 bg-white p-4 text-[13.5px] text-system-600">
            No tienes decisiones que puedas apelar.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {apelables.map((a) => (
              <li key={a.clave} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm sm:p-5">
                <Decision decision={a.decision} fechaTexto={a.fechaTexto} />
                <FormularioDeApelacion apelable={a} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tus-apelaciones">
        <h2 id="tus-apelaciones" className="text-[17px] font-extrabold text-system-900">
          Tus apelaciones
        </h2>
        {apelaciones.length === 0 ? (
          <p className="mt-3 rounded-lg border border-system-200 bg-white p-4 text-[13.5px] text-system-600">
            Todavía no has apelado ninguna decisión.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {apelaciones.map((a) => (
              <li key={a.id} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-system-900">{tituloDeDecision(a.decision)}</p>
                    <p className="mt-0.5 text-[12.5px] text-system-500">
                      Decisión del {a.decisionTexto} · apelada el {a.fechaTexto}
                    </p>
                  </div>
                  <Tag tone={TONO[a.estado]}>{NOMBRE_DE_ESTADO[a.estado]}</Tag>
                </div>
                <p className="mt-3 text-[12.5px] font-semibold text-system-600">Lo que escribiste</p>
                <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-system-900">{a.motivo}</p>
                {a.estado === "pendiente" ? (
                  <p className="mt-3 text-[13px] text-system-600">
                    La administración la está revisando. Te llegará su respuesta como notificación.
                  </p>
                ) : (
                  <div className={`mt-3 rounded-lg border-l-4 px-3.5 py-2.5 ${a.estado === "aceptada" ? "border-success-700 bg-success-50" : "border-error-700 bg-error-50"}`}>
                    <p className="text-[12.5px] font-semibold text-system-900">
                      Respuesta de la administración{a.resueltaTexto ? ` · ${a.resueltaTexto}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-system-900">{a.respuesta}</p>
                    <p className="mt-1.5 text-[12.5px] text-system-600">
                      {a.estado === "aceptada" ? efectoDeAceptar(a.decision.clase) : "La decisión se mantiene. Esta respuesta es final."}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
