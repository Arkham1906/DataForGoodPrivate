"use client";

// Subtemáticas (etiquetas, 2026-10-27) de los intereses de la persona, en /bienvenida y /cuenta.
// Desde el 2026-10-28 (a pedido del usuario) cada temática elegida (las que salen del texto) es un
// submenú desplegable con sus etiquetas del catálogo (GET /api/etiquetas; las base salen de
// lib/etiquetas/base.ts) que se marcan como botones, y un campo para proponer una que no está: queda
// en `nuevas` hasta guardar el perfil, el servidor la crea pendiente y el SuperUsuario la aprueba o la
// rechaza en /sistema/tematicas. Mientras tanto la persona la ve marcada "por revisar".
// Sirven para los avisos de campañas nuevas: con subtemáticas marcadas en una temática, no avisan de
// las campañas que solo tengan otras etiquetas (las que no tienen etiquetas sí avisan). Se guardan con
// el perfil (PATCH /api/usuarios/[id], `etiquetas`: ids, `etiquetasNuevas`: [{ tematica, nombre }]);
// el servidor quita las de temáticas que ya no tiene.

import { useEffect, useId, useRef, useState } from "react";

import { BASE_PATH } from "@/lib/base-path";
import {
  MAXIMO_DE_ETIQUETAS_EN_PERFIL,
  MAXIMO_DE_ETIQUETAS_NUEVAS_EN_PERFIL,
  type CatalogoDeEtiquetas,
  type EtiquetaNueva,
} from "@/lib/etiquetas/reglas";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { etiquetasEnElTexto } from "@/lib/etiquetas/desde-texto";

/** Pausa al escribir antes de buscar etiquetas en el texto (la misma de ui/InteresesDesdeTexto). */
const PAUSA_AL_ESCRIBIR_MS = 700;

// Mismas reglas que validarNombreDeTematica (lib/tematicas/catalogo.ts); el servidor vuelve a revisar
// (también las palabras inapropiadas).
const LARGO_MINIMO = 3;
const LARGO_MAXIMO = 60;
const FORMATO_DEL_NOMBRE = /^\p{L}[\p{L} ,-]*$/u;

const CLASE_BOTON =
  "rounded-pill border px-3 py-1 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const CLASE_ACTIVA = "border-brand-600 bg-brand-600 text-white";
const CLASE_INACTIVA = "border-system-300 bg-white text-system-600 hover:border-brand-600";

