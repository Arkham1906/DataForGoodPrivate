// /api/progreso/racha — calendario de la racha de la persona con sesión (RF-GAM-85, 86): lo pide
// components/gamificacion/CalendarioDeRacha al abrir la ventana y al cambiar de mes. Solo lectura.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { esMesValido, obtenerCalendarioDeRacha } from "@/lib/gamificacion/mi-progreso";

// GET ?mes=YYYY-MM — sin mes, el mes en curso. Un mes fuera de la vida de la cuenta devuelve el más cercano.
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const mes = new URL(request.url).searchParams.get("mes") ?? undefined;
    if (mes !== undefined && !esMesValido(mes)) {
      return NextResponse.json({ error: "mes debe tener el formato YYYY-MM" }, { status: 400 });
    }

    const calendario = await obtenerCalendarioDeRacha(user.id, mes);
    if (!calendario) return NextResponse.json({ error: "No se pudo cargar el calendario" }, { status: 500 });
    return NextResponse.json(calendario);
  } catch (error) {
    console.error("Error leyendo el calendario de la racha", error);
    return NextResponse.json({ error: "No se pudo cargar el calendario" }, { status: 500 });
  }
}
