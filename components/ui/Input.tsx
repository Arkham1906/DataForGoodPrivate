"use client";

// Campos de formulario de la zona de usuario (Field, Input...).

import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import CampoEtiquetado, { marcarComoControl } from "@/components/ui/CampoEtiquetado";

interface FieldWrapperProps {
  label: string;
  hint?: string;
  required?: boolean;
  /** Qué está mal en el campo (2026-10-27): borde rojo y el motivo debajo. */
  error?: string | null;
  children: React.ReactNode;
}

/** Etiqueta, pista y campo. La conexión etiqueta–campo la hace ui/CampoEtiquetado. */
export function Field(props: FieldWrapperProps) {
  return <CampoEtiquetado {...props} />;
}

export const Input = marcarComoControl(function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 aria-invalid:border-error-700 aria-invalid:bg-error-50 ${
        props.className ?? ""
      }`}
    />
  );
});

export const Textarea = marcarComoControl(function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 aria-invalid:border-error-700 aria-invalid:bg-error-50 ${
        props.className ?? ""
      }`}
    />
  );
});
