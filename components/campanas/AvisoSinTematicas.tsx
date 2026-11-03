"use client";

// Aviso "Agrega tus temáticas de interés" (2026-11-02, a pedido del usuario) para quien no tiene temáticas
// en su perfil (las omitió al crear su cuenta). La usan /campanas ("Explorar campañas") y el formulario de
// una campaña nueva. Es un recuadro dentro de la página con el mismo estilo que AvisoDeUbicacion (antes era
// una ventana emergente; se cambió a pedido del usuario porque resultaba molesta). "Agregar mis temáticas"
// lleva a /cuenta#mis-intereses; "Ahora no" lo oculta en esa pantalla durante la sesión del navegador
// (sessionStorage con la `clave` de quien la usa). Desde el 2026-11-03 también en /inicio (Server Component):
// sessionStorage se lee con useSyncExternalStore para que el HTML del servidor y la hidratación coincidan.

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

function yaSeOculto(clave: string): boolean {
  try {
    return sessionStorage.getItem(clave) === "1";
  } catch {
    return false;
  }
}

function ocultar(clave: string) {
  try {
    sessionStorage.setItem(clave, "1");
  } catch {
    // Sin sessionStorage (modo privado estricto): puede volver a salir; no pasa nada.
  }
}

const sinSuscripcion = () => () => {};

export default function AvisoSinTematicas({
  sinTematicas,
  clave,
  children,
}: {
  /** true cuando ya se sabe que la persona no tiene temáticas (mientras carga, false). */
  sinTematicas: boolean;
  /** Clave de sessionStorage de esta pantalla. */
  clave: string;
  /** Texto del aviso. */
  children: ReactNode;
}) {
  const [cerrado, setCerrado] = useState(false);
  // En el servidor (y al hidratar) cuenta como oculto, para no mostrarlo y quitarlo en seguida si ya se
  // dijo "Ahora no"; después se lee sessionStorage y aparece si toca.
  const oculto = useSyncExternalStore(sinSuscripcion, () => yaSeOculto(clave), () => true);
  if (!sinTematicas || cerrado || oculto) return null;

  function cerrar() {
    ocultar(clave);
    setCerrado(true);
  }

  return (
    <div className="mb-5 rounded-lg border-l-4 border-brand-600 bg-system-100 p-3.5 text-[12.5px] text-system-600">
      {children}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Link href="/cuenta#mis-intereses" onClick={cerrar}>
          <Button size="sm" variant="primary">
            Agregar mis temáticas
          </Button>
        </Link>
        <Button size="sm" variant="ghost" onClick={cerrar}>
          Ahora no
        </Button>
      </div>
    </div>
  );
}
