// Pantalla /pendientes (2026-11-24, a pedido del usuario): todo lo que la persona tiene por hacer, cada pendiente por
// separado con su enlace, cuánto lleva esperando o cuándo vence y su urgencia, agrupado por sección (Supervisión,
// Revisión de aportes, Tus campañas, Aportar, Tus apelaciones, Tu perfil) y, aparte, una campaña que le puede interesar.
// Server Component. Acceso: sesión de usuario (exigirUsuario). Datos: pendientesDelUsuario() de
// lib/pendientes/del-usuario.ts, la misma fuente del recuadro azul del menú y del número junto a "Pendientes".
// Solo lectura; cada renglón lleva a la pantalla donde se resuelve. Se actualiza en vivo (ActualizacionEnVivo del
// marco hace router.refresh cuando algo cambia en la base).

import type { Metadata } from "next";

import ListaDePendientes from "@/components/pendientes/ListaDePendientes";
import { pendientesDelUsuario, type PendientesDelUsuario } from "@/lib/pendientes/del-usuario";
import { SECCIONES_DEL_USUARIO } from "@/lib/pendientes/tipos";
import { exigirUsuario } from "@/lib/session";

export const metadata: Metadata = { title: "Pendientes" };
export const dynamic = "force-dynamic";

export default async function PendientesPage() {
  const usuario = await exigirUsuario();
  let datos: PendientesDelUsuario | null = null;
  try {
    datos = await pendientesDelUsuario(usuario);
  } catch (error) {
    console.error("No se pudieron leer los pendientes", error);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Pendientes</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-system-600">
          Lo que tienes por hacer en DataForGood, de lo más urgente a lo menos. Cada renglón te lleva a donde se resuelve.
        </p>
      </div>
      {datos ? (
        <ListaDePendientes
          pendientes={datos.pendientes}
          secciones={SECCIONES_DEL_USUARIO}
          sugerencia={datos.sugerencia}
          sinPendientes="No tienes nada pendiente por ahora. Aquí aparecerá lo que necesite tu atención."
        />
      ) : (
        <p role="alert" className="rounded border border-error-700 bg-error-50 p-3 text-sm text-error-700">
          No se pudieron cargar tus pendientes. Recarga la página en un momento.
        </p>
      )}
    </div>
  );
}
