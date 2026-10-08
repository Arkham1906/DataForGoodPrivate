"use client";

// Buscador de /usuarios/supervisores; escribe la búsqueda en la URL (?q=).

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

export default function BuscadorDeSupervisores({ q }: { q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, iniciar] = useTransition();
  const [texto, setTexto] = useState(q);
  const id = useId();

  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (texto) params.set("q", texto);
      else params.delete("q");
      const qs = params.toString();
      iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <div className="w-[200px]">
      <label className="sr-only" htmlFor={id}>
        Buscar supervisor
      </label>
      <input
        id={id}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar supervisor"
        className="w-full rounded border border-system-300 bg-white px-3.5 py-2 text-sm text-system-900 outline-none transition-colors focus:border-brand-600"
      />
    </div>
  );
}
