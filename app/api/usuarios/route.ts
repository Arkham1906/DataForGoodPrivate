// /api/usuarios — registro de cuentas, directorio completo (SuperUsuario) y buscador de revisores.
// El registro siempre crea la cuenta con el rol "usuario": los demás los asigna el
// SuperUsuario (Supervisor) o se ganan al aceptar una invitación (Revisor).

import { NextResponse } from "next/server";
import { MENSAJE_CORREO_BLOQUEADO, correoEnListaNegra } from "@/lib/usuarios/lista-negra";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { cumpleReglasDeContrasena } from "@/lib/reglas-contrasena";
import { isValidEmail } from "@/lib/validation";
import { startVerification } from "@/lib/verification";
import { getSessionUser } from "@/lib/session";
import { hasRootSession } from "@/lib/rootSession";
import { buscarUsuarios, POR_PAGINA } from "@/lib/usuarios/directorio";
import { errorDeLargo } from "@/lib/usuarios/perfil";
import { resolverIntereses } from "@/lib/tematicas/catalogo";

// POST: registro. Crea la cuenta sin verificar y envía el código por correo.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const nombre = String(body.nombre ?? body.alias ?? "").trim();
    const apellidos = String(body.apellidos ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const state = String(body.state ?? "").trim();
    const city = String(body.city ?? "").trim();
    const specialty = String(body.specialty ?? "").trim();
    // Nunca se leen roles del body: antes cualquiera podía registrarse como supervisor.
    const roles = ["usuario"];

    if (!nombre || !apellidos || !email || !password) {
      return NextResponse.json(
        { error: "nombre, apellidos, email y password son obligatorios" },
        { status: 400 }
      );
    }
    // Las mismas reglas que muestra /registro: antes el servidor solo pedía 6 caracteres
    // y una llamada directa a la API podía crear la cuenta con "123456".
    if (!cumpleReglasDeContrasena(password)) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial" },
        { status: 400 }
      );
    }
    const errorLargo = errorDeLargo({ nombre, apellidos, state, city, specialty });
    if (errorLargo || email.length > 255) {
      return NextResponse.json({ error: errorLargo ?? "El correo es demasiado largo" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "El correo no tiene un formato válido" },
        { status: 400 }
      );
    }

    // En el registro aún no hay cuenta: solo se aceptan temáticas que ya existen (no se crean).
    const resueltos = await resolverIntereses(Array.isArray(body.intereses) ? body.intereses : [], null);
    const intereses = resueltos.ok ? resueltos.intereses : [];

    // Correo de una cuenta baneada (lista negra, 2026-10-12): no puede volver a registrarse.
    if (await correoEnListaNegra(email)) {
      return NextResponse.json({ error: MENSAJE_CORREO_BLOQUEADO }, { status: 403 });
    }

    const emailExists = await pool.query(
      `SELECT 1 FROM usuarios WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (emailExists.rowCount && emailExists.rowCount > 0) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO usuarios (nombre, apellidos, email, password_hash, state, city, specialty, intereses, xp_total, level, streak_days, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 0, 1, 0, $9::jsonb)
       RETURNING id, nombre, apellidos, email, state, city, specialty, intereses, role, xp_total, level, streak_days, email_verificado`,
      [nombre, apellidos, email, passwordHash, state, city, specialty, JSON.stringify(intereses), JSON.stringify(roles)]
    );

    const usuario = result.rows[0];
    let emailEnviado = true;
    const response = NextResponse.json(
      { message: "Usuario creado", data: usuario, emailEnviado },
      { status: 201 }
    );

    try {
      const { expiresAt } = await startVerification(usuario.id, usuario.email, usuario.nombre, response);
      response.cookies.set("pending_verification_id", String(usuario.id), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: expiresAt,
      });
    } catch (verificationError) {
      console.error("No se pudo enviar el correo de verificación", verificationError);
      emailEnviado = false;
      response.cookies.delete("pending_verification_id");
    }

    return response;
  } catch (error) {
    console.error("POST /api/usuarios: ", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "No se pudo crear el usuario", detail: message },
      { status: 500 }
    );
  }
}

