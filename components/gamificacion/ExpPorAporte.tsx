"use client";

// Ícono de EXP con recuadro (2026-11-13, a pedido del responsable; SRS v1.3: RF-GAM-01 a 03, 32). Va en el detalle
// de una campaña, en lugar de «N XP por aporte aprobado» (campanas.xp_per_contribution, que no es la EXP real).
// - Al pasar el cursor (solo con puntero fino) se abre; al salir, se cierra. Un clic lo deja fijo; otro clic, Escape
//   o un clic fuera lo cierran. Con teclado: Enter o Espacio sobre el botón.
// - Pide la EXP por tipo la primera vez que se abre (GET /api/progreso/exp-por-tipo) y la conserva.
// - El recuadro crece desde el ícono (escala 0.97 + opacidad, 150 ms); con movimiento reducido solo se funde.
// Estilo de la pastilla: el mismo verde que ExpDelAporte («+N EXP»), para que la EXP se reconozca igual en todo.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/base-path";
import { TEXTOS } from "@/lib/gamificacion/textos";

const T = TEXTOS.expPorAporte;
const OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

type Datos = { tipos: { tipo: string; minimo: number; maximo: number }[]; bonificacionPotenciador: number };

function IconoDeExp() {
  // Destello de cuatro puntas: «energía ganada», distinto de la estrella de la calificación.
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="currentColor">
      <path d="M8 1.2c.3 0 .5.2.6.5l.9 3.3c.1.4.4.7.8.8l3.3.9c.3.1.5.3.5.6s-.2.5-.5.6l-3.3.9c-.4.1-.7.4-.8.8l-.9 3.3c-.1.3-.3.5-.6.5s-.5-.2-.6-.5l-.9-3.3c-.1-.4-.4-.7-.8-.8l-3.3-.9c-.3-.1-.5-.3-.5-.6s.2-.5.5-.6l3.3-.9c.4-.1.7-.4.8-.8l.9-3.3c.1-.3.3-.5.6-.5Z" />
    </svg>
  );
}

const nombreDeTipo = (tipo: string) => tipo[0].toUpperCase() + tipo.slice(1);

export default function ExpPorAporte({ tipos }: { tipos: string[] }) {
  const [abierto, setAbierto] = useState(false);
  const [fijo, setFijo] = useState(false);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState(false);
  const pedido = useRef(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const clave = tipos.join(",");

  const cargar = useCallback(() => {
    if (pedido.current) return;
    pedido.current = true;
    fetch(`${BASE_PATH}/api/progreso/exp-por-tipo?tipos=${encodeURIComponent(clave)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Datos) => setDatos(d))
      .catch(() => {
        setError(true);
        pedido.current = false; // el siguiente intento vuelve a pedir
      });
  }, [clave]);

  const abrir = useCallback(() => {
    if (cierre.current) clearTimeout(cierre.current);
    setError(false);
    setAbierto(true);
    cargar();
  }, [cargar]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setFijo(false);
  }, []);

  // Escape y clic fuera, solo mientras está abierto.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      cerrar();
      boton.current?.focus();
    };
    const alPulsar = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) cerrar();
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alPulsar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alPulsar);
    };
  }, [abierto, cerrar]);

  useEffect(() => () => {
    if (cierre.current) clearTimeout(cierre.current);
  }, []);

  const conPunteroFino = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  return (
    <span
      ref={raiz}
      className="relative inline-flex"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse" && conPunteroFino()) abrir();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse" || fijo) return;
        cierre.current = setTimeout(() => setAbierto(false), 120);
      }}
    >
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={T.abrir}
        onClick={() => {
          if (abierto && fijo) cerrar();
          else {
            abrir();
            setFijo(true);
          }
        }}
        className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-1 font-mono text-[11.5px] leading-none font-bold text-success-700 transition-transform duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-success-700 focus-visible:ring-offset-2 active:scale-[0.97]"
      >
        <IconoDeExp />
        {T.etiqueta}
      </button>

      <div
        id={id}
        role="region"
        aria-label={T.titulo}
        aria-live="polite"
        className="exp-por-aporte absolute top-full right-0 z-30 mt-2 w-64 rounded-lg border border-system-200 bg-white p-3.5 text-left shadow-lg"
        style={{
          transformOrigin: "top right",
          opacity: abierto ? 1 : 0,
          transform: abierto ? "scale(1)" : "scale(0.97)",
          visibility: abierto ? "visible" : "hidden",
          transition: abierto
            ? `opacity 150ms ${OUT}, transform 150ms ${OUT}, visibility 0s`
            : `opacity 120ms ease-out, transform 120ms ease-out, visibility 0s linear 120ms`,
        }}
      >
        <p className="mb-2 text-[12px] font-bold text-system-900">{T.titulo}</p>
        {datos ? (
          <>
            <dl className="text-[12.5px]">
              {datos.tipos.map((t, i) => (
                <div
                  key={t.tipo}
                  className={`flex justify-between gap-3 py-1.5 ${i < datos.tipos.length - 1 ? "border-b border-system-200" : ""}`}
                >
                  <dt className="text-system-600">{nombreDeTipo(t.tipo)}</dt>
                  <dd className="font-mono font-semibold text-success-700 tabular-nums">{T.rango(t.minimo, t.maximo)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-system-600">{T.nota}</p>
            {datos.bonificacionPotenciador > 0 && (
              <p className="mt-1 text-[11.5px] leading-relaxed text-system-600">{T.notaPotenciador(datos.bonificacionPotenciador)}</p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-system-600">{error ? T.error : T.cargando}</p>
        )}
      </div>
    </span>
  );
}
