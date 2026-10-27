"use client";

// Campo de texto con sugerencias de un catálogo (2026-10-26): un <input> con <datalist> que el
// navegador filtra mientras se escribe. Se elige una sugerencia o se escribe un valor propio. Lo usan
// ui/CampoDeEspecialidad (/bienvenida, /cuenta) y el campo de organización (/bienvenida, /cuenta y el
// formulario de campaña). Lee `url` (GET, { data: string[] }); si falla, sugiere `respaldo`.
// Marcado como control: Field le conecta la etiqueta y la pista.

import { useEffect, useId, useState, type InputHTMLAttributes } from "react";

import { marcarComoControl } from "@/components/ui/CampoEtiquetado";
import { Input } from "@/components/ui/Input";
import { BASE_PATH } from "@/lib/base-path";

export type PropsDeCampoConSugerencias = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "list"> & {
  value: string;
  onChange: (valor: string) => void;
};

type Props = PropsDeCampoConSugerencias & {
  /** Ruta de la API sin basePath, p. ej. "/api/organizaciones". */
  url: string;
  respaldo?: readonly string[];
};

const CampoConSugerencias = marcarComoControl(function CampoConSugerencias({ value, onChange, url, respaldo = [], ...rest }: Props) {
  const idLista = useId();
  const [opciones, setOpciones] = useState<readonly string[]>(respaldo);

  useEffect(() => {
    let vigente = true;
    fetch(`${BASE_PATH}${url}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: string[] } | null) => {
        if (vigente && Array.isArray(json?.data) && json.data.length > 0) setOpciones(json.data);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [url]);

  return (
    <>
      <Input {...rest} value={value} onChange={(e) => onChange(e.target.value)} list={idLista} autoComplete="off" />
      <datalist id={idLista}>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion} />
        ))}
      </datalist>
    </>
  );
});

export default CampoConSugerencias;
