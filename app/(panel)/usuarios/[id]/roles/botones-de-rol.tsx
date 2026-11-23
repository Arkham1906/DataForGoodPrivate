"use client";

// Botones de /usuarios/[id]/roles. Llaman a las server actions asignarRol y revocarRol
// (lib/usuarios/acciones-usuarios.ts), que verifican la sesión raíz y registran en audit_log.
// BotonDePermiso (2026-11-22): quita o devuelve creador de campaña y aportador.
// Desde el 2026-11-22 (a pedido del usuario) todos piden confirmación con "¿Seguro que quieres…?" y lo que pasa
// (components/sistema/useConfirmacion); antes, solo revocar y quitar, con un "Confirmar" sin explicación.

import Button from "@/components/sistema/Button";
import Tag from "@/components/sistema/Tag";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import { asignarRol, revocarRol } from "@/lib/usuarios/acciones-usuarios";
import { AL_QUITAR, NOMBRE_DE_ROL, type PermisoDeUsuario, type RolAsignable } from "@/lib/usuarios/rol-asignable";

/** Qué pasa al dar cada rol (lo que no es un permiso del usuario común). */
const AL_ASIGNAR: Partial<Record<RolAsignable, string>> = {
  SUPERVISOR:
    "Podrá tomar campañas en revisión, aceptarlas o rechazarlas, moderar reportes y sancionar. Le llega un aviso.",
};

const AL_REVOCAR: Partial<Record<RolAsignable, string>> = {
  SUPERVISOR:
    "Deja de supervisar: las campañas que tomó sin dictaminar quedan libres, y sus campañas activas siguen corriendo y pasan a la tutela del supervisor del área.",
  REVISOR_DE_APORTES: "Sale de todas las campañas donde revisa aportes. Los aportes que ya decidió no cambian.",
};

export function BotonAsignar({
  usuarioId,
  usuario,
  rol,
  asignado,
}: {
  usuarioId: string;
  usuario: string;
  rol: RolAsignable;
  asignado: boolean;
}) {
  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();

  if (asignado) return <Tag tone="ok">Asignado</Tag>;

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        disabled={ocupado}
        onClick={() =>
          pedirConfirmacion({
            pregunta: `¿Seguro que quieres hacer ${NOMBRE_DE_ROL[rol].toLowerCase()} a ${usuario}?`,
            detalle: <p>{AL_ASIGNAR[rol] ?? "Le llega un aviso."} Puedes revocarlo después desde esta pantalla.</p>,
            textoConfirmar: "Sí, asignar",
            textoOcupado: "Asignando…",
            accion: () => asignarRol(usuarioId, rol),
          })
        }
      >
        Asignar
        <span className="sr-only"> el rol de {NOMBRE_DE_ROL[rol]}</span>
      </Button>
      {ventana}
    </div>
  );
}

export function BotonRevocar({
  usuarioId,
  usuario,
  rol,
}: {
  usuarioId: string;
  usuario: string;
  rol: RolAsignable;
}) {
  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        className="mt-3.5 w-full"
        disabled={ocupado}
        onClick={() =>
          pedirConfirmacion({
            pregunta: `¿Seguro que quieres revocar el rol de ${NOMBRE_DE_ROL[rol].toLowerCase()} a ${usuario}?`,
            detalle: <p>{AL_REVOCAR[rol] ?? ""} Le llega un aviso.</p>,
            textoConfirmar: "Sí, revocar",
            textoOcupado: "Revocando…",
            peligro: true,
            accion: () => revocarRol(usuarioId, rol),
          })
        }
      >
        Revocar rol de {NOMBRE_DE_ROL[rol]}
      </Button>
      {ventana}
    </>
  );
}

/** Quitar o devolver un permiso del usuario común; los dos piden confirmar y dicen qué pasa. */
export function BotonDePermiso({
  usuarioId,
  usuario,
  permiso,
  tiene,
}: {
  usuarioId: string;
  usuario: string;
  permiso: PermisoDeUsuario;
  tiene: boolean;
}) {
  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();
  const nombre = NOMBRE_DE_ROL[permiso];

  return (
    <div className="shrink-0">
      {!tiene ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={ocupado}
          onClick={() =>
            pedirConfirmacion({
              pregunta: `¿Seguro que quieres devolverle el rol de ${nombre.toLowerCase()} a ${usuario}?`,
              detalle: (
                <p>
                  {permiso === "CREADOR_DE_CAMPANAS"
                    ? "Podrá volver a crear campañas y enviarlas a revisión."
                    : "Podrá volver a inscribirse a campañas y enviar aportes."}{" "}
                  Le llega un aviso.
                </p>
              ),
              textoConfirmar: "Sí, devolver",
              textoOcupado: "Devolviendo…",
              accion: () => asignarRol(usuarioId, permiso),
            })
          }
        >
          Devolver
          <span className="sr-only"> el rol de {nombre}</span>
        </Button>
      ) : (
        <Button
          variant="danger"
          size="sm"
          disabled={ocupado}
          onClick={() =>
            pedirConfirmacion({
              pregunta: `¿Seguro que quieres quitarle el rol de ${nombre.toLowerCase()} a ${usuario}?`,
              detalle: (
                <>
                  <p>{AL_QUITAR[permiso]}</p>
                  <p>Le llega un aviso. Puedes devolvérselo cuando quieras.</p>
                </>
              ),
              textoConfirmar: "Sí, quitar",
              textoOcupado: "Quitando…",
              peligro: true,
              accion: () => revocarRol(usuarioId, permiso),
            })
          }
        >
          Quitar<span className="sr-only"> el rol de {nombre}</span>
        </Button>
      )}
      {ventana}
    </div>
  );
}
