"use client";

// Pasos del formulario de campaña (/mis-campanas/nueva, 2026-10-21, a pedido del usuario: todo en
// una página, cada bloque en su tarjeta numerada).
//   - TarjetaDePaso: la tarjeta de un paso, con su número (✓ cuando está completo) y su título.
//   - GuiaDePasos: en escritorio (lg), la lista fija a la izquierda; marca ✓ los completos, resalta
//     el que está a la vista y lleva a cada uno. Debajo de lg solo dice cuántos van completos.
// Qué hace "completo" a cada paso lo decide NuevaCampanaForm.tsx.

import { useEffect, useState, type ReactNode } from "react";

export type Paso = { id: string; titulo: string; completo: boolean };

function NumeroDePaso({ numero, completo, activo }: { numero: number; completo: boolean; activo?: boolean }) {
  const clases = completo
    ? "border-success-700 bg-success-700 text-white"
    : activo
      ? "border-brand-600 bg-brand-600 text-white"
      : "border-system-300 bg-white text-system-600";
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12.5px] font-bold ${clases}`}
      aria-hidden
    >
      {completo ? "✓" : numero}
    </span>
  );
}

export function TarjetaDePaso({
  id,
  numero,
  titulo,
  descripcion,
  completo,
  aviso,
  children,
}: {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string;
  completo: boolean;
  /** Nota a la derecha del título, p. ej. que el paso no se puede cambiar. */
  aviso?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="mb-5 scroll-mt-24 rounded-lg border border-system-200 bg-white p-5 sm:p-6"
    >
      <div className="mb-5 flex items-start gap-3">
        <NumeroDePaso numero={numero} completo={completo} />
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-titulo`} className="text-[15px] font-bold text-system-900">
            {titulo}
            <span className="sr-only">{completo ? " (completo)" : " (pendiente)"}</span>
          </h2>
          <p className="mt-0.5 text-[12.5px] text-system-600">{descripcion}</p>
        </div>
        {aviso && <span className="shrink-0 text-[11.5px] font-medium text-system-500">{aviso}</span>}
      </div>
      {children}
    </section>
  );
}

export function GuiaDePasos({ pasos }: { pasos: Paso[] }) {
  const [activo, setActivo] = useState(pasos[0]?.id);
  const completos = pasos.filter((p) => p.completo).length;
  const ids = pasos.map((p) => p.id).join(",");

  // El paso a la vista es el que cruza la franja superior de la pantalla.
  useEffect(() => {
    const secciones = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((e) => e.isIntersecting);
        if (visible) setActivo(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    secciones.forEach((s) => observador.observe(s));
    return () => observador.disconnect();
  }, [ids]);

  function irA(id: string) {
    const seccion = document.getElementById(id);
    if (!seccion) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    seccion.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
    setActivo(id);
  }

  return (
    <>
      <p className="mb-4 text-[12.5px] text-system-600 lg:hidden">
        {completos} de {pasos.length} pasos completos
      </p>
      <nav aria-label="Pasos de la campaña" className="sticky top-24 hidden lg:block">
        <p className="mb-3 font-mono text-[11.5px] uppercase tracking-wide text-system-500">
          {completos} de {pasos.length} completos
        </p>
        <ol className="flex flex-col gap-1">
          {pasos.map((paso, i) => (
            <li key={paso.id}>
              <a
                href={`#${paso.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  irA(paso.id);
                }}
                aria-current={activo === paso.id ? "step" : undefined}
                className={`flex items-center gap-2.5 rounded px-2 py-2 text-[13px] transition-colors hover:bg-system-100 ${
                  activo === paso.id ? "bg-system-100 font-semibold text-system-900" : "text-system-600"
                }`}
              >
                <NumeroDePaso numero={i + 1} completo={paso.completo} activo={activo === paso.id} />
                <span>
                  {paso.titulo}
                  <span className="sr-only">{paso.completo ? " (completo)" : " (pendiente)"}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
