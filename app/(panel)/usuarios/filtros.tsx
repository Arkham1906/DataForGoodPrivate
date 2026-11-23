"use client";

// Filtros del directorio /usuarios: los escribe en la URL (searchParams). Desde el 2026-11-22 también por
// organización (?organizacion=, a pedido del usuario): las que tienen al menos una cuenta, con cuántas, y "Sin
// organización" (lib/usuarios/directorio.ts, organizacionesDelDirectorio y SIN_ORGANIZACION).

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

/** El mismo valor que SIN_ORGANIZACION de lib/usuarios/directorio.ts (ese módulo usa pg: no se importa aquí). */
const SIN_ORGANIZACION = "__ninguna";

// "Sin rol de creador" y "Sin rol de aportador" (2026-11-22): quienes perdieron ese permiso del usuario común
// (lib/usuarios/directorio.ts, FILTRO_SIN_PERMISO). "Creador de campaña" y "Aportador" no van: los tiene casi todos.
const ROLES = [
  { valor: "usuario", etiqueta: "Usuario común" },
  { valor: "supervisor", etiqueta: "Supervisor" },
  { valor: "revisor", etiqueta: "Revisor de aportes" },
  { valor: "sin_creador", etiqueta: "Sin rol de creador" },
  { valor: "sin_aportador", etiqueta: "Sin rol de aportador" },
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
  organizacion,
  organizaciones,
}: {
  q: string;
  rol: string;
  estado: string;
  organizacion: string;
  /** Opciones del filtro, con cuántas cuentas tiene cada una. */
  organizaciones: { opciones: { nombre: string; total: number }[]; sinOrganizacion: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, iniciar] = useTransition();
  const idBusqueda = useId();
  const idRol = useId();
  const idEstado = useId();
  const idOrganizacion = useId();

  const [texto, setTexto] = useState(q);
  // El servidor compara sin mayúsculas: el select marca la opción aunque la URL la escriba distinto ("cicese").
  const organizacionElegida =
    organizaciones.opciones.find((o) => o.nombre.toLowerCase() === organizacion.toLowerCase())?.nombre ?? organizacion;

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

      <div className="max-w-full">
        <label className="sr-only" htmlFor={idOrganizacion}>
          Filtrar por organización
        </label>
        <select
          id={idOrganizacion}
          value={organizacionElegida}
          onChange={(e) => aplicar("organizacion", e.target.value)}
          className={`${CLASE_SELECT} max-w-full sm:max-w-[260px]`}
        >
          <option value="">Organización: todas</option>
          {organizaciones.sinOrganizacion > 0 && (
            <option value={SIN_ORGANIZACION}>Sin organización ({organizaciones.sinOrganizacion})</option>
          )}
          {organizaciones.opciones.map((o) => (
            <option key={o.nombre} value={o.nombre}>
              {o.nombre} ({o.total})
            </option>
          ))}
          {/* La de la URL, aunque ya no tenga cuentas, para que el select no la pierda. */}
          {organizacion && organizacion !== SIN_ORGANIZACION &&
            !organizaciones.opciones.some((o) => o.nombre.toLowerCase() === organizacion.toLowerCase()) && (
              <option value={organizacion}>{organizacion} (0)</option>
            )}
        </select>
      </div>
    </div>
  );
}
