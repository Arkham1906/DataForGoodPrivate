// /api/ubicacion — zona donde está la persona según el GPS del navegador (2026-10-31; lib/ubicacion/).
// Solo con sesión. Lo llama components/layout/DetectorDeUbicacion cuando la persona dio permiso.
//  - GET: la última zona detectada ({ zona: { estado, municipio, detectadaEn } | null }).
//  - POST { latitud, longitud }: busca el municipio, guarda solo estado y municipio (nunca las
//    coordenadas) y, si cambió de zona, le avisa (una vez al día por zona). Fuera de México: zona null.
//  - DELETE: deja de usar su ubicación (borra la zona guardada).

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { zonaPorCoordenadas } from "@/lib/ubicacion/zona-por-coordenadas";
import { olvidarZona, registrarZona, zonaDetectadaDe } from "@/lib/ubicacion/zona-detectada";

const SIN_SESION = { error: "Debes iniciar sesion" };

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json(SIN_SESION, { status: 401 });
    return NextResponse.json({ zona: await zonaDetectadaDe(Number(user.id)) });
  } catch (error) {
    console.error("Error leyendo la zona detectada", error);
    return NextResponse.json({ error: "No se pudo leer tu ubicación" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json(SIN_SESION, { status: 401 });

    const body = await request.json().catch(() => null);
    const latitud = Number(body?.latitud);
    const longitud = Number(body?.longitud);
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
      return NextResponse.json({ error: "latitud y longitud deben ser números válidos" }, { status: 400 });
    }

    const zona = zonaPorCoordenadas(latitud, longitud);
    if (!zona) return NextResponse.json({ zona: null, cambio: false, avisado: false });
    const resultado = await registrarZona(Number(user.id), zona);
    return NextResponse.json({ zona, ...resultado });
  } catch (error) {
    console.error("Error registrando la zona detectada", error);
    return NextResponse.json({ error: "No se pudo registrar tu ubicación" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json(SIN_SESION, { status: 401 });
    await olvidarZona(Number(user.id));
    return NextResponse.json({ message: "Ya no usamos tu ubicación" });
  } catch (error) {
    console.error("Error olvidando la zona detectada", error);
    return NextResponse.json({ error: "No se pudo quitar tu ubicación" }, { status: 500 });
  }
}
