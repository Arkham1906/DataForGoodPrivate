// Pantalla /sistema/pendientes del panel (2026-11-24, a pedido del usuario): lo que el SuperUsuario tiene por hacer,
// cada pendiente por separado con su enlace, su espera y su urgencia, por sección (Supervisión, Moderación, Aportes sin
// revisar, Temáticas y subtemáticas).
// Server Component. Acceso: sesión raíz (exigirSesionRoot, además del layout). Datos: pendientesDelPanel() de
// lib/pendientes/del-panel.ts, la misma fuente del recuadro azul del menú y del número junto a "Pendientes".
// Solo lectura; se actualiza en vivo (ActualizacionEnVivo del layout).

import type { Metadata } from "next";

import ListaDePendientes from "@/components/pendientes/ListaDePendientes";
import { Encabezado } from "@/components/sistema/ui";
import { pendientesDelPanel } from "@/lib/pendientes/del-panel";
import { SECCIONES_DEL_PANEL, type Pendiente } from "@/lib/pendientes/tipos";
import { exigirSesionRoot } from "@/lib/supervision/root";

export const metadata: Metadata = { title: "Pendientes" };
export const dynamic = "force-dynamic";

export default async function PendientesDelPanelPage() {
  await exigirSesionRoot();
  let pendientes: Pendiente[] | null = null;
  try {
    pendientes = await pendientesDelPanel();
  } catch (error) {
    console.error("No se pudieron leer los pendientes del panel", error);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado
        titulo="Pendientes"
        subtitulo="Lo que espera tu decisión, de lo más urgente a lo menos. Cada renglón te lleva a donde se resuelve."
      />
      {pendientes ? (
        <ListaDePendientes
          pendientes={pendientes}
          secciones={SECCIONES_DEL_PANEL}
          sinPendientes="No hay campañas, reportes, apelaciones ni propuestas esperando tu decisión."
        />
      ) : (
        <p role="alert" className="rounded border border-error-700 bg-error-50 p-3 text-sm text-error-700">
          No se pudieron cargar los pendientes. Recarga la página en un momento.
        </p>
      )}
    </div>
  );
}
