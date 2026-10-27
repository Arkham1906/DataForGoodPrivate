"use client";

// Campo de especialidad de /bienvenida y /cuenta (2026-10-26): se elige del catálogo o se escribe la
// propia, que al guardar entra al catálogo y se sugiere a todos (lib/usuarios/especialidades.ts).
// Antes era un <select> de 3 opciones con "Otra (especifica)". Sugerencias de GET /api/especialidades
// (ui/CampoConSugerencias); si falla, la lista base. Marcado como control para Field.

import { marcarComoControl } from "@/components/ui/CampoEtiquetado";
import CampoConSugerencias, { type PropsDeCampoConSugerencias } from "@/components/ui/CampoConSugerencias";
import { ESPECIALIDADES, LARGO_MAXIMO_DE_ESPECIALIDAD } from "@/lib/perfil-opciones";

const CampoDeEspecialidad = marcarComoControl(function CampoDeEspecialidad(props: PropsDeCampoConSugerencias) {
  return (
    <CampoConSugerencias
      placeholder="Escribe o elige tu especialidad"
      maxLength={LARGO_MAXIMO_DE_ESPECIALIDAD}
      {...props}
      url="/api/especialidades"
      respaldo={ESPECIALIDADES}
    />
  );
});

export default CampoDeEspecialidad;
