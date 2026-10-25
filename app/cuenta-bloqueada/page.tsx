// Pantalla /cuenta-bloqueada: lo único que ve una cuenta suspendida o baneada.
// Llega aquí por exigirUsuario() (lib/session.ts). Datos: obtenerBloqueoDeLaSesion().
// Si la cuenta no está bloqueada, redirige a /campanas (o a /entrar sin sesión).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CuentaBloqueada from "@/components/layout/CuentaBloqueada";
import { getSessionUser, obtenerBloqueoDeLaSesion } from "@/lib/session";

export const metadata: Metadata = { title: "Cuenta bloqueada" };
export const dynamic = "force-dynamic";

/**
 * A donde exigirUsuario() manda una cuenta suspendida o baneada. Solo
 * explica el motivo: la API y las acciones ya la rechazan (getSessionUser).
 */
export default async function CuentaBloqueadaPage() {
  const bloqueada = await obtenerBloqueoDeLaSesion();
  if (!bloqueada) {
    // Ya se levantó el bloqueo (o nunca lo hubo): de vuelta a la app.
    redirect((await getSessionUser()) ? "/inicio" : "/entrar");
  }
  return <CuentaBloqueada nombre={bloqueada.nombre} bloqueo={bloqueada.bloqueo} historial={bloqueada.historial} />;
}
