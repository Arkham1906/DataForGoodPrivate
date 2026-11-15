// /api/progreso/historial-exp — una página del historial de EXP de quien tiene la sesión (SRS v1.3: RF-GAM-07). La
// pide components/gamificacion/HistorialDeExp al cambiar de filtro y con «Ver movimientos anteriores». Solo lectura;
// cada persona ve solo sus movimientos (RF-GAM-77).

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { obtenerPaginaDeMovimientos } from "@/lib/gamificacion/historial-exp";
import { FILTROS_DE_MOVIMIENTOS, type FiltroDeMovimientos } from "@/lib/gamificacion/historial-exp-tipos";

// GET ?filtro=aporte|mision|bono|descuento (sin filtro: todos) &cursor=<id del último movimiento mostrado>
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const parametros = new URL(request.url).searchParams;
    const pedido = parametros.get("filtro") ?? "todos";
    const filtro = (FILTROS_DE_MOVIMIENTOS as readonly string[]).includes(pedido) ? (pedido as FiltroDeMovimientos) : "todos";
    const cursor = parametros.get("cursor");
    return NextResponse.json(await obtenerPaginaDeMovimientos(user.id, filtro, cursor));
  } catch (error) {
    console.error("Error leyendo una página del historial de EXP", error);
    return NextResponse.json({ error: "No se pudo cargar el historial" }, { status: 500 });
  }
}
