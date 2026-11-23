"use client";

// "Cerrar sesión" del SuperUsuario, en la barra del panel (components/sistema/Topbar), 2026-11-22, a pedido del
// usuario: antes no había forma de salir y la sesión raíz solo vencía a las 2 horas. Llama a DELETE /api/auth/root
// (borra la sesión y la cookie) y vuelve a /root. Sin ventana de confirmación: salir no cambia nada de la plataforma.
// Si la llamada falla, avisa y no se mueve de la pantalla (la sesión podría seguir abierta).

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BASE_PATH } from "@/lib/base-path";

export default function BotonCerrarSesionRoot() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState(false);

  async function salir() {
    setSaliendo(true);
    setError(false);
    try {
      const respuesta = await fetch(`${BASE_PATH}/api/auth/root`, { method: "DELETE" });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      router.replace("/root");
      router.refresh();
    } catch {
      setError(true);
      setSaliendo(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-[12px] text-error-700">
          No se pudo cerrar la sesión.
        </span>
      )}
      <button
        type="button"
        onClick={() => void salir()}
        disabled={saliendo}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-pill border border-system-300 bg-white px-3 text-[12.5px] font-semibold text-system-900 transition-colors hover:border-error-700 hover:text-error-700 disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0">
          <path
            d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10.5 11 13.5 8l-3-3M13.5 8H6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {saliendo ? "Saliendo…" : "Cerrar sesión"}
      </button>
    </span>
  );
}
