"use client";

// Checklists del formulario de aportar (/campanas/[id]/aportar y /c/[token]). Desde el 2026-10-28
// cada checklist es de un tipo de dato: solo se muestran los del tipo de lo que se manda
// (seccionesParaElAporte); si aún no se elige el archivo, se avisa que aparecerán al elegirlo.

import { etiquetaDeRespuesta, type SeccionDeChecklist } from "@/lib/campanas/checklist";

export default function ChecklistsDelAporte({
  visibles,
  faltaArchivo,
  marcadas,
  onAlternar,
}: {
  visibles: SeccionDeChecklist[];
  faltaArchivo: boolean;
  marcadas: string[];
  onAlternar: (valor: string) => void;
}) {
  return (
    <>
      {faltaArchivo && (
        <p className="mb-4 rounded-lg border border-dashed border-system-300 p-3 text-[12px] text-system-500">
          Elige tu archivo para ver qué puedes marcar sobre él.
        </p>
      )}
      {visibles.map((seccion, i) => (
        <fieldset key={`${seccion.tipo ?? ""}-${seccion.titulo || i}`} className="mb-4 rounded-lg border border-system-200 bg-white p-3.5">
          <legend className="px-1 text-[13px] font-medium text-system-900">{seccion.titulo || "Marca lo que aplique"}</legend>
          {seccion.opciones.map((opcion) => {
            // Se guarda como "Título: opción" para saber a qué checklist pertenece.
            const valor = etiquetaDeRespuesta(seccion.titulo, opcion);
            return (
              <label key={opcion} className="mb-2 flex items-center gap-2 text-[12.5px] text-system-600 last:mb-0">
                <input type="checkbox" checked={marcadas.includes(valor)} onChange={() => onAlternar(valor)} />
                {opcion}
              </label>
            );
          })}
        </fieldset>
      ))}
    </>
  );
}
