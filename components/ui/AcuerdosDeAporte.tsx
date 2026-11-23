"use client";

// Acuerdos para aportar (2026-10-15, a pedido del usuario; reemplaza a la ventana "Antes de enviar" que salía
// en cada aporte). Dos casillas cortas, "Acepto el acuerdo de confirmación" y "Acepto el acuerdo de uso del
// aporte". Desde el 2026-11-23 (a pedido del usuario) cada una lleva justo después su propio enlace, "Leer el
// acuerdo", que abre una ventana (<dialog> nativo) solo con ese acuerdo; antes había un solo "Leer los acuerdos"
// debajo de las dos, con los dos textos en la misma ventana (lib/aportes/consentimiento.ts).
//   - Con cuenta, se aceptan una sola vez al inscribirse (POST /api/campanas/[id]/inscripcion). En /campanas/[id],
//     VentanaDeInscripcion: ventana emergente al dar "Realizar un aporte" (2026-11-10, a pedido del usuario; antes
//     las casillas iban en la página). Si llega a /campanas/[id]/aportar sin inscribirse, InscripcionACampana arriba.
//   - CasillasDeAcuerdos + agregarAcuerdos: sin cuenta (/c/[token]), en el formulario de cada aporte.
// El servidor vuelve a exigirlos en los dos casos.

