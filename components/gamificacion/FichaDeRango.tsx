"use client";

// Ficha de rango en ventana (2026-11-02; SRS v1.1: RF-GAM-22, 78 a 83): el detalle de un rango según su estado.
// Actual y alcanzado: cuándo se alcanzó, lo que pidió y lo que se recibió. Siguiente: avance por requisito y lo que
// se recibirá. Avistado: la pista y lo que pedirá. Por descubrir: solo lo que pedirá. Solo pinta lo que el servidor
// envió en cada ficha (RNF-GAM-14): avistado y por descubrir no traen nombre, descripción ni etapa, así que aquí no
// hay forma de mostrarlos. Textos según la v1.2 (2026-11-04): nada promete ni advierte una reversión.
//
// Ventana <dialog> nativo, como EditarAvatar y PreferenciasDeComunicacion: Esc la cierra, el foco vuelve al
// botón que la abrió y el clic en el fondo la cierra. `abierta` es el número del rango que se ve (null =
// cerrada); ‹ › recorren las fichas que recibe. El estado lo lleva quien la usa (CaminoCompacto).
//
// Pendiente (no se inventa): «Lo que recibiste» solo muestra etapa e insignia; las demás recompensas del rango
// y el coleccionable exclusivo dependen del catálogo de objetos (DA-GAM-09). La descripción sale cuando exista
// (DA-GAM-23).

import { useEffect, useRef, type ReactNode } from "react";
import ButtonLink from "@/components/ui/ButtonLink";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import type {
  AvanceDeRequisito,
  FichaDeRango as DatosDeFicha,
  RequisitoDeRango,
} from "@/lib/gamificacion/rangos";
import InsigniaDeRango from "./InsigniaDeRango";

const CHIP: Record<DatosDeFicha["estado"], { texto: string; tono: "default" | "ok" | "info" }> = {
  alcanzado: { texto: "Alcanzado", tono: "info" },
  actual: { texto: "Tu rango actual", tono: "default" },
  siguiente: { texto: "Siguiente", tono: "ok" },
  avistado: { texto: "Avistado", tono: "info" },
  oculto: { texto: "Por descubrir", tono: "default" },
};

function Flecha({ lado }: { lado: "izquierda" | "derecha" | "cerrar" }) {
  const trazo =
    lado === "izquierda" ? "M15 18l-6-6 6-6" : lado === "derecha" ? "M9 18l6-6-6-6" : "M18 6L6 18M6 6l12 12";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={trazo} />
    </svg>
  );
}

const CLASE_DE_BOTON =
  "inline-flex h-9 w-9 items-center justify-center rounded-pill border border-white/30 text-white transition-colors hover:bg-white/10";

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-system-500">
        {titulo}
      </h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function Marca({ cumplido }: { cumplido: boolean }) {
  return cumplido ? (
    <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-success-100 text-success-800">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  ) : (
    <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center">
      <span className="h-2 w-2 rounded-pill bg-system-300" />
    </span>
  );
}

/** Requisitos sin avance: lo que pidió el rango actual o lo que pedirá el avistado. */
function ListaDeMetas({ requisitos, cumplidos }: { requisitos: RequisitoDeRango[]; cumplidos: boolean }) {
  return (
    <ul className="space-y-1.5">
      {requisitos.map((r) => (
        <li key={r.clave} className="flex items-center gap-2.5 text-sm">
          <Marca cumplido={cumplidos} />
          <span className="flex-1 text-system-900">{r.etiqueta}</span>
          <span className="font-mono text-[13px] font-semibold text-system-900">{r.textoMeta}</span>
        </li>
      ))}
    </ul>
  );
}

