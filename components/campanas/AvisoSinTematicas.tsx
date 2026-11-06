"use client";

// Aviso "Agrega tus temáticas de interés" (2026-11-02, a pedido del usuario) para quien no tiene temáticas
// en su perfil (las omitió al crear su cuenta). La usan /campanas ("Explorar campañas") y el formulario de
// una campaña nueva. Es un recuadro dentro de la página con el mismo estilo que AvisoDeUbicacion (antes era
// una ventana emergente; se cambió a pedido del usuario porque resultaba molesta). "Agregar mis temáticas"
// lleva a /cuenta#mis-intereses con la sección en rojo (resaltarTematicas, 2026-11-03). "Ahora no" lo oculta solo
// mientras la persona sigue en esa pantalla: al recargar o volver a entrar sale otra vez, hasta que tenga temáticas
// (2026-11-06, a pedido del usuario; antes se guardaba en sessionStorage y no volvía en toda la sesión). Desde el
// 2026-11-03 también en /inicio (Server Component).

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function AvisoSinTematicas({
  sinTematicas,
  children,
  siCerrado = null,
  returnTo,
}: {
  /** true cuando ya se sabe que la persona no tiene temáticas (mientras carga, false). */
  sinTematicas: boolean;
  /** Texto del aviso. */
  children: ReactNode;
  /** Qué mostrar tras decir "Ahora no": en /inicio evita dejar solo el título de "Campañas para ti". */
  siCerrado?: ReactNode;
  /** Ruta interna a la que debe volver después de guardar las temáticas. */
  returnTo?: string;
}) {
  const [cerrado, setCerrado] = useState(false);
  if (!sinTematicas) return null;
  if (cerrado) return <>{siCerrado}</>;

  return (
    <div className="mb-5 rounded-lg border-l-4 border-brand-600 bg-system-100 p-3.5 text-[12.5px] text-system-600">
      {children}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Link href={`/cuenta?resaltarTematicas=1${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}#mis-intereses`}>
          <Button size="sm" variant="primary">
            Agregar mis temáticas
          </Button>
        </Link>
        <Button size="sm" variant="ghost" onClick={() => setCerrado(true)}>
          Ahora no
        </Button>
      </div>
    </div>
  );
}
