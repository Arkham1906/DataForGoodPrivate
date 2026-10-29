"use client";

// Selector de temáticas: muestra las elegidas y abre un <dialog> nativo con buscador.
// Aplica los cambios solo al dar Aceptar. Lo usan /bienvenida, /cuenta y el formulario de
// campaña (/mis-campanas/nueva, con `unica`: una sola temática).
// Con `proponer` (2026-10-29), si lo que se busca no está, la ventana ofrece "Proponer «…» como
// temática nueva": se marca como cualquier otra y queda pendiente hasta que el SuperUsuario la
// revisa (el servidor la valida y la da de alta al guardar; lib/tematicas/catalogo.ts).

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { claveDeTematica, LARGO_DEL_NOMBRE } from "@/lib/tematicas/analizar";
import { esInapropiada } from "@/lib/tematicas/filtro";

/** El mismo criterio que validarNombreDeTematica del servidor, para avisar antes de guardar. */
function errorDePropuesta(nombre: string): string | null {
  if (nombre.length < LARGO_DEL_NOMBRE.minimo || nombre.length > LARGO_DEL_NOMBRE.maximo) {
    return `El nombre debe tener entre ${LARGO_DEL_NOMBRE.minimo} y ${LARGO_DEL_NOMBRE.maximo} caracteres.`;
  }
  if (!/^\p{L}[\p{L} ,-]*$/u.test(nombre)) return "Usa solo letras, espacios, guiones y comas, empezando con una letra.";
  if (esInapropiada(nombre)) return "El nombre tiene palabras que no se permiten.";
  return null;
}

/** El nombre de la temática y, si es una propuesta, "· nueva" o "· por aprobar". */
function ConMarca({ tema, marca, clara }: { tema: string; marca: string | null; clara: boolean }) {
  return (
    <>
      {tema}
      {marca ? (
        <span className={`ml-1.5 text-[11px] font-medium ${clara ? "text-white/85" : "text-system-500"}`}>· {marca}</span>
      ) : null}
    </>
  );
}

/**
 * Muestra las temáticas elegidas y un botón que abre una ventana con todas
 * las opciones. Los cambios dentro de la ventana solo se aplican al dar
 * "Aceptar"; Cancelar, Esc o un clic fuera los descartan. Usa <dialog>
 * nativo: el navegador atrapa el foco y cierra con Esc.
 *
 * Con `quitables`, cada temática elegida trae una × para quitarla sin abrir
 * la ventana, y el botón queda como "Agregar temáticas" (así en /cuenta).
 *
 * Con `unica`, se elige exactamente una temática (la de una campaña): tocar
 * otra reemplaza a la anterior y "Aceptar" pide que haya una marcada.
 *
 * Con `proponer`, se puede proponer una que no está (ver arriba). `pendientes` (propuestas ya
 * guardadas, sin revisar) y `nuevas` (propuestas aún sin guardar) se marcan junto al nombre.
 */
