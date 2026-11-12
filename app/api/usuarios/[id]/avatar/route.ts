// /api/usuarios/[id]/avatar — ícono del perfil de la cuenta propia (2026-10-13), desde /cuenta.
// Las iniciales, un ícono predefinido (masculino, femenino, otro) o una foto propia. Lógica en
// lib/usuarios/avatar.ts; opciones y límites en lib/usuarios/avatar-opciones.ts.

import { NextResponse } from "next/server";
import { apareceEnLaClasificacion } from "@/lib/gamificacion/clasificacion";
import { getSessionUser } from "@/lib/session";
import { cambiarAvatar, leerFotoDePerfil } from "@/lib/usuarios/avatar";
import { ELECCIONES_DE_AVATAR, errorDeFotoDePerfil, type EleccionDeAvatar } from "@/lib/usuarios/avatar-opciones";

async function cuentaPropia(id: string) {
  const usuario = await getSessionUser();
  if (!usuario) return { error: NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 }) };
  if (Number(usuario.id) !== Number(id)) {
    return { error: NextResponse.json({ error: "Solo puedes cambiar el ícono de tu propia cuenta" }, { status: 403 }) };
  }
  return { usuario };
}

// GET: la foto de perfil (JPEG de 256 px). La de la cuenta propia y, desde el 2026-11-12 (a pedido del
// usuario), la de quien sale en la tabla de líderes (apareceEnLaClasificacion), también sin sesión: la
// muestran el podio y la lista de la landing y de /progreso/leaderboard. De cualquier otra cuenta, 404,
// igual que si no tuviera foto (no dice si existe). 404 también si eligió las iniciales o un ícono.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const sinFoto = () => NextResponse.json({ error: "Esta cuenta no tiene foto de perfil" }, { status: 404 });
  try {
    const { id } = await context.params;
    const usuarioId = Number(id);
    const usuario = await getSessionUser();
    const propia = Boolean(usuario) && Number(usuario?.id) === usuarioId;
    if (!propia && !(await apareceEnLaClasificacion(usuarioId))) return sinFoto();

    const foto = await leerFotoDePerfil(usuarioId);
    if (!foto) return sinFoto();

    return new NextResponse(new Uint8Array(foto), {
      headers: {
        "Content-Type": "image/jpeg",
        // La URL lleva ?v=<versión>, que cambia con cada foto nueva: la propia se guarda en caché. La de
        // otra persona solo una hora (y nunca en un caché compartido): si la sancionan, deja de verse pronto.
        "Cache-Control": propia ? "private, max-age=31536000, immutable" : "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error leyendo la foto de perfil", error);
    return NextResponse.json({ error: "No se pudo leer la foto de perfil" }, { status: 500 });
  }
}

// PUT (multipart/form-data): avatar = iniciales | masculino | femenino | otro | foto; con "foto", file
// (JPG o PNG de hasta 5 MB). La foto se recorta a 256 px y se guarda sin metadatos; elegir otra
// opción borra la foto anterior. Responde { data: { usuarioId, nombre, avatar, version } }.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { error } = await cuentaPropia(id);
    if (error) return error;

    const formData = await request.formData();
    const eleccion = String(formData.get("avatar") ?? "");
    if (!ELECCIONES_DE_AVATAR.has(eleccion)) {
      return NextResponse.json({ error: "Opción de ícono no válida" }, { status: 400 });
    }
    const archivo = formData.get("file");
    if (eleccion === "foto") {
      const problema = errorDeFotoDePerfil(archivo);
      if (problema) return NextResponse.json({ error: problema }, { status: 400 });
    }

    const resultado = await cambiarAvatar(
      Number(id),
      eleccion as EleccionDeAvatar,
      eleccion === "foto" && archivo instanceof File ? archivo : null,
    );
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 400 });

    return NextResponse.json({ message: "Ícono actualizado", data: resultado.datos });
  } catch (error) {
    console.error("Error cambiando el ícono del perfil", error);
    return NextResponse.json({ error: "No se pudo cambiar el ícono" }, { status: 500 });
  }
}
