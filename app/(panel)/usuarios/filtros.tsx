"use client";

// Filtros del directorio /usuarios: los escribe en la URL (searchParams).

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

const ROLES = [
  { valor: "usuario", etiqueta: "Usuario común" },
  { valor: "supervisor", etiqueta: "Supervisor" },
  { valor: "revisor", etiqueta: "Revisor de aportes" },
];
const ESTADOS = [
  { valor: "ACTIVA", etiqueta: "Activo" },
  { valor: "CON_STRIKES", etiqueta: "Con avisos" },
  { valor: "SUSPENDIDA", etiqueta: "Suspendida" },
  { valor: "BANEADA", etiqueta: "Baneada" },
];

const CLASE_SELECT =
  "rounded border border-system-300 bg-white px-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 min-h-[38px]";

/**
 * Los filtros viven en la URL: la vista filtrada se puede compartir, el botón
 * atrás funciona y el filtrado real lo hace el servidor.
 */
export default function Filtros({
  q,
  rol,
  estado,
}: {
  q: string;
  rol: string;
  estado: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, iniciar] = useTransition();
  const idBusqueda = useId();
  const idRol = useId();
  const idEstado = useId();

  const [texto, setTexto] = useState(q);

  // La búsqueda se aplica sola tras una pausa al teclear, sin botón aparte.
  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => aplicar("q", texto), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  function aplicar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    // Cualquier cambio de filtro vuelve a la primera página.
    params.delete("pagina");

    const qs = params.toString();
    iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5">
      <div className="min-w-[220px] flex-1">
        <label className="sr-only" htmlFor={idBusqueda}>
          Buscar usuarios
        </label>
        <input
          id={idBusqueda}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por correo, nombre o ID"
          className="w-full rounded border border-system-300 bg-white px-3.5 py-2 text-sm text-system-900 outline-none transition-colors focus:border-brand-600"
        />
      </div>

      <div>
        <label className="sr-only" htmlFor={idRol}>
          Filtrar por rol
        </label>
        <select
          id={idRol}
          value={rol}
          onChange={(e) => aplicar("rol", e.target.value)}
          className={CLASE_SELECT}
        >
          <option value="">Rol: todos</option>
          {ROLES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="sr-only" htmlFor={idEstado}>
          Filtrar por estado
        </label>
        <select
          id={idEstado}
          value={estado}
          onChange={(e) => aplicar("estado", e.target.value)}
          className={CLASE_SELECT}
        >
          <option value="">Estado: todos</option>
          {ESTADOS.map((e2) => (
            <option key={e2.valor} value={e2.valor}>
              {e2.etiqueta}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
