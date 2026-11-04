"use client";

// Calendario de la racha (2026-11-04; diseño v10, SRS v1.2: RF-GAM-85, 86): el botón «Ver calendario de la racha» y
// su ventana, con el estado de cada día del mes, los aportes del día elegido y lo que produjeron, y los eventos de la
// racha. Los datos se piden al abrir y al cambiar de mes (GET /api/progreso/racha), no al cargar la página.
//
// Ventana <dialog> nativo, como FichaDeRango: Esc la cierra, el foco vuelve al botón y el clic en el fondo la cierra.
// El estado de cada día se distingue también por su forma y su texto para lectores de pantalla, no solo por el color.
//
// Pendiente (no se inventa): el avance de misiones de cada día (RF-GAM-85) no tiene de dónde leerse: las misiones no
// guardan qué aporte las hizo avanzar. La hora exacta de consolidación depende de DA-GAM-16.

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import Tag from "@/components/ui/Tag";
import { NOMBRES_DE_ESTRELLAS } from "@/lib/aportes/calificacion";
import { BASE_PATH } from "@/lib/base-path";
import type { CalendarioDeRachaDelMes, DiaDelCalendario } from "@/lib/gamificacion/mi-progreso-tipos";
import { MAXIMO_DE_PROTECTORES, type ResumenDeRacha } from "@/lib/gamificacion/progreso-tipos";

type Estado = DiaDelCalendario["estado"];

const ESTADOS: Record<Estado, { nombre: string; celda: string; tono: "default" | "ok" | "warn" | "info" }> = {
  confirmado: { nombre: "Confirmado", celda: "bg-success-700 text-white", tono: "ok" },
  provisional: {
    nombre: "Provisional",
    celda: "border border-warning-500 bg-[repeating-linear-gradient(135deg,var(--color-warning-100)_0_4px,var(--color-warning-300)_4px_6px)] text-warning-900",
    tono: "warn",
  },
  protegido: { nombre: "Con protector", celda: "bg-brand-200 text-brand-800", tono: "info" },
  sin_actividad: { nombre: "Sin actividad", celda: "border border-system-200 bg-white text-system-600", tono: "default" },
  suspendido: { nombre: "Suspendido", celda: "bg-system-300 text-system-800", tono: "default" },
  por_venir: { nombre: "Por venir", celda: "border border-system-100 bg-system-50 text-system-500", tono: "default" },
};

const LEYENDA: Exclude<Estado, "por_venir" | "suspendido">[] = ["confirmado", "provisional", "protegido", "sin_actividad"];
const DIAS_DE_LA_SEMANA = [
  ["L", "lunes"],
  ["M", "martes"],
  ["M", "miércoles"],
  ["J", "jueves"],
  ["V", "viernes"],
  ["S", "sábado"],
  ["D", "domingo"],
] as const;

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function fechaLarga(dia: string): string {
  const texto = FECHA_LARGA.format(new Date(`${dia}T00:00:00Z`));
  return texto.charAt(0).toLocaleUpperCase("es-MX") + texto.slice(1);
}

function textoDelDia(d: DiaDelCalendario): string {
  if (d.estado === "confirmado") return "Un aporte aceptado confirma el día para siempre.";
  if (d.estado === "provisional") return "Tu aporte sigue en revisión. El día cuenta durante su ventana de 72 horas; después se consolida aunque se rechace.";
  if (d.estado === "protegido") return "Se usó un protector y la racha siguió.";
  if (d.estado === "suspendido") return "Tu racha estuvo suspendida este día.";
  if (d.hoy) return "Envía un aporte hoy para que el día cuente.";
  return "Este día no sumó a tu racha.";
}

function Icono({ trazo }: { trazo: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={trazo} />
    </svg>
  );
}

const BOTON_DE_ICONO =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-system-600 hover:bg-system-100 hover:text-system-900 disabled:opacity-40 disabled:hover:bg-transparent";

