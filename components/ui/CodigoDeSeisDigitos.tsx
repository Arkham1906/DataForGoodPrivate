"use client";

// Código de 6 dígitos en seis casillas, con el mismo aspecto que /verificar. Avanza solo al
// escribir, retrocede con Borrar y acepta pegar el código completo. Lo usan /recuperar y las
// ventanas de contraseña de /cuenta.
// `valor` guarda una casilla vacía en medio como espacio: el código está completo solo si
// cumple /^\d{6}$/. Para vaciarlo, pasa "".

import { useEffect, useRef } from "react";

const LARGO = 6;

export default function CodigoDeSeisDigitos({
  valor,
  onCambiar,
  deshabilitado = false,
  autoFocus = false,
}: {
  valor: string;
  onCambiar: (valor: string) => void;
  deshabilitado?: boolean;
  autoFocus?: boolean;
}) {
  const casillas = useRef<(HTMLInputElement | null)[]>([]);
  const digitos = Array.from({ length: LARGO }, (_, i) => (valor[i] ?? "").trim());

  useEffect(() => {
    if (autoFocus) casillas.current[0]?.focus();
  }, [autoFocus]);

  // Si quien lo usa vacía el código (p. ej. tras un código incorrecto), vuelve a la primera casilla.
  useEffect(() => {
    if (valor === "" && document.activeElement && casillas.current.includes(document.activeElement as HTMLInputElement)) {
      casillas.current[0]?.focus();
    }
  }, [valor]);

  function cambiar(indice: number, texto: string) {
    const limpio = texto.replace(/\D/g, "");
    if (limpio.length > 1) {
      // Pegado o autocompletado: reparte los dígitos desde esta casilla.
      const nuevo = (digitos.slice(0, indice).map((d) => d || " ").join("") + limpio).slice(0, LARGO);
      onCambiar(nuevo);
      casillas.current[Math.min(nuevo.length, LARGO - 1)]?.focus();
      return;
    }
    // Una casilla vacía en medio se guarda como espacio, así el valor solo pasa /^\d{6}$/
    // cuando las seis tienen dígito.
    const nuevos = digitos.map((d) => d || " ");
    nuevos[indice] = limpio || " ";
    onCambiar(nuevos.join("").trimEnd());
    if (limpio && indice < LARGO - 1) casillas.current[indice + 1]?.focus();
  }

  function teclaAbajo(indice: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digitos[indice] && indice > 0) {
      casillas.current[indice - 1]?.focus();
    }
  }

  return (
    <div className="flex justify-center gap-1.5 sm:gap-2" role="group" aria-label="Código de 6 dígitos">
      {digitos.map((digito, i) => (
        <input
          key={i}
          ref={(el) => {
            casillas.current[i] = el;
          }}
          value={digito}
          onChange={(e) => cambiar(i, e.target.value)}
          onKeyDown={(e) => teclaAbajo(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Dígito ${i + 1}`}
          disabled={deshabilitado}
          className="h-12 min-w-0 max-w-11 flex-1 rounded border border-system-300 text-center text-lg font-semibold text-system-900 outline-none focus:border-brand-600 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