const MINIMO_BUSQUEDA = 3;
const MAXIMO_RESULTADOS = 10;

/** "ana.lopez@gmail.com" -> "an***@gmail.com": identifica sin exponer el correo. */
function ocultarCorreo(email: string): string {
  const [local, dominio] = email.split("@");
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}***@${dominio ?? ""}`;
}

const ESTADOS_DE_CUENTA = new Set<string>(["ACTIVA", "CON_STRIKES", "SUSPENDIDA", "BANEADA"]);

/**
 * GET /api/usuarios con sesión raíz (cookie de /root o token Bearer de
 * POST /api/auth/root/token) — directorio completo de usuarios del sistema,
 * el mismo de /usuarios: 20 por página, con filtros opcionales.
 */
async function listarTodos(url: URL) {
  const pagina = Number(url.searchParams.get("pagina") ?? "1");
  const estado = (url.searchParams.get("estado") ?? "").trim().toUpperCase();
  if (!Number.isInteger(pagina) || pagina < 1) {
    return NextResponse.json({ error: "pagina debe ser un entero positivo" }, { status: 400 });
  }
  if (estado && !ESTADOS_DE_CUENTA.has(estado)) {
    return NextResponse.json(
      { error: `estado debe ser uno de: ${Array.from(ESTADOS_DE_CUENTA).join(", ")}` },
      { status: 400 }
    );
  }

  const { filas, total } = await buscarUsuarios({
    q: url.searchParams.get("q") ?? "",
    rol: url.searchParams.get("rol") ?? "",
    estado,
    pagina,
  });
  return NextResponse.json({
    data: filas,
    pagina,
    porPagina: POR_PAGINA,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  });
}

/**
 * GET /api/usuarios
 * - SuperUsuario: lista todos los usuarios (ver `listarTodos`).
 * - Usuario con `?campanaId=…&q=…`: buscador de "agregar revisor". Solo lo usa
 *   el creador de esa campaña, con al menos 3 letras del nombre o un correo
 *   completo, y devuelve pocas coincidencias con el correo oculto: así no sirve
 *   para descargar la lista de usuarios.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (await hasRootSession()) {
      return await listarTodos(url);
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }

    const campanaId = Number(url.searchParams.get("campanaId"));
    const q = (url.searchParams.get("q") ?? "").trim();

    if (!Number.isInteger(campanaId) || campanaId <= 0) {
      return NextResponse.json({ error: "campanaId es obligatorio" }, { status: 400 });
    }
    const campana = await pool.query(`SELECT creator_id FROM campanas WHERE id = $1`, [campanaId]);
    if (campana.rowCount === 0) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    if (Number(campana.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo el creador de la campaña puede buscar revisores" }, { status: 403 });
    }

    const porCorreo = q.includes("@");
    if (porCorreo ? !isValidEmail(q) : q.length < MINIMO_BUSQUEDA) {
      return NextResponse.json({ data: [] });
    }

    // Por correo: coincidencia exacta. Por nombre: contiene el texto (con %
    // y _ escapados para que se busquen literalmente).
    const patron = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const result = await pool.query<{ id: number; nombre: string; apellidos: string; email: string; role: string[] }>(
      `SELECT id, nombre, apellidos, email, role
       FROM usuarios
       WHERE email_verificado
         AND baja_solicitada_en IS NULL
         AND id <> $1
         AND ${porCorreo ? "LOWER(email) = LOWER($2)" : "(nombre || ' ' || apellidos) ILIKE $2"}
       ORDER BY nombre, apellidos
       LIMIT ${MAXIMO_RESULTADOS}`,
      [user.id, porCorreo ? q : patron]
    );

    return NextResponse.json({
      data: result.rows.map((fila) => ({
        id: fila.id,
        nombre: fila.nombre,
        apellidos: fila.apellidos,
        emailOculto: ocultarCorreo(fila.email),
        role: fila.role,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "No se pudieron listar los usuarios" },
      { status: 500 }
    );
  }
}
