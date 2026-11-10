"use client";

// Pantalla /campanas: campañas activas para participar. Componente cliente. Datos: GET /api/campanas y
// GET /api/auth/sesion; arriba, "Campañas para ti" como en /inicio (GET /api/campanas?paraTi=true,
// components/campanas/CampanasParaTi; 2026-10-27). Mientras llegan, tarjetas esqueleto (cards/CampaignCardSkeleton).
// Filtros (2026-10-31, a pedido del usuario): solo la barra de /sistema/campanas (campanas/BarraDeFiltros):
// "Mostrar" (todas, favoritas, tu localidad o cerca de ti), búsqueda, temática (las de tus intereses primero),
// subtemática, tipo de dato y orden; sin vigencia.
// Filas de botones (2026-11-02, a pedido del usuario: regresan sin quitar la barra; campanas/FilasDeFiltros): Todas, Tu
// localidad y hasta 5 temáticas (las de tus intereses primero, con ★; el resto en
// "Más temáticas", campanas/MasTematicas); con una temática, sus subtemáticas; y los tipos de dato. Desde el
// 2026-11-10 (a pedido del usuario) van debajo del título "Campañas para ti" (antes, arriba de él) y filtran SOLO
// esa sección, con su propio estado: la barra filtra solo la lista de abajo.
// Tres partes separadas por una línea (2026-11-10, a pedido del usuario): "Campañas favoritas", "Campañas para
// ti" (con sus filtros y sus avisos) y "Todas las campañas" (título visible, barra de filtros y lista). La sección pide todas las recomendadas en orden
// (?paraTi=true&todas=true): sin filtro muestra las CAMPANAS_PARA_TI primeras; con filtro, todas las que
// coinciden. Sin "Favoritas" en estos botones (2026-11-02, a pedido del usuario; sigue en el select de la barra).
// "Campañas favoritas" (2026-11-04, a pedido del usuario; antes "Guardadas"): sección sin filtros, arriba de
// "Campañas para ti", con todas las favoritas activas; sin favoritas no sale.
// Aviso de temáticas (2026-11-02, a pedido del usuario): si la persona no tiene temáticas de interés (las
// omitió al crear su cuenta), sale el recuadro campanas/AvisoSinTematicas (mismo estilo que el de ubicación),
// que la lleva a "Mis intereses" de /cuenta; "Ahora no" lo oculta hasta recargar o volver a entrar. Desde el
// 2026-11-10 (a pedido del usuario) va arriba de todo, antes de "Campañas favoritas".
// Ubicación real (2026-10-31; lib/ubicacion/): si la persona activó "Usar mi ubicación"
// (components/campanas/AvisoDeUbicacion), "Tu localidad" pasa a "Cerca de ti": su municipio detectado (GET
// /api/ubicacion), todo su estado y todo el país, y la lista abre así. Sin zona, sigue el estado del perfil.

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import AvisoDeUbicacion from "@/components/campanas/AvisoDeUbicacion";
import { EVENTO_ZONA, type ZonaDetectada } from "@/lib/ubicacion/en-el-navegador";
import CampaignCard from "@/components/cards/CampaignCard";
import CampaignCardSkeleton from "@/components/cards/CampaignCardSkeleton";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import CampanasParaTi from "@/components/campanas/CampanasParaTi";
import FilasDeFiltros, { TODAS, TU_LOCALIDAD, useFiltrosDeLista } from "@/components/campanas/FilasDeFiltros";
import type { CampanaParaTi } from "@/lib/usuarios/inicio";
import Button from "@/components/ui/Button";
import AvisoSinTematicas from "@/components/campanas/AvisoSinTematicas";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { FILTROS_VACIOS, filtrarCampanas, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import { nombresDeTipos } from "@/lib/campanas/sistema-opciones";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import BotonCrearCampana from "@/components/campanas/BotonCrearCampana";

// Qué lista se muestra (select "Mostrar"): todas, las favoritas o las de su localidad / cerca de ti.
const FAVORITAS = "favoritas";
// Tarjetas esqueleto mientras cargan: dos filas en escritorio (3 columnas), suficientes en móvil.
const TARJETAS_DE_CARGA = 6;
const CLAVE_VISTA_CAMPANAS = "dfg:campanas:vista";
const EVENTO_VISTA_CAMPANAS = "dfg:campanas:vista-cambio";
let vistaCampanasEnMemoria = true;

function leerVistaDeCampanas(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_VISTA_CAMPANAS) !== "lista";
  } catch {
    return vistaCampanasEnMemoria;
  }
}

