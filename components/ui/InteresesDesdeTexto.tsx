"use client";

// Intereses a partir de un texto (2026-10-07). La persona escribe qué le gusta y se sacan las
// temáticas con lib/tematicas/analizar.ts, en el navegador. Desde el 2026-10-27 (a pedido del usuario)
// el texto y sus temáticas van sincronizados: si se borra el fragmento que dio una temática, al analizar
// la temática se quita. Desde el 2026-11-04 (a pedido del usuario) se analiza SOLO con el botón "Analizar
// texto" (antes, al dejar de escribir o con Enter; Enter ahora es un salto de línea) y, si el texto cambió
// desde el último análisis, al guardar (`ref.analizarAlGuardar()`). `onAnalizado` avisa al formulario
// para que ui/SubtematicasDelPerfil analice el mismo texto. Las que la
// persona agregó con "Agregar temáticas" se respetan aunque el texto no las mencione. Debajo, las elegidas con × y "Agregar temáticas" (ui/SelectorDeTemas) para
// corregir. Desde el 2026-10-20 el texto solo da temáticas que ya existen (palabras clave): lo que
// no reconoce se ignora y no se crean temáticas nuevas. Lo usan /bienvenida (paso 4) y /cuenta
// (Mis intereses).
// Catálogo: GET /api/tematicas; si falla, las base.
// Desde el 2026-10-29 (a pedido del usuario) "Agregar temáticas" deja proponer una que no está: va en
// `nuevas` (el formulario la manda como `tematicasNuevas` en PATCH /api/usuarios/[id]) y queda pendiente
// hasta que el SuperUsuario la revisa; las ya propuestas (`propias` del catálogo) se marcan "por aprobar".

import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import SelectorDeTemas from "@/components/ui/SelectorDeTemas";
import { TEMAS_DE_INTERES } from "@/lib/intereses";
import { analizarIntereses, claveDeTematica, LARGO_MAXIMO_DEL_TEXTO, MAXIMO_DE_INTERESES } from "@/lib/tematicas/analizar";
import { BASE_PATH } from "@/lib/base-path";

