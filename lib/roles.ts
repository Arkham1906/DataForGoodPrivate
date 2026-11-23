// Códigos de rol válidos (tabla usuario_roles desde el 2026-10-30, lib/usuarios/tabla-roles.ts): usuario,
// creador y aportador (desde el 2026-11-22: toda cuenta los tiene y el SuperUsuario los quita), supervisor,
// revisor, admin.
// Los nombres para mostrar están en lib/usuarios/rol-asignable.ts.

export const VALID_ROLES = new Set(["usuario", "creador", "aportador", "supervisor", "revisor", "admin"]);

export function normalizeRoles(input: unknown): string[] {
  const incoming = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  const roles = incoming
    .map((role) => String(role ?? "").trim().toLowerCase())
    .filter((role) => role.length > 0 && VALID_ROLES.has(role));

  return Array.from(new Set(["usuario", ...roles]));
}
