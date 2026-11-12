// Pestaña «Líderes» de Mi progreso: /progreso/leaderboard (2026-11-09; antes /leaderboard, pública). La tabla de
// líderes completa, con todas las personas que tienen aportes aprobados (o XP), paginada de 25 en 25. Server
// Component, sin JavaScript de cliente: la categoría, la temática y la página viajan en searchParams
// (?categoria=aportes|nivel|tematica, ?tematica=, ?pagina=). La vieja /leaderboard redirige aquí (next.config.ts).
// Acceso: sesión de usuario (exigirUsuario); el marco, el título y las pestañas los ponen (dashboard)/layout.tsx y
// ../layout.tsx. La persona se ve marcada con "Tú" en la tabla.
// Datos: lib/gamificacion/clasificacion.ts (obtenerClasificacion, obtenerTematicasConLideres). Reglas
// de quién cuenta y de privacidad (nombre "Carlos P.", foto de perfil visible desde el 2026-11-12) en ese archivo y en dominio.md § 7.
// Acciones: ninguna (solo consulta). La landing enlaza aquí con "Ver tabla completa".
// Diseño del 2026-11-06: el de la landing. La franja va redondeada porque se ve dentro del marco de la app.

import type { Metadata } from "next";
import { BASE_PATH } from "@/lib/base-path";
import { retraso } from "@/lib/animaciones";
import Link from "next/link";
import ButtonLink from "@/components/ui/ButtonLink";
import FranjaDeCampo from "@/components/landing/FranjaDeCampo";
import { claseDeOrden } from "@/components/landing/estilos";
import Button from "@/components/ui/Button";
import ListaDeLideres from "@/components/gamificacion/ListaDeLideres";
import Podio from "@/components/gamificacion/Podio";
import { obtenerClasificacion, obtenerTematicasConLideres } from "@/lib/gamificacion/clasificacion";
import {
    CATEGORIAS_DE_CLASIFICACION,
    LIDERES_POR_PAGINA,
    LUGARES_DEL_PODIO,
    categoriaValida,
    type CategoriaDeClasificacion,
} from "@/lib/gamificacion/tipos";
import { exigirUsuario } from "@/lib/session";

export const metadata: Metadata = {
    title: "Tabla de líderes",
    description: "Las personas que más aportan a la comunidad de DataForGood: por aportes, por nivel o por temática.",
};

const nf = new Intl.NumberFormat("es-MX");

type Busqueda = Record<string, string | undefined>;

/** Ruta de la pestaña (sin basePath: <Link> lo pone solo). */
const RUTA = "/progreso/leaderboard";

/** Arma la ruta de la tabla con la categoría, la temática y la página (lo que sea el valor por defecto se omite). */
function enlaceA(categoria: CategoriaDeClasificacion, tematica: string | undefined, pagina: number): string {
    const params = new URLSearchParams();
    if (categoria !== "aportes") params.set("categoria", categoria);
    if (categoria === "tematica" && tematica) params.set("tematica", tematica);
    if (pagina > 1) params.set("pagina", String(pagina));
    const qs = params.toString();
    return qs ? `${RUTA}?${qs}` : RUTA;
}

