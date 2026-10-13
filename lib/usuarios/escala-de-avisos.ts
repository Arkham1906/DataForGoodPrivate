// Escala de avisos (2026-10-12, decisión del usuario). Cada reporte que el SuperUsuario confirma es un
// aviso; en la tabla `sanciones` se guarda como tipo STRIKE (los strikes de antes cuentan como avisos y
// no caducan). Según cuántos lleve la cuenta con el nuevo:
//   1.º → solo el mensaje "Tu cuenta lleva un reporte" con el motivo;
//   2.º → suspensión de 2 días;  3.º → suspensión de 7 días;
//   4.º o más → baneo y el correo a la lista negra (no puede volver a registrarse).
// Sin imports de servidor: lo usan aplicarSancion (lib/usuarios/acciones-usuarios.ts) y las pantallas.

/** Con este aviso la cuenta se banea y su correo entra a la lista negra. */
export const AVISOS_PARA_BANEO = 4;

export type ConsecuenciaDeAviso =
  | { tipo: "mensaje" }
  | { tipo: "suspension"; dias: number }
  | { tipo: "baneo" };

/** Qué pasa con el aviso número `n` (1, 2, 3...). */
export function consecuenciaDelAviso(n: number): ConsecuenciaDeAviso {
  if (n >= AVISOS_PARA_BANEO) return { tipo: "baneo" };
  if (n === 3) return { tipo: "suspension", dias: 7 };
  if (n === 2) return { tipo: "suspension", dias: 2 };
  return { tipo: "mensaje" };
}

/** "solo un mensaje", "suspensión de 2 días", "baneo y lista negra". */
export function describirConsecuencia(c: ConsecuenciaDeAviso): string {
  if (c.tipo === "baneo") return "baneo de la cuenta y su correo a la lista negra";
  if (c.tipo === "suspension") return `suspensión de ${c.dias} ${c.dias === 1 ? "día" : "días"}`;
  return "solo un mensaje con el motivo";
}
