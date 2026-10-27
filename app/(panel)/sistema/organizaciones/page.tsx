// Pantalla /sistema/organizaciones (2026-10-26): catálogo de organizaciones del perfil. Empezó con
// las que ya usaban las campañas y crece con las que escriben los usuarios en /bienvenida y /cuenta;
// todas se sugieren a todos. El SuperUsuario crea, edita y borra: renombrar las cambia en los perfiles
// y en las campañas (campanas.organizer); borrar las quita de los perfiles y las campañas conservan
// su texto.
// Server Component. Acceso: sesión raíz. Datos: lib/usuarios/organizaciones.ts. Búsqueda con ?q=.
// Acciones: lib/usuarios/acciones-organizaciones.ts. Dibujo: components/sistema/catalogo.

import type { Metadata } from "next";

import PantallaDeCatalogo from "@/components/sistema/catalogo/PantallaDeCatalogo";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { LARGO_MAXIMO_DE_ORGANIZACION } from "@/lib/perfil-opciones";
import { organizacionesDelPanel } from "@/lib/usuarios/organizaciones";
import { borrarOrganizacionDelPanel, crearOrganizacionDelPanel, editarOrganizacion } from "@/lib/usuarios/acciones-organizaciones";

export const metadata: Metadata = { title: "Organizaciones" };
export const dynamic = "force-dynamic";

export default async function OrganizacionesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigirSesionRoot();
  const { q = "" } = await searchParams;
  const organizaciones = await organizacionesDelPanel.listarDelPanel(q);

  return (
    <PantallaDeCatalogo
      titulo="Organizaciones"
      subtitulo="Lo que las personas responden en «¿Perteneces a alguna organización?» al registrarse y en su cuenta, más las que ya usaban las campañas. Todas se sugieren a todos, y la del perfil se propone al crear una campaña. Al editar una, cambia también en los perfiles y las campañas que la tienen; al borrarla, esos perfiles quedan sin organización y las campañas conservan su texto."
      q={q}
      elementos={organizaciones}
      conCampanas
      maximo={LARGO_MAXIMO_DE_ORGANIZACION}
      textos={{
        nuevo: "Nueva organización",
        placeholder: "Ej. Colectivo Ambiental de Tepic",
        ayuda: "Se sugiere desde ya al registrarse, en la cuenta y al crear campañas.",
        buscar: "Buscar organización",
        sustantivo: "organización",
        sinElDato: "sin organización",
        ninguna: "Todavía no hay organizaciones.",
      }}
      acciones={{ crear: crearOrganizacionDelPanel, editar: editarOrganizacion, borrar: borrarOrganizacionDelPanel }}
    />
  );
}
