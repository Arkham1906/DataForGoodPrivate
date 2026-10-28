// Pantalla /sistema/especialidades (2026-10-26): catálogo de especialidades del perfil. Las 44 base
// (lib/perfil-opciones.ts) y las que escriben los usuarios en /bienvenida y /cuenta, que se sugieren
// a todos desde que se guardan. El SuperUsuario crea y edita o borra las que no son base: renombrar
// las cambia en los perfiles; borrar las quita de ellos. Las base no se tocan.
// Server Component. Acceso: sesión raíz. Datos: lib/usuarios/especialidades.ts. Búsqueda con ?q=.
// Acciones: lib/usuarios/acciones-especialidades.ts. Dibujo: components/sistema/catalogo.

import type { Metadata } from "next";

import PantallaDeCatalogo from "@/components/sistema/catalogo/PantallaDeCatalogo";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { LARGO_MAXIMO_DE_ESPECIALIDAD } from "@/lib/perfil-opciones";
import { especialidadesDelPanel } from "@/lib/usuarios/especialidades";
import { borrarEspecialidadDelPanel, crearEspecialidadDelPanel, editarEspecialidad } from "@/lib/usuarios/acciones-especialidades";

export const metadata: Metadata = { title: "Especialidades" };
export const dynamic = "force-dynamic";

export default async function EspecialidadesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigirSesionRoot();
  const { q = "" } = await searchParams;
  const especialidades = await especialidadesDelPanel.listarDelPanel(q);

  return (
    <PantallaDeCatalogo
      titulo="Especialidades"
      subtitulo="Lo que las personas eligen o escriben en «¿En qué te especializas?» al registrarse y en su cuenta. Las que escriben se sugieren a todos desde que se guardan. Puedes crear especialidades y editar o borrar las que no son base: al editar una, cambia también en los perfiles que la tienen; al borrarla, esos perfiles quedan sin especialidad."
      q={q}
      elementos={especialidades}
      conCampanas={false}
      maximo={LARGO_MAXIMO_DE_ESPECIALIDAD}
      textos={{
        nuevo: "Nueva especialidad",
        placeholder: "Ej. Ingeniería agrícola",
        ayuda: "Se sugiere desde ya al registrarse y en la cuenta. Letras, espacios y . , - / ( ).",
        buscar: "Buscar especialidad",
        sustantivo: "especialidad",
        sinElDato: "sin especialidad",
        ninguna: "Todavía no hay especialidades.",
      }}
      acciones={{ crear: crearEspecialidadDelPanel, editar: editarEspecialidad, borrar: borrarEspecialidadDelPanel }}
    />
  );
}