export default async function LideresPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
    const sp = await searchParams;
    const categoria = categoriaValida(sp.categoria);
    const paginaPedida = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);

    const [tematicas, sesion] = await Promise.all([
        categoria === "tematica" ? obtenerTematicasConLideres() : Promise.resolve([] as string[]),
        exigirUsuario(),
    ]);
    // Una temática que no está en la lista (o ninguna) cae en la primera.
    const tematica = categoria === "tematica" ? (tematicas.find((t) => t === sp.tematica) ?? tematicas[0]) : undefined;

    let { lideres, total } = await obtenerClasificacion({ categoria, tematica, pagina: paginaPedida });
    const paginas = Math.max(1, Math.ceil(total / LIDERES_POR_PAGINA));
    const pagina = Math.min(paginaPedida, paginas);
    // Si pidió una página que no existe (p. ej. ?pagina=99), se muestra la última.
    if (pagina !== paginaPedida && total > 0) {
        ({ lideres, total } = await obtenerClasificacion({ categoria, tematica, pagina }));
    }

    const primerLugar = (pagina - 1) * LIDERES_POR_PAGINA + 1;
    // El podio solo en la primera página; en las demás, todo va en lista.
    const enPodio = pagina === 1 ? lideres.slice(0, LUGARES_DEL_PODIO) : [];
    const enLista = pagina === 1 ? lideres.slice(LUGARES_DEL_PODIO) : lideres;
    const resaltarId = sesion.id;

    return (
        <div>
            {/* h2: el h1 «Mi progreso» ya lo pone ../layout.tsx. */}
            <div className="text-center">
            <h2 className="text-xl font-semibold text-system-900">Tabla de líderes</h2>
            <p className="mt-1 text-[13px] text-system-600">
                Quienes más aportan a la comunidad. Solo cuentan los aportes aprobados, desde siempre.
                {total > 0 && ` ${nf.format(total)} ${total === 1 ? "persona" : "personas"} en esta tabla.`}
            </p>
            </div>

            <FranjaDeCampo redondeada style={retraso(240)} className="landing-entrada mt-6">
            <div className="relative flex justify-center px-4 py-8">
                <div className="flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-[18px] bg-white p-2 shadow-sm">
                <nav aria-label="Categoría" className="flex max-w-full gap-1.5 overflow-x-auto">
                    {CATEGORIAS_DE_CLASIFICACION.map((c) => (
                    <Link
                        key={c.valor}
                        href={enlaceA(c.valor, undefined, 1)}
                        aria-current={categoria === c.valor ? "page" : undefined}
                        className={claseDeOrden(categoria === c.valor)}
                    >
                        {c.etiqueta}
                    </Link>
                    ))}
                </nav>

                {categoria === "tematica" && tematicas.length > 0 && (
                    // Formulario GET: cambia de temática sin JavaScript. El action lleva el basePath a mano.
                    <form action={`${BASE_PATH}${RUTA}`} method="get" className="flex items-center gap-2">
                    <input type="hidden" name="categoria" value="tematica" />
                    <label htmlFor="tematica-de-lideres" className="text-[12.5px] font-medium text-system-600">
                        Temática
                    </label>
                    <select
                        id="tematica-de-lideres"
                        name="tematica"
                        defaultValue={tematica}
                        className="rounded border border-system-300 bg-white px-3 py-2 text-[13px] text-system-900 outline-none focus:border-brand-600"
                    >
                        {tematicas.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                        ))}
                    </select>
                    <Button type="submit" size="sm">
                        Ver
                    </Button>
                    </form>
                )}
                </div>
            </div>
            </FranjaDeCampo>

            <section className="mt-6 rounded-[18px] bg-system-100 p-4 md:p-8" aria-label="Clasificación">
            {total === 0 ? (
                <p className="rounded-lg bg-white p-4 text-center text-[13px] text-system-600">
                {categoria === "nivel"
                    ? "Todavía nadie ha ganado XP para aparecer en esta tabla."
                    : "Todavía no hay aportes aprobados para armar esta tabla."}
                </p>
            ) : (
                <div className="grid gap-6">
                {enPodio.length > 0 && <Podio lideres={enPodio} categoria={categoria} resaltarId={resaltarId} />}
                <ListaDeLideres
                    lideres={enLista}
                    categoria={categoria}
                    desde={pagina === 1 ? LUGARES_DEL_PODIO + 1 : primerLugar}
                    resaltarId={resaltarId}
                />
                </div>
            )}
            </section>

            {paginas > 1 && (
            <nav aria-label="Páginas" className="mt-6 flex items-center justify-between gap-3">
                {pagina > 1 ? (
                <ButtonLink href={enlaceA(categoria, tematica, pagina - 1)} variant="secondary" size="sm">
                    ← Anterior
                </ButtonLink>
                ) : (
                <span />
                )}
                <span className="font-mono text-[12px] text-system-500">
                Página {nf.format(pagina)} de {nf.format(paginas)}
                </span>
                {pagina < paginas ? (
                <ButtonLink href={enlaceA(categoria, tematica, pagina + 1)} variant="secondary" size="sm">
                    Siguiente →
                </ButtonLink>
                ) : (
                <span />
                )}
            </nav>
            )}
        </div>
    );
}