import { useEffect, useId, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import { BASE_PATH } from "@/lib/base-path";
import {
  AVISO_DE_CONTENIDO,
  AVISO_DE_USO,
  CAMPO_ACEPTA_USO,
  CAMPO_CONFIRMA_CONTENIDO,
  CASILLA_DE_CONFIRMACION,
  CASILLA_DE_USO,
  CONSECUENCIA_DEL_CONTENIDO,
} from "@/lib/aportes/consentimiento";
import { claseDeVentana } from "@/components/ui/ventana-emergente";

export type Acuerdos = { confirmaContenido: boolean; aceptaUso: boolean };

export const SIN_ACUERDOS: Acuerdos = { confirmaContenido: false, aceptaUso: false };

export const acuerdosCompletos = (a: Acuerdos) => a.confirmaContenido && a.aceptaUso;

type CualAcuerdo = "confirmacion" | "uso";

const TITULO_DEL_ACUERDO: Record<CualAcuerdo, string> = {
  confirmacion: "Acuerdo de confirmación",
  uso: "Acuerdo de uso del aporte",
};

/** Ventana de solo lectura con el texto completo de un acuerdo (2026-11-23: una por acuerdo). */
function VentanaDeAcuerdo({
  cual,
  abierta,
  onCerrar,
  proposito,
}: {
  cual: CualAcuerdo;
  abierta: boolean;
  onCerrar: () => void;
  proposito?: string | null;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  // Hay dos ventanas (y puede haber casillas en más de un lugar): cada título con su propio id.
  const idTitulo = useId();

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierta && !el.open) el.showModal();
    if (!abierta && el.open) el.close();
  }, [abierta]);

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      onClose={() => {
        if (abierta) onCerrar();
      }}
      // Clic en el fondo (fuera de la caja): se cierra.
      onClick={(e) => {
        if (e.target === dialogo.current) onCerrar();
      }}
      className={claseDeVentana("normal")}
    >
      <div className="flex max-h-[88vh] flex-col">
        <div className="border-b border-system-200 px-5 py-5 md:px-8 md:py-6">
          <h2 id={idTitulo} className="text-xl font-extrabold md:text-2xl text-system-900">
            {TITULO_DEL_ACUERDO[cual]}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-6 text-[15px] text-system-600">
          {cual === "confirmacion" ? (
            <>
              <p>{AVISO_DE_CONTENIDO}</p>
              {/* Qué pasa si no se cumple: es de este acuerdo (antes iba al final de la ventana con los dos). */}
              <p className="mt-4 text-[13.5px] text-system-500">{CONSECUENCIA_DEL_CONTENIDO}</p>
            </>
          ) : (
            <>
              <p>{AVISO_DE_USO}</p>
              {proposito && (
                // Propósito de la campaña (2026-10-27): para qué se usarán los datos.
                <p className="mt-2">
                  <span className="font-semibold text-system-900">Propósito de esta campaña:</span> {proposito}.
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end border-t border-system-200 px-5 py-4 md:px-8 md:py-5">
          <Button type="button" variant="primary" onClick={onCerrar}>
            Entendido
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/** "Leer el acuerdo": va justo después del texto de su casilla, fuera de la <label> (un botón no puede ir dentro). */
function EnlaceDeAcuerdo({ cual, onAbrir }: { cual: CualAcuerdo; onAbrir: (cual: CualAcuerdo) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(cual)}
      className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
    >
      Leer el acuerdo<span className="sr-only"> de {cual === "confirmacion" ? "confirmación" : "uso del aporte"}</span>
    </button>
  );
}

/** Las dos casillas cortas, cada una con su enlace para leer ese acuerdo completo. */
export function CasillasDeAcuerdos({
  acuerdos,
  onCambio,
  deshabilitado = false,
  proposito,
}: {
  acuerdos: Acuerdos;
  onCambio: (acuerdos: Acuerdos) => void;
  deshabilitado?: boolean;
  /** Para qué se usarán los datos (lib/campanas/proposito.ts, textoDelProposito), si la campaña lo tiene. */
  proposito?: string | null;
}) {
  const [leyendo, setLeyendo] = useState<CualAcuerdo | null>(null);
  const idConfirmacion = useId();
  const idUso = useId();
  const claseDelRenglon = "flex items-start gap-2 text-[length:var(--ventana-campo,12.5px)] text-system-700";

  return (
    <div className="flex flex-col gap-2">
      <div className={claseDelRenglon}>
        <input
          id={idConfirmacion}
          type="checkbox"
          className="mt-0.5"
          checked={acuerdos.confirmaContenido}
          onChange={(e) => onCambio({ ...acuerdos, confirmaContenido: e.target.checked })}
          disabled={deshabilitado}
        />
        <span>
          <label htmlFor={idConfirmacion}>{CASILLA_DE_CONFIRMACION}</label>{" "}
          <EnlaceDeAcuerdo cual="confirmacion" onAbrir={setLeyendo} />
        </span>
      </div>
      <div className={claseDelRenglon}>
        <input
          id={idUso}
          type="checkbox"
          className="mt-0.5"
          checked={acuerdos.aceptaUso}
          onChange={(e) => onCambio({ ...acuerdos, aceptaUso: e.target.checked })}
          disabled={deshabilitado}
        />
        <span>
          <label htmlFor={idUso}>{CASILLA_DE_USO}</label> <EnlaceDeAcuerdo cual="uso" onAbrir={setLeyendo} />
          {proposito && <span className="mt-0.5 block text-[length:var(--ventana-pista,11.5px)] text-system-500">Los datos se usarán para: {proposito}.</span>}
        </span>
      </div>
      <VentanaDeAcuerdo cual="confirmacion" abierta={leyendo === "confirmacion"} onCerrar={() => setLeyendo(null)} />
      <VentanaDeAcuerdo cual="uso" abierta={leyendo === "uso"} onCerrar={() => setLeyendo(null)} proposito={proposito} />
    </div>
  );
}

/** Agrega las dos casillas al FormData de un aporte sin cuenta, con el formato que espera el servidor. */
export function agregarAcuerdos(datos: FormData, acuerdos: Acuerdos) {
  if (acuerdos.aceptaUso) datos.set(CAMPO_ACEPTA_USO, "si");
  if (acuerdos.confirmaContenido) datos.set(CAMPO_CONFIRMA_CONTENIDO, "si");
}

/** Envía la inscripción con los dos acuerdos; la comparten el bloque y la ventana. */
function useInscripcion(campanaId: string, onInscrito: () => void) {
  const [acuerdos, setAcuerdos] = useState(SIN_ACUERDOS);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function inscribirme() {
    setEnviando(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${encodeURIComponent(campanaId)}/inscripcion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [CAMPO_CONFIRMA_CONTENIDO]: acuerdos.confirmaContenido ? "si" : "",
          [CAMPO_ACEPTA_USO]: acuerdos.aceptaUso ? "si" : "",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo completar la inscripción");
      onInscrito();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la inscripción");
      setEnviando(false);
    }
  }

  return { acuerdos, setAcuerdos, enviando, error, setError, inscribirme };
}

/** Botón de inscribirse: en rojo y sin efecto hasta aceptar los dos acuerdos (2026-11-04, a pedido del usuario). */
function BotonDeInscripcion({
  acuerdos,
  enviando,
  onClick,
  texto,
  className = "",
}: {
  acuerdos: Acuerdos;
  enviando: boolean;
  onClick: () => void;
  texto: string;
  className?: string;
}) {
  return (
    <Button
      variant="primary"
      className={`${className} ${acuerdosCompletos(acuerdos) ? "" : "!border-error-700 !bg-error-700 !text-white disabled:!opacity-100"}`}
      disabled={!acuerdosCompletos(acuerdos) || enviando}
      onClick={onClick}
    >
      {enviando ? (
        <span className="inline-flex items-center gap-2">
          <IndicadorDeCarga />
          Inscribiendo…
        </span>
      ) : (
        texto
      )}
    </Button>
  );
}

function AvisoDeError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded border border-error-700 bg-error-50 p-2 text-[length:var(--ventana-error,12px)] text-error-700">
      {error}
    </p>
  );
}

/** Bloque "Inscríbete para aportar" dentro de la página: casillas y botón (arriba de /campanas/[id]/aportar). */
export function InscripcionACampana({
  campanaId,
  onInscrito,
  proposito,
}: {
  campanaId: string;
  onInscrito: () => void;
  proposito?: string | null;
}) {
  const { acuerdos, setAcuerdos, enviando, error, inscribirme } = useInscripcion(campanaId, onInscrito);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-system-600">
        Para aportar, inscríbete aceptando estos acuerdos. Solo se piden una vez en esta campaña.
      </p>
      <CasillasDeAcuerdos acuerdos={acuerdos} onCambio={setAcuerdos} deshabilitado={enviando} proposito={proposito} />
      <AvisoDeError error={error} />
      <BotonDeInscripcion
        acuerdos={acuerdos}
        enviando={enviando}
        onClick={() => void inscribirme()}
        texto="Inscribirme para aportar"
        className="w-full"
      />
    </div>
  );
}

