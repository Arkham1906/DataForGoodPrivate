import { NextResponse } from "next/server";
import { createRootSession, destroyRootSession, hasRootSession } from "@/lib/rootSession";
import { registrarAuditoria } from "@/lib/auditoria";
import { verificarCredencialRoot } from "@/lib/root-acceso";

/**
 * POST /api/auth/root — valida la credencial de SuperUsuario y abre su
 * sesión con la cookie `root_session_token` (la usa /root). Los accesos,
 * exitosos o fallidos, quedan en audit_log.
 */
export async function POST(request: Request) {
  const error = await verificarCredencialRoot(request);
  if (error) return error;

  await createRootSession();
  await registrarAuditoria({ actor: { tipo: "superusuario" }, accion: "root.acceso" });

  return new NextResponse(null, { status: 204 });
}

/**
 * DELETE /api/auth/root — cierra la sesión del SuperUsuario (2026-11-22, a pedido del usuario: antes no había forma
 * y la sesión solo vencía a las 2 horas). Borra su fila de root_sessions y la cookie, y lo registra en audit_log como
 * `root.salida`. Lo llama el botón "Cerrar sesión" de la barra del panel (components/sistema/BotonCerrarSesionRoot).
 * Sin sesión vigente también responde 204: el resultado es el mismo, no hay sesión.
 */
export async function DELETE() {
  const habiaSesion = await hasRootSession();
  await destroyRootSession();
  if (habiaSesion) await registrarAuditoria({ actor: { tipo: "superusuario" }, accion: "root.salida" });
  return new NextResponse(null, { status: 204 });
}
