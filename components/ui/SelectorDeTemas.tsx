"use client";

// Selector de temáticas: muestra las elegidas y abre un <dialog> nativo con buscador.
// Aplica los cambios solo al dar Aceptar. Lo usan /bienvenida, /cuenta y el formulario de
// campaña (/mis-campanas/nueva, con `unica`: una sola temática).
// Con `proponer` (2026-10-29), si lo que se busca no está, la ventana ofrece "Proponer «…» como
// temática nueva": se marca como cualquier otra y queda pendiente hasta que el SuperUsuario la
// revisa (el servidor la valida y la da de alta al guardar; lib/tematicas/catalogo.ts).
// Con `proponerAparte` (2026-11-11, a pedido del usuario; /cuenta y /bienvenida) proponer es un
// proceso aparte del buscador: el último mosaico de la ventana, "+ Proponer temática", abre una
// vista con el aviso de que la administración evalúa las propuestas y el campo para escribirla.
// Las propuestas (nuevas o por aprobar) salen primero, arriba.
// Si lo que se quiere proponer se parece a una que ya existe (2026-11-11, a pedido del usuario; por
// nombre o significado, lib/tematicas/equivalente.ts), no se propone: se marca la existente y se avisa.
// Con `quitables` (el perfil), las elegidas son mosaicos con ícono, nombre y ×, y el último
// mosaico, "+ Agregar temáticas", abre la ventana (2026-11-11, a pedido del usuario).

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import IconoDeTematica from "@/components/ui/IconoDeTematica";
import { claveDeTematica, LARGO_DEL_NOMBRE, MAXIMO_DE_TEMATICAS_PROPUESTAS } from "@/lib/tematicas/analizar";
import { avisoDeTematicaExistente, tematicaEquivalente } from "@/lib/tematicas/equivalente";
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

const sinEspaciosDeMas = (texto: string) => texto.trim().replace(/\s+/g, " ");

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

/** Rejilla de mosaicos: `auto-fill` los acomoda al ancho de su tarjeta (3 por fila en móvil). */
const REJILLA = "grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-x-3 gap-y-4";
const CUADRO = "relative flex aspect-square w-full items-center justify-center rounded-lg border-2 transition-colors";
const CUADRO_ELEGIDO = "border-brand-600 bg-brand-50 text-brand-700";
const CUADRO_PARA_AGREGAR =
  "border-dashed border-system-300 bg-white text-system-600 group-hover:border-brand-600 group-hover:text-brand-700 group-disabled:opacity-60";