export default function SubtematicasDelPerfil({
  texto,
  intereses,
  seleccionadas,
  onCambiar,
  nuevas,
  onNuevas,
  error,
}: {
  /**
   * Lo que la persona escribió sobre sus gustos (2026-10-28): las etiquetas que menciona se marcan
   * solas (lib/etiquetas/desde-texto.ts), como las temáticas en ui/InteresesDesdeTexto.
   */
  texto: string;
  /** Temáticas elegidas (nombres). */
  intereses: string[];
  /** Ids de las etiquetas marcadas (aprobadas o pendientes propias). */
  seleccionadas: number[];
  onCambiar: (ids: number[]) => void;
  /** Etiquetas que la persona escribió y aún no se guardan (2026-10-28). */
  nuevas: EtiquetaNueva[];
  onNuevas: (nuevas: EtiquetaNueva[]) => void;
  /** Error del servidor sobre las etiquetas, si lo hubo al guardar. */
  error?: string | null;
}) {
  const [catalogo, setCatalogo] = useState<CatalogoDeEtiquetas | null>(null);
  // Temáticas aprobadas y visibles: solo a esas se les puede proponer una etiqueta.
  const [tematicas, setTematicas] = useState<string[]>([]);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  // Al guardar, las nuevas vuelven del servidor como ids que este catálogo todavía no tiene: cambiar
  // esta clave lo vuelve a pedir (si siguen sin aparecer, p. ej. rechazadas, la clave no cambia).
  const idsDelCatalogo = new Set(Object.values(catalogo ?? {}).flatMap((lista) => lista.map((e) => e.id)));
  const desconocidas = catalogo ? seleccionadas.filter((id) => !idsDelCatalogo.has(id)).sort((a, b) => a - b).join() : "";

  useEffect(() => {
    let vigente = true;
    fetch(`${BASE_PATH}/api/etiquetas`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!vigente) return;
        setCatalogo(body?.data && typeof body.data === "object" ? (body.data as CatalogoDeEtiquetas) : {});
        setTematicas(Array.isArray(body?.tematicas) ? (body.tematicas as string[]) : []);
      })
      .catch(() => vigente && setCatalogo({}));
    return () => {
      vigente = false;
    };
  }, [desconocidas]);

  // Etiquetas desde el texto (2026-10-28), con las mismas reglas que las temáticas: al dejar de
  // escribir se marcan las que el texto menciona y se desmarcan las que ya no menciona, salvo las que
  // la persona marcó a mano; las que desmarcó a mano no vuelven mientras el texto las siga mencionando.
  const delTexto = useRef<Set<number> | null>(null);
  const aMano = useRef(new Set<number>());
  const quitadasAMano = useRef(new Set<number>());
  const primerTexto = useRef(texto);
  const [avisoDelTexto, setAvisoDelTexto] = useState<string | null>(null);
  const actuales = useRef({ catalogo, intereses, seleccionadas, nuevas, onCambiar });
  useEffect(() => {
    actuales.current = { catalogo, intereses, seleccionadas, nuevas, onCambiar };
  });
  const clavesDeIntereses = intereses.map(claveDeTematica).join("|");

  useEffect(() => {
    if (!catalogo) return;
    const temporizador = setTimeout(() => {
      const { catalogo: cat, intereses: temas, seleccionadas: marcadasAhora, nuevas: porProponer, onCambiar: cambiar } = actuales.current;
      if (!cat) return;
      // Solo las aprobadas de sus temáticas: una pendiente ya la eligió ella al proponerla.
      const candidatas = temas.flatMap((tema) => (cat[tema] ?? []).filter((e) => !e.pendiente));
      if (delTexto.current === null) {
        // Lo que el texto guardado menciona y no está marcado lo desmarcó antes: no se vuelve a poner.
        delTexto.current = etiquetasEnElTexto(primerTexto.current, candidatas);
        for (const id of delTexto.current) if (!marcadasAhora.includes(id)) quitadasAMano.current.add(id);
      }
      const ahora = etiquetasEnElTexto(texto, candidatas);
      for (const id of quitadasAMano.current) if (!ahora.has(id)) quitadasAMano.current.delete(id);
      const quitadas = marcadasAhora.filter((id) => delTexto.current!.has(id) && !ahora.has(id) && !aMano.current.has(id));
      const quedan = marcadasAhora.filter((id) => !quitadas.includes(id));
      const espacio = Math.max(0, MAXIMO_DE_ETIQUETAS_EN_PERFIL - quedan.length - porProponer.length);
      const agregadas = [...ahora].filter((id) => !quedan.includes(id) && !quitadasAMano.current.has(id)).slice(0, espacio);
      delTexto.current = ahora;
      if (quitadas.length === 0 && agregadas.length === 0) return;
      cambiar([...quedan, ...agregadas]);
      const nombre = (id: number) => candidatas.find((e) => e.id === id)?.nombre ?? "";
      const partes: string[] = [];
      if (agregadas.length > 0) partes.push(`Marcamos ${agregadas.map(nombre).join(", ")} por tu texto.`);
      if (quitadas.length > 0) partes.push(`Desmarcamos ${quitadas.map(nombre).filter(Boolean).join(", ")}: ya no está en tu texto.`);
      setAvisoDelTexto(partes.join(" "));
      // Se abre el submenú de las temáticas donde se marcó algo, para que se vea.
      const temasConAgregadas = temas.filter((tema) => (cat[tema] ?? []).some((e) => agregadas.includes(e.id)));
      if (temasConAgregadas.length > 0) setAbiertas((actualesAbiertas) => new Set([...actualesAbiertas, ...temasConAgregadas]));
    }, PAUSA_AL_ESCRIBIR_MS);
    return () => clearTimeout(temporizador);
  }, [texto, clavesDeIntereses, catalogo]);

  if (!catalogo) return null;
  const clavesDeTematicas = new Set(tematicas.map(claveDeTematica));
  const conSubmenu = intereses.filter((tema) => (catalogo[tema] ?? []).length > 0 || clavesDeTematicas.has(claveDeTematica(tema)));
  if (conSubmenu.length === 0) return null;

  // Solo cuentan las de temáticas que sigue teniendo: al quitar una temática, sus etiquetas se van.
  const visibles = new Set(conSubmenu.flatMap((tema) => (catalogo[tema] ?? []).map((e) => e.id)));
  const marcadas = seleccionadas.filter((id) => visibles.has(id));
  const nuevasVisibles = nuevas.filter((n) => conSubmenu.some((tema) => claveDeTematica(tema) === claveDeTematica(n.tematica)));
  const total = marcadas.length + nuevasVisibles.length;
  const lleno = total >= MAXIMO_DE_ETIQUETAS_EN_PERFIL;

  function alternar(id: number) {
    if (marcadas.includes(id)) {
      aMano.current.delete(id);
      if (delTexto.current?.has(id)) quitadasAMano.current.add(id);
      onCambiar(marcadas.filter((x) => x !== id));
    } else if (!lleno) {
      aMano.current.add(id);
      quitadasAMano.current.delete(id);
      onCambiar([...marcadas, id]);
    }
  }

  function alternarSubmenu(tema: string) {
    setAbiertas((actuales) => {
      const siguiente = new Set(actuales);
      if (siguiente.has(tema)) siguiente.delete(tema);
      else siguiente.add(tema);
      return siguiente;
    });
  }

  /** Agrega lo escrito: si ya existe en la temática, la marca; si no, queda como nueva. Devuelve el error o null. */
  function proponer(tema: string, escrito: string): string | null {
    const nombre = escrito.trim().replace(/\s+/g, " ");
    if (nombre.length < LARGO_MINIMO || nombre.length > LARGO_MAXIMO) {
      return `Escribe entre ${LARGO_MINIMO} y ${LARGO_MAXIMO} caracteres.`;
    }
    if (!FORMATO_DEL_NOMBRE.test(nombre)) return "Usa solo letras, espacios, guiones y comas.";
    const clave = claveDeTematica(nombre);
    if (clavesDeTematicas.has(clave) || intereses.some((t) => claveDeTematica(t) === clave)) {
      return `«${nombre}» ya es una temática: escribe algo más específico.`;
    }
    const existente = (catalogo?.[tema] ?? []).find((e) => claveDeTematica(e.nombre) === clave);
    if (existente) {
      if (!marcadas.includes(existente.id)) {
        if (lleno) return `Puedes marcar hasta ${MAXIMO_DE_ETIQUETAS_EN_PERFIL}.`;
        onCambiar([...marcadas, existente.id]);
      }
      return null;
    }
    if (nuevas.some((n) => claveDeTematica(n.tematica) === claveDeTematica(tema) && claveDeTematica(n.nombre) === clave)) return null;
    if (lleno) return `Puedes marcar hasta ${MAXIMO_DE_ETIQUETAS_EN_PERFIL}.`;
    if (nuevasVisibles.length >= MAXIMO_DE_ETIQUETAS_NUEVAS_EN_PERFIL) {
      return `Puedes proponer hasta ${MAXIMO_DE_ETIQUETAS_NUEVAS_EN_PERFIL} etiquetas nuevas a la vez.`;
    }
    onNuevas([...nuevas, { tematica: tema, nombre }]);
    return null;
  }

  return (
    <div className="mt-4 border-t border-system-200 pt-4">
      <p className="text-[13px] font-semibold text-system-900">
        Subtemáticas <span className="font-normal text-system-500">(opcional)</span>
      </p>
      <p className="mb-3 mt-0.5 text-[12px] text-system-500">
        Abre cada temática y marca lo que más te interesa. Si marcas alguna, no te avisamos de las campañas de esa temática que solo tengan otras etiquetas (las que no tienen etiquetas sí te llegan). Hasta{" "}
        {MAXIMO_DE_ETIQUETAS_EN_PERFIL} en total.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-[12.5px] text-error-700">
          {error}
        </p>
      )}
      <p aria-live="polite" className={avisoDelTexto ? "mb-3 text-[12px] text-brand-600" : "sr-only"}>
        {avisoDelTexto}
      </p>
      <div className="flex flex-col gap-2">
        {conSubmenu.map((tema) => (
          <SubmenuDeTematica
            key={tema}
            tema={tema}
            etiquetas={catalogo[tema] ?? []}
            marcadas={marcadas}
            nuevas={nuevasVisibles.filter((n) => claveDeTematica(n.tematica) === claveDeTematica(tema))}
            abierto={abiertas.has(tema)}
            lleno={lleno}
            puedeProponer={clavesDeTematicas.has(claveDeTematica(tema))}
            onAbrir={() => alternarSubmenu(tema)}
            onAlternar={alternar}
            onQuitarNueva={(nombre) => onNuevas(nuevas.filter((n) => !(n.tematica === tema && n.nombre === nombre)))}
            onProponer={(escrito) => proponer(tema, escrito)}
          />
        ))}
      </div>
    </div>
  );
}

