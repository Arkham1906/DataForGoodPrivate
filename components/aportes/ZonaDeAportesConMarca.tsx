// Envoltorio de servidor de ProteccionDeAportes (2026-11-12): arma la marca de agua con el nombre de quien
// revisa y la fecha en hora de Tepic. Va en los layouts de las pantallas donde el creador y el revisor ven
// los aportes. La sesión la exige el layout del dashboard; aquí solo se lee el nombre.

import type { ReactNode } from "react";
import ZonaDeAportesProtegida from "@/components/aportes/ProteccionDeAportes";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { getSessionUser } from "@/lib/session";

const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: ZONA_DE_CAMPANAS });

export default async function ZonaDeAportesConMarca({
  sinProteccionEn,
  children,
}: {
  sinProteccionEn?: string[];
  children: ReactNode;
}) {
  const usuario = await getSessionUser();
  const nombre = usuario ? `${usuario.nombre} ${usuario.apellidos}`.trim() : "DataForGood";
  return (
    <ZonaDeAportesProtegida marca={`${nombre} · ${fecha.format(new Date())} · DataForGood`} sinProteccionEn={sinProteccionEn}>
      {children}
    </ZonaDeAportesProtegida>
  );
}
