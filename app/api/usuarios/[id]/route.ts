// /api/usuarios/[id] — perfil de un usuario.
// GET sobre la cuenta propia (o cualquiera, con sesión raíz); PATCH y DELETE (baja) solo sobre la propia.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { destroySession, getSessionUser } from "@/lib/session";
import { hasRootSession } from "@/lib/rootSession";
import { errorDeLargo } from "@/lib/usuarios/perfil";
import { resolverIntereses } from "@/lib/tematicas/catalogo";
import { etiquetasDelUsuario, guardarEtiquetasDelUsuario, recortarEtiquetasDelUsuario, validarEtiquetasNuevas } from "@/lib/etiquetas/catalogo";
import { MAXIMO_DE_ETIQUETAS_EN_PERFIL, type EtiquetaNueva } from "@/lib/etiquetas/reglas";
import { resolverEspecialidad } from "@/lib/usuarios/especialidades";
import { resolverOrganizacion } from "@/lib/usuarios/organizaciones";
import { LARGO_MAXIMO_DEL_TEXTO } from "@/lib/tematicas/analizar";
import { comprobarContrasenaActual } from "@/lib/usuarios/contrasena-actual";
import { solicitarBaja } from "@/lib/usuarios/baja";
import { esDestinoDeAportes, PALABRA_DE_CONFIRMACION } from "@/lib/usuarios/baja-opciones";

// GET: tu propio perfil (401 sin sesión, 403 si el id no es el tuyo); el SuperUsuario, cualquier perfil.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const rawId = id;

    if (!rawId || Number.isNaN(Number(rawId))) {
      return NextResponse.json(
        { error: "El id del usuario es obligatorio" },
        { status: 400 }
      );
    }

    // Un usuario solo ve su propia cuenta, igual que en el PATCH: antes respondía
    // sin sesión y dejaba sacar el correo y la ubicación de cualquier id. El
    // SuperUsuario (cookie de /root o token Bearer) puede ver cualquiera.
    if (!(await hasRootSession())) {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
      }
      if (Number(sessionUser.id) !== Number(rawId)) {
        return NextResponse.json({ error: "Solo puedes ver tu propia cuenta" }, { status: 403 });
      }
    }

    const result = await pool.query(
      `SELECT
        id,
        nombre,
        apellidos,
        email,
        state,
        city,
        specialty,
        organizacion,
        intereses,
        intereses_texto,
        role,
        xp_total,
        level,
        streak_days,
        created_at,
        updated_at
       FROM usuarios
       WHERE id = $1
       LIMIT 1`,
      [Number(rawId)]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result.rows[0] }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo obtener el usuario" },
      { status: 500 }
    );
  }
}