function SignoMas({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function NombreDelMosaico({ tema, marca, activo }: { tema: string; marca: string | null; activo: boolean }) {
  return (
    <span className={`w-full break-words text-[12px] leading-4 ${activo ? "font-semibold text-brand-800" : "text-system-700"}`}>
      {tema}
      {marca ? <span className="block text-[10.5px] font-medium text-system-500">{marca}</span> : null}
    </span>
  );
}

/**
 * Muestra las temáticas elegidas y un botón que abre una ventana con todas
 * las opciones. Los cambios dentro de la ventana solo se aplican al dar
 * "Aceptar"; Cancelar, Esc o un clic fuera los descartan. Usa <dialog>
 * nativo: el navegador atrapa el foco y cierra con Esc.
 *
 * Con `quitables`, las elegidas son mosaicos con × para quitarlas sin abrir
 * la ventana, y el último mosaico, "Agregar temáticas", la abre (así en /cuenta).
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
  proponerAparte = false,
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
  /** Con `proponer`: proponer es un mosaico aparte en la ventana, no el buscador. */
  proponerAparte?: boolean;
  pendientes?: string[];
  nuevas?: string[];
}) {
  // Proponer desde el buscador de la ventana (formulario de campaña) o con el mosaico (perfil).
  const proponerEnBuscador = proponer && !proponerAparte;
  const proponerConMosaico = proponer && proponerAparte;
  const mosaicosEnElPerfil = quitables && !unica;

  const dialogo = useRef<HTMLDialogElement>(null);
  const campoDePropuesta = useRef<HTMLInputElement>(null);
  const [borrador, setBorrador] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  // Propuestas hechas en esta ventana; se muestran primero con `proponerAparte`.
  const [propuestas, setPropuestas] = useState<string[]>([]);
  const [avisoDePropuesta, setAvisoDePropuesta] = useState<string | null>(null);
  // Vista "Proponer una temática" dentro de la ventana (`proponerAparte`).
  const [proponiendo, setProponiendo] = useState(false);
  const [nombrePropuesto, setNombrePropuesto] = useState("");
  const [avisoDelCatalogo, setAvisoDelCatalogo] = useState<string | null>(null);

  const clavesPendientes = new Set(pendientes.map(claveDeTematica));
  const clavesNuevas = new Set([...nuevas, ...propuestas].map(claveDeTematica));
  function marca(tema: string): string | null {
    const clave = claveDeTematica(tema);
    return clavesPendientes.has(clave) ? "por aprobar" : clavesNuevas.has(clave) ? "nueva" : null;
  }

  // Con `proponerAparte`, las propuestas (nuevas o por aprobar) van primero, arriba.
  const primeroLasPropuestas = (temas: string[]) =>
    proponerAparte ? [...temas.filter((t) => marca(t)), ...temas.filter((t) => !marca(t))] : temas;

  const enOpciones = new Set(opciones.map(claveDeTematica));
  const lista = primeroLasPropuestas([...opciones, ...propuestas.filter((p) => !enOpciones.has(claveDeTematica(p)))]);
  const elegidas = primeroLasPropuestas(seleccionados);

  function abrir() {
    setBorrador(seleccionados);
    setBusqueda("");
    setPropuestas([]);
    setAvisoDePropuesta(null);
    setProponiendo(false);
    setNombrePropuesto("");
    setAvisoDelCatalogo(null);
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
    setAvisoDelCatalogo(null);
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
  const propuestaPosible = sinEspaciosDeMas(busqueda);
  const clavePosible = claveDeTematica(propuestaPosible);
  const puedeProponer = proponerEnBuscador && clavePosible !== "" && !lista.some((tema) => claveDeTematica(tema) === clavePosible);
  // Parecida a una que ya existe (2026-11-11, a pedido del usuario): en vez de proponerla se elige esa.
  const parecida = puedeProponer ? tematicaEquivalente(propuestaPosible, opciones) : null;

  /** Marca la temática existente que equivale a lo que se quería proponer, y lo avisa. */
  function elegirParecida(escrito: string, existente: string) {
    setBorrador((prev) => (unica ? [existente] : prev.includes(existente) ? prev : [...prev, existente]));
    setBusqueda("");
    setAvisoDePropuesta(null);
    // Mensaje pedido por el usuario (2026-11-12): "Esa temática ya existe, es «…»".
    volverAlCatalogo(avisoDeTematicaExistente(existente));
  }

  function proponerBusqueda() {
    if (parecida) {
      elegirParecida(propuestaPosible, parecida);
      return;
    }
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

  function abrirPropuesta() {
    // Si buscó algo que no está, se lleva lo escrito al campo.
    setNombrePropuesto(visibles.length === 0 ? propuestaPosible : "");
    setAvisoDePropuesta(null);
    setAvisoDelCatalogo(null);
    setProponiendo(true);
    requestAnimationFrame(() => campoDePropuesta.current?.focus());
  }

  function volverAlCatalogo(aviso: string | null = null) {
    setProponiendo(false);
    setAvisoDePropuesta(null);
    setAvisoDelCatalogo(aviso);
  }

  // Vista de proponer: la propuesta queda marcada en la ventana y se aplica con "Aceptar".
  function proponerDesdeLaVentana() {
    const nombre = sinEspaciosDeMas(nombrePropuesto);
    if (!nombre) {
      setAvisoDePropuesta("Escribe el nombre de la temática que quieres proponer.");
      return;
    }
    const clave = claveDeTematica(nombre);
    // Si ya existe en el catálogo no se propone: se marca la existente.
    const existente = lista.find((tema) => claveDeTematica(tema) === clave);
    if (existente) {
      setBorrador((prev) => (unica ? [existente] : prev.includes(existente) ? prev : [...prev, existente]));
      setBusqueda("");
      volverAlCatalogo(avisoDeTematicaExistente(existente));
      return;
    }
    const equivalente = tematicaEquivalente(nombre, opciones);
    if (equivalente) {
      setNombrePropuesto("");
      elegirParecida(nombre, equivalente);
      return;
    }
    const error = errorDePropuesta(nombre);
    if (error) {
      setAvisoDePropuesta(error);
      return;
    }
    const enEspera = new Set([...pendientes, ...nuevas, ...propuestas].map(claveDeTematica));
    if (enEspera.size >= MAXIMO_DE_TEMATICAS_PROPUESTAS) {
      setAvisoDePropuesta(
        `Ya tienes ${MAXIMO_DE_TEMATICAS_PROPUESTAS} temáticas propuestas en espera. Cuando la administración las revise podrás proponer otra.`,
      );
      return;
    }
    setPropuestas((prev) => [...prev, nombre]);
    setBorrador((prev) => (unica ? [nombre] : [...prev, nombre]));
    setBusqueda("");
    setNombrePropuesto("");
    volverAlCatalogo(`Propusiste «${nombre}». Da “Aceptar” y guarda los cambios de tu perfil para enviarla.`);
  }

  return (
    <>
      {mosaicosEnElPerfil ? (
        <div>
          {seleccionados.length === 0 ? <p className="mb-2 text-[12.5px] text-system-500">Aún no eliges ninguna temática.</p> : null}
          <ul className={REJILLA} aria-label="Tus temáticas">
            {elegidas.map((tema) => (
              <li key={tema} className="flex min-w-0 flex-col items-center gap-2 text-center">
                <span className={`${CUADRO} ${CUADRO_ELEGIDO}`}>
                  <IconoDeTematica tematica={tema} className="h-[42%] w-[42%]" />
                  {deshabilitado ? null : (
                    <button
                      type="button"
                      onClick={() => onAceptar(seleccionados.filter((t) => t !== tema))}
                      aria-label={`Quitar ${tema}`}
                      title={`Quitar ${tema}`}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-system-300 bg-white text-system-600 transition-colors hover:border-error-700 hover:bg-error-50 hover:text-error-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  )}
                </span>
                <NombreDelMosaico tema={tema} marca={marca(tema)} activo />
              </li>
            ))}
            <li className="min-w-0">
              <button
                type="button"
                onClick={abrir}
                disabled={deshabilitado}
                className="group flex w-full flex-col items-center gap-2 rounded-lg text-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-default"
              >
                <span className={`${CUADRO} ${CUADRO_PARA_AGREGAR}`}>
                  <SignoMas className="h-[38%] w-[38%]" />
                </span>
                <span className="w-full text-[12px] font-semibold leading-4 text-system-700">Agregar temáticas</span>
              </button>
            </li>
          </ul>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {seleccionados.length === 0 ? (
            <p className="text-[12.5px] text-system-500">Aún no eliges ninguna temática.</p>
          ) : (
            elegidas.map((tema) => (
              <Tag key={tema} tone="on">
                <ConMarca tema={tema} marca={marca(tema)} clara />
              </Tag>
            ))
          )}
          <Button type="button" size="sm" onClick={abrir} disabled={deshabilitado}>
            {textoDelBoton}
          </Button>
        </div>
      )}

      <dialog
        ref={dialogo}
        aria-labelledby="selector-temas-titulo"
        // Clic en el fondo (fuera de la caja): se cierra sin aplicar cambios.
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
      >
        {proponiendo ? (
          <div className="flex max-h-[85vh] flex-col">
            <div className="border-b border-system-200 p-5">
              <h2 id="selector-temas-titulo" className="text-lg font-extrabold text-system-900">
                Proponer una temática
              </h2>
              <p className="mt-1 text-[12.5px] text-system-600">Si la temática que buscas no está en el catálogo, puedes proponerla.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="rounded border-l-4 border-brand-600 bg-system-100 p-4">
                <p className="text-[13px] font-bold text-system-900">Las temáticas propuestas serán evaluadas por la administración</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-5 text-system-600">
                  <li>Se envía cuando guardas los cambios de tu perfil.</li>
                  <li>Mientras la revisan, solo tú la ves en tu perfil, marcada como «por aprobar».</li>
                  <li>Te avisaremos cuando la aprueben o la rechacen. Si la aprueban, todos podrán elegirla.</li>
                  <li>Puedes tener hasta {MAXIMO_DE_TEMATICAS_PROPUESTAS} temáticas propuestas en espera a la vez.</li>
                  <li>Si ya existe en el catálogo, la marcamos en lugar de proponerla.</li>
                </ul>
              </div>

              <label htmlFor="selector-temas-propuesta" className="mt-5 block text-[13px] font-medium text-system-900">
                Nombre de la temática
              </label>
              <input
                ref={campoDePropuesta}
                id="selector-temas-propuesta"
                type="text"
                value={nombrePropuesto}
                onChange={(e) => {
                  setNombrePropuesto(e.target.value);
                  setAvisoDePropuesta(null);
                }}
                onKeyDown={(e) => {
                  // Enter no envía el formulario de la página: propone lo escrito.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    proponerDesdeLaVentana();
                  }
                }}
                maxLength={LARGO_DEL_NOMBRE.maximo}
                placeholder="Por ejemplo: Huertos urbanos"
                aria-invalid={avisoDePropuesta ? true : undefined}
                aria-describedby="selector-temas-propuesta-aviso"
                className="mt-1.5 w-full rounded border border-system-300 bg-white px-3 py-2 text-base text-system-900 outline-none focus:border-brand-600 aria-invalid:border-error-700 sm:text-[13px]"
              />
              <p id="selector-temas-propuesta-aviso" role="alert" className="mt-1.5 min-h-[1lh] text-[12px] font-medium text-error-700">
                {avisoDePropuesta}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-system-200 p-4">
              <Button type="button" variant="secondary" size="sm" onClick={() => volverAlCatalogo()}>
                ← Volver al catálogo
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={proponerDesdeLaVentana}>
                Proponer temática
              </Button>
            </div>
          </div>
        ) : (
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
                {proponerEnBuscador
                  ? " Si no encuentras la tuya, escríbela y proponla."
                  : proponerConMosaico
                    ? " Si no está la tuya, usa «Proponer temática», al final de la lista."
                    : null}
              </p>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setAvisoDePropuesta(null);
                  setAvisoDelCatalogo(null);
                }}
                onKeyDown={(e) => {
                  // Enter no envía el formulario de la página. Si lo escrito se parece a una que ya existe, la
                  // marca (2026-11-12, aunque la lista muestre otras); sin coincidencias, propone lo escrito.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (parecida || (puedeProponer && visibles.length === 0)) proponerBusqueda();
                  }
                }}
                placeholder={proponerEnBuscador ? "Buscar o proponer una temática" : "Buscar temática"}
                aria-label={proponerEnBuscador ? "Buscar o proponer una temática" : "Buscar temática"}
                maxLength={proponerEnBuscador ? LARGO_DEL_NOMBRE.maximo : undefined}
                className="mt-3 w-full rounded border border-system-300 bg-white px-3 py-2 text-[13px] text-system-900 outline-none focus:border-brand-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <p aria-live="polite" className={avisoDelCatalogo ? "mb-4 rounded bg-success-50 px-3 py-2 text-[12.5px] text-success-800" : "sr-only"}>
                {avisoDelCatalogo}
              </p>
              {puedeProponer ? (
                <div className="mb-4 rounded border border-dashed border-system-300 p-3">
                  {parecida ? (
                    <>
                      <p className="text-[12.5px] text-system-600">
                        Esa temática ya existe, es «{parecida}».
                      </p>
                      <Button type="button" size="sm" className="mt-2" onClick={proponerBusqueda}>
                        Elegir «{parecida}»
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-[12.5px] text-system-600">
                        {visibles.length === 0 ? `Ninguna temática coincide con «${propuestaPosible}».` : "¿No está la que buscas?"}
                      </p>
                      <Button type="button" size="sm" className="mt-2" onClick={proponerBusqueda}>
                        + Proponer «{propuestaPosible}» como temática nueva
                      </Button>
                      <p className="mt-1.5 text-[11.5px] text-system-500">
                        Queda pendiente hasta que la apruebe el SuperUsuario; mientras tanto solo la ves tú.
                      </p>
                    </>
                  )}
                  {avisoDePropuesta ? (
                    <p role="alert" className="mt-1.5 text-[12px] font-medium text-error-700">
                      {avisoDePropuesta}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {visibles.length === 0 && !puedeProponer ? (
                <p className="mb-4 text-[12.5px] text-system-500">Ninguna temática coincide con «{busqueda}».</p>
              ) : null}
              {visibles.length > 0 || proponerConMosaico ? (
                // Mosaicos con ícono y nombre (2026-11-11, a pedido del usuario; estructura tomada de
                // la página de categorías de GoFundMe). `auto-fill` los acomoda al ancho de la ventana:
                // 3 por fila en móvil y hasta 6 en escritorio, sin desbordar la tarjeta.
                <ul className={REJILLA}>
                  {visibles.map((tema) => {
                    const activo = borrador.includes(tema);
                    return (
                      <li key={tema} className="min-w-0">
                        <button
                          type="button"
                          aria-pressed={activo}
                          onClick={() => alternar(tema)}
                          className="group flex w-full flex-col items-center gap-2 rounded-lg text-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          <span
                            className={`${CUADRO} ${
                              activo ? CUADRO_ELEGIDO : "border-transparent bg-system-100 text-system-800 group-hover:border-system-300"
                            }`}
                          >
                            <IconoDeTematica tematica={tema} className="h-[42%] w-[42%]" />
                            {activo ? (
                              <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                                </svg>
                              </span>
                            ) : null}
                          </span>
                          <NombreDelMosaico tema={tema} marca={marca(tema)} activo={activo} />
                        </button>
                      </li>
                    );
                  })}
                  {proponerConMosaico ? (
                    <li className="min-w-0">
                      <button
                        type="button"
                        onClick={abrirPropuesta}
                        className="group flex w-full flex-col items-center gap-2 rounded-lg text-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      >
                        <span className={`${CUADRO} ${CUADRO_PARA_AGREGAR}`}>
                          <SignoMas className="h-[38%] w-[38%]" />
                        </span>
                        <span className="w-full text-[12px] font-semibold leading-4 text-system-700">Proponer temática</span>
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : null}
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
        )}
      </dialog>
    </>
  );
}
