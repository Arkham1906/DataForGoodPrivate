"use client";

// "Más ▾" con "Editar" y "Borrar" de un elemento de un catálogo del perfil en el panel (2026-10-26;
// /sistema/especialidades y /sistema/organizaciones). Editar abre una ventana con el nombre; Borrar
// pide confirmación. Recibe las server actions (`editar`, `borrar`), que revalidan la página.
// La ventana solo se monta abierta: VentanaDeConfirmacion usa un id fijo y hay un menú por renglón.

import { useState, useTransition } from "react";

import { Input } from "@/components/sistema/Input";
import MenuDeAcciones from "@/components/ui/MenuDeAcciones";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import type { ResultadoDeAccion } from "@/lib/catalogos/acciones-de-catalogo";

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function EditarOBorrarDelCatalogo({
  id,
  nombre,
  personas,
  campanas,
  sustantivo,
  sinElDato,
  maximo,
  editar,
  borrar,
}: {
  id: number;
  nombre: string;
  personas: number;
  /** Campañas que lo usan; null si el catálogo no se usa en campañas. */
  campanas: number | null;
  /** "especialidad", "organización": para los títulos. */
  sustantivo: string;
  /** "sin especialidad": cómo quedan los perfiles al borrar. */
  sinElDato: string;
  maximo: number;
  editar: (id: number, nombre: string) => Promise<ResultadoDeAccion>;
  borrar: (id: number) => Promise<ResultadoDeAccion>;
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
      const resultado = ventana === "editar" ? await editar(id, nuevoNombre) : await borrar(id);
      if (resultado.ok) setVentana(null);
      else setError(resultado.error);
    });
  }

  const perfiles = cuantos(personas, "perfil", "perfiles");
  const enCampanas = campanas ? cuantos(campanas, "campaña", "campañas") : null;
  const alerta = error ? (
    <p role="alert" className="mt-2 text-[12.5px] text-error-700">
      {error}
    </p>
  ) : null;

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
          titulo={`Editar ${sustantivo}`}
          textoConfirmar="Guardar"
          textoOcupado="Guardando…"
          ocupado={pendiente}
          confirmarDeshabilitado={nuevoNombre.trim().length === 0}
          onCancelar={() => setVentana(null)}
          onConfirmar={confirmar}
        >
          <label htmlFor={`editar-catalogo-${id}`} className="mb-2 block text-[13px] font-semibold text-system-900">
            Nombre
          </label>
          <Input
            id={`editar-catalogo-${id}`}
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
            maxLength={maximo}
            disabled={pendiente}
          />
          <p className="mt-2">
            {personas > 0 || enCampanas
              ? `También cambia en ${[personas > 0 ? perfiles : null, enCampanas].filter(Boolean).join(" y ")} que la tienen.`
              : "Ningún perfil la tiene todavía."}
          </p>
          {alerta}
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
          onCancelar={() => setVentana(null)}
          onConfirmar={confirmar}
        >
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Deja de sugerirse y no se puede deshacer; su nombre queda en la bitácora.</li>
            <li>{personas > 0 ? `${perfiles} que la tienen quedan ${sinElDato}.` : "Ningún perfil la tiene."}</li>
            {enCampanas ? <li>Las {enCampanas} que la usan conservan su nombre.</li> : null}
          </ul>
          {alerta}
        </VentanaDeConfirmacion>
      ) : null}
    </>
  );
}
