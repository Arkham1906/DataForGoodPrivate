"use client";

// Botones de /usuarios/[id]/roles. Llaman a las server actions asignarRol y revocarRol
// (lib/usuarios/acciones-usuarios.ts), que verifican la sesión raíz y registran en audit_log.

import { useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import Tag from "@/components/sistema/Tag";
import { asignarRol, revocarRol } from "@/lib/usuarios/acciones-usuarios";
import { NOMBRE_DE_ROL, type RolAsignable } from "@/lib/usuarios/rol-asignable";

export function BotonAsignar({
  usuarioId,
  rol,
  asignado,
}: {
  usuarioId: string;
  rol: RolAsignable;
  asignado: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (asignado) return <Tag tone="ok">Asignado</Tag>;

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await asignarRol(usuarioId, rol);
            setError(r.ok ? null : r.error);
          })
        }
      >
        {pendiente ? "Asignando…" : "Asignar"}
        <span className="sr-only"> el rol de {NOMBRE_DE_ROL[rol]}</span>
      </Button>
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] text-error-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function BotonRevocar({
  usuarioId,
  rol,
}: {
  usuarioId: string;
  rol: RolAsignable;
}) {
  const [pendiente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button
        variant="danger"
        size="sm"
        className="mt-3.5 w-full"
        onClick={() => setConfirmando(true)}
      >
        Revocar rol de {NOMBRE_DE_ROL[rol]}
      </Button>
    );
  }

  return (
    <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2.5">
      <Button variant="secondary" size="sm" onClick={() => setConfirmando(false)}>
        Cancelar
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={pendiente}
        onClick={() => iniciar(() => revocarRol(usuarioId, rol).then(() => setConfirmando(false)))}
      >
        {pendiente ? "Revocando…" : "Confirmar revocación"}
      </Button>
    </div>
  );
}
