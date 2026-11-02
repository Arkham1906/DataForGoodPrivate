"use client";

// Ventana que explica que una persona debe agregar una organización a su perfil antes de crear campañas.

import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";

export default function VentanaDeOrganizacionRequerida({
  abierto,
  onCancelar,
  onAgregar,
}: {
  abierto: boolean;
  onCancelar: () => void;
  onAgregar: () => void;
}) {
  return (
    <VentanaDeConfirmacion
      abierto={abierto}
      titulo="Necesitas pertenecer a una organización"
      textoConfirmar="Agregar organización"
      textoOcupado="Abriendo Mi cuenta…"
      onCancelar={onCancelar}
      onConfirmar={onAgregar}
    >
      <p>Para crear una campaña, primero agrega una organización a tu cuenta.</p>
    </VentanaDeConfirmacion>
  );
}