/** Requisitos del rango siguiente, con lo que la persona lleva (RF-GAM-22). */
function ListaDeAvance({ requisitos }: { requisitos: AvanceDeRequisito[] }) {
  return (
    <ul className="space-y-3">
      {requisitos.map((r) => (
        <li key={r.clave}>
          <div className="flex items-center gap-2.5 text-sm">
            <Marca cumplido={r.cumplido} />
            <span className="flex-1 text-system-900">{r.etiqueta}</span>
            <span className={`font-mono text-[13px] font-semibold ${r.cumplido ? "text-success-800" : "text-system-900"}`}>
              {r.textoAvance}
            </span>
          </div>
          <div className="mt-1.5 pl-[30px]">
            <ProgressBar pct={r.porcentaje} tone={r.cumplido ? "ok" : "accent"} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Recompensa({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <li className="rounded-lg border border-system-200 bg-system-50 px-3.5 py-2.5">
      <p className="text-sm font-semibold text-system-900">{titulo}</p>
      {detalle && <p className="text-[12.5px] text-system-600">{detalle}</p>}
    </li>
  );
}

function Descripcion({ texto }: { texto: string | null }) {
  return texto ? <p className="text-sm text-system-700">{texto}</p> : null;
}

function Cuerpo({ ficha, total }: { ficha: DatosDeFicha; total: number }) {
  if (ficha.estado === "actual" || ficha.estado === "alcanzado") {
    const esActual = ficha.estado === "actual";
    return (
      <>
        <p id="ficha-rango-intro" className="text-sm text-system-700">
          {esActual
            ? "Tu rango actual. Es permanente: no se pierde por inactividad ni por perder la racha."
            : "Un rango que ya es tuyo, para siempre."}
        </p>
        {ficha.textoDeAscenso && <p className="text-[13px] font-semibold text-system-900">{ficha.textoDeAscenso}</p>}
        <Descripcion texto={ficha.descripcion} />
        <Seccion id="ficha-rango-pidio" titulo="Lo que pidió">
          {ficha.requisitos.length === 0 ? (
            <p className="text-sm text-system-600">No pide nada: es el punto de partida de toda trayectoria.</p>
          ) : (
            <>
              <ListaDeMetas requisitos={ficha.requisitos} cumplidos />
              <p className="text-[12px] text-system-500">Todos se cumplieron a la vez el día del ascenso.</p>
            </>
          )}
        </Seccion>
        <Seccion id="ficha-rango-recibiste" titulo="Lo que recibiste">
          <ul className="space-y-2">
            <Recompensa
              titulo={`Etapa ${ficha.etapaDelAvatar} de tu avatar`}
              detalle={esActual ? "Es la etapa que tiene hoy tu avatar." : "Tu avatar ya pasó por esta etapa y no retrocede."}
            />
            <Recompensa titulo="Insignia del rango" detalle="El emblema de este rango." />
          </ul>
        </Seccion>
      </>
    );
  }

  if (ficha.estado === "siguiente") {
    const ultimo = ficha.numero >= total;
    return (
      <>
        <p id="ficha-rango-intro" className="text-sm text-system-700">
          Tu siguiente rango. Cumples {ficha.cumplidos} de {ficha.requisitos.length} requisitos; todos deben cumplirse a la
          vez. La racha cuenta en el momento de la comprobación.
        </p>
        <Descripcion texto={ficha.descripcion} />
        <Seccion id="ficha-rango-pide" titulo="Lo que pide y tu avance">
          <ListaDeAvance requisitos={ficha.requisitos} />
          <p className="text-[12px] text-system-500">
            Los aportes de 5★ cuentan también como de 4★ o más. Lo que ganas con un aporte aceptado no se revierte.
          </p>
        </Seccion>
        <Seccion id="ficha-rango-recibiras" titulo="Lo que recibirás">
          <ul className="space-y-2">
            <Recompensa titulo={`Etapa ${ficha.etapaDelAvatar} de tu avatar`} detalle="Tu avatar evoluciona al alcanzar el rango." />
            <Recompensa
              titulo={ultimo ? "Completas la trayectoria" : `Se revela el rango ${ficha.numero + 1}`}
              detalle={!ultimo && ficha.numero + 2 <= total ? `Y avistas el ${ficha.numero + 2} con su pista.` : undefined}
            />
          </ul>
        </Seccion>
        <ButtonLink href="/campanas" variant="primary" size="sm" className="self-start">
          Buscar campañas para aportar
        </ButtonLink>
      </>
    );
  }

  if (ficha.estado === "oculto") {
    return (
      <>
        <p id="ficha-rango-intro" className="text-sm text-system-700">
          Un rango por descubrir. Puedes consultar lo que pedirá; lo demás se revela al acercarte.
        </p>
        <Seccion id="ficha-rango-pedira" titulo="Lo que pedirá">
          <ListaDeMetas requisitos={ficha.requisitos} cumplidos={false} />
          <p className="text-[12px] text-system-500">
            Requisitos vigentes del catálogo. Pueden cambiar en nuevas versiones sin afectar a los rangos ya alcanzados.
          </p>
        </Seccion>
        <p className="text-[12.5px] text-system-600">
          Su nombre, su insignia y lo que recibirás se revelan al alcanzar el rango {ficha.numero - 1}.
          {ficha.numero >= total && " Es el último rango de la trayectoria."}
        </p>
      </>
    );
  }

  return (
    <>
      <p id="ficha-rango-intro" className="text-sm text-system-700">
        Ya sabes que existe y qué es lo nuevo que pedirá. Su nombre y su insignia siguen ocultos.
      </p>
      <div className="rounded-r-lg border-l-4 border-brand-600 bg-brand-50 px-4 py-3">
        <p className="text-sm font-semibold text-system-900">Pista: {ficha.pista}</p>
        <p className="text-[12px] text-system-600">Es el único rango oculto con pista.</p>
      </div>
      <Seccion id="ficha-rango-pedira" titulo="Lo que pedirá">
        <ListaDeMetas requisitos={ficha.requisitos} cumplidos={false} />
        <p className="text-[12px] text-system-500">
          Requisitos vigentes del catálogo. Pueden cambiar en nuevas versiones sin afectar a los rangos ya alcanzados.
        </p>
      </Seccion>
      <p className="text-[12.5px] text-system-600">
        Su nombre, su insignia y lo que recibirás se revelan al alcanzar el rango {ficha.numero - 1}.
      </p>
    </>
  );
}

export default function FichaDeRango({
  fichas,
  abierta,
  total,
  onIr,
  onCerrar,
}: {
  fichas: DatosDeFicha[];
  /** Número del rango que se muestra; null con la ventana cerrada. */
  abierta: number | null;
  /** Rangos que hay en la trayectoria. */
  total: number;
  onIr: (numero: number) => void;
  onCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const posicion = fichas.findIndex((f) => f.numero === abierta);
  const ficha = posicion >= 0 ? fichas[posicion] : null;
  const anterior = posicion > 0 ? fichas[posicion - 1] : null;
  const siguiente = posicion >= 0 && posicion < fichas.length - 1 ? fichas[posicion + 1] : null;

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (ficha && !d.open) d.showModal();
    if (!ficha && d.open) d.close();
  }, [ficha]);

  const chip = ficha ? CHIP[ficha.estado] : null;
  return (
    <dialog
      ref={dialogo}
      aria-labelledby="ficha-rango-titulo"
      aria-describedby="ficha-rango-intro"
      onClose={onCerrar}
      // Clic en el fondo (fuera de la caja): se cierra.
      onClick={(e) => {
        if (e.target === dialogo.current) dialogo.current?.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
    >
      {ficha && chip && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="bg-brand-950 p-5 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                {anterior ? (
                  <button type="button" onClick={() => onIr(anterior.numero)} aria-label={`Ver el rango ${anterior.numero}`} className={CLASE_DE_BOTON}>
                    <Flecha lado="izquierda" />
                  </button>
                ) : (
                  <span aria-hidden="true" className="h-9 w-9" />
                )}
                {siguiente ? (
                  <button type="button" onClick={() => onIr(siguiente.numero)} aria-label={`Ver el rango ${siguiente.numero}`} className={CLASE_DE_BOTON}>
                    <Flecha lado="derecha" />
                  </button>
                ) : (
                  <span aria-hidden="true" className="h-9 w-9" />
                )}
              </div>
              <button type="button" onClick={() => dialogo.current?.close()} aria-label="Cerrar" className={CLASE_DE_BOTON}>
                <Flecha lado="cerrar" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <InsigniaDeRango numero={ficha.numero} estado={ficha.estado} tamano="lg" />
              <div className="min-w-0">
                <Tag tone={chip.tono}>{ficha.estado === "oculto" && ficha.numero >= total ? "El último rango" : chip.texto}</Tag>
                <h2 id="ficha-rango-titulo" className="mt-1.5 text-xl font-extrabold leading-tight">
                  <span className="block text-[12px] font-semibold text-brand-200">
                    Rango {ficha.numero} de {total}
                  </span>
                  {ficha.estado === "avistado" || ficha.estado === "oculto" ? "Nombre por descubrir" : ficha.nombre}
                </h2>
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            <Cuerpo ficha={ficha} total={total} />
          </div>
        </div>
      )}
    </dialog>
  );
}