function Celda({ dia, elegido, onElegir }: { dia: DiaDelCalendario; elegido: boolean; onElegir: () => void }) {
  const estado = ESTADOS[dia.estado];
  const hoy = dia.hoy ? " (hoy)" : "";
  return (
    <button
      type="button"
      onClick={onElegir}
      disabled={dia.estado === "por_venir"}
      aria-pressed={elegido}
      aria-label={`${dia.numero}${hoy}: ${estado.nombre}`}
      className={`flex h-11 w-full flex-col items-center justify-center rounded-[10px] text-[13px] font-bold leading-none ${estado.celda} ${
        dia.hoy ? "outline-2 -outline-offset-2 outline-dashed outline-brand-600" : ""
      } ${elegido ? "ring-2 ring-brand-600 ring-offset-2" : ""} disabled:cursor-default`}
    >
      {dia.numero}
      {dia.hoy && <span className="mt-0.5 text-[11px] font-semibold">hoy</span>}
      {dia.estado === "protegido" && !dia.hoy && (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 h-3 w-3" fill="currentColor">
          <path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z" />
        </svg>
      )}
    </button>
  );
}

function DetalleDelDia({ dia }: { dia: DiaDelCalendario }) {
  const estado = ESTADOS[dia.estado];
  return (
    <section aria-live="polite" className="flex flex-col gap-1.5 rounded-[10px] border border-system-100 bg-system-50 px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-system-900">{fechaLarga(dia.dia)}</h3>
        <Tag tone={estado.tono}>{estado.nombre}</Tag>
      </div>
      <p className="text-[13px] text-system-700">{textoDelDia(dia)}</p>
      {dia.aportes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {dia.aportes.map((a) => (
            <li key={a.id} className="flex justify-between gap-2.5 text-[12.5px]">
              <span className="min-w-0 text-system-900">
                {a.descripcion}
                <span className="block text-system-600">
                  {a.campana}
                  {a.calificacion && ` · ${a.calificacion}★ ${NOMBRES_DE_ESTRELLAS[a.calificacion]}`}
                </span>
              </span>
              <span className={`shrink-0 font-bold ${a.exp ? "text-success-800" : "text-system-600"}`}>
                {a.exp ? `+${a.exp} EXP` : a.estado}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function CalendarioDeRacha({ racha }: { racha: ResumenDeRacha }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const peticion = useRef<AbortController | null>(null);
  const [calendario, setCalendario] = useState<CalendarioDeRachaDelMes | null>(null);
  const [fallo, setFallo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);

  const cargar = useCallback(async (mes?: string) => {
    peticion.current?.abort();
    const control = new AbortController();
    peticion.current = control;
    setCargando(true);
    setFallo(false);
    try {
      const consulta = mes ? `?mes=${mes}` : "";
      const respuesta = await fetch(`${BASE_PATH}/api/progreso/racha${consulta}`, { signal: control.signal });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      const datos = (await respuesta.json()) as CalendarioDeRachaDelMes;
      setCalendario(datos);
      setElegido((datos.dias.find((d) => d.hoy) ?? datos.dias[0]).dia);
    } catch (error) {
      if (control.signal.aborted) return;
      console.error("Error cargando el calendario de la racha", error);
      setFallo(true);
    }
    if (!control.signal.aborted) setCargando(false);
  }, []);

  useEffect(() => () => peticion.current?.abort(), []);

  function abrir() {
    dialogo.current?.showModal();
    void cargar();
  }

  const dia = calendario?.dias.find((d) => d.dia === elegido) ?? null;
  const conSuspendidos = calendario?.dias.some((d) => d.estado === "suspendido") ?? false;

  return (
    <>
      <button type="button" onClick={abrir} aria-haspopup="dialog" className="self-start py-1 text-[12.5px] font-bold text-brand-700 hover:underline">
        Ver calendario de la racha
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby="calendario-racha-titulo"
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <h2 id="calendario-racha-titulo" className="text-lg font-extrabold">
              Calendario de tu racha
            </h2>
            <button type="button" onClick={() => dialogo.current?.close()} aria-label="Cerrar" className={BOTON_DE_ICONO}>
              <Icono trazo="M18 6L6 18M6 6l12 12" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-4 pt-3">
            <p className="text-sm text-system-700">
              <strong className="text-[22px] text-system-900">
                {racha.actual} {racha.actual === 1 ? "día" : "días"}
              </strong>{" "}
              de racha actual · máxima {racha.maxima} · protectores {racha.protectores} de {MAXIMO_DE_PROTECTORES}
            </p>

            {fallo ? (
              <div role="alert" className="rounded-[10px] bg-error-50 p-3.5 text-[13px] text-error-700">
                <p>No pudimos cargar el calendario.</p>
                <Button type="button" variant="secondary" size="sm" className="mt-2.5" onClick={() => void cargar(calendario?.mes)}>
                  Reintentar
                </Button>
              </div>
            ) : !calendario ? (
              <div role="status">
                <span className="sr-only">Cargando el calendario…</span>
                <Skeleton className="h-80 w-full rounded-lg" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => calendario.mesAnterior && void cargar(calendario.mesAnterior)}
                    disabled={!calendario.mesAnterior || cargando}
                    aria-label="Mes anterior"
                    className={BOTON_DE_ICONO}
                  >
                    <Icono trazo="M15 18l-6-6 6-6" />
                  </button>
                  <span aria-live="polite" className="text-[13px] font-bold">
                    {calendario.titulo}
                  </span>
                  <button
                    type="button"
                    onClick={() => calendario.mesSiguiente && void cargar(calendario.mesSiguiente)}
                    disabled={!calendario.mesSiguiente || cargando}
                    aria-label="Mes siguiente"
                    className={BOTON_DE_ICONO}
                  >
                    <Icono trazo="M9 18l6-6-6-6" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={`Días de ${calendario.titulo}`}>
                  {DIAS_DE_LA_SEMANA.map(([letra, nombre]) => (
                    <span key={nombre} className="text-center text-[11.5px] font-bold text-system-500">
                      <span aria-hidden="true">{letra}</span>
                      <span className="sr-only">{nombre}</span>
                    </span>
                  ))}
                  {Array.from({ length: calendario.desfase }, (_, i) => (
                    <span key={i} aria-hidden="true" />
                  ))}
                  {calendario.dias.map((d) => (
                    <Celda key={d.dia} dia={d} elegido={d.dia === elegido} onElegir={() => setElegido(d.dia)} />
                  ))}
                </div>

                <ul aria-label="Significado de los colores" className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-system-700">
                  {[...LEYENDA, ...(conSuspendidos ? (["suspendido"] as const) : [])].map((e) => (
                    <li key={e} className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className={`h-3 w-3 rounded ${ESTADOS[e].celda}`} />
                      {e === "provisional" ? "Provisional (72 h)" : ESTADOS[e].nombre}
                    </li>
                  ))}
                </ul>

                {dia && <DetalleDelDia dia={dia} />}

                <section aria-labelledby="calendario-racha-eventos">
                  <h3 id="calendario-racha-eventos" className="mb-1.5 text-[13px] font-extrabold">
                    Eventos de tu racha
                  </h3>
                  {calendario.eventos.length === 0 ? (
                    <p className="text-[12.5px] text-system-600">Sin eventos este mes.</p>
                  ) : (
                    <ul className="text-[12.5px]">
                      {calendario.eventos.map((e) => (
                        <li key={e.id} className="grid grid-cols-[56px_1fr] gap-2 border-t border-system-100 py-1.5">
                          <span className="font-mono text-system-500">{e.fecha}</span>
                          <span>
                            {e.texto}
                            {e.aporte && <span className="block text-system-600">{e.aporte}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>

          <div className="flex justify-end border-t border-system-100 px-5 py-3.5">
            <Button type="button" size="sm" onClick={() => dialogo.current?.close()}>
              Cerrar
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
