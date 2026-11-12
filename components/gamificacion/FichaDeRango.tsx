"use client";
import { useEffect, useRef, type ReactNode } from "react";
import AyudaEmergente from "@/components/ui/AyudaEmergente";
import ButtonLink from "@/components/ui/ButtonLink";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import {
  TEXTO_DE_LA_RACHA,
  type AvanceDeRequisito,
  type FichaDeRango as DatosDeFicha,
  type RequisitoDeRango,
} from "@/lib/gamificacion/rangos";
import InsigniaDeRango from "./InsigniaDeRango";
import { claseDeVentana } from "@/components/ui/ventana-emergente";

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
            <span className="flex flex-1 items-center gap-1 text-system-900">
              {r.etiqueta}
              {r.clave === "racha" && <AyudaEmergente etiqueta="Cómo cuenta la racha">{TEXTO_DE_LA_RACHA}</AyudaEmergente>}
            </span>
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
        <div id="ficha-rango-intro" className="space-y-1">
          <p className="text-base font-semibold text-system-900">{ficha.textoDeAscenso || "Ya alcanzaste este rango."}</p>
          {esActual && <p className="text-[15px] text-system-700">Es tuyo aunque dejes de aportar o pierdas la racha.</p>}
        </div>
        <Descripcion texto={ficha.descripcion} />
        <Seccion id="ficha-rango-pidio" titulo="Lo que pidió">
          {ficha.requisitos.length === 0 ? (
            <p className="text-base text-system-600">No pide nada.</p>
          ) : (
            <>
              <ListaDeMetas requisitos={ficha.requisitos} cumplidos />
              <p className="text-[14px] text-system-500">Los cumpliste todos el día que subiste.</p>
            </>
          )}
        </Seccion>
        <Seccion id="ficha-rango-recibiste" titulo="Lo que recibiste">
          <ul className="space-y-2">
            <Recompensa
              titulo={`Etapa ${ficha.etapaDelAvatar} de tu avatar`}
              detalle={esActual ? "La que tiene tu avatar hoy." : "Tu avatar ya pasó por ella y no retrocede."}
            />
            <Recompensa titulo={`Insignia del rango ${ficha.numero}`} detalle="Su emblema, aparte de tu avatar." />
          </ul>
        </Seccion>
      </>
    );
  }

  if (ficha.estado === "siguiente") {
    const ultimo = ficha.numero >= total;
    return (
      <>
        <div id="ficha-rango-intro" className="space-y-1">
          <p className="text-base font-bold text-system-900">{ficha.textoQueFalta}</p>
          <p className="text-[15px] text-system-700">
            Cumples {ficha.cumplidos} de {ficha.requisitos.length}. Subes en cuanto cumplas todos a la vez; la racha se toma
            tal como esté en ese momento.
          </p>
        </div>
        <Descripcion texto={ficha.descripcion} />
        <Seccion id="ficha-rango-pide" titulo="Lo que pide y tu avance">
          <ListaDeAvance requisitos={ficha.requisitos} />
          <p className="text-[14px] text-system-500">Un aporte de 5★ también cuenta en «4★ o más».</p>
        </Seccion>
        <Seccion id="ficha-rango-recibiras" titulo="Al subir recibes">
          <ul className="space-y-2">
            <Recompensa titulo={`Etapa ${ficha.etapaDelAvatar} de tu avatar`} detalle="Tu avatar evoluciona y no retrocede." />
            <Recompensa titulo={`Insignia del rango ${ficha.numero}`} detalle="Su emblema, aparte de tu avatar." />
            <Recompensa
              titulo={ultimo ? `Los ${total} rangos completos` : `El rango ${ficha.numero + 1} completo`}
              detalle={
                ultimo ? "No queda ninguno por descubrir." : ficha.numero + 2 <= total ? `Y la pista del ${ficha.numero + 2}.` : undefined
              }
            />
          </ul>
        </Seccion>
        <ButtonLink href="/campanas" variant="primary" className="self-start">
          Aportar a una campaña
        </ButtonLink>
      </>
    );
  }

  if (ficha.estado === "oculto") {
    return (
      <>
        <div id="ficha-rango-intro" className="space-y-1">
          <p className="text-base text-system-700">
            De este rango solo puedes ver lo que pedirá. Su nombre, su insignia y sus recompensas aparecen cuando alcances
            el rango {ficha.numero - 1}.
          </p>
          {ficha.numero >= total && <p className="text-[15px] text-system-700">Es el último rango de la trayectoria.</p>}
        </div>
        <Seccion id="ficha-rango-pedira" titulo="Lo que pedirá">
          <ListaDeMetas requisitos={ficha.requisitos} cumplidos={false} />
          <p className="text-[14px] text-system-500">
            Estos requisitos pueden ajustarse más adelante. Un cambio nunca te quita un rango que ya tengas.
          </p>
        </Seccion>
      </>
    );
  }

  return (
    <>
      <p id="ficha-rango-intro" className="text-base text-system-700">
        Ya puedes ver lo que pedirá. Su nombre y su insignia aparecen cuando alcances el rango {ficha.numero - 1}.
      </p>
      <div className="rounded-lg bg-brand-50 px-4 py-3">
        <p className="text-base font-bold text-brand-950">Pista: {ficha.pista}</p>
        <p className="text-[14px] text-brand-800">Los rangos más lejanos no tienen pista.</p>
      </div>
      <Seccion id="ficha-rango-pedira" titulo="Lo que pedirá">
        <ListaDeMetas requisitos={ficha.requisitos} cumplidos={false} />
        <p className="text-[14px] text-system-500">
          Estos requisitos pueden ajustarse más adelante. Un cambio nunca te quita un rango que ya tengas.
        </p>
      </Seccion>
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
      className={claseDeVentana("normal")}
    >
      {ficha && chip && (
        <div className="flex max-h-[88vh] flex-col">
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
                  <span className="block text-[14px] font-semibold text-brand-200">
                    Rango {ficha.numero} de {total}
                  </span>
                  {ficha.estado === "avistado" || ficha.estado === "oculto" ? "Nombre por descubrir" : ficha.nombre}
                </h2>
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
            <Cuerpo ficha={ficha} total={total} />
          </div>
        </div>
      )}
    </dialog>
  );
}
