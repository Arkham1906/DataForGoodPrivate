// PATCH /api/usuarios/[id]/preferencias — Preferencias de "Comunicación y notificaciones" de /cuenta
// (solo la cuenta propia). Body con una o varias de: avisosCampanasNuevas, avisosAportes,
// recordatorioSemanal, resumenMensual y notificaciones (el interruptor general, 2026-10-19) (booleanos). Lista y columnas en lib/usuarios/preferencias-opciones.ts.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { TODAS_LAS_PREFERENCIAS } from "@/lib/usuarios/preferencias-opciones";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    const { id } = await context.params;
    if (Number(id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo puedes cambiar tus propias preferencias" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const cambios = TODAS_LAS_PREFERENCIAS.filter((o) => body && o.clave in body);
    const desconocidas = Object.keys(body ?? {}).filter((k) => !TODAS_LAS_PREFERENCIAS.some((o) => o.clave === k));
    if (cambios.length === 0 || desconocidas.length > 0 || cambios.some((o) => typeof body[o.clave] !== "boolean")) {
      return NextResponse.json(
        { error: `Manda true o false en: ${TODAS_LAS_PREFERENCIAS.map((o) => o.clave).join(", ")}` },
        { status: 400 },
      );
    }

    // Las columnas salen de la lista fija, nunca del body.
    const asignaciones = cambios.map((o, i) => `${o.columna} = $${i + 2}`).join(", ");
    await pool.query(`UPDATE usuarios SET ${asignaciones}, updated_at = NOW() WHERE id = $1`, [
      user.id,
      ...cambios.map((o) => body[o.clave] as boolean),
    ]);
    return NextResponse.json({ data: Object.fromEntries(cambios.map((o) => [o.clave, body[o.clave]])) });
  } catch (error) {
    console.error("Error guardando las preferencias", error);
    return NextResponse.json({ error: "No se pudieron guardar las preferencias" }, { status: 500 });
  }
}
