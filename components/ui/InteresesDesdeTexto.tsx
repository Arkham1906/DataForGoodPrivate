"use client";

// Intereses a partir de un texto (2026-10-07). La persona escribe qué le gusta; al dar Enter (o
// "Analizar") se sacan las temáticas con lib/tematicas/analizar.ts, en el navegador, y se suman a
// las que ya tenía. Debajo, las elegidas con × y "Agregar temáticas" (ui/SelectorDeTemas) para
// corregir. Desde el 2026-10-20 el texto solo da temáticas que ya existen (palabras clave): lo que
// no reconoce se ignora y no se crean temáticas nuevas. Lo usan /bienvenida (paso 4) y /cuenta
// (Mis intereses).
// Catálogo: GET /api/tematicas; si falla, las 23 base.

import { useEffect, useId, useState } from "react";
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

export default function InteresesDesdeTexto({
  texto,
  onTexto,
  seleccionados,
  onCambiar,
  deshabilitado = false,
}: {
  texto: string;
  onTexto: (texto: string) => void;
  seleccionados: string[];
  onCambiar: (temas: string[]) => void;
  deshabilitado?: boolean;
}) {
  const id = useId();
  const [catalogo, setCatalogo] = useState<string[]>(TEMAS_DE_INTERES);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(`${BASE_PATH}/api/tematicas`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (vigente && Array.isArray(body?.data)) setCatalogo(body.data as string[]);
      })
      .catch(() => {
        // Sin catálogo se analiza contra las 23 base; el servidor revisa todo al guardar.
      });
    return () => {
      vigente = false;
    };
  }, []);

  function analizar() {
    if (!texto.trim()) {
      setAviso("Escribe primero qué te gusta hacer.");
      return;
    }
    const { tematicas: encontradas, descartadas } = analizarIntereses(texto, catalogo);
    // Las partes con palabras inapropiadas (lib/tematicas/filtro.ts) se descartan completas; se
    // avisa sin repetir las palabras.
    const avisoDeDescartadas =
      descartadas === 0
        ? ""
        : descartadas === 1
          ? " Quitamos una parte de tu texto con palabras que no se permiten."
          : ` Quitamos ${descartadas} partes de tu texto con palabras que no se permiten.`;
    if (encontradas.length === 0) {
      setAviso(`No reconocimos temas en tu texto.${avisoDeDescartadas} Prueba con otras palabras o elige de la lista en "Agregar temáticas".`);
      return;
    }
    const yaEstaban = new Set(seleccionados.map(claveDeTematica));
    const nuevas = encontradas.filter((tema) => !yaEstaban.has(claveDeTematica(tema)));
    if (nuevas.length === 0) {
      setAviso(`Esas temáticas ya estaban en tu lista.${avisoDeDescartadas}`);
      return;
    }
    const caben = nuevas.slice(0, Math.max(0, MAXIMO_DE_INTERESES - seleccionados.length));
    if (caben.length === 0) {
      setAviso(`Ya tienes ${MAXIMO_DE_INTERESES} intereses: quita alguno para agregar otros.`);
      return;
    }
    onCambiar([...seleccionados, ...caben]);

    const avisoDeTope = caben.length < nuevas.length ? ` Las demás no caben: el máximo es ${MAXIMO_DE_INTERESES}.` : "";
    setAviso(`Agregamos ${enLista(caben)}.${avisoDeTope}${avisoDeDescartadas}`);
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
        onKeyDown={(e) => {
          // Enter analiza; Mayús+Enter hace un salto de línea. Mientras se compone un carácter
          // (teclados con acentos o en otros idiomas) Enter no cuenta.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            analizar();
          }
        }}
        maxLength={LARGO_MAXIMO_DEL_TEXTO}
        rows={3}
        disabled={deshabilitado}
        placeholder="Por ejemplo: me gusta andar en bici, cuidar a los perritos de la calle y la fotografía."
        className="disabled:cursor-default disabled:bg-system-100"
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11.5px] text-system-500">Presiona Enter para sacar tus temáticas del texto.</p>
        <Button type="button" variant="secondary" size="sm" onClick={analizar} disabled={deshabilitado}>
          Analizar
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
            onCambiar(temas);
            setAviso(null);
          }}
          quitables
          deshabilitado={deshabilitado}
        />
      </div>
    </div>
  );
}
