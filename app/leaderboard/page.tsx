// Pantalla /lideres (pública): la tabla de líderes completa, con todas las personas que tienen
// aportes aprobados (o XP), paginada de 25 en 25. Server Component, sin JavaScript de cliente: la
// categoría, la temática y la página viajan en searchParams (?categoria=aportes|nivel|tematica,
// ?tematica=, ?pagina=).
// Datos: lib/gamificacion/clasificacion.ts (obtenerClasificacion, obtenerTematicasConLideres). Reglas
// de quién cuenta y de privacidad (nombre "Carlos P.", nunca la foto) en ese archivo y en dominio.md § 7.
// Si hay sesión, la persona se ve marcada con "Tú" en la tabla y el marco (TopBar + sidebar) lo pone
// app/leaderboard/layout.tsx; sin sesión, el marco es el público (PublicHeader + PublicFooter).
// Acciones: ninguna (solo consulta). La landing enlaza aquí con "Ver tabla completa".

import type { Metadata } from "next";
import { BASE_PATH } from "@/lib/base-path";
import { retraso } from "@/lib/animaciones";
import ButtonLink from "@/components/ui/ButtonLink";
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
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
    title: "Tabla de líderes",
    description: "Las personas que más aportan a la comunidad de DataForGood: por aportes, por nivel o por temática.",
};

const nf = new Intl.NumberFormat("es-MX");

type Busqueda = Record<string, string | undefined>;

/** Arma /lideres con la categoría, la temática y la página (lo que sea el valor por defecto se omite). */
function enlaceA(categoria: CategoriaDeClasificacion, tematica: string | undefined, pagina: number): string {
    const params = new URLSearchParams();
    if (categoria !== "aportes") params.set("categoria", categoria);
    if (categoria === "tematica" && tematica) params.set("tematica", tematica);
    if (pagina > 1) params.set("pagina", String(pagina));
    const qs = params.toString();
    return qs ? `/leaderboard?${qs}` : "/leaderboard";
}

export default async function LideresPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
    const sp = await searchParams;
    const categoria = categoriaValida(sp.categoria);
    const paginaPedida = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);

    const [tematicas, sesion] = await Promise.all([
        categoria === "tematica" ? obtenerTematicasConLideres() : Promise.resolve([] as string[]),
        getSessionUser().catch(() => null),
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
    const resaltarId = sesion?.id;

    return (
        <div className="mx-auto max-w-4xl">
            <p className="landing-entrada mb-2 font-mono text-[10.5px] uppercase tracking-widest text-brand-600">
            Comunidad
            </p>
            <h1
            style={retraso(80)}
            className="landing-entrada max-w-2xl text-[32px] font-extrabold leading-tight tracking-tight text-system-900"
            >
            Tabla de líderes
            </h1>
            <p style={retraso(160)} className="landing-entrada mt-4 max-w-2xl text-[14.5px] leading-relaxed text-system-600">
            Quienes más aportan a la comunidad. Solo cuentan los aportes aprobados, desde siempre.
            {total > 0 && ` ${nf.format(total)} ${total === 1 ? "persona" : "personas"} en esta tabla.`}
            </p>

            <div style={retraso(240)} className="landing-entrada mt-6 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Categoría" className="flex flex-wrap gap-2">
                {CATEGORIAS_DE_CLASIFICACION.map((c) => (
                <ButtonLink
                    key={c.valor}
                    href={enlaceA(c.valor, undefined, 1)}
                    variant={categoria === c.valor ? "primary" : "secondary"}
                    size="sm"
                    aria-current={categoria === c.valor ? "page" : undefined}
                >
                    {c.etiqueta}
                </ButtonLink>
                ))}
            </nav>

            {categoria === "tematica" && tematicas.length > 0 && (
                // Formulario GET: cambia de temática sin JavaScript. El action lleva el basePath a mano.
                <form action={`${BASE_PATH}/leaderboard`} method="get" className="flex items-center gap-2">
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

            <section className="mt-8" aria-label="Clasificación">
            {total === 0 ? (
                <p className="rounded-lg bg-system-100 p-4 text-center text-[13px] text-system-600">
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
