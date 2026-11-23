import Link from "next/link";
import SelectorDeVistaCampanas from "@/components/campanas/SelectorDeVistaCampanas";
import TarjetaDeCampanaPublica from "@/components/campanas/TarjetaDeCampanaPublica";
import type { CampanaConPendientes } from "@/lib/revisiones/dashboard";
import { esperaDesde } from "@/lib/duracion";

const nf = new Intl.NumberFormat("es-MX");

export default function CampanasPendientesDelRevisor({ campanas, ahora }: { campanas: CampanaConPendientes[]; ahora: number }) {
  return <SelectorDeVistaCampanas persistKey="revisor-dashboard-vista-campanas" toolbar={<span className="text-xs text-system-600">Vista</span>}>
    {campanas.map((c, indice) => (
      <div key={c.id} className="flex min-w-0 flex-col gap-2">
        <div className="hidden group-data-[vista=cuadricula]:block">
          <TarjetaDeCampanaPublica campana={c.tarjeta} indice={indice} nivel="h3" compacta href={`/revisiones/campanas/${c.id}`} />
        </div>
        <div className="hidden group-data-[vista=lista]:block">
          <TarjetaDeCampanaPublica campana={c.tarjeta} indice={indice} nivel="h3" lista href={`/revisiones/campanas/${c.id}`} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
          <p className="text-xs text-system-600">
            <strong>{nf.format(c.pendientes)} {c.pendientes === 1 ? "pendiente" : "pendientes"}</strong>
            <span className="block">El más antiguo desde hace {esperaDesde(c.masAntiguo, ahora)}</span>
          </p>
          <Link href={`/revisiones/campanas/${c.id}`} className="rounded-pill border border-system-300 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-600">
            Revisar<span className="sr-only"> los aportes de {c.nombre}</span> →
          </Link>
        </div>
      </div>
    ))}
  </SelectorDeVistaCampanas>;
}
