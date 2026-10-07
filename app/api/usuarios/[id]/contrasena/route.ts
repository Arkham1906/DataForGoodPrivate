// /api/usuarios/[id]/contrasena — contraseña de la cuenta propia desde /cuenta.
// PATCH cambia la que ya existe con la actual; POST la pone con el código del correo
// (POST /api/usuarios/[id]/contrasena/codigo): la crea en una cuenta de Google o la cambia
// cuando no se recuerda la actual.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { comprobarContrasenaActual } from "@/lib/usuarios/contrasena-actual";
import { cumpleReglasDeContrasena } from "@/lib/reglas-contrasena";
import { registrarAuditoria } from "@/lib/auditoria";
import { CODIGO_INVALIDO, ponerContrasenaConCodigo } from "@/lib/usuarios/recuperacion";

// POST: { codigo, nueva }. Una cuenta de Google crea su contraseña (y desde entonces entra de
// las dos formas); una con contraseña la cambia sin la actual. Las sesiones abiertas se conservan.
// Responde { creoContrasena } para que la pantalla diga cuál de las dos pasó.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }
    if (Number(sessionUser.id) !== Number(id)) {
      return NextResponse.json(
        { error: "Solo puedes cambiar la contraseña de tu propia cuenta" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const codigo = String(body.codigo ?? "").trim();
    const nueva = typeof body.nueva === "string" ? body.nueva : "";
    if (!codigo || !nueva) {
      return NextResponse.json({ error: "El código y la contraseña son obligatorios" }, { status: 400 });
    }
    if (!/^\d{6}$/.test(codigo)) {
      return NextResponse.json({ error: CODIGO_INVALIDO }, { status: 400 });
    }
    if (!cumpleReglasDeContrasena(nueva)) {
      return NextResponse.json({ error: "La contraseña no cumple los requisitos" }, { status: 400 });
    }

    const resultado = await ponerContrasenaConCodigo(Number(id), codigo, nueva);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: 400 });
    }

    return NextResponse.json({ data: { ok: true, creoContrasena: resultado.creoContrasena } });
  } catch (error) {
    console.error("POST /api/usuarios/[id]/contrasena:", error);
    return NextResponse.json({ error: "No se pudo guardar la contraseña" }, { status: 500 });
  }
}

// PATCH: { actual, nueva }. Revisa la contraseña actual y guarda la nueva.
// Una contraseña actual equivocada cuenta como intento fallido de inicio de sesión
// (mismo contador y mismo bloqueo de 15 minutos), para que una sesión robada no sirva
// para adivinarla. Las sesiones abiertas, incluida la actual, se conservan.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }
    if (Number(sessionUser.id) !== Number(id)) {
      return NextResponse.json(
        { error: "Solo puedes cambiar la contraseña de tu propia cuenta" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const actual = typeof body.actual === "string" ? body.actual : "";
    const nueva = typeof body.nueva === "string" ? body.nueva : "";
    if (!actual || !nueva) {
      return NextResponse.json(
        { error: "La contraseña actual y la nueva son obligatorias" },
        { status: 400 }
      );
    }
    if (!cumpleReglasDeContrasena(nueva)) {
      return NextResponse.json(
        { error: "La nueva contraseña no cumple los requisitos" },
        { status: 400 }
      );
    }
    if (nueva === actual) {
      return NextResponse.json(
        { error: "La nueva contraseña debe ser distinta de la actual" },
        { status: 400 }
      );
    }

    const comprobacion = await comprobarContrasenaActual(Number(id), actual);
    if (!comprobacion.ok) {
      return NextResponse.json({ error: comprobacion.error }, { status: comprobacion.status });
    }

    const nuevoHash = await hashPassword(nueva);
    await pool.query(
      `UPDATE usuarios
       SET password_hash = $2, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $1`,
      [Number(id), nuevoHash]
    );

    await registrarAuditoria({
      actor: { tipo: "usuario", id: Number(id) },
      accion: "usuario.contrasena_cambiar",
      objetivo: { tipo: "usuario", id: Number(id) },
    });

    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/usuarios/[id]/contrasena:", error);
    return NextResponse.json(
      { error: "No se pudo cambiar la contraseña" },
      { status: 500 }
    );
  }
}
