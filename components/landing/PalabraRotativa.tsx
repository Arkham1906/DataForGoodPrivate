"use client";

// Frase de la portada (landing, 2026-11-06): "DataForGood es para …", con la palabra final cambiando sola.
// Con movimiento reducido queda fija en la primera. El lector de pantalla oye la frase completa una vez.

import { useEffect, useState } from "react";

const CADA_CUANTO_MS = 2600;

export default function PalabraRotativa({ inicio, palabras }: { inicio: string; palabras: string[] }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const intervalo = window.setInterval(() => setIndice((i) => (i + 1) % palabras.length), CADA_CUANTO_MS);
    return () => window.clearInterval(intervalo);
  }, [palabras.length]);

  return (
    <>
      <span className="sr-only">
        {inicio} {palabras.join(", ")}.
      </span>
      <span aria-hidden="true">
        {inicio} <span key={indice} className="landing-entrada inline-block text-brand-600">{palabras[indice]}</span>
      </span>
    </>
  );
}