export default function SelectorDeTemas({
  opciones,
  seleccionados,
  onAceptar,
  quitables = false,
  unica = false,
  deshabilitado = false,
  titulo,
  descripcion,
  proponer = false,
  pendientes = [],
  nuevas = [],
}: {
  opciones: string[];
  seleccionados: string[];
  onAceptar: (temas: string[]) => void;
  quitables?: boolean;
  unica?: boolean;
  deshabilitado?: boolean;
  titulo?: string;
  descripcion?: string;
  proponer?: boolean;
  pendientes?: string[];
  nuevas?: string[];
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [borrador, setBorrador] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  // Propuestas hechas en esta ventana: se muestran al final de la lista mientras está abierta.
  const [propuestas, setPropuestas] = useState<string[]>([]);
  const [avisoDePropuesta, setAvisoDePropuesta] = useState<string | null>(null);

  const clavesPendientes = new Set(pendientes.map(claveDeTematica));
  const clavesNuevas = new Set([...nuevas, ...propuestas].map(claveDeTematica));
  function marca(tema: string): string | null {
    const clave = claveDeTematica(tema);
    return clavesPendientes.has(clave) ? "por aprobar" : clavesNuevas.has(clave) ? "nueva" : null;
  }

  // Las opciones y, al final, lo propuesto en esta ventana.
  const enOpciones = new Set(opciones.map(claveDeTematica));
  const lista = [...opciones, ...propuestas.filter((p) => !enOpciones.has(claveDeTematica(p)))];

  function abrir() {
    setBorrador(seleccionados);
    setBusqueda("");
    setPropuestas([]);
    setAvisoDePropuesta(null);
    dialogo.current?.showModal();
  }

  function cerrar() {
    dialogo.current?.close();
  }

  function aceptar() {
    // Se respeta el orden de la lista original, no el orden en que se tocaron.
    onAceptar(lista.filter((tema) => borrador.includes(tema)));
    cerrar();
  }

  function alternar(tema: string) {
    if (unica) {
      setBorrador([tema]);
      return;
    }
    setBorrador((prev) => (prev.includes(tema) ? prev.filter((t) => t !== tema) : [...prev, tema]));
  }

  const textoDelBoton =
    seleccionados.length === 0
      ? unica
        ? "+ Elegir temática"
        : "+ Elegir temáticas"
      : unica
        ? "Cambiar temática"
        : quitables
          ? "+ Agregar temáticas"
          : "Cambiar temáticas";

  const termino = busqueda.trim().toLowerCase();
  const visibles = termino ? lista.filter((tema) => tema.toLowerCase().includes(termino)) : lista;
  // Se ofrece proponer lo que se busca si no coincide exactamente con ninguna (sin importar acentos).
  const propuestaPosible = busqueda.trim().replace(/\s+/g, " ");
  const clavePosible = claveDeTematica(propuestaPosible);
  const puedeProponer = proponer && clavePosible !== "" && !lista.some((tema) => claveDeTematica(tema) === clavePosible);

  function proponerBusqueda() {
    const error = errorDePropuesta(propuestaPosible);
    if (error) {
      setAvisoDePropuesta(error);
      return;
    }
    setPropuestas((prev) => [...prev, propuestaPosible]);
    setBorrador((prev) => (unica ? [propuestaPosible] : [...prev, propuestaPosible]));
    setBusqueda("");
    setAvisoDePropuesta(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {seleccionados.length === 0 ? (
          <p className="text-[12.5px] text-system-500">Aún no eliges ninguna temática.</p>
        ) : quitables && !unica ? (
          seleccionados.map((tema) => (
            <button
              key={tema}
              type="button"
              onClick={() => onAceptar(seleccionados.filter((t) => t !== tema))}
              aria-label={`Quitar ${tema}`}
              className="inline-flex items-center gap-2 rounded-pill border border-brand-600 bg-brand-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800"
            >
              <span>
                <ConMarca tema={tema} marca={marca(tema)} clara />
              </span>
              <span className="font-mono text-[11px]" aria-hidden>
                ×
              </span>
            </button>
          ))
        ) : (
          seleccionados.map((tema) => (
            <Tag key={tema} tone="on">
              <ConMarca tema={tema} marca={marca(tema)} clara />
            </Tag>
          ))
        )}
        <Button type="button" size="sm" onClick={abrir} disabled={deshabilitado}>
          {textoDelBoton}
        </Button>
      </div>

      <dialog
        ref={dialogo}
        aria-labelledby="selector-temas-titulo"
        // Clic en el fondo (fuera de la caja): se cierra sin aplicar cambios.
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="border-b border-system-200 p-5">
            <h2 id="selector-temas-titulo" className="text-lg font-extrabold text-system-900">
              {titulo ?? (unica ? "Elige la temática" : "Elige tus temáticas")}
            </h2>
            <p className="mt-1 text-[12.5px] text-system-600">
              {descripcion ??
                (unica
                  ? "Marca una; tocar otra la reemplaza."
                  : "Marca las que te interesen; te mostraremos campañas relacionadas.")}
              {proponer ? " Si no encuentras la tuya, escríbela y proponla." : null}
            </p>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setAvisoDePropuesta(null);
              }}
              onKeyDown={(e) => {
                // Enter no envía el formulario de la página; sin coincidencias, propone lo escrito.
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (puedeProponer && visibles.length === 0) proponerBusqueda();
                }
              }}
              placeholder={proponer ? "Buscar o proponer una temática" : "Buscar temática"}
              aria-label={proponer ? "Buscar o proponer una temática" : "Buscar temática"}
              maxLength={proponer ? LARGO_DEL_NOMBRE.maximo : undefined}
              className="mt-3 w-full rounded border border-system-300 bg-white px-3 py-2 text-[13px] text-system-900 outline-none focus:border-brand-600"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {puedeProponer ? (
              <div className="mb-4 rounded border border-dashed border-system-300 p-3">
                <p className="text-[12.5px] text-system-600">
                  {visibles.length === 0 ? `Ninguna temática coincide con «${propuestaPosible}».` : "¿No está la que buscas?"}
                </p>
                <Button type="button" size="sm" className="mt-2" onClick={proponerBusqueda}>
                  + Proponer «{propuestaPosible}» como temática nueva
                </Button>
                <p className="mt-1.5 text-[11.5px] text-system-500">
                  Queda pendiente hasta que la apruebe el SuperUsuario; mientras tanto solo la ves tú.
                </p>
                {avisoDePropuesta ? (
                  <p role="alert" className="mt-1.5 text-[12px] font-medium text-error-700">
                    {avisoDePropuesta}
                  </p>
                ) : null}
              </div>
            ) : null}
            {visibles.length === 0 ? (
              puedeProponer ? null : <p className="text-[12.5px] text-system-500">Ninguna temática coincide con «{busqueda}».</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visibles.map((tema) => {
                  const activo = borrador.includes(tema);
                  return (
                    <button
                      key={tema}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => alternar(tema)}
                      className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                        activo
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-system-300 bg-white text-system-600 hover:border-brand-600"
                      }`}
                    >
                      <ConMarca tema={tema} marca={marca(tema)} clara={activo} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-system-200 p-4">
            <span className="font-mono text-[12px] text-system-500">
              {borrador.length} {borrador.length === 1 ? "seleccionada" : "seleccionadas"}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={aceptar} disabled={unica && borrador.length === 0}>
                Aceptar
              </Button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
