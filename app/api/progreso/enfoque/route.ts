// /api/progreso/enfoque — enfoque de la persona con sesión (RF-GAM-115, 116). Lo usan el último paso del registro,
// la ventana para cuentas sin enfoque y Mi cuenta. Contrato en lib/gamificacion/enfoque-tipos.ts.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { elegirEnfoque, obtenerEstadoDelEnfoque } from "@/lib/gamificacion/enfoque";

// GET — enfoque actual, desde cuándo se puede cambiar y las opciones que se pueden elegir.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    const estado = await obtenerEstadoDelEnfoque(user.id);
    if (!estado) return NextResponse.json({ error: "No se pudo cargar tu enfoque" }, { status: 404 });
    return NextResponse.json(estado);
  } catch (error) {
    console.error("Error leyendo el enfoque", error);
    return NextResponse.json({ error: "No se pudo cargar tu enfoque" }, { status: 500 });
  }
}

// PUT { enfoque: "<clave>" } — elige o cambia el enfoque. 409 con puedeCambiarDesde si aún no pasan los días de espera.
export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const clave = body?.enfoque;
    if (typeof clave !== "string" || clave.length === 0 || clave.length > 30 || Object.keys(body).length !== 1) {
      return NextResponse.json({ error: "Manda solo { enfoque: \"<clave>\" }" }, { status: 400 });
    }

    const resultado = await elegirEnfoque(user.id, clave);
    if (resultado.ok) return NextResponse.json({ cambio: resultado.cambio, ...resultado.estado });
    if (resultado.motivo === "en_espera") {
      return NextResponse.json(
        { error: "Todavía no puedes cambiar tu enfoque", puedeCambiarDesde: resultado.puedeCambiarDesde },
        { status: 409 },
      );
    }
    if (resultado.motivo === "no_disponible") {
      return NextResponse.json({ error: "Ese enfoque no existe o ya no se puede elegir" }, { status: 400 });
    }
    return NextResponse.json({ error: "No se encontró tu cuenta" }, { status: 404 });
  } catch (error) {
    console.error("Error guardando el enfoque", error);
    return NextResponse.json({ error: "No se pudo guardar tu enfoque" }, { status: 500 });
  }
}
