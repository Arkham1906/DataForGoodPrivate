"use client";

// Etiqueta de un campo de formulario conectada de verdad con su control (2026-10-07, accesibilidad:
// WCAG 1.3.1 y 4.1.2). Antes `Field` dibujaba la etiqueta en un <span> y el lector de pantalla no la
// anunciaba. Lo usan Field de components/ui/Input y de components/sistema/Input.
//   - Si el primer hijo es un control (input, select, textarea o un componente marcado con
//     esControlDeFormulario, como Input, Textarea o PasswordInput), la etiqueta es un <label for> y
//     la pista se conecta con aria-describedby.
//   - Si no (varios controles juntos: fecha y hora, botones de opción), los hijos van en un grupo
//     (role="group") que toma su nombre de la etiqueta. Así no se le cambia el nombre a ningún botón.

import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type ControlMarcado = { esControlDeFormulario?: boolean };

function esControl(nodo: ReactNode): nodo is ReactElement<{ id?: string; "aria-describedby"?: string }> {
  if (!isValidElement(nodo)) return false;
  if (typeof nodo.type === "string") return ["input", "select", "textarea"].includes(nodo.type);
  return Boolean((nodo.type as ControlMarcado).esControlDeFormulario);
}

/** Marca un componente como control de formulario para que CampoEtiquetado le conecte la etiqueta. */
export function marcarComoControl<T extends object>(componente: T): T {
  (componente as ControlMarcado).esControlDeFormulario = true;
  return componente;
}

export default function CampoEtiquetado({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const base = useId();
  const idPista = hint ? `${base}-pista` : undefined;
  const hijos = Children.toArray(children);
  const primero = hijos[0];
  const claseEtiqueta = "mb-1.5 block text-[13px] font-medium text-system-900";
  const contenidoEtiqueta = (
    <>
      {label} {required && <span className="text-error-700">*</span>}
    </>
  );
  const pista = hint && (
    <p id={idPista} className="mt-1.5 text-[11.5px] text-system-500">
      {hint}
    </p>
  );

  if (esControl(primero)) {
    const idControl = primero.props.id ?? `${base}-campo`;
    const describe = [primero.props["aria-describedby"], idPista].filter(Boolean).join(" ") || undefined;
    return (
      <div className="mb-4">
        <label htmlFor={idControl} className={claseEtiqueta}>
          {contenidoEtiqueta}
        </label>
        {cloneElement(primero, { id: idControl, "aria-describedby": describe })}
        {hijos.slice(1)}
        {pista}
      </div>
    );
  }

  const idEtiqueta = `${base}-etiqueta`;
  return (
    <div className="mb-4">
      <span id={idEtiqueta} className={claseEtiqueta}>
        {contenidoEtiqueta}
      </span>
      <div role="group" aria-labelledby={idEtiqueta} aria-describedby={idPista}>
        {children}
      </div>
      {pista}
    </div>
  );
}
