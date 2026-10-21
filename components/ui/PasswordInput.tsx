// Campo de contraseña de la zona de usuario: el Input de siempre con un botón de ojo
// que alterna entre ocultar y mostrar lo escrito. El botón no le quita el foco al campo (en el
// teléfono se cerraba el teclado) y se bloquea junto con él. El ojo propio de Edge se oculta en
// app/globals.css.
"use client";

import { InputHTMLAttributes, useState } from "react";
import { Input } from "@/components/ui/Input";
import { marcarComoControl } from "@/components/ui/CampoEtiquetado";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={`pr-11 ${className ?? ""}`} />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        disabled={props.disabled}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-system-500 transition-colors hover:text-system-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {visible ? <IconoOjoTachado /> : <IconoOjo />}
      </button>
    </div>
  );
}

function IconoOjo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconoOjoTachado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.6" />
      <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

// Field le conecta su etiqueta (ui/CampoEtiquetado).
export default marcarComoControl(PasswordInput);
