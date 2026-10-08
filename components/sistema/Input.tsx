// Campos de formulario del panel del SuperUsuario.

import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldWrapperProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function Field({ label, hint, required, children }: FieldWrapperProps) {
  return (
    <div className="mb-4">
      <span className="mb-1.5 block text-[13px] font-medium text-system-900">
        {label} {required && <span className="text-error-700">*</span>}
      </span>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] text-system-400">{hint}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 ${
        props.className ?? ""
      }`}
    />
  );
}
