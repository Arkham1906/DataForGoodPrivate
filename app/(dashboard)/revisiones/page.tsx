// Pantalla /revisiones: la pestaña "Dashboard" del revisor de aportes, lo primero que se abre (2026-11-13, a pedido
// del usuario). Arriba las pestañas Dashboard / Campañas (components/revisiones/PestanasDelRevisor) y el
// dashboard (components/revisiones/DashboardDelRevisor), armado aquí con obtenerDashboardDelRevisor()
// (lib/revisiones/dashboard.ts). Si falla o la persona aún no revisa ninguna campaña, un aviso con el enlace a la
// pestaña Campañas. Las listas de campañas están en /revisiones/campanas y /revisiones/finalizadas.
// Acceso: sesión de usuario (exigirUsuario); el permiso por campaña lo revisa cada consulta.

import type { Metadata } from "next";
import Link from "next/link";
import DashboardDelRevisor from "@/components/revisiones/DashboardDelRevisor";
import PestanasDelRevisor, { RUTA_DE_CAMPANAS_DEL_REVISOR } from "@/components/revisiones/PestanasDelRevisor";
import { obtenerDashboardDelRevisor } from "@/lib/revisiones/dashboard";
import { exigirUsuario } from "@/lib/session";
import { periodoDesde } from "@/lib/periodo";

export const metadata: Metadata = { title: "Revisiones" };

// ?periodo= o ?desde=&hasta= (2026-11-22): el periodo de la gráfica "Tus decisiones" (lib/periodo.ts).
export default async function RevisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  const usuario = await exigirUsuario();
  const periodo = periodoDesde(await searchParams, "mes");
  const datos = await obtenerDashboardDelRevisor(usuario.id, periodo);

  return (
    <div className="mx-auto max-w-5xl lg:mx-0 lg:max-w-none">
      <PestanasDelRevisor />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl">Revisor de aportes</h1>
        <p className="mt-1 text-[13px] text-system-600">Tu resumen como revisor de aportes.</p>
      </div>
      {datos && datos.campanas > 0 ? (
        <DashboardDelRevisor datos={datos} periodo={periodo} />
      ) : (
        <p className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">
          {datos
            ? "Aún no revisas ninguna campaña: cuando aceptes una invitación de revisor, aquí verás tu resumen."
            : "No se pudo cargar tu resumen."}{" "}
          Tus campañas están en la pestaña{" "}
          <Link href={RUTA_DE_CAMPANAS_DEL_REVISOR} className="font-semibold text-brand-700 underline">
            Campañas
          </Link>
          .
        </p>
      )}
    </div>
  );
}
