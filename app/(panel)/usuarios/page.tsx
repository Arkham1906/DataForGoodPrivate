// Pantalla /usuarios: directorio de usuarios con búsqueda y filtros.
// Server Component. Datos: buscarUsuarios() de lib/usuarios/directorio.ts. Protegida solo por el layout del panel.

import type { Metadata } from "next";
import { Suspense } from "react";

import Subtabs from "@/components/sistema/subtabs";
import { Encabezado, EnlaceBoton, Paginacion, formatearNumero } from "@/components/sistema/ui";
import Tag from "@/components/sistema/Tag";
import { PESTANAS_USUARIOS } from "@/lib/usuarios/dashboard";
import { ETIQUETA_DE_ESTADO, POR_PAGINA, buscarUsuarios } from "@/lib/usuarios/directorio";
import Filtros from "./filtros";
import { exigirSesionRoot } from "@/lib/supervision/root";

export const metadata: Metadata = { title: "Directorio de usuarios" };
export const dynamic = "force-dynamic";

type Busqueda = { q?: string; rol?: string; estado?: string; pagina?: string; movil?: string };

export default async function DirectorioPage({
  searchParams,
}: {
  searchParams: Promise<Busqueda>;
}) {
  await exigirSesionRoot();
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina ?? 1) || 1);

  const { filas, total } = await buscarUsuarios({
    q: sp.q,
    rol: sp.rol,
    estado: sp.estado,
    pagina,
  });

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, total);

  function enlaceDePagina(p: number) {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.rol) params.set("rol", sp.rol);
    if (sp.estado) params.set("estado", sp.estado);
    if (p > 1) params.set("pagina", String(p));
    const qs = params.toString();
    return qs ? `/usuarios?${qs}` : "/usuarios";
  }

  return (
    <div>
      <Subtabs
        pestanas={PESTANAS_USUARIOS}
        etiquetaAria="Secciones de usuarios"
        listaEnMovil={sp.movil === "menu"}
        menuInicialMovil={sp.movil === "menu"}
        volverAlMenuEnMovil={sp.movil !== "menu"}
      />

      <div className={sp.movil === "menu" ? "hidden md:block" : undefined}>
        <Encabezado
          titulo="Usuarios"
          subtitulo={`${formatearNumero(total)} registrados`}
          acciones={<EnlaceBoton href="/usuarios/dashboard">Ver dashboard</EnlaceBoton>}
        />

        <Suspense fallback={null}>
          <Filtros q={sp.q ?? ""} rol={sp.rol ?? ""} estado={sp.estado ?? ""} />
        </Suspense>

        {filas.length === 0 ? (
          <p className="py-7 text-[13px] text-system-600">
            Ningún usuario coincide con la búsqueda. Prueba con otro término o quita
            alguno de los filtros.
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filas.map((u) => {
                const estado = ETIQUETA_DE_ESTADO[u.estado];
                return (
                  <article key={u.id} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="break-words text-[14px] font-bold leading-snug text-system-900">
                        {u.nombre}
                      </p>
                      <p className="mt-1 break-all font-mono text-[11px] text-system-500">{u.correo}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-system-200 pt-3">
                      {u.roles.map((rol) => (
                        <Tag key={rol}>{rol}</Tag>
                      ))}
                      {u.rolDetalle ? (
                        <span className="text-[12.5px] text-system-500">{u.rolDetalle}</span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-system-600">Estado</span>
                      <Tag tone={estado.tono}>
                        {u.estado === "CON_STRIKES" ? `${u.strikes} ${u.strikes === 1 ? "aviso" : "avisos"}` : estado.texto}
                      </Tag>
                    </div>

                    <div className="mt-3 grid">
                      <EnlaceBoton href={`/usuarios/${u.id}`}>
                        Abrir ficha<span className="sr-only"> de {u.nombre}</span>
                      </EnlaceBoton>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm md:block">
              <table className="w-full min-w-[720px] text-left text-[13.5px]">
                <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
                  <tr>
                    <th className="pb-3 font-medium">Usuario</th>
                    <th className="pb-3 font-medium">Rol</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((u) => {
                    const estado = ETIQUETA_DE_ESTADO[u.estado];
                    return (
                      <tr key={u.id} className="border-b border-system-200 last:border-0">
                        <td className="py-4">
                          <p className="font-bold text-system-900">{u.nombre}</p>
                          <p className="font-mono text-[11px] text-system-500">{u.correo}</p>
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {u.roles.map((rol) => (
                              <Tag key={rol}>{rol}</Tag>
                            ))}
                            {u.rolDetalle ? (
                              <span className="text-[12.5px] text-system-500">{u.rolDetalle}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <Tag tone={estado.tono}>
                            {u.estado === "CON_STRIKES" ? `${u.strikes} ${u.strikes === 1 ? "aviso" : "avisos"}` : estado.texto}
                          </Tag>
                        </td>
                        <td className="text-right">
                          <EnlaceBoton href={`/usuarios/${u.id}`}>
                            Abrir<span className="sr-only"> la ficha de {u.nombre}</span>
                          </EnlaceBoton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Paginacion
              desde={desde}
              hasta={hasta}
              total={total}
              pagina={pagina}
              paginas={paginas}
              href={enlaceDePagina}
            />
          </>
        )}
      </div>
    </div>
  );
}