function suscribirVistaDeCampanas(alCambiar: () => void): () => void {
  const alCambiarVista = () => alCambiar();
  window.addEventListener("storage", alCambiarVista);
  window.addEventListener(EVENTO_VISTA_CAMPANAS, alCambiarVista);
  return () => {
    window.removeEventListener("storage", alCambiarVista);
    window.removeEventListener(EVENTO_VISTA_CAMPANAS, alCambiarVista);
  };
}

function guardarVistaDeCampanas(vistaCuadricula: boolean): void {
  vistaCampanasEnMemoria = vistaCuadricula;
  try {
    window.localStorage.setItem(CLAVE_VISTA_CAMPANAS, vistaCuadricula ? "cuadricula" : "lista");
  } catch {
    // Si el navegador bloquea el almacenamiento, la selección dura mientras la página siga abierta.
  }
  window.dispatchEvent(new Event(EVENTO_VISTA_CAMPANAS));
}

/** Línea entre las partes de la pantalla: favoritas, para ti y todas las campañas (2026-11-10). */
function Separador() {
  return <hr className="mb-8 mt-3 border-system-200 max-md:mb-6 max-md:mt-2" />;
}

// Cuántas muestra "Campañas para ti" sin filtro (las mismas que CAMPANAS_PARA_TI de lib/usuarios/inicio.ts, que no se
// importa aquí porque ese archivo usa la base de datos).
const CAMPANAS_PARA_TI = 3;

/** "Estado de México" y "estado de mexico" cuentan como el mismo estado. */
function normalizarEstado(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

function BotonCambiarVista({ vistaCuadricula, onCambiar, className = "" }: { vistaCuadricula: boolean; onCambiar: () => void; className?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      className={`!size-[42px] !shrink-0 !rounded-lg !p-0 ${className}`}
      onClick={onCambiar}
      aria-label={vistaCuadricula ? "Cambiar a vista de lista" : "Cambiar a vista cuadriculada"}
      aria-pressed={vistaCuadricula}
      title={vistaCuadricula ? "Vista de lista" : "Vista cuadriculada"}
    >
      {vistaCuadricula ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      )}
    </Button>
  );
}

