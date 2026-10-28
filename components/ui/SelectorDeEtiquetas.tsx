"use client";

// Etiquetas de una campaña (subtemáticas de su temática, 2026-10-27) en el formulario de
// /mis-campanas/nueva. Muestra las del catálogo de esa temática como botones que se marcan y un
// campo para proponer una nueva, que queda pendiente hasta que la aprueba el SuperUsuario.
// Hasta `maximo`. El servidor valida todo (lib/etiquetas/catalogo.ts, guardarEtiquetasDeCampana).

import { useState } from "react";

import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { claveDeTematica, LARGO_DEL_NOMBRE } from "@/lib/tematicas/analizar";

export default function SelectorDeEtiquetas({
  tematica,
  opciones,
  seleccionadas,
  pendientes = [],
  onCambiar,
  maximo,
  deshabilitado = false,
  tematicas = [],
}: {
  /** Temática de la campaña; sin ella no hay etiquetas que ofrecer. */
  tematica: string;
  /** Nombres del catálogo de esa temática (aprobados y visibles). */
  opciones: string[];
  seleccionadas: string[];
  /** Las de la campaña que siguen pendientes de aprobar. */
  pendientes?: string[];
  onCambiar: (etiquetas: string[]) => void;
  maximo: number;
  deshabilitado?: boolean;
  /** Nombres de las temáticas: una etiqueta no puede llamarse igual (2026-10-27; el servidor también lo revisa). */
  tematicas?: string[];
}) {
  const [nueva, setNueva] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  if (!tematica) {
    return <p className="text-[12.5px] text-system-500">Elige primero la temática para ver sus etiquetas.</p>;
  }

  const claves = new Set(seleccionadas.map(claveDeTematica));
  const delCatalogo = new Set(opciones.map(claveDeTematica));
  const pendientesClaves = new Set(pendientes.map(claveDeTematica));
  // Las del catálogo y, después, las elegidas que no están en él (propuestas por el creador).
  const visibles = [...opciones, ...seleccionadas.filter((e) => !delCatalogo.has(claveDeTematica(e)))];
  const lleno = seleccionadas.length >= maximo;

  function alternar(etiqueta: string) {
    const clave = claveDeTematica(etiqueta);
    if (claves.has(clave)) {
      onCambiar(seleccionadas.filter((e) => claveDeTematica(e) !== clave));
    } else if (!lleno) {
      onCambiar([...seleccionadas, etiqueta]);
    }
    setAviso(null);
  }

  function agregar() {
    const limpia = nueva.trim().replace(/\s+/g, " ");
    const clave = claveDeTematica(limpia);
    if (!clave) return;
    if (limpia.length < LARGO_DEL_NOMBRE.minimo) {
      setAviso(`La etiqueta debe tener al menos ${LARGO_DEL_NOMBRE.minimo} letras.`);
      return;
    }
    if (claves.has(clave)) {
      setAviso(`«${limpia}» ya está marcada.`);
      return;
    }
    const tematica = tematicas.find((t) => claveDeTematica(t) === clave);
    if (tematica) {
      setAviso(`«${tematica}» ya es una temática: usa una etiqueta más específica.`);
      return;
    }
    if (lleno) {
      setAviso(`Puedes poner hasta ${maximo} etiquetas.`);
      return;
    }
    // Si ya existe en el catálogo, se marca con su nombre de ahí.
    const existente = opciones.find((o) => claveDeTematica(o) === clave);
    onCambiar([...seleccionadas, existente ?? limpia]);
    setNueva("");
    setAviso(null);
  }

  return (
    <div>
      {visibles.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label={`Etiquetas de ${tematica}`}>
          {visibles.map((etiqueta) => {
            const clave = claveDeTematica(etiqueta);
            const activa = claves.has(clave);
            const propuesta = !delCatalogo.has(clave);
            return (
              <button
                key={clave}
                type="button"
                aria-pressed={activa}
                disabled={deshabilitado || (!activa && lleno)}
                onClick={() => alternar(etiqueta)}
                className={`rounded-pill border px-3 py-1 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  activa ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
                }`}
              >
                {etiqueta}
                {propuesta ? (
                  <span className={`ml-1.5 text-[11px] font-medium ${activa ? "text-white/85" : "text-system-500"}`}>
                    {pendientesClaves.has(clave) ? "· por aprobar" : "· nueva"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mb-2 text-[12.5px] text-system-500">{tematica} todavía no tiene etiquetas en el catálogo; puedes proponer una.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={nueva}
          onChange={(e) => {
            setNueva(e.target.value);
            setAviso(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
          maxLength={LARGO_DEL_NOMBRE.maximo}
          placeholder="Proponer otra etiqueta"
          aria-label={`Proponer otra etiqueta de ${tematica}`}
          disabled={deshabilitado || lleno}
          className="max-w-[16rem]"
        />
        <Button type="button" size="sm" onClick={agregar} disabled={deshabilitado || lleno || nueva.trim().length === 0}>
          Agregar
        </Button>
        <span className="font-mono text-[11.5px] text-system-500">
          {seleccionadas.length} de {maximo}
        </span>
      </div>
      {aviso ? (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-error-700">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
