"use client";

// Ventana "Agrega tus temáticas de interés" (2026-11-02, a pedido del usuario) para quien no tiene temáticas
// en su perfil (las omitió al crear su cuenta). La usan /campanas ("Explorar campañas") y el formulario de
// una campaña nueva. Solo sale de la pantalla si la persona pulsa "Agregar mis temáticas" (va a
// /cuenta#mis-intereses); con "Ahora no" sigue donde estaba. Sale una vez por sesión del navegador en cada
// pantalla (sessionStorage con la `clave` de quien la usa), no en cada visita ni con la actualización en vivo.

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";

function yaSeAviso(clave: string): boolean {
  try {
    return sessionStorage.getItem(clave) === "1";
  } catch {
    return false;
  }
}

function marcarAviso(clave: string) {
  try {
    sessionStorage.setItem(clave, "1");
  } catch {
    // Sin sessionStorage (modo privado estricto): puede volver a salir; no pasa nada.
  }
}

export default function AvisoSinTematicas({
  sinTematicas,
  clave,
  children,
}: {
  /** true cuando ya se sabe que la persona no tiene temáticas (mientras carga, false). */
  sinTematicas: boolean;
  /** Clave de sessionStorage de esta pantalla. */
  clave: string;
  /** Texto de la ventana. */
  children: ReactNode;
}) {
  const router = useRouter();
  const [cerrado, setCerrado] = useState(false);
  // sinTematicas solo es true en el navegador (llega de un fetch), así que aquí sessionStorage ya existe.
  const abierto = sinTematicas && !cerrado && !yaSeAviso(clave);

  function cerrar() {
    marcarAviso(clave);
    setCerrado(true);
  }

  return (
    <VentanaDeConfirmacion
      abierto={abierto}
      titulo="Agrega tus temáticas de interés"
      textoConfirmar="Agregar mis temáticas"
      textoOcupado="Abriendo…"
      textoCancelar="Ahora no"
      onCancelar={cerrar}
      onConfirmar={() => {
        cerrar();
        router.push("/cuenta#mis-intereses");
      }}
    >
      {children}
      <p className="mt-2 text-system-600">Puedes agregarlas o cambiarlas cuando quieras en Mi cuenta.</p>
    </VentanaDeConfirmacion>
  );
}
