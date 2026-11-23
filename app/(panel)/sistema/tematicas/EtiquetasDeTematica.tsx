"use client";

// Etiquetas (subtemáticas, 2026-10-27) de una temática en /sistema/tematicas: lista desplegable con
// las del catálogo y las que propusieron los creadores (arriba, "Por revisar": Aprobar/Rechazar),
// Ocultar/Mostrar, "Más" → Editar/Borrar (components/sistema/catalogo) y "Nueva etiqueta".
// Server actions en lib/etiquetas/acciones-etiquetas.ts, que revalidan la página.
// Ocultar, mostrar, aprobar y rechazar piden confirmación desde el 2026-11-22 (components/sistema/useConfirmacion).

import { useState, useTransition, type FormEvent } from "react";

import Button from "@/components/sistema/Button";
import { Input } from "@/components/sistema/Input";
import Tag from "@/components/sistema/Tag";
import EditarOBorrarDelCatalogo from "@/components/sistema/catalogo/EditarOBorrarDelCatalogo";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import {
  borrarEtiquetaDelPanel,
  cambiarVisibilidadDeEtiqueta,
  crearEtiquetaDelPanel,
  editarEtiqueta,
  revisarEtiqueta,
} from "@/lib/etiquetas/acciones-etiquetas";
import type { EtiquetaDelPanel } from "@/lib/etiquetas/catalogo";
import { LARGO_DEL_NOMBRE } from "@/lib/tematicas/analizar";

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function EtiquetasDeTematica({
  tematicaId,
  tematica,
  etiquetas,
}: {
  tematicaId: number;
  tematica: string;
  etiquetas: EtiquetaDelPanel[];
}) {
  const [nombre, setNombre] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const porRevisar = etiquetas.filter((e) => !e.aprobada).length;

  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();

  function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const escrito = nombre.trim().replace(/\s+/g, " ");
    if (!escrito) return;
    iniciar(async () => {
      const resultado = await crearEtiquetaDelPanel(tematicaId, escrito);
      if (resultado.ok) {
        setNombre("");
        setAviso({ tipo: "ok", texto: `Se creó «${escrito}».` });
      } else {
        setAviso({ tipo: "error", texto: resultado.error });
      }
    });
  }

  return (
    <details className="group w-full rounded border border-system-200 bg-system-50" open={porRevisar > 0}>
      <summary className="cursor-pointer select-none px-3 py-2 text-[12.5px] font-semibold text-system-600">
        Etiquetas · {etiquetas.length}
        {porRevisar > 0 ? <span className="ml-1 text-warning-800">({porRevisar} por revisar)</span> : null}
      </summary>
      <div className="border-t border-system-200 px-3 py-3">
        {etiquetas.length === 0 ? (
          <p className="mb-3 text-[12.5px] text-system-500">{tematica} todavía no tiene etiquetas.</p>
        ) : (
          <ul className="mb-3 divide-y divide-system-200">
            {etiquetas.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className={`break-words text-[13px] font-semibold ${e.oculta ? "text-system-500 line-through" : "text-system-900"}`}>
                    #{e.nombre}
                  </p>
                  <p className="text-[11.5px] text-system-500">
                    {e.origen === "panel" ? "Creada aquí" : "Propuesta por un usuario (en su campaña o su perfil)"} · {cuantos(e.campanas, "campaña", "campañas")} ·{" "}
                    {cuantos(e.personas, "persona", "personas")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {e.aprobada ? (
                    <>
                      {e.oculta ? <Tag tone="warn">Oculta</Tag> : null}
                      <Button
                        size="sm"
                        variant={e.oculta ? "secondary" : "danger"}
                        disabled={pendiente || ocupado}
                        onClick={() =>
                          pedirConfirmacion(
                            e.oculta
                              ? {
                                  pregunta: `¿Seguro que quieres volver a mostrar #${e.nombre}?`,
                                  detalle: <p>Se vuelve a ofrecer al crear campañas de {tematica}.</p>,
                                  textoConfirmar: "Sí, mostrar",
                                  // El segundo argumento es `oculta`.
                                  accion: () => cambiarVisibilidadDeEtiqueta(e.id, false),
                                }
                              : {
                                  pregunta: `¿Seguro que quieres ocultar #${e.nombre}?`,
                                  detalle: (
                                    <p>
                                      Deja de ofrecerse al crear campañas de {tematica}. Las campañas y los perfiles que ya la tienen la
                                      conservan. Puedes volver a mostrarla cuando quieras.
                                    </p>
                                  ),
                                  textoConfirmar: "Sí, ocultar",
                                  peligro: true,
                                  accion: () => cambiarVisibilidadDeEtiqueta(e.id, true),
                                },
                          )
                        }
                      >
                        {e.oculta ? "Mostrar" : "Ocultar"}
                        <span className="sr-only"> {e.nombre}</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Tag tone="on">Por revisar</Tag>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={pendiente || ocupado}
                        onClick={() =>
                          pedirConfirmacion({
                            pregunta: `¿Seguro que quieres rechazar #${e.nombre}?`,
                            detalle: <p>Se borra y sale de la campaña que la propuso. No se puede deshacer.</p>,
                            textoConfirmar: "Sí, rechazar",
                            peligro: true,
                            accion: () => revisarEtiqueta(e.id, false),
                          })
                        }
                      >
                        Rechazar<span className="sr-only"> {e.nombre}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={pendiente || ocupado}
                        onClick={() =>
                          pedirConfirmacion({
                            pregunta: `¿Seguro que quieres aprobar #${e.nombre}?`,
                            detalle: <p>Pasa al catálogo de {tematica}: se ofrece a todos y se ve en la campaña que la propuso.</p>,
                            textoConfirmar: "Sí, aprobar",
                            accion: () => revisarEtiqueta(e.id, true),
                          })
                        }
                      >
                        Aprobar<span className="sr-only"> {e.nombre}</span>
                      </Button>
                    </>
                  )}
                  <EditarOBorrarDelCatalogo
                    id={e.id}
                    nombre={e.nombre}
                    personas={e.personas}
                    campanas={e.campanas}
                    sustantivo="etiqueta"
                    sinElDato="sin esa etiqueta"
                    maximo={LARGO_DEL_NOMBRE.maximo}
                    editar={editarEtiqueta}
                    borrar={borrarEtiquetaDelPanel}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={crear} className="flex flex-wrap items-center gap-2">
          <Input
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setAviso(null);
            }}
            maxLength={LARGO_DEL_NOMBRE.maximo}
            placeholder="Nueva etiqueta, ej. Perros"
            aria-label={`Nueva etiqueta de ${tematica}`}
            disabled={pendiente}
            className="max-w-xs"
          />
          <Button type="submit" size="sm" variant="primary" disabled={pendiente || nombre.trim().length === 0}>
            {pendiente ? "Guardando…" : "Crear etiqueta"}
          </Button>
        </form>
        {aviso ? (
          <p role={aviso.tipo === "error" ? "alert" : "status"} className={`mt-2 text-[12.5px] ${aviso.tipo === "error" ? "text-error-700" : "text-success-700"}`}>
            {aviso.texto}
          </p>
        ) : null}
      </div>
      {ventana}
    </details>
  );
}