export default function CampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // "Campañas para ti" (2026-10-27): las mismas de /inicio, arriba de los filtros.
  const [paraTi, setParaTi] = useState<CampanaParaTi[]>([]);
  const vistaCuadricula = useSyncExternalStore(suscribirVistaDeCampanas, leerVistaDeCampanas, () => true);
  const [vista, setVista] = useState(TODAS);
  // Temática elegida ("" = todas) y su subtemática (2026-10-27; "" = todas). Otra temática quita la subtemática.
  const [temaActivo, setTemaActivo] = useState("");
  const [etiquetaActiva, setEtiquetaActiva] = useState("");
  // Zona detectada por GPS (null: no la compartió). Al conocerla, la lista abre en "Cerca de ti" si la
  // persona todavía no eligió qué mostrar.
  const [zona, setZona] = useState<ZonaDetectada | null>(null);
  const eligioVista = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  // Estado declarado en el perfil (Mi cuenta); vacío si no lo ha indicado.
  const [miEstado, setMiEstado] = useState("");
  // Intereses del perfil (por clave, sin acentos): sus temáticas van primero en el select.
  const [misIntereses, setMisIntereses] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState<FiltrosLocales>(FILTROS_VACIOS);
  // Tipos de dato elegidos, separados por comas (2026-11-03: uno o varios); "" = todos. Se conserva al cambiar de temática.
  const [tipoActivo, setTipoActivo] = useState("");
  // Aviso "Agrega tus temáticas" (2026-11-02): sin temáticas de interés en el perfil.
  const [sinTematicas, setSinTematicas] = useState(false);
  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function cargarCampanas() {
      try {
        const [response, sesionRes, paraTiRes, zonaRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/campanas?paraTi=true&todas=true`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/ubicacion`, { cache: "no-store" }),
        ]);
        const zonaBody = await zonaRes.json().catch(() => ({}));
        const zonaGuardada = zonaRes.ok && zonaBody.zona ? (zonaBody.zona as ZonaDetectada) : null;
        setZona(zonaGuardada);
        if (zonaGuardada && !eligioVista.current) setVista(TU_LOCALIDAD);
        // Si falla, la sección no sale; la lista sigue.
        const paraTiBody = await paraTiRes.json().catch(() => ({}));
        setParaTi(paraTiRes.ok && Array.isArray(paraTiBody.data) ? (paraTiBody.data as CampanaParaTi[]) : []);
        const sesion = await sesionRes.json().catch(() => ({}));
        if (sesionRes.ok) {
          setMiEstado(String(sesion.data?.state ?? "").trim());
          const intereses: unknown = sesion.data?.intereses;
          if (Array.isArray(intereses)) setMisIntereses(new Set(intereses.map((t) => claveDeTematica(String(t)))));
          setSinTematicas(Array.isArray(intereses) && intereses.length === 0);
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        const todas = Array.isArray(payload.data) ? (payload.data as Campaign[]) : [];
        // Solo activas: las pausadas salieron de 2026-10-24 a 2026-11-03 y se quitaron a pedido del usuario.
        setCampaigns(todas.filter((campaign) => campaign.status === "activa"));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setCargando(false);
      }
    }
    void cargarCampanas();
  }, [recarga]);

  // La zona cambia sola (DetectorDeUbicacion) o con el aviso: se pone al día sin recargar.
  useEffect(() => {
    const alCambiar = (evento: Event) => {
      const nueva = (evento as CustomEvent<ZonaDetectada | null>).detail ?? null;
      setZona(nueva);
      // Si la lista la puso la zona (la persona no eligió otra), sigue a la zona: con ella "Cerca de ti",
      // sin ella "Todas".
      if (!eligioVista.current) setVista(nueva ? TU_LOCALIDAD : TODAS);
    };
    window.addEventListener(EVENTO_ZONA, alCambiar);
    return () => window.removeEventListener(EVENTO_ZONA, alCambiar);
  }, []);

  // Con zona detectada: su municipio, todo su estado y todo el país. Sin ella: el estado del perfil.
  const deMiLocalidad = (lista: Campaign[]) =>
    zona
      ? lista.filter(
          (c) =>
            c.todoElPais ||
            (normalizarEstado(c.locationState) === normalizarEstado(zona.estado) &&
              (!c.locationCity || normalizarEstado(c.locationCity) === normalizarEstado(zona.municipio)))
        )
      : miEstado
        ? lista.filter((c) => c.todoElPais || normalizarEstado(c.locationState) === normalizarEstado(miEstado))
        : [];
  const enMiEstado = deMiLocalidad(campaigns);
  const lugarDelFiltro = zona ? `${zona.municipio}, ${zona.estado}` : miEstado;
  const favoritas = campaigns.filter((c) => c.isSaved);

  const vistas = [
    { valor: TODAS, etiqueta: `Mostrar: todas (${campaigns.length})` },
    { valor: FAVORITAS, etiqueta: `Favoritas (${favoritas.length})` },
    {
      valor: TU_LOCALIDAD,
      etiqueta: zona
        ? `Cerca de ti: ${zona.municipio} (${enMiEstado.length})`
        : miEstado
          ? `Tu localidad: ${miEstado} (${enMiEstado.length})`
          : "Tu localidad",
    },
  ];

  const porVista = vista === FAVORITAS ? favoritas : vista === TU_LOCALIDAD ? enMiEstado : campaigns;

  const esDeMisIntereses = (tema: string) => misIntereses.has(claveDeTematica(tema));

  // Temáticas de las campañas (así nunca aparece una opción sin resultados): primero las de los
  // intereses de la persona, luego de la más frecuente a la menos.
  const temasConCampanas = Array.from(
    campaigns.reduce((conteo, c) => (c.tag ? conteo.set(c.tag, (conteo.get(c.tag) ?? 0) + 1) : conteo), new Map<string, number>())
  ).sort(
    (a, b) =>
      Number(esDeMisIntereses(b[0])) - Number(esDeMisIntereses(a[0])) || b[1] - a[1] || a[0].localeCompare(b[0], "es")
  );

  const porTema = temaActivo ? porVista.filter((c) => c.tag === temaActivo) : porVista;
  const porEtiqueta =
    temaActivo && etiquetaActiva ? porTema.filter((c) => (c.etiquetas ?? []).some((e) => e.nombre === etiquetaActiva)) : porTema;

  const buscando = tipoActivo !== "" || busqueda.q.trim() !== "" || busqueda.orden !== "";
  const filtered = filtrarCampanas(porEtiqueta, { ...busqueda, tipo: tipoActivo }, (c) => c.tag);

  // Subtemáticas (aprobadas) de cada temática de la lista, para el select de la barra.
  const etiquetasPorTema: Record<string, string[]> = {};
  for (const c of campaigns) {
    if (!c.tag) continue;
    const nombres = new Set(etiquetasPorTema[c.tag] ?? []);
    for (const e of c.etiquetas ?? []) if (!e.pendiente) nombres.add(e.nombre);
    etiquetasPorTema[c.tag] = [...nombres].sort((a, b) => a.localeCompare(b, "es"));
  }

  // Filas de botones de "Campañas para ti" (2026-11-02): trabajan sobre las recomendadas (en su orden), con
  // los datos completos de cada una (temática, etiquetas, tipos, favorita, lugar) tomados de la lista.
  // Solo las de sus temáticas de interés o de su ubicación (2026-11-03, a pedido del usuario): las
  // "populares" de otras temáticas que agrega el servidor ya no entran, y los botones de temática son solo
  // los de sus intereses.
  const porId = new Map(campaigns.map((c) => [String(c.id), c]));
  const idsDeMiLocalidad = new Set(enMiEstado.map((c) => String(c.id)));
  const recomendadas = paraTi.flatMap((p) => {
    const c = porId.get(String(p.id));
    return c && ((c.tag && esDeMisIntereses(c.tag)) || idsDeMiLocalidad.has(String(c.id))) ? [{ p, c }] : [];
  });
  const filtroParaTi = useFiltrosDeLista({ campanas: recomendadas.map((r) => r.c), deMiLocalidad, esDeMisIntereses });
  const idsParaTi = new Set(filtroParaTi.coinciden.map((c) => String(c.id)));
  // Sin temáticas de interés ni ubicación (GPS o estado del perfil) no hay nada "para ti": no salen las filas de
  // botones ni campañas (2026-11-03; antes mostraba las populares), pero sí el título (2026-11-04, a pedido del usuario).
  const conParaTi = misIntereses.size > 0 || Boolean(lugarDelFiltro);
  // Sin filtro, las CAMPANAS_PARA_TI primeras; con filtro, todas las que coinciden (2026-11-02).
  const ptCoinciden = recomendadas.filter((r) => idsParaTi.has(String(r.c.id)));
  const paraTiVisibles = (filtroParaTi.activo ? ptCoinciden : ptCoinciden.slice(0, CAMPANAS_PARA_TI)).map((r) => r.p);
  // El de temáticas va arriba de todo, antes de "Campañas favoritas" (2026-11-10, a pedido del usuario). El de
  // ubicación va debajo del título de "Campañas para ti" si la sección no tiene qué mostrar; si no, después de ella.
  const avisoSinTematicas = (
    <AvisoSinTematicas sinTematicas={sinTematicas}>
      <p>
        Aún no eliges temáticas de interés. Agrégalas para mostrarte primero las campañas que te interesan y
        avisarte cuando se abra una nueva.
      </p>
    </AvisoSinTematicas>
  );
  const avisoDeUbicacion = <AvisoDeUbicacion zona={zona} />;

    function cambiarBusqueda(clave: keyof ValoresDeFiltros, valor: string) {
    if (clave === "q" || clave === "orden") setBusqueda((actual) => ({ ...actual, [clave]: valor }));
    else if (clave === "vista") {
      eligioVista.current = true;
      setVista(valor);
    } else if (clave === "tematica") {
      setTemaActivo(valor);
      setEtiquetaActiva("");
    } else if (clave === "etiqueta") setEtiquetaActiva(valor);
    else if (clave === "tipo") setTipoActivo(valor);
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Campañas disponibles</h1>
          <p className="mt-1 text-[13px] text-system-600 max-md:max-w-[220px] max-md:text-[12px] max-md:leading-5">
            Descubre proyectos con impacto social cerca de ti.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <BotonCrearCampana variant="primary" size="sm" className="whitespace-nowrap max-md:max-w-[126px] max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px] max-md:leading-4">
            Crear campaña
          </BotonCrearCampana>
          <BotonCambiarVista vistaCuadricula={vistaCuadricula} onCambiar={() => guardarVistaDeCampanas(!vistaCuadricula)} />
        </div>
      </div>

      {/* Arriba de todo, antes de "Campañas favoritas" (2026-11-10, a pedido del usuario). */}
      {!cargando && !error && avisoSinTematicas}

      {!cargando && !error && favoritas.length > 0 && (
        <>
          <section aria-labelledby="campanas-favoritas" className="mb-6 max-md:mb-5">
            <h2 id="campanas-favoritas" className="mb-3 text-lg font-extrabold text-system-900">
              Campañas favoritas
            </h2>
            <div className={vistaCuadricula ? "grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3" : "flex flex-col gap-3"}>
              {favoritas.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} compact={!vistaCuadricula} mobileCompact={vistaCuadricula} hrefAlAbrir={`/campanas/${campaign.id}`} />
              ))}
            </div>
          </section>
          <Separador />
        </>
      )}

      {!cargando && !error && (
        <CampanasParaTi
          id="campanas-para-ti"
          campanas={conParaTi ? paraTiVisibles : []}
          filtros={
            conParaTi && recomendadas.length > 0 ? (
              <FilasDeFiltros
                filtro={filtroParaTi}
                lugar={lugarDelFiltro}
                cercaDeTi={zona !== null}
                esDeMisIntereses={esDeMisIntereses}
                className="mb-4"
              />
            ) : null
          }
          vacio={
            !conParaTi ? (
              // Sin temáticas ni ubicación: el título sigue y debajo va el aviso de ubicación (2026-11-04, a pedido del
              // usuario; el de temáticas pasó arriba de "Campañas favoritas" el 2026-11-10).
              avisoDeUbicacion
            ) : filtroParaTi.activo ? (
              <p className="text-sm text-system-600">
                {filtroParaTi.vista === TU_LOCALIDAD && !lugarDelFiltro
                  ? "Aún no indicas en qué estado vives: agrégalo en Mi cuenta o usa tu ubicación."
                  : "Ninguna campaña recomendada para ti coincide con este filtro."}
              </p>
            ) : (
              <p className="text-sm text-system-600">Por ahora no hay campañas activas de tus temáticas de interés ni de tu zona.</p>
            )
          }
          vistaCuadricula={vistaCuadricula}
          className="mb-6 max-md:mb-5"
        />
      )}

      {!cargando && !error && conParaTi && avisoDeUbicacion}

      {!cargando && !error && <Separador />}

      <h2 id="todas-las-campanas" className="mb-3 text-lg font-extrabold text-system-900">
        Todas las campañas
      </h2>

      {!cargando && !error && (
        <BarraDeFiltros
          valores={{ vista, q: busqueda.q, orden: busqueda.orden, tematica: temaActivo, etiqueta: etiquetaActiva, tipo: tipoActivo }}
          vistas={vistas}
          tematicas={temasConCampanas.map(([tema]) => tema)}
          etiquetasPorTematica={etiquetasPorTema}
          onCambiar={cambiarBusqueda}
          colapsableEnMovil
        />
      )}

      {error ? (
        <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p>
      ) : cargando ? (
        <div role="status" aria-live="polite" className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
          <span className="sr-only">Cargando campañas…</span>
          {Array.from({ length: TARJETAS_DE_CARGA }, (_, i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      ) : vista === TU_LOCALIDAD && !lugarDelFiltro ? (
        <p className="text-sm text-system-600">
          Aún no indicas en qué estado vives.{" "}
          <Link href="/cuenta" className="font-semibold text-brand-600 hover:underline">
            Agrégalo en Mi cuenta
          </Link>{" "}
          o usa tu ubicación para ver las campañas de tu localidad.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-system-600">
          {buscando && porEtiqueta.length > 0
            ? tipoActivo && !busqueda.q.trim()
              ? `Ninguna campaña de esta lista pide ${nombresDeTipos(tipoActivo).toLowerCase()}.`
              : "Ninguna campaña coincide con la búsqueda."
            : temaActivo
              ? "No hay campañas de esta temática en esta lista."
              : vista === FAVORITAS
                ? "Aún no tienes campañas favoritas."
                : vista === TU_LOCALIDAD
                  ? `Por ahora no hay campañas activas en ${lugarDelFiltro}.`
                  : "Todavía no hay campañas activas."}
        </p>
      ) : (
        <div className={vistaCuadricula ? "grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3" : "flex flex-col gap-3"}>
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} compact={!vistaCuadricula} mobileCompact={vistaCuadricula} hrefAlAbrir={`/campanas/${campaign.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
