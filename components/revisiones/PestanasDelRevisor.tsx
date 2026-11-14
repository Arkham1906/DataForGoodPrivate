// Pestañas de arriba del revisor de aportes (2026-11-13, a pedido del usuario): Dashboard (/revisiones, lo primero
// que se abre) y Campañas (/revisiones/campanas, las campañas en curso; también se marca en /revisiones/finalizadas,
// que es la otra mitad de la lista). Las pestañas son components/sistema/subtabs.

import Subtabs from "@/components/sistema/subtabs";

export const RUTA_DE_CAMPANAS_DEL_REVISOR = "/revisiones/campanas";

export default function PestanasDelRevisor() {
  return (
    <Subtabs
      pestanas={[
        { href: "/revisiones", etiqueta: "Dashboard" },
        { href: RUTA_DE_CAMPANAS_DEL_REVISOR, etiqueta: "Campañas", tambienEn: ["/revisiones/finalizadas"] },
      ]}
      etiquetaAria="Secciones del revisor de aportes"
      distribuidasEnMovil
    />
  );
}
