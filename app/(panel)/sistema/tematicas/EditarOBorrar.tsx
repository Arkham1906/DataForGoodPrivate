"use client";

// "Más ▾" con "Editar" y "Borrar" de una temática que no es base en /sistema/tematicas (2026-10-26).
// Editar abre una ventana con el nombre (editarTematica: también lo cambia en perfiles y campañas);
// Borrar pide confirmación (borrarTematicaDelPanel: no borra si alguna campaña la usa). Las dos
// server actions están en lib/tematicas/acciones-tematicas.ts y revalidan la página.
// La ventana solo se monta abierta: VentanaDeConfirmacion usa un id fijo y hay un menú por renglón.

import { useState, useTransition } from "react";

import { Input } from "@/components/sistema/Input";
import MenuDeAcciones from "@/components/ui/MenuDeAcciones";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { borrarTematicaDelPanel, editarTematica } from "@/lib/tematicas/acciones-tematicas";
import { LARGO_DEL_NOMBRE } from "@/lib/tematicas/analizar";

export default function EditarOBorrar({
  id,
  nombre,
  personas,
  campanas,
}: {
  id: number;
  nombre: string;
  personas: number;
  campanas: number;
}) {
  const [ventana, setVentana] = useState<"editar" | "borrar" | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState(nombre);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function abrir(cual: "editar" | "borrar") {
    setNuevoNombre(nombre);
    setError(null);
    setVentana(cual);
  }

  function confirmar() {
    iniciar(async () => {
      const resultado = ventana === "editar" ? await editarTematica(id, nuevoNombre) : await borrarTematicaDelPanel(id);
      if (resultado.ok) setVentana(null);
      else setError(resultado.error);
    });
  }

  const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  return (
    <>
      <MenuDeAcciones
        etiqueta={`Más acciones de ${nombre}`}
        opciones={[
          { etiqueta: "Editar", alElegir: () => abrir("editar") },
          { etiqueta: "Borrar", alElegir: () => abrir("borrar"), peligro: true },
        ]}
      />

      {ventana === "editar" ? (
        <VentanaDeConfirmacion
          abierto
          titulo="Editar temática"
          textoConfirmar="Guardar"
          textoOcupado="Guardando…"
          ocupado={pendiente}
          confirmarDeshabilitado={nuevoNombre.trim().length === 0}
          onCancelar={() => setVentana(null)}
          onConfirmar={confirmar}
        >
          <label htmlFor={`editar-tematica-${id}`} className="mb-2 block text-[13px] font-semibold text-system-900">
            Nombre
          </label>
          <Input
            id={`editar-tematica-${id}`}
            value={nuevoNombre}
            onChange={(e) => {
              setNuevoNombre(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nuevoNombre.trim()) {
                e.preventDefault();
                confirmar();
              }
            }}
            maxLength={LARGO_DEL_NOMBRE.maximo}
            disabled={pendiente}
          />
          <p className="mt-2">
            {personas + campanas > 0
              ? `También cambia en ${cuantos(personas, "perfil", "perfiles")} y ${cuantos(campanas, "campaña", "campañas")} que la tienen.`
              : "Ningún perfil ni campaña la tiene todavía."}
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-[12.5px] text-error-700">
              {error}
            </p>
          ) : null}
        </VentanaDeConfirmacion>
      ) : null}

      {ventana === "borrar" ? (
        <VentanaDeConfirmacion
          abierto
          titulo={`¿Borrar «${nombre}»?`}
          textoConfirmar="Borrar"
          textoOcupado="Borrando…"
          ocupado={pendiente}
          peligro
          confirmarDeshabilitado={campanas > 0}
          onCancelar={() => setVentana(null)}
          onConfirmar={confirmar}
        >
          {campanas > 0 ? (
            <p>
              No se puede borrar: la {campanas === 1 ? "usa 1 campaña" : `usan ${campanas} campañas`}. Ocúltala para que ya
              no se ofrezca.
            </p>
          ) : (
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>Se quita del catálogo y no se puede deshacer; su nombre queda en la bitácora.</li>
              <li>
                {personas > 0
                  ? `Se quita de ${cuantos(personas, "perfil", "perfiles")} que la tienen entre sus intereses.`
                  : "Ningún perfil la tiene."}
              </li>
            </ul>
          )}
          {error ? (
            <p role="alert" className="mt-2 text-[12.5px] text-error-700">
              {error}
            </p>
          ) : null}
        </VentanaDeConfirmacion>
      ) : null}
    </>
  );
}
