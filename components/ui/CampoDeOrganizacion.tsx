"use client";

// Campo de organización (2026-10-26): a cuál pertenece la persona (/bienvenida, /cuenta) o cuál
// impulsa una campaña (formulario de campaña). Se elige del catálogo o se escribe; en el perfil, una
// nueva entra al catálogo al guardar (lib/usuarios/organizaciones.ts). Sugerencias de
// GET /api/organizaciones (ui/CampoConSugerencias). Marcado como control para Field.

import { marcarComoControl } from "@/components/ui/CampoEtiquetado";
import CampoConSugerencias, { type PropsDeCampoConSugerencias } from "@/components/ui/CampoConSugerencias";
import { LARGO_MAXIMO_DE_ORGANIZACION } from "@/lib/perfil-opciones";

const CampoDeOrganizacion = marcarComoControl(function CampoDeOrganizacion(props: PropsDeCampoConSugerencias) {
  return (
    <CampoConSugerencias
      placeholder="Escribe o elige tu organización"
      maxLength={LARGO_MAXIMO_DE_ORGANIZACION}
      {...props}
      url="/api/organizaciones"
    />
  );
});

export default CampoDeOrganizacion;
