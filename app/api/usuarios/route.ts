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
import { resolverEspecialidad } from "@/lib/usuarios/especialidades";
import { resolverOrganizacion } from "@/lib/usuarios/organizaciones";

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

    // Especialidad (2026-10-26): validada; con el nombre del catálogo si existe. Una nueva no entra
    // al catálogo hasta que la cuenta guarde su perfil (resolverEspecialidad con darDeAlta: false).
    const resuelta = await resolverEspecialidad(specialty, null, { darDeAlta: false });
    if (!resuelta.ok) return NextResponse.json({ error: resuelta.error }, { status: 400 });
    const especialidad = resuelta.especialidad;
    // Organización (2026-10-26): igual que la especialidad. En la pantalla se pregunta en /bienvenida.
    const organizacionResuelta = await resolverOrganizacion(String(body.organizacion ?? ""), null, { darDeAlta: false });
    if (!organizacionResuelta.ok) return NextResponse.json({ error: organizacionResuelta.error }, { status: 400 });

    // En el registro aún no hay cuenta: solo se aceptan temáticas que ya existen (no se crean).
    const resueltos = await resolverIntereses(Array.isArray(body.intereses) ? body.intereses : [], [], { descartarDesconocidas: true });
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
      `INSERT INTO usuarios (nombre, apellidos, email, password_hash, state, city, specialty, intereses, xp_total, level, streak_days, role, organizacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 0, 1, 0, $9::jsonb, $10)
       RETURNING id, nombre, apellidos, email, state, city, specialty, organizacion, intereses, role, xp_total, level, streak_days, email_verificado`,
      [nombre, apellidos, email, passwordHash, state, city, especialidad, JSON.stringify(intereses), JSON.stringify(roles), organizacionResuelta.valor]
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

/** Candidatos a revisor por página (2026-10-19: la lista completa, de a poco). */
const CANDIDATOS_POR_PAGINA = 30;

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
 * - Usuario con `?campanaId=…&q=…&pagina=…`: lista de "agregar revisor". Solo la usa
 *   el creador de esa campaña. Desde el 2026-10-19 (a pedido del usuario) sin `q`
 *   devuelve a todos los usuarios verificados, de 30 en 30, y `q` filtra por
 *   nombre y apellidos desde la primera letra, sin importar acentos. Por correo
 *   solo con el correo completo y exacto, y el correo siempre va oculto
 *   (an***@gmail.com): así no se pueden adivinar correos letra por letra.
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

    const pagina = Number(url.searchParams.get("pagina") ?? "1");
    if (!Number.isInteger(pagina) || pagina < 1) {
      return NextResponse.json({ error: "pagina debe ser un entero positivo" }, { status: 400 });
    }
    // Con "@" solo cuenta el correo completo: mientras no lo sea, no hay resultados.
    const porCorreo = q.includes("@");
    if (porCorreo && !isValidEmail(q)) {
      return NextResponse.json({ data: [], total: 0, pagina, hayMas: false });
    }

    // Por correo: coincidencia exacta. Por nombre: contiene el texto, sin importar
    // acentos (con % y _ escapados para que se busquen literalmente). Sin texto: todos.
    const patron = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const sinAcentos = (sql: string) => `translate(LOWER(${sql}), 'áéíóúüñ', 'aeiouun')`;
    // $1 = quien busca, $2 = desde qué fila, $3 = el texto (solo si hay).
    const filtro = porCorreo
      ? "AND LOWER(email) = LOWER($3)"
      : q
        ? `AND ${sinAcentos("nombre || ' ' || apellidos")} LIKE ${sinAcentos("$3")}`
        : "";
    const valores: unknown[] = [user.id, (pagina - 1) * CANDIDATOS_POR_PAGINA];
    if (porCorreo || q) valores.push(porCorreo ? q : patron);
    const result = await pool.query<{
      id: number;
      nombre: string;
      apellidos: string;
      email: string;
      role: string[];
      total: string;
    }>(
      `SELECT id, nombre, apellidos, email, role, COUNT(*) OVER () AS total
       FROM usuarios
       WHERE email_verificado
         AND baja_solicitada_en IS NULL
         AND id <> $1
         ${filtro}
       ORDER BY LOWER(nombre), LOWER(apellidos), id
       LIMIT ${CANDIDATOS_POR_PAGINA} OFFSET $2`,
      valores
    );
    const total = Number(result.rows[0]?.total ?? 0);

    return NextResponse.json({
      total,
      pagina,
      hayMas: pagina * CANDIDATOS_POR_PAGINA < total,
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