// PATCH: actualiza el perfil. Solo la propia cuenta.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const rawId = id;

    if (!rawId || Number.isNaN(Number(rawId))) {
      return NextResponse.json(
        { error: "El id del usuario es obligatorio" },
        { status: 400 }
      );
    }

    // Este endpoint solo edita el perfil propio: sin esto, cualquiera podía
    // mandar un PATCH a /api/usuarios/<otro-id> y sobrescribir sus datos.
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }
    if (Number(sessionUser.id) !== Number(rawId)) {
      return NextResponse.json(
        { error: "Solo puedes editar tu propia cuenta" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : null;
    const apellidos = typeof body.apellidos === "string" ? body.apellidos.trim() : null;
    if (body.nombre !== undefined && !nombre) {
      return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
    }
    if (body.apellidos !== undefined && !apellidos) {
      return NextResponse.json({ error: "Los apellidos no pueden estar vacíos" }, { status: 400 });
    }

    // A diferencia de nombre/apellidos/intereses (que se conservan si el
    // caller no manda la llave), state/city/specialty sí se pueden vaciar a
    // propósito: el formulario de cuenta ya no preselecciona un valor por
    // defecto, así que un "" explícito significa "lo dejé sin elegir", no
    // "no toques este campo".
    const state = body.state !== undefined ? String(body.state).trim() || null : undefined;
    const city = body.city !== undefined ? String(body.city).trim() || null : undefined;
    let specialty = body.specialty !== undefined ? String(body.specialty).trim() || null : undefined;
    const errorLargo = errorDeLargo({ nombre, apellidos, state, city, specialty });
    if (errorLargo) return NextResponse.json({ error: errorLargo }, { status: 400 });
    // Especialidad del catálogo (lib/usuarios/especialidades.ts, 2026-10-26): una nueva se da de
    // alta y se ofrece a todos. La que ya tenía guardada no se vuelve a validar (pudo escribirse
    // antes de estas reglas).
    if (specialty && specialty !== sessionUser.specialty) {
      const resuelta = await resolverEspecialidad(specialty, sessionUser.id);
      if (!resuelta.ok) return NextResponse.json({ error: resuelta.error }, { status: 400 });
      specialty = resuelta.especialidad;
    }
    // Organización a la que pertenece (lib/usuarios/organizaciones.ts, 2026-10-26): opcional, una;
    // "" la borra; una nueva entra al catálogo. Igual que la especialidad, la guardada no se revalida.
    let organizacion = body.organizacion !== undefined ? String(body.organizacion ?? "").trim() || null : undefined;
    if (organizacion && organizacion !== sessionUser.organizacion) {
      const resuelta = await resolverOrganizacion(organizacion, sessionUser.id);
      if (!resuelta.ok) return NextResponse.json({ error: resuelta.error }, { status: 400 });
      organizacion = resuelta.valor;
    }

    // Texto libre de gustos (de ahí salen los intereses, lib/tematicas/analizar.ts). "" lo borra.
    const interesesTexto =
      body.interesesTexto !== undefined ? String(body.interesesTexto ?? "").trim() || null : undefined;
    if (interesesTexto && interesesTexto.length > LARGO_MAXIMO_DEL_TEXTO) {
      return NextResponse.json(
        { error: `El texto de intereses no puede pasar de ${LARGO_MAXIMO_DEL_TEXTO} caracteres` },
        { status: 400 }
      );
    }
    // Intereses del catálogo de temáticas (lib/tematicas/catalogo.ts): desde el 2026-10-20 solo
    // las que existen (400 si no). Una oculta o pendiente solo se conserva si ya la tenía.
    let intereses: string | null = null;
    if (Array.isArray(body.intereses)) {
      const resueltos = await resolverIntereses(body.intereses, sessionUser.intereses ?? []);
      if (!resueltos.ok) return NextResponse.json({ error: resueltos.error }, { status: 400 });
      intereses = JSON.stringify(resueltos.intereses);
    }
    // Subtemáticas (etiquetas, 2026-10-27): ids, de las temáticas que queden en sus intereses.
    if ("etiquetas" in body && (!Array.isArray(body.etiquetas) || body.etiquetas.length > MAXIMO_DE_ETIQUETAS_EN_PERFIL)) {
      return NextResponse.json({ error: `Puedes marcar hasta ${MAXIMO_DE_ETIQUETAS_EN_PERFIL} subtemáticas` }, { status: 400 });
    }
    // Etiquetas que la persona propone porque no las encontró (2026-10-28): [{ tematica, nombre }], quedan
    // pendientes hasta que el SuperUsuario las revisa. Se validan antes de guardar nada.
    let etiquetasNuevas: EtiquetaNueva[] = [];
    if ("etiquetasNuevas" in body) {
      const validadas = await validarEtiquetasNuevas(body.etiquetasNuevas);
      if (!validadas.ok) return NextResponse.json({ error: validadas.error }, { status: 400 });
      etiquetasNuevas = validadas.nuevas;
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET nombre = COALESCE($2, nombre),
           apellidos = COALESCE($3, apellidos),
           state = CASE WHEN $4::boolean THEN $5 ELSE state END,
           city = CASE WHEN $6::boolean THEN $7 ELSE city END,
           specialty = CASE WHEN $8::boolean THEN $9 ELSE specialty END,
           intereses = COALESCE($10::jsonb, intereses),
           intereses_texto = CASE WHEN $11::boolean THEN $12 ELSE intereses_texto END,
           organizacion = CASE WHEN $13::boolean THEN $14 ELSE organizacion END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, nombre, apellidos, email, state, city, specialty, organizacion, intereses, intereses_texto, role, xp_total, level, streak_days`,
      [
        Number(rawId),
        nombre,
        apellidos,
        state !== undefined,
        state ?? null,
        city !== undefined,
        city ?? null,
        specialty !== undefined,
        specialty ?? null,
        intereses,
        interesesTexto !== undefined,
        interesesTexto ?? null,
        organizacion !== undefined,
        organizacion ?? null,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Sus campañas guardan una copia del nombre (creator_name, la de POST /api/campanas) que se
    // muestra como quien organiza si no puso organización (2026-10-22): se mantiene al día.
    if (nombre !== null || apellidos !== null) {
      const fila = result.rows[0];
      await pool.query(`UPDATE campanas SET creator_name = $2 WHERE creator_id = $1 AND creator_name IS DISTINCT FROM $2`, [
        Number(rawId),
        `${fila.nombre} ${fila.apellidos}`.trim(),
      ]);
    }

    const interesesFinales: string[] = Array.isArray(result.rows[0].intereses) ? result.rows[0].intereses : [];
    if ("etiquetas" in body || etiquetasNuevas.length > 0) {
      const guardadas = await guardarEtiquetasDelUsuario(
        Number(rawId),
        "etiquetas" in body ? body.etiquetas : await etiquetasDelUsuario(Number(rawId)),
        interesesFinales,
        etiquetasNuevas,
      );
      if (!guardadas.ok) return NextResponse.json({ error: guardadas.error }, { status: 400 });
    } else if (intereses !== null) {
      await recortarEtiquetasDelUsuario(Number(rawId), interesesFinales);
    }

    return NextResponse.json({ data: { ...result.rows[0], etiquetas: await etiquetasDelUsuario(Number(rawId)) } }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo actualizar el usuario" },
      { status: 500 }
    );
  }
}

// DELETE: pide la baja de la propia cuenta (SCR-WEB-31). Body:
// { destino: "eliminar" | "anonimizar" | "autoria", confirmacion: "ELIMINAR", contrasena }.
// `contrasena` solo se exige si la cuenta tiene una (las de Google no); un error cuenta
// para el bloqueo del login. La cuenta entra en un plazo de gracia (MINUTOS_DE_GRACIA, 3 min desde el 2026-10-19): se cierran
// todas sus sesiones y volver a iniciar sesión cancela la baja (lib/usuarios/baja.ts).
export async function DELETE(
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
      return NextResponse.json({ error: "Solo puedes eliminar tu propia cuenta" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (!esDestinoDeAportes(body.destino)) {
      return NextResponse.json({ error: "Elige qué hacer con tus aportes" }, { status: 400 });
    }
    if (body.confirmacion !== PALABRA_DE_CONFIRMACION) {
      return NextResponse.json(
        { error: `Escribe ${PALABRA_DE_CONFIRMACION} para confirmar` },
        { status: 400 }
      );
    }

    const conContrasena = await pool.query<{ tiene: boolean }>(
      `SELECT password_hash IS NOT NULL AS tiene FROM usuarios WHERE id = $1`,
      [Number(id)]
    );
    if (conContrasena.rows[0]?.tiene) {
      const contrasena = typeof body.contrasena === "string" ? body.contrasena : "";
      if (!contrasena) {
        return NextResponse.json({ error: "Confirma con tu contraseña" }, { status: 400 });
      }
      const comprobacion = await comprobarContrasenaActual(Number(id), contrasena);
      if (!comprobacion.ok) {
        const error = comprobacion.status === 400 ? "La contraseña no es correcta" : comprobacion.error;
        return NextResponse.json({ error }, { status: comprobacion.status });
      }
    }

    const baja = await solicitarBaja(Number(id), body.destino);
    await destroySession();

    return NextResponse.json({
      message: "Baja registrada",
      data: {
        efectivaEn: baja.efectivaEn.toISOString(),
        campanasFinalizadas: baja.campanasFinalizadas,
        campanasBorradas: baja.campanasBorradas,
      },
    });
  } catch (error) {
    console.error("DELETE /api/usuarios/[id]:", error);
    return NextResponse.json({ error: "No se pudo registrar la baja" }, { status: 500 });
  }
}
