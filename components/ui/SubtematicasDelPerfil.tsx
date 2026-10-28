"use client";

// Subtemáticas (etiquetas, 2026-10-27) de los intereses de la persona, en /bienvenida y /cuenta.
// Por cada temática elegida que tiene etiquetas en el catálogo (GET /api/etiquetas), las muestra
// como botones que se marcan. Sirven para los avisos de campañas nuevas: con subtemáticas marcadas
// en una temática, no avisan de las campañas que solo tengan otras etiquetas (las que no tienen
// etiquetas sí avisan). Se guardan con el perfil
// (PATCH /api/usuarios/[id], `etiquetas`: ids); el servidor quita las de temáticas que ya no tiene.

import { useEffect, useState } from "react";

import { BASE_PATH } from "@/lib/base-path";
import { MAXIMO_DE_ETIQUETAS_EN_PERFIL, type CatalogoDeEtiquetas } from "@/lib/etiquetas/reglas";

export default function SubtematicasDelPerfil({
  intereses,
  seleccionadas,
  onCambiar,
}: {
  /** Temáticas elegidas (nombres). */
  intereses: string[];
  /** Ids de las etiquetas marcadas. */
  seleccionadas: number[];
  onCambiar: (ids: number[]) => void;
}) {
  const [catalogo, setCatalogo] = useState<CatalogoDeEtiquetas | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(`${BASE_PATH}/api/etiquetas`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (vigente) setCatalogo(body?.data && typeof body.data === "object" ? (body.data as CatalogoDeEtiquetas) : {});
      })
      .catch(() => vigente && setCatalogo({}));
    return () => {
      vigente = false;
    };
  }, []);

  if (!catalogo) return null;
  const conEtiquetas = intereses.filter((tema) => (catalogo[tema] ?? []).length > 0);
  // Solo cuentan las de temáticas que sigue teniendo: al quitar una temática, sus etiquetas se van.
  const visibles = new Set(conEtiquetas.flatMap((tema) => catalogo[tema].map((e) => e.id)));
  const marcadas = seleccionadas.filter((id) => visibles.has(id));
  const lleno = marcadas.length >= MAXIMO_DE_ETIQUETAS_EN_PERFIL;

  if (conEtiquetas.length === 0) return null;

  function alternar(id: number) {
    onCambiar(marcadas.includes(id) ? marcadas.filter((x) => x !== id) : lleno ? marcadas : [...marcadas, id]);
  }

  return (
    <div className="mt-4 border-t border-system-200 pt-4">
      <p className="text-[13px] font-semibold text-system-900">
        Subtemáticas <span className="font-normal text-system-500">(opcional)</span>
      </p>
      <p className="mb-3 mt-0.5 text-[12px] text-system-500">
        Afina tus avisos: si marcas alguna de una temática, no te avisamos de las campañas de esa temática que solo tengan otras etiquetas (las que no tienen etiquetas sí te llegan). Hasta{" "}
        {MAXIMO_DE_ETIQUETAS_EN_PERFIL}.
      </p>
      <div className="flex flex-col gap-3">
        {conEtiquetas.map((tema) => (
          <div key={tema} role="group" aria-label={`Subtemáticas de ${tema}`}>
            <p className="mb-1.5 text-[12px] font-semibold text-system-600">{tema}</p>
            <div className="flex flex-wrap gap-1.5">
              {catalogo[tema].map((e) => {
                const activa = marcadas.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={activa}
                    disabled={!activa && lleno}
                    onClick={() => alternar(e.id)}
                    className={`rounded-pill border px-3 py-1 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      activa ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
                    }`}
                  >
                    #{e.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
