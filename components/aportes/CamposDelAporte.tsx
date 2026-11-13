"use client";

// Descripción del aporte o, si es de solo texto, título + texto (2026-11-11, a pedido del usuario).
// Lo usan /campanas/[id]/aportar y /c/[token] (aporte sin cuenta). Es de solo texto cuando no hay
// archivo y la campaña acepta texto: el campo "Descripción" pasa a "Título del texto" y aparece
// "Texto". El servidor guarda el texto como un .txt (lib/aportes/comun.ts, archivoDelTexto) y manda
// el título en `description`; lo que se envía va en los campos `description` y `texto`.

import { useId } from "react";
import { Field, Input, Textarea } from "@/components/ui/Input";
import {
  LARGO_MAXIMO_DESCRIPCION,
  LARGO_MAXIMO_TEXTO_DEL_APORTE,
  LARGO_MAXIMO_TITULO_DEL_TEXTO,
} from "@/lib/aportes/archivo";

const nf = new Intl.NumberFormat("es-MX");

/** Si lo escrito alcanza para enviar: descripción, o título y texto. */
export function camposDelAporteCompletos(soloTexto: boolean, descripcion: string, texto: string): boolean {
  if (!descripcion.trim()) return false;
  if (!soloTexto) return descripcion.length <= LARGO_MAXIMO_DESCRIPCION;
  return descripcion.length <= LARGO_MAXIMO_TITULO_DEL_TEXTO && texto.trim().length > 0 && texto.length <= LARGO_MAXIMO_TEXTO_DEL_APORTE;
}

function Contador({ actual, maximo, id }: { actual: number; maximo: number; id?: string }) {
  const pasado = actual > maximo;
  return (
    <p id={id} className={`mb-4 text-right font-mono text-[11px] ${pasado ? "font-semibold text-error-700" : "text-system-500"}`}>
      {nf.format(actual)} / {nf.format(maximo)}
    </p>
  );
}

export default function CamposDelAporte({
  soloTexto,
  descripcion,
  onDescripcion,
  texto,
  onTexto,
  placeholderDescripcion = "Describe qué se ve en el contenido",
  compactoEnEscritorio = false,
}: {
  soloTexto: boolean;
  descripcion: string;
  onDescripcion: (valor: string) => void;
  texto: string;
  onTexto: (valor: string) => void;
  placeholderDescripcion?: string;
  /** Reduce la altura de los campos al mostrarlos junto al selector de archivo en escritorio. */
  compactoEnEscritorio?: boolean;
}) {
  const id = useId();

  if (!soloTexto) {
    return (
      <>
        <Field label="Descripción" required>
          <Textarea
            rows={4}
            value={descripcion}
            onChange={(e) => onDescripcion(e.target.value)}
            placeholder={placeholderDescripcion}
            maxLength={LARGO_MAXIMO_DESCRIPCION}
            className={compactoEnEscritorio ? "lg:h-24 lg:min-h-0" : ""}
            required
          />
        </Field>
        <Contador actual={descripcion.length} maximo={LARGO_MAXIMO_DESCRIPCION} />
      </>
    );
  }

  return (
    <>
      <p className="mb-3 rounded-lg border border-system-200 bg-system-50 p-3 text-[12px] leading-5 text-system-600 lg:mb-2 lg:p-2">
        Aporte de solo texto: ponle un título y escribe tu texto abajo. Se guarda como un archivo .txt.
      </p>
      <Field label="Título del texto" required>
        <Input
          value={descripcion}
          onChange={(e) => onDescripcion(e.target.value)}
          placeholder="Por ejemplo: Así quedó mi calle después de la lluvia"
          maxLength={LARGO_MAXIMO_TITULO_DEL_TEXTO}
          aria-describedby={`${id}-titulo`}
          required
        />
      </Field>
      <Contador id={`${id}-titulo`} actual={descripcion.length} maximo={LARGO_MAXIMO_TITULO_DEL_TEXTO} />
      <Field label="Texto" required>
        <Textarea
          rows={8}
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
          placeholder="Escribe aquí tu aporte"
          maxLength={LARGO_MAXIMO_TEXTO_DEL_APORTE}
          aria-describedby={`${id}-texto`}
          className={compactoEnEscritorio ? "lg:h-24 lg:min-h-0" : ""}
          required
        />
      </Field>
      <Contador id={`${id}-texto`} actual={texto.length} maximo={LARGO_MAXIMO_TEXTO_DEL_APORTE} />
    </>
  );
}
