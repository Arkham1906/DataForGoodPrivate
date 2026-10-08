// Pantalla /mis-campanas/nueva: crear campaña, o editar una con ?edit=<id>.
// Solo monta NuevaCampanaForm.tsx, que hace todo el trabajo.

import { Suspense } from "react";
import NuevaCampanaForm from "./NuevaCampanaForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Crear o editar campaña" };

export default function NuevaCampanaPage() {
  return (
    <Suspense fallback={null}>
      <NuevaCampanaForm />
    </Suspense>
  );
}