/** "A", "A y B", "A, B y C". */
function enLista(nombres: string[]): string {
  return nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

export type ControlDeIntereses = {
  /** Analiza si el texto cambió desde el último análisis. Devuelve las temáticas con las que se guarda. */
  analizarAlGuardar: () => string[];
};

export default function InteresesDesdeTexto({
  ref,
  texto,
  onTexto,
  seleccionados,
  onCambiar,
  deshabilitado = false,
  nuevas: propuestasSinGuardar = [],
  onNuevas,
  onAnalizado,
}: {
  ref?: Ref<ControlDeIntereses>;
  texto: string;
  onTexto: (texto: string) => void;
  seleccionados: string[];
  onCambiar: (temas: string[]) => void;
  deshabilitado?: boolean;
  /** Temáticas propuestas aún sin guardar (2026-10-29). Sin `onNuevas` no se puede proponer. */
  nuevas?: string[];
  onNuevas?: (nuevas: string[]) => void;
  /** Se dio "Analizar texto" (2026-11-04). */
  onAnalizado?: () => void;
}) {
  const id = useId();
  const [catalogo, setCatalogo] = useState<string[]>(TEMAS_DE_INTERES);
  const [propias, setPropias] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(`${BASE_PATH}/api/tematicas`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (vigente && Array.isArray(body?.data)) setCatalogo(body.data as string[]);
        if (vigente && Array.isArray(body?.propias)) setPropias(body.propias as string[]);
      })
      .catch(() => {
        // Sin catálogo se analiza contra las base; el servidor revisa todo al guardar.
      });
    return () => {
      vigente = false;
    };
  }, []);

  // Temáticas que salieron del texto en el último análisis (por clave) y las que la persona agregó a
  // mano. Al volver a analizar, las del texto anterior que ya no salen se quitan, salvo las de a mano.
  // Al empezar: las del texto guardado que la persona tiene (las demás las eligió a mano).
  const delTexto = useRef<Set<string> | null>(null);
  const aMano = useRef(new Set<string>());
  // Las que quitó con la × aunque el texto las mencione: no se vuelven a poner mientras el texto las
  // siga mencionando (si deja de mencionarlas y luego las vuelve a escribir, sí).
  const quitadasAMano = useRef(new Set<string>());
  const primerTexto = useRef(texto);
  const ultimoAnalizado = useRef(texto);

  useImperativeHandle(ref, () => ({
    analizarAlGuardar: () => (texto.trim() === ultimoAnalizado.current.trim() ? seleccionados : analizar()),
  }));

  function analizar(): string[] {
    ultimoAnalizado.current = texto;
    // Lo que el texto guardado menciona y no está en el perfil ya no se toma como quitado a mano: un
    // texto puede guardarse sin analizar (2026-11-04), y entonces el botón no podría agregarlo.
    delTexto.current ??= new Set(analizarIntereses(primerTexto.current, catalogo).tematicas.map(claveDeTematica));
    const { tematicas: encontradas, descartadas } = analizarIntereses(texto, catalogo);
    const ahora = new Set(encontradas.map(claveDeTematica));
    for (const clave of quitadasAMano.current) if (!ahora.has(clave)) quitadasAMano.current.delete(clave);

    // Se quitan las que daba el texto anterior y ya no da (si no se agregaron a mano).
    const quitadas = seleccionados.filter((t) => {
      const clave = claveDeTematica(t);
      return delTexto.current!.has(clave) && !ahora.has(clave) && !aMano.current.has(clave);
    });
    const quedan = seleccionados.filter((t) => !quitadas.includes(t));
    const yaEstaban = new Set(quedan.map(claveDeTematica));
    const nuevas = encontradas.filter((t) => !yaEstaban.has(claveDeTematica(t)) && !quitadasAMano.current.has(claveDeTematica(t)));
    const caben = nuevas.slice(0, Math.max(0, MAXIMO_DE_INTERESES - quedan.length));
    delTexto.current = ahora;

    const resultado = quitadas.length > 0 || caben.length > 0 ? [...quedan, ...caben] : seleccionados;
    if (resultado !== seleccionados) onCambiar(resultado);

    // Las partes con palabras inapropiadas (lib/tematicas/filtro.ts) se descartan completas; se
    // avisa sin repetir las palabras.
    const partes: string[] = [];
    if (caben.length > 0) partes.push(`Agregamos ${enLista(caben)}.`);
    if (quitadas.length > 0) partes.push(`Quitamos ${enLista(quitadas)}: ya no está en tu texto.`);
    if (caben.length < nuevas.length) partes.push(`Las demás no caben: el máximo es ${MAXIMO_DE_INTERESES}.`);
    if (descartadas > 0) {
      partes.push(
        descartadas === 1
          ? "Quitamos una parte de tu texto con palabras que no se permiten."
          : `Quitamos ${descartadas} partes de tu texto con palabras que no se permiten.`,
      );
    }
    if (partes.length > 0) {
      setAviso(partes.join(" "));
    } else {
      setAviso(
        !texto.trim()
          ? "Escribe primero qué te gusta hacer."
          : encontradas.length === 0
            ? 'No reconocimos temas en tu texto. Prueba con otras palabras o elige de la lista en "Agregar temáticas".'
            : "Esas temáticas ya estaban en tu lista.",
      );
    }
    return resultado;
  }

  // Las que la persona ya tenía y no se ofrecen (pendientes de antes del 2026-10-20, u ocultas)
  // también son opciones: el selector descarta lo que no esté en `opciones`.
  const enCatalogo = new Set(catalogo.map(claveDeTematica));
  const opciones = [...catalogo, ...seleccionados.filter((tema) => !enCatalogo.has(claveDeTematica(tema)))];

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-system-900">
        Cuéntanos qué te gusta hacer
      </label>
      <Textarea
        id={id}
        value={texto}
        onChange={(e) => onTexto(e.target.value)}
        maxLength={LARGO_MAXIMO_DEL_TEXTO}
        rows={3}
        disabled={deshabilitado}
        placeholder="Por ejemplo: me gusta andar en bici, cuidar a los perritos de la calle y la fotografía."
        className="disabled:cursor-default disabled:bg-system-100"
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11.5px] text-system-500">Da “Analizar texto” para ver tus temáticas; también se analiza al guardar. Si borras algo, se quita su temática.</p>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onAnalizado?.();
            analizar();
          }}
          disabled={deshabilitado}
        >
          Analizar texto
        </Button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-[1lh] text-[12.5px] text-system-600">
        {aviso}
      </p>

      <div className="mt-3">
        <SelectorDeTemas
          opciones={opciones}
          seleccionados={seleccionados}
          onAceptar={(temas) => {
            // Las que se agregan aquí son "a mano": el texto no las quita. Las que se quitan dejan de serlo.
            const nuevas = new Set(temas.map(claveDeTematica));
            const antes = new Set(seleccionados.map(claveDeTematica));
            for (const clave of nuevas) if (!antes.has(clave)) aMano.current.add(clave);
            for (const clave of nuevas) quitadasAMano.current.delete(clave);
            for (const clave of antes) {
              if (nuevas.has(clave)) continue;
              aMano.current.delete(clave);
              quitadasAMano.current.add(clave);
            }
            onCambiar(temas);
            // Propuestas: las que no son del catálogo ni ya propuestas, y que no tenía antes (o que
            // ya eran nuevas sin guardar).
            if (onNuevas) {
              const yaPropuestas = new Set(propias.map(claveDeTematica));
              const sinGuardar = new Set(propuestasSinGuardar.map(claveDeTematica));
              const tenia = new Set(seleccionados.map(claveDeTematica));
              onNuevas(
                temas.filter((tema) => {
                  const clave = claveDeTematica(tema);
                  return !enCatalogo.has(clave) && !yaPropuestas.has(clave) && (sinGuardar.has(clave) || !tenia.has(clave));
                }),
              );
            }
            setAviso(null);
          }}
          quitables
          deshabilitado={deshabilitado}
          proponer={Boolean(onNuevas)}
          pendientes={propias}
          nuevas={propuestasSinGuardar}
        />
      </div>
    </div>
  );
}
