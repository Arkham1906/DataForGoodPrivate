// Pantalla /supervision: la pestaña "Dashboard" del supervisor, lo primero que se abre (2026-11-13, a pedido del
// usuario). Arriba las pestañas Dashboard / Campañas / Reportes / Sanciones (PestanasDeModeracion) y el
// dashboard (components/supervision/DashboardDelSupervisor), armado aquí con obtenerDashboardDelSupervisor()
// (lib/supervision/dashboard.ts); si falla, un aviso con el enlace a la pestaña Campañas. Las listas para
// trabajar están en /supervision/campanas (hasta ese día eran esta pantalla).
// Acceso: sesión de usuario con rol "supervisor" (exigirUsuario aquí y en el layout, que redirige si no lo tiene).

import Link from "next/link";
import { redirect } from "next/navigation";
import PestanasDeModeracion from "@/components/moderacion/PestanasDeModeracion";
import DashboardDelSupervisor from "@/components/supervision/DashboardDelSupervisor";
import { rutasDeModeracion } from "@/lib/moderacion/rutas";
import { obtenerDashboardDelSupervisor } from "@/lib/supervision/dashboard";
import { exigirUsuario } from "@/lib/session";
import { periodoDesde } from "@/lib/periodo";

// ?periodo= o ?desde=&hasta= (2026-11-22): el periodo de la gráfica "Tus dictámenes" (lib/periodo.ts).
export default async function SupervisionPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  const usuario = await exigirUsuario();
  if (!usuario.role.includes("supervisor")) redirect("/campanas");
  const periodo = periodoDesde(await searchParams, "mes");
  const datos = await obtenerDashboardDelSupervisor(Number(usuario.id), periodo);

  return (
    <div className="mx-auto max-w-4xl lg:mx-0 lg:max-w-none">
      <PestanasDeModeracion zona="supervision" />
      {/* h1 con aspecto de etiqueta, como en la pestaña Campañas (WCAG 1.3.1). */}
      <h1 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Supervisión</h1>
      {datos ? (
        <DashboardDelSupervisor datos={datos} periodo={periodo} />
      ) : (
        <p className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">
          No se pudo cargar tu resumen. Tus campañas siguen en la pestaña{" "}
          <Link href={rutasDeModeracion("supervision").campanas} className="font-semibold text-brand-700 underline">
            Campañas
          </Link>
          .
        </p>
      )}
    </div>
  );
}
