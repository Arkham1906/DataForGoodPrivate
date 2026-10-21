// Campo de fecha que siempre se ve como DD/MM/AAAA (2026-10-21, a pedido del usuario). El
// <input type="date"> del navegador muestra el formato del idioma del sistema (mm/dd/yyyy en
// inglés) y ningún atributo lo cambia. Aquí se escribe como texto, con las diagonales puestas
// solas, y el botón del calendario abre el selector nativo (un <input type="date"> oculto).
// Hacia afuera, el valor sigue siendo "AAAA-MM-DD" (o "" si está vacía o incompleta).
"use client";

import { useRef, useState } from "react";

type CampoDeFechaProps = {
  value: string;
  onChange: (fecha: string) => void;
  /** "AAAA-MM-DD": el calendario no deja elegir antes de esta fecha. */
  min?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label": string;
  className?: string;
};

/** "2026-10-21" → "21/10/2026". */
function aTexto(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : "";
}

/** "21/10/2026" → "2026-10-21"; "" si no está completa o no existe (31/02/2026). */
function aFecha(texto: string): string {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!partes) return "";
  const [, dia, mes, anio] = partes;
  const d = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  const existe = d.getUTCFullYear() === Number(anio) && d.getUTCMonth() === Number(mes) - 1 && d.getUTCDate() === Number(dia);
  return existe ? `${anio}-${mes}-${dia}` : "";
}

/** Solo dígitos, con las diagonales después del día y del mes. */
function conDiagonales(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

export default function CampoDeFecha({ value, onChange, min, disabled, required, className, ...props }: CampoDeFechaProps) {
  const [texto, setTexto] = useState(() => aTexto(value));
  // Si la fecha cambia desde afuera (el calendario, otra parte del formulario), se vuelve a
  // escribir; no mientras la persona está a medio escribir y la fecha todavía vale "".
  const [anterior, setAnterior] = useState(value);
  if (value !== anterior) {
    setAnterior(value);
    if (value !== aFecha(texto)) setTexto(aTexto(value));
  }
  const calendario = useRef<HTMLInputElement>(null);
  const completa = texto.length === 10;
  const invalida = completa && !aFecha(texto);

  function escribir(nuevo: string) {
    const conFormato = conDiagonales(nuevo);
    setTexto(conFormato);
    onChange(aFecha(conFormato));
  }

  function abrirCalendario() {
    const campo = calendario.current;
    if (!campo) return;
    try {
      campo.showPicker();
    } catch {
      campo.focus();
      campo.click();
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={texto}
        onChange={(e) => escribir(e.target.value)}
        placeholder="DD/MM/AAAA"
        maxLength={10}
        disabled={disabled}
        required={required}
        aria-label={`${props["aria-label"]} (DD/MM/AAAA)`}
        aria-invalid={invalida || undefined}
        className={`w-full rounded border bg-white py-3 pl-3.5 pr-10 font-mono text-sm text-system-900 outline-none transition-colors focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${
          invalida ? "border-error-700" : "border-system-300"
        } ${className ?? ""}`}
      />
      <button
        type="button"
        onClick={abrirCalendario}
        disabled={disabled}
        aria-label={`Elegir ${props["aria-label"].toLowerCase()} en el calendario`}
        title="Abrir calendario"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-system-500 transition-colors hover:text-system-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {/* Solo para abrir el selector nativo; queda en la esquina para que el calendario salga ahí.
          form apunta a un formulario que no existe: así no entra en la validación del navegador
          (con min, una fecha vieja bloqueaba el envío sin mensaje, porque el campo no se ve). */}
      <input
        ref={calendario}
        type="date"
        form="campo-de-fecha-sin-formulario"
        value={value}
        min={min}
        onChange={(e) => {
          setTexto(aTexto(e.target.value));
          onChange(e.target.value);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
      />
      {/* Debajo, sin empujar el renglón: así no se estira el campo de la hora de al lado. */}
      {invalida && <p className="absolute left-0 top-full mt-0.5 whitespace-nowrap text-[11.5px] text-error-700">Esa fecha no existe.</p>}
    </div>
  );
}