function SubmenuDeTematica({
  tema,
  etiquetas,
  marcadas,
  nuevas,
  abierto,
  lleno,
  puedeProponer,
  onAbrir,
  onAlternar,
  onQuitarNueva,
  onProponer,
}: {
  tema: string;
  etiquetas: { id: number; nombre: string; pendiente?: boolean }[];
  marcadas: number[];
  nuevas: EtiquetaNueva[];
  abierto: boolean;
  lleno: boolean;
  puedeProponer: boolean;
  onAbrir: () => void;
  onAlternar: (id: number) => void;
  onQuitarNueva: (nombre: string) => void;
  onProponer: (escrito: string) => string | null;
}) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const idPanel = useId();
  const idCampo = useId();
  const cuantas = etiquetas.filter((e) => marcadas.includes(e.id)).length + nuevas.length;

  function agregar() {
    const error = onProponer(texto);
    setAviso(error);
    if (!error) setTexto("");
  }

  return (
    <div className="rounded-lg border border-system-200 bg-white">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={onAbrir}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="text-[13px] font-semibold text-system-900">{tema}</span>
        <span className="flex shrink-0 items-center gap-2 text-[12px] text-system-500">
          {cuantas > 0 ? `${cuantas} ${cuantas === 1 ? "marcada" : "marcadas"}` : "Elegir"}
          <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-4 transition-transform ${abierto ? "rotate-180" : ""}`}>
            <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div id={idPanel} hidden={!abierto} className="border-t border-system-100 px-3.5 pb-3.5 pt-3">
        <div role="group" aria-label={`Subtemáticas de ${tema}`} className="flex flex-wrap gap-1.5">
          {etiquetas.map((e) => {
            const activa = marcadas.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={activa}
                disabled={!activa && lleno}
                onClick={() => onAlternar(e.id)}
                title={e.pendiente ? "La propusiste: el administrador la está revisando" : undefined}
                className={`${CLASE_BOTON} ${activa ? CLASE_ACTIVA : CLASE_INACTIVA} ${e.pendiente ? "border-dashed" : ""}`}
              >
                #{e.nombre}
                {e.pendiente && <span className="ml-1 font-normal opacity-80">(por revisar)</span>}
              </button>
            );
          })}
          {nuevas.map((n) => (
            <span key={n.nombre} className={`${CLASE_BOTON} ${CLASE_ACTIVA} inline-flex items-center gap-1 border-dashed`}>
              #{n.nombre}
              <span className="font-normal opacity-80">(nueva, por revisar)</span>
              <button
                type="button"
                onClick={() => onQuitarNueva(n.nombre)}
                aria-label={`Quitar ${n.nombre}`}
                className="ml-0.5 rounded-full px-1 leading-none hover:bg-white/20"
              >
                ×
              </button>
            </span>
          ))}
          {etiquetas.length === 0 && nuevas.length === 0 && (
            <p className="text-[12px] text-system-500">Todavía no hay subtemáticas en esta temática.</p>
          )}
        </div>

        {puedeProponer && (
          <div className="mt-3">
            <label htmlFor={idCampo} className="mb-1 block text-[12px] text-system-600">
              ¿No encuentras la que buscas? Escríbela: el administrador la revisa antes de que la vean los demás.
            </label>
            <div className="flex gap-2">
              <input
                id={idCampo}
                type="text"
                value={texto}
                maxLength={LARGO_MAXIMO}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setAviso(null);
                }}
                onKeyDown={(e) => {
                  // Enter agrega la etiqueta en vez de enviar el formulario del perfil.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregar();
                  }
                }}
                placeholder={`Otra subtemática de ${tema}`}
                aria-invalid={aviso ? true : undefined}
                className="min-w-0 flex-1 rounded border border-system-300 bg-white px-3 py-1.5 text-[13px] text-system-900 outline-none transition-colors focus:border-brand-600 aria-invalid:border-error-700"
              />
              <button
                type="button"
                onClick={agregar}
                disabled={texto.trim().length === 0}
                className="shrink-0 rounded border border-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
            {aviso && (
              <p role="alert" className="mt-1 text-[12px] text-error-700">
                {aviso}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
