// Marco de «Mi progreso» (2026-11-04; diseño v10): título y pestañas comunes a todas sus pantallas. Cada pestaña es
// una ruta bajo /progreso; las que aún no existen se ven deshabilitadas (lib/gamificacion/pantallas-de-progreso.ts).
// El acceso lo verifica cada página con exigirUsuario().

import type { ReactNode } from "react";
import PestanasDeProgreso from "@/components/gamificacion/PestanasDeProgreso";

export default function ProgresoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mi progreso</h1>
        <p className="mt-1 text-[13px] text-system-600">
          Tu rango, tus misiones, tus medallas y tu avatar. Lo que ganas con cada aporte aceptado es definitivo.
        </p>
      </div>
      <PestanasDeProgreso />
      {children}
    </div>
  );
}
