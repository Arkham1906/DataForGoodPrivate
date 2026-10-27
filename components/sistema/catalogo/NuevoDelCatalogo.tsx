"use client";

// Formulario "Nueva …" de un catálogo del perfil en el panel (2026-10-26; /sistema/especialidades y
// /sistema/organizaciones). Recibe la server action que crea (`crear`), que valida y revalida la página.

import { useId, useState, useTransition, type FormEvent } from "react";

import Button from "@/components/sistema/Button";
import { Input } from "@/components/sistema/Input";
import type { ResultadoDeAccion } from "@/lib/catalogos/acciones-de-catalogo";

export default function NuevoDelCatalogo({
  titulo,
  placeholder,
  ayuda,
  maximo,
  crear,
}: {
  /** "Nueva especialidad". */
  titulo: string;
  placeholder: string;
  ayuda: string;
  maximo: number;
  crear: (nombre: string) => Promise<ResultadoDeAccion>;
}) {
  const id = useId();
  const [nombre, setNombre] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const escrito = nombre.trim();
    if (!escrito) return;
    iniciar(async () => {
      const resultado = await crear(escrito);
      if (resultado.ok) {
        setNombre("");
        setAviso({ tipo: "ok", texto: `Se creó «${escrito.replace(/\s+/g, " ")}».` });
      } else {
        setAviso({ tipo: "error", texto: resultado.error });
      }
    });
  }

  return (
    <form onSubmit={enviar} className="mb-5 rounded-lg border border-system-200 bg-white p-4 shadow-sm">
      <label htmlFor={`${id}-campo`} className="mb-2 block text-[13px] font-bold text-system-900">
        {titulo}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`${id}-campo`}
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setAviso(null);
          }}
          maxLength={maximo}
          placeholder={placeholder}
          aria-describedby={`${id}-ayuda`}
          disabled={pendiente}
          className="max-w-xs"
        />
        <Button type="submit" size="sm" variant="primary" disabled={pendiente || nombre.trim().length === 0}>
          {pendiente ? "Creando…" : "Crear"}
        </Button>
      </div>
      <p id={`${id}-ayuda`} className="mt-2 text-[12px] text-system-500">
        {ayuda}
      </p>
      {aviso ? (
        <p role={aviso.tipo === "error" ? "alert" : "status"} className={`mt-2 text-[12.5px] ${aviso.tipo === "error" ? "text-error-700" : "text-success-700"}`}>
          {aviso.texto}
        </p>
      ) : null}
    </form>
  );
}
