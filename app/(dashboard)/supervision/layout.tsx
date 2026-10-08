// Layout de /supervision: exige sesión (exigirUsuario) y rol "supervisor"; si no, a /campanas.
// Cada página vuelve a comprobarlo.

import type { Metadata } from "next";
import { tituloDeSeccion } from "@/lib/titulo";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/session";

// Título de la pestaña (WCAG 2.4.2); las páginas de abajo con el suyo lo reemplazan.
export const metadata: Metadata = { title: tituloDeSeccion("Supervisión") };

export default async function SupervisionLayout({ children }: { children: React.ReactNode }) {
  const user = await exigirUsuario();
  if (!user.role.includes("supervisor")) {
    redirect("/campanas");
  }

  return children;
}