/**
 * Ventana emergente de inscripción (2026-11-10, a pedido del usuario; antes las casillas iban en la página de
 * /campanas/[id]). Muestra las dos casillas, cada una con su "Leer el acuerdo" (CasillasDeAcuerdos); al aceptar inscribe y llama a
 * onInscrito (la página lleva al formulario de aporte). Cancelar, Esc o clic en el fondo la cierran sin inscribir.
 */
export function VentanaDeInscripcion({
  abierta,
  onCerrar,
  campanaId,
  onInscrito,
  proposito,
}: {
  abierta: boolean;
  onCerrar: () => void;
  campanaId: string;
  onInscrito: () => void;
  proposito?: string | null;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const { acuerdos, setAcuerdos, enviando, error, setError, inscribirme } = useInscripcion(campanaId, onInscrito);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierta && !el.open) el.showModal();
    if (!abierta && el.open) el.close();
  }, [abierta]);

  function cerrar() {
    if (enviando) return;
    setError(null);
    onCerrar();
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="inscripcion-titulo"
      // React hace llegar aquí también el cancel/close de las ventanas "Leer el acuerdo" (están dentro): solo cuentan
      // los de esta misma ventana, o al cerrar el texto se cerraría todo.
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        // Esc: lo cierra cerrar() (y no mientras se envía).
        e.preventDefault();
        cerrar();
      }}
      onClose={(e) => {
        if (e.target === e.currentTarget && abierta) onCerrar();
      }}
      // Clic en el fondo (fuera de la caja): se cierra.
      onClick={(e) => {
        if (e.target === dialogo.current) cerrar();
      }}
      className={claseDeVentana("normal")}
    >
      <div className="flex max-h-[88vh] flex-col">
        <div className="border-b border-system-200 px-5 py-5 md:px-8 md:py-6">
          <h2 id="inscripcion-titulo" className="text-xl font-extrabold md:text-2xl text-system-900">
            Acuerdos para aportar
          </h2>
          <p className="mt-1 text-[15px] text-system-600">
            Para aportar en esta campaña, acepta los dos acuerdos. Solo se piden una vez.
          </p>
        </div>
        {/* Solo las casillas y su "Leer el acuerdo", que abre ese acuerdo completo encima (a pedido del usuario el
            mismo día: sin desplegar los dos acuerdos aquí). */}
        <div className="flex flex-col gap-3 p-5">
          <CasillasDeAcuerdos acuerdos={acuerdos} onCambio={setAcuerdos} deshabilitado={enviando} proposito={proposito} />
          <AvisoDeError error={error} />
          <div className="flex flex-wrap justify-end gap-2">
            {/* Botón con borde y letra en rojo (variante danger), del mismo alto que "Aceptar y aportar"
                (2026-11-10, a pedido del usuario; antes era texto sin borde). */}
            <Button type="button" variant="danger" onClick={cerrar} disabled={enviando}>
              Cancelar
            </Button>
            <BotonDeInscripcion
              acuerdos={acuerdos}
              enviando={enviando}
              onClick={() => void inscribirme()}
              texto="Aceptar y aportar"
            />
          </div>
        </div>
      </div>
    </dialog>
  );
}
