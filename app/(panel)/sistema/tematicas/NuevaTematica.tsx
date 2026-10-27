"use client";

// "Nueva temática" en /sistema/tematicas (2026-10-26): el SuperUsuario escribe el nombre y la crea
// aprobada y visible. Llama a la server action crearTematicaDelPanel (lib/tematicas/acciones-tematicas.ts),
// que valida el nombre (validarNombreDeTematica) y revalida la página.

import { useState, useTransition, type FormEvent } from "react";

import Button from "@/components/sistema/Button";
import { Input } from "@/components/sistema/Input";
import { crearTematicaDelPanel } from "@/lib/tematicas/acciones-tematicas";
import { LARGO_DEL_NOMBRE } from "@/lib/tematicas/analizar";

export default function NuevaTematica() {
  const [nombre, setNombre] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const escrito = nombre.trim();
    if (!escrito) return;
    iniciar(async () => {
      const resultado = await crearTematicaDelPanel(escrito);
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
      <label htmlFor="nueva-tematica" className="mb-2 block text-[13px] font-bold text-system-900">
        Nueva temática
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="nueva-tematica"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setAviso(null);
          }}
          maxLength={LARGO_DEL_NOMBRE.maximo}
          placeholder="Ej. Agricultura urbana"
          aria-describedby="nueva-tematica-ayuda"
          disabled={pendiente}
          className="max-w-xs"
        />
        <Button type="submit" size="sm" variant="primary" disabled={pendiente || nombre.trim().length === 0}>
          {pendiente ? "Creando…" : "Crear"}
        </Button>
      </div>
      <p id="nueva-tematica-ayuda" className="mt-2 text-[12px] text-system-500">
        Se ofrece desde ya en los perfiles y al crear campañas. Solo letras, espacios, guiones y comas.
      </p>
      {aviso ? (
        <p role={aviso.tipo === "error" ? "alert" : "status"} className={`mt-2 text-[12.5px] ${aviso.tipo === "error" ? "text-error-700" : "text-success-700"}`}>
          {aviso.texto}
        </p>
      ) : null}
    </form>
  );
}
