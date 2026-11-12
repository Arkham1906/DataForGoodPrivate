"use client";

// Formulario de campaña (crear o editar, según ?edit=<id>).
// Crear: POST /api/campanas con status "borrador" o "en_revision".
// Editar: carga con GET /api/campanas?mine=true y guarda con PATCH /api/campanas/[id].
// Qué campos se pueden editar depende del estado; la regla real está en el PATCH (ver docs/datos.md § 3).

import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Field, Input, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import ButtonLink from "@/components/ui/ButtonLink";
import Tag from "@/components/ui/Tag";
import VentanaDeProblemas, { type ProblemaDeFormulario } from "@/components/ui/VentanaDeProblemas";
import SelectorDeTemas from "@/components/ui/SelectorDeTemas";
import SelectorDeEtiquetas from "@/components/ui/SelectorDeEtiquetas";
import RutaDeTematica from "@/components/ui/RutaDeTematica";
import { LARGO_MAXIMO_PROPOSITO_OTRO, PROPOSITOS, validarProposito } from "@/lib/campanas/proposito";
import { MAXIMO_DE_ETIQUETAS_POR_CAMPANA, type CatalogoDeEtiquetas } from "@/lib/etiquetas/reglas";
import type { Campaign, DataType } from "@/types";
import { municipiosDe, NOMBRES_DE_ESTADOS } from "@/lib/mexico-geo";
import { opcionesCon } from "@/lib/perfil-opciones";
import { TEMAS_DE_INTERES } from "@/lib/intereses";
import { BASE_PATH } from "@/lib/base-path";
import { MAX_LARGO_TEXTO, claveDeTexto } from "@/lib/campanas/checklist";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import VentanaDeOrganizacionRequerida from "@/components/campanas/VentanaDeOrganizacionRequerida";
import CampoDeFecha from "@/components/ui/CampoDeFecha";
import AsaDeArrastre, { moverA } from "@/components/ui/AsaDeArrastre";
import { MAX_CAMPANAS_EN_REVISION } from "@/lib/campanas/cola-de-revision";
import { errorDeMaximoSobreLimite } from "@/lib/campanas/cuota-por-tipo";
import { errorDeFinAntesDeInicio, errorDeInicioPasado, fechaDDMMAAAA, hoyEnTepic, inicioEnElFuturo } from "@/lib/fecha-de-tepic";
import { LARGO_MAXIMO_ORGANIZACION } from "@/lib/campanas/organizacion";
import CampoDeOrganizacion from "@/components/ui/CampoDeOrganizacion";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import { GuiaDePasos, TarjetaDePaso, type Paso } from "./PasosDeCampana";
import PedirUbicacion, { type ControlDeUbicacion } from "@/components/ui/PedirUbicacion";
import AvisoSinTematicas from "@/components/campanas/AvisoSinTematicas";
import { AvisoDeUbicacionAlCrear } from "@/components/campanas/AvisoDeUbicacion";
import type { ZonaDetectada } from "@/lib/ubicacion/en-el-navegador";
import { PLURALES_DE_TIPO, repartoSugerido } from "@/lib/campanas/reparto-sugerido";
import { maximosDesdeLaCuota } from "@/lib/campanas/cuota-por-tipo";
import { LIMITE_MAXIMO_POR_TIPO } from "@/lib/campanas/limite-por-tipo";
import { FORMATOS_DE_DOCUMENTO, type FormatoDeDocumento } from "@/lib/aportes/archivo";
import CampanasParecidasDelRechazo from "@/components/campanas/CampanasParecidasDelRechazo";

/** Campos del formulario que pueden tener un problema al guardar (2026-10-27). "general": nada en particular. */
type CampoDeCampana =
  | "nombre"
  | "descripcion"
  | "tematica"
  | "etiquetas"
  | "organizacion"
  | "proposito"
  | "tipos"
  | "checklists"
  | "meta"
  | "cuota"
  | "cuotaPorTipo"
  | "limites"
  | "inicio"
  | "fin"
  | "estado"
  | "municipio"
  | "general";
type Problema = ProblemaDeFormulario & { campo: CampoDeCampana };

function fechaLocalActual(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function suscribirSinCambios(): () => void {
  return () => {};
}

function fechaEnServidor(): string {
  return "";
}

function sumarMeses(fecha: string, meses: number): string {
  // Calcula cada duración desde el día de inicio, conservándolo si cabe en el mes final.
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const indiceMes = anio * 12 + mes - 1 + meses;
  const anioFinal = Math.floor(indiceMes / 12);
  const mesFinal = ((indiceMes % 12) + 12) % 12;
  const diaFinal = Math.min(dia, new Date(Date.UTC(anioFinal, mesFinal + 1, 0)).getUTCDate());
  return `${anioFinal}-${String(mesFinal + 1).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

/** En qué paso está cada campo: el paso se marca en rojo si alguno de sus campos tiene un problema. */
const PASO_DEL_CAMPO: Record<CampoDeCampana, string | null> = {
  nombre: "paso-datos",
  descripcion: "paso-datos",
  tematica: "paso-datos",
  etiquetas: "paso-datos",
  organizacion: "paso-datos",
  proposito: "paso-recoleccion",
  tipos: "paso-recoleccion",
  checklists: "paso-recoleccion",
  meta: "paso-meta",
  cuota: "paso-meta",
  cuotaPorTipo: "paso-meta",
  limites: "paso-meta",
  inicio: "paso-vigencia",
  fin: "paso-vigencia",
  estado: "paso-lugar",
  municipio: "paso-lugar",
  general: null,
};

/** A qué campo se refiere un error del servidor (400), por sus palabras; si no se sabe, "general". */
function campoDelMensaje(mensaje: string): CampoDeCampana {
  const m = mensaje.toLowerCase();
  if (m.includes("propósito") || m.includes("proposito")) return "proposito";
  if (m.includes("por persona") && m.includes("máximo de")) return "cuotaPorTipo";
  if (m.includes("límite") || m.includes("limite")) return "limites";
  if (m.includes("característica") || m.includes("checklist") || m.includes("opción")) return "checklists";
  if (m.includes("tipo de dato") || m.includes("tipos de dato")) return "tipos";
  if (m.includes("etiqueta")) return "etiquetas";
  if (m.includes("temática") || m.includes("tematica")) return "tematica";
  if (m.includes("organización") || m.includes("organizacion")) return "organizacion";
  if (m.includes("descripción") || m.includes("descripcion")) return "descripcion";
  if (m.includes("nombre")) return "nombre";
  if (m.includes("meta")) return "meta";
  if (m.includes("cuota")) return "cuota";
  if (m.includes("municipio")) return "municipio";
  if (m.includes("inicio")) return "inicio";
  if (m.includes("finaliza") || m.includes("cierre") || m.includes("fecha de fin")) return "fin";
  if (m.includes("estado") && !m.includes("campañas en revisión")) return "estado";
  return "general";
}

/** Lleva al campo: lo centra en pantalla y enfoca su primer control (data-campo en el control o su contenedor). */
function irAlCampo(campo: string) {
  const el = document.querySelector<HTMLElement>(`[data-campo="${campo}"]`);
  if (!el) return;
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "center" });
  const enfocable = el.matches("input, select, textarea, button")
    ? el
    : el.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])");
  enfocable?.focus({ preventScroll: true });
}

/** Un checklist en edición; las `clave` solo sirven como key de React (el texto de una opción se edita). */
type OpcionEditable = { clave: number; texto: string };
/** `tipo`: el tipo de dato al que pertenece (2026-10-28); "" = de una campaña anterior, vale para todos. */
type ChecklistEditable = { clave: number; tipo: DataType | ""; titulo: string; opciones: OpcionEditable[]; nuevaOpcion: string };

type BorradorDeCampana = {
  name: string;
  description: string;
  organizer: string;
  proposito: string;
  propositoOtro: string;
  theme: string;
  etiquetas: string[];
  dataTypes: DataType[];
  formatosDeDocumento: FormatoDeDocumento[];
  checklists: ChecklistEditable[];
  goal: string;
  quota: string;
  metaPorTipo: boolean;
  limites: Partial<Record<DataType, string>>;
  topes: Partial<Record<DataType, string>>;
  startDate: string;
  endDate: string;
  duracionEnMeses: number;
  modoFinalizacion: "mensual" | "personalizada";
  fechaFinPersonalizada: string;
  inicioModificado: boolean;
  locationState: string;
  locationCity: string;
  modoDeLugar: ModoDeLugar;
};

function leerBorradorDeCampana(clave: string): Partial<BorradorDeCampana> | null {
  if (typeof window === "undefined") return null;
  try {
    const valor: unknown = JSON.parse(sessionStorage.getItem(clave) ?? "null");
    return valor && typeof valor === "object" ? (valor as Partial<BorradorDeCampana>) : null;
  } catch {
    return null;
  }
}

function borrarBorradorDeCampana(clave: string) {
  try {
    sessionStorage.removeItem(clave);
  } catch {
    // El formulario sigue funcionando aunque el navegador no permita sessionStorage.
  }
}

/** Otra opción de la característica ya dice lo mismo (claveDeTexto: sin mayúsculas, acentos ni espacios de más). */
function opcionYaExiste(c: ChecklistEditable, texto: string, salvo?: number): boolean {
  const clave = claveDeTexto(texto);
  return clave !== "" && c.opciones.some((o) => o.clave !== salvo && claveDeTexto(o.texto) === clave);
}

/** Una opción está repetida si otra de antes en la lista dice lo mismo: se marca la segunda, no la primera. */
function opcionRepetida(c: ChecklistEditable, j: number): boolean {
  const clave = claveDeTexto(c.opciones[j].texto);
  return clave !== "" && c.opciones.slice(0, j).some((o) => claveDeTexto(o.texto) === clave);
}
let siguienteClave = 0;
function nuevoChecklist(titulo = "", opciones: string[] = [], tipo: DataType | "" = ""): ChecklistEditable {
  return { clave: siguienteClave++, tipo, titulo, opciones: opciones.map((texto) => ({ clave: siguienteClave++, texto })), nuevaOpcion: "" };
}

/** Reordena (con el asa ⠿) solo los checklists de un tipo; los demás no se mueven. */
function moverEnGrupo(lista: ChecklistEditable[], tipo: ChecklistEditable["tipo"], de: number, a: number): ChecklistEditable[] {
  const posiciones = lista.flatMap((c, i) => (c.tipo === tipo ? [i] : []));
  const reordenados = moverA(posiciones.map((i) => lista[i]), de, a);
  const copia = [...lista];
  posiciones.forEach((p, k) => {
    copia[p] = reordenados[k];
  });
  return copia;
}


// Las temáticas de campaña son las mismas que los intereses del perfil: el catálogo de
// GET /api/tematicas (las base y las que salen de los textos de los usuarios). Mientras carga,
// o si falla, se ofrecen las base.
const THEMES = TEMAS_DE_INTERES;

const DATA_TYPES: { value: DataType; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "foto", label: "Foto" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "documento", label: "Archivo" },
];

/** "Solo los ve quien manda una foto": cómo se nombra cada tipo en los checklists. */
const QUIEN_MANDA: Record<DataType, string> = {
  texto: "texto",
  foto: "una foto",
  video: "un video",
  audio: "un audio",
  documento: "un archivo",
};

// Opción "Todo el estado" del selector de municipio. Solo vive en el formulario:
// se manda y se guarda como municipio vacío.
const TODO_EL_ESTADO = "__todo_el_estado__";

/** Dónde aplica la campaña: las 4 opciones del paso "Lugar" (2026-11-03). */
type ModoDeLugar = "pais" | "perfil" | "actual" | "manual";

function textoDeZona(zona: ZonaDetectada): string {
  return `${zona.municipio ? `${zona.municipio}, ` : "Todo el estado de "}${zona.estado}`;
}

/** Ruta para `returnTo`, sin basePath: window.location lo trae y router.push lo vuelve a poner. */
function rutaActualParaRegreso(): string {
  if (typeof window === "undefined") return "/mis-campanas/nueva";
  const { pathname, search } = window.location;
  const ruta = BASE_PATH && pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length) : pathname;
  return `${ruta}${search}`;
}

/** Para comparar los máximos por persona sin que importe el orden de los tipos. */
function maximosOrdenados(maximos: Partial<Record<DataType, number>>): [string, number | undefined][] {
  return Object.entries(maximos).sort(([a], [b]) => a.localeCompare(b));
}


const ESTADO_LABELS: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aceptada: "Aceptada",
  activa: "Activa",
  pausada: "Pausada",
  finalizada: "Finalizada",
  rechazada: "Rechazada",
};

function labelEstado(status: string | undefined) {
  return status ? ESTADO_LABELS[status] ?? status : "Borrador";
}

/** Sin temáticas de interés (ventana al abrir) y estado/municipio del perfil (botón de "Lugar"). */
type DatosDelPerfil = { sinTematicas: boolean; zona: ZonaDetectada | null };

export default function NuevaCampanaForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit");
  const restaurarEstado = searchParams.get("restaurar") === "activa";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [cargando, setCargando] = useState(true);
  const [organizacionPerfil, setOrganizacionPerfil] = useState<string | undefined>(undefined);
  // Lo demás del perfil que usa el formulario (2026-11-02), de la misma consulta a la sesión.
  const [perfil, setPerfil] = useState<DatosDelPerfil>({ sinTematicas: false, zona: null });
  const [errorCarga, setErrorCarga] = useState("");

  useEffect(() => {
    let activo = true;

    async function loadCampaigns() {
      try {
        const [response, sesionResponse] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas?mine=true`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" }),
        ]);
        if (!response.ok) throw new Error("No se pudieron cargar tus campañas.");
        const body = await response.json();
        if (activo) setCampaigns(Array.isArray(body.data) ? body.data : []);
        if (!sesionResponse.ok) throw new Error("No se pudo verificar la organización de tu perfil.");
        const sesion = await sesionResponse.json();
        const organizacion = typeof sesion.data?.organizacion === "string"
          ? sesion.data.organizacion.trim()
          : "";
        if (activo) setOrganizacionPerfil(organizacion);
        const intereses: unknown = sesion.data?.intereses;
        const estado: unknown = sesion.data?.state;
        const municipio: unknown = sesion.data?.city;
        if (activo) {
          setPerfil({
            sinTematicas: Array.isArray(intereses) && intereses.length === 0,
            zona:
              typeof estado === "string" && estado.trim()
                ? { estado, municipio: typeof municipio === "string" ? municipio : "" }
                : null,
          });
        }
      } catch (error) {
        if (activo) setErrorCarga(error instanceof Error ? error.message : "No se pudo cargar el formulario.");
      } finally {
        if (activo) setCargando(false);
      }
    }

    loadCampaigns();
    return () => {
      activo = false;
    };
  }, [editId]);

  const editingCampaign = editId ? campaigns.find((campaign) => campaign.id === editId) : undefined;
  // Cola de revisión (2026-11-04): la campaña que se edita no ocupa lugar si ya está en revisión.
  const campanasEnRevision = campaigns.filter((c) => c.status === "en_revision" && c.id !== editId).length;
  const vaARevision =
    !editingCampaign ||
    editingCampaign.status === "borrador" ||
    editingCampaign.status === "rechazada" ||
    (editingCampaign.status === "pausada" && editingCampaign.pausa?.por !== "supervision") ||
    // Programada (2026-11-10): sus cambios amplios vuelven a revisión.
    editingCampaign.status === "aceptada";
  const colaLlena = vaARevision && campanasEnRevision >= MAX_CAMPANAS_EN_REVISION;

  // Mientras carga, no se monta el formulario: sus campos leen
  // editingCampaign una sola vez, al montar (ver CampanaFormulario). Si se
  // montara antes de que llegue la campaña a editar, abriría en blanco.
  if (errorCarga) {
    return (
      <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-5 text-sm text-error-700">
        <p>{errorCarga}</p>
        <ButtonLink href="/mis-campanas" size="sm" className="mt-3">Volver a Mis campañas</ButtonLink>
      </div>
    );
  }

  if (cargando || organizacionPerfil === undefined) {
    return <PantallaEsqueleto tipo="formulario" etiqueta="Cargando el formulario…" />;
  }

  if (!editingCampaign && !organizacionPerfil) {
    return (
      <VentanaDeOrganizacionRequerida
        abierto
        onCancelar={() => router.push("/mis-campanas")}
        onAgregar={() =>
          router.push(
            `/cuenta?resaltarOrganizacion=1&returnTo=${encodeURIComponent(rutaActualParaRegreso())}#organizacion`
          )
        }
      />
    );
  }

  return (
    <CampanaFormulario
      key={editingCampaign?.id ?? "nueva"}
      editingCampaign={editingCampaign}
      organizacionPerfil={organizacionPerfil}
      perfil={perfil}
      campanasEnRevision={campanasEnRevision}
      colaLlena={colaLlena}
      restaurarEstado={restaurarEstado}
    />
  );
}

function CampanaFormulario({
  editingCampaign,
  organizacionPerfil,
  perfil,
  campanasEnRevision,
  colaLlena,
  restaurarEstado,
}: {
  editingCampaign: Campaign | undefined;
  organizacionPerfil: string;
  perfil: DatosDelPerfil;
  campanasEnRevision: number;
  colaLlena: boolean;
  restaurarEstado: boolean;
}) {
  const router = useRouter();
  const claveBorrador = `dfg:campana-borrador:${editingCampaign?.id ?? "nueva"}`;
  const borradorLeido = useRef(false);
  const restaurandoBorrador = useRef(false);

  // Reglas de edición por estado (dominio.md): una campaña en revisión o
  // rechazada se puede editar por completo y reenviar; activa, pausada o
  // aceptada (aprobada, esperando su fecha de inicio) solo permiten ajustar
  // meta y fecha de finalización, sin tocar su estado; pausada permite casi
  // todo y al guardar pasa a revisión, salvo que solo cambien meta/límites o fin;
  // aceptada (programada, 2026-11-10) igual que la pausada, y también puede mover su inicio;
  // finalizada queda en solo lectura.
  const status = editingCampaign?.status;
  const soloLectura = status === "finalizada";
  const edicionLimitada = status === "activa" || status === "pausada" || status === "aceptada";
  const edicionCompleta = !edicionLimitada && !soloLectura;
  const editaEnPausa = status === "pausada";
  // Aceptada que espera su inicio: se edita como la pausada (2026-11-10, a pedido del usuario).
  const editaProgramada = status === "aceptada";
  const edicionAmplia = editaEnPausa || editaProgramada;
  // La que pausó la supervisión sigue pausada al guardar: solo la supervisión la reanuda (2026-11-04).
  const pausadaPorSupervision = editaEnPausa && editingCampaign?.pausa?.por === "supervision";
  const enviarRevisionAlGuardar = (editaEnPausa && !pausadaPorSupervision) || editaProgramada;
  // Lo que solo se edita por completo, en pausa o programada (nombre, temática, tipos, cuota, ubicación).
  const contenidoBloqueado = edicionLimitada && !edicionAmplia;

  const [name, setName] = useState(editingCampaign?.name ?? "");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [mostrarSelectorBanner, setMostrarSelectorBanner] = useState(!editingCampaign?.hasBanner);
  const [description, setDescription] = useState(editingCampaign?.description ?? "");
  const [organizer, setOrganizer] = useState(editingCampaign?.organizer ?? organizacionPerfil);
  // Propósito: ¿para qué se usarán los datos? (2026-10-27). Uno de la lista u "Otro" con una frase.
  const [proposito, setProposito] = useState(editingCampaign?.proposito ?? "");
  const [propositoOtro, setPropositoOtro] = useState(editingCampaign?.propositoOtro ?? "");
  useEffect(() => {
    return () => {
      if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    };
  }, [bannerPreviewUrl]);
  // Una campaña nueva empieza sin temática, sin tipos de dato y con meta y cuota vacías
  // (2026-10-21, a pedido del usuario; antes venían "Medio ambiente", Foto, 500 y 10).
  const [theme, setTheme] = useState(editingCampaign?.tag ?? "");
  const [catalogoDeTemas, setCatalogoDeTemas] = useState<string[]>(THEMES);
  // Las que propuso esta persona y siguen sin revisar (2026-10-29): se marcan "por aprobar".
  const [tematicasPropias, setTematicasPropias] = useState<string[]>([]);
  useEffect(() => {
    let vigente = true;
    fetch(`${BASE_PATH}/api/tematicas`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (vigente && Array.isArray(body?.data)) setCatalogoDeTemas(body.data as string[]);
        if (vigente && Array.isArray(body?.propias)) setTematicasPropias(body.propias as string[]);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);
  // Temática propuesta en este formulario (2026-10-29): no está en el catálogo ni es la que la campaña
  // ya tenía. Se manda `tematicaNueva` y el servidor la da de alta pendiente de aprobar.
  const esTematicaNueva = Boolean(theme) && theme !== (editingCampaign?.tag ?? "") && !catalogoDeTemas.includes(theme);
  // Etiquetas: subtemáticas de la temática (2026-10-27), opcionales. El catálogo sale de
  // GET /api/etiquetas; cambiar de temática las vacía.
  const [etiquetas, setEtiquetas] = useState<string[]>(() => (editingCampaign?.etiquetas ?? []).map((e) => e.nombre));
  const etiquetasPendientes = (editingCampaign?.etiquetas ?? []).filter((e) => e.pendiente).map((e) => e.nombre);
  const [catalogoDeEtiquetas, setCatalogoDeEtiquetas] = useState<CatalogoDeEtiquetas>({});
  useEffect(() => {
    let vigente = true;
    fetch(`${BASE_PATH}/api/etiquetas`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (vigente && body?.data && typeof body.data === "object") {
          // Solo las aprobadas: las pendientes que trae (2026-10-28) son las de su perfil; las de su
          // campaña ya vienen en editingCampaign.etiquetas.
          const catalogo = body.data as CatalogoDeEtiquetas;
          setCatalogoDeEtiquetas(
            Object.fromEntries(Object.entries(catalogo).map(([tema, lista]) => [tema, lista.filter((e) => !e.pendiente)]))
          );
        }
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);
  const [dataTypes, setDataTypes] = useState<DataType[]>(editingCampaign?.dataTypes ?? []);
  // Formatos de "Archivo" que acepta la campaña (2026-10-28, a pedido del usuario): se eligen al marcar
  // "Archivo"; ninguno marcado = todos (PDF, Word, PowerPoint y Excel).
  const [formatosDeDocumento, setFormatosDeDocumento] = useState<FormatoDeDocumento[]>(editingCampaign?.formatosDeDocumento ?? []);
  function alternarFormato(formato: FormatoDeDocumento) {
    setFormatosDeDocumento((actuales) =>
      actuales.includes(formato) ? actuales.filter((f) => f !== formato) : [...actuales, formato]
    );
  }
  // Sin ejemplos: una campaña nueva empieza sin checklists. Los de campañas
  // viejas (lista plana, sin título) se titulan "Checklist" para poder guardarlos.
  const [checklists, setChecklists] = useState<ChecklistEditable[]>(
    () =>
      (editingCampaign?.checklistSecciones ?? []).map((s) => nuevoChecklist(s.titulo || "Características", s.opciones, s.tipo ?? ""))
  );
  // Un borrador guardado sin meta o sin cuota trae 0: se muestra vacío, no "0".
  const [goal, setGoal] = useState(editingCampaign?.goalContributions ? String(editingCampaign.goalContributions) : "");
  const [quota, setQuota] = useState(editingCampaign?.quotaPerUser ? String(editingCampaign.quotaPerUser) : "");
  // Sin reparto de la cuota por tipo desde el 2026-10-27 (a pedido del usuario): la cuota vale
  // para cualquier tipo y debajo solo se muestra un reparto sugerido (lib/campanas/reparto-sugerido.ts).
  const sugerencia = repartoSugerido(Number(quota), dataTypes);
  // Cómo se mide la meta (2026-10-28, a pedido del usuario; lib/campanas/limite-por-tipo.ts): por defecto
  // POR TIPO DE DATO (cada tipo con su límite total, obligatorio; la meta es la suma) o META GENERAL (un
  // total de aprobados, sin límites por tipo). Una campaña que ya existe sin límites queda en meta general.
  // Meta y límites se pueden cambiar también con la campaña activa o aceptada.
  const [metaPorTipo, setMetaPorTipo] = useState(
    () => !editingCampaign || Object.keys(editingCampaign.limitePorTipo ?? {}).length > 0
  );
  const [limites, setLimites] = useState<Partial<Record<DataType, string>>>(() =>
    Object.fromEntries(Object.entries(editingCampaign?.limitePorTipo ?? {}).map(([tipo, n]) => [tipo, String(n)]))
  );
  // Solo de los tipos marcados (los de un tipo que se desmarcó no se guardan), y solo con meta por tipo.
  const limitePorTipo: Partial<Record<DataType, number>> = metaPorTipo
    ? Object.fromEntries(dataTypes.filter((t) => (limites[t] ?? "").trim() !== "").map((t) => [t, Number(limites[t])]))
    : {};
  const sumaDeLimites = Object.values(limitePorTipo).reduce((total, n) => total + (Number.isInteger(n) && n > 0 ? n : 0), 0);
  // Máximo por persona de cada tipo (2026-10-31, a pedido del usuario; lib/campanas/cuota-por-tipo.ts).
  // Con meta POR TIPO no hay campo de cuota: cada tipo lleva su máximo (obligatorio, también con un solo
  // tipo) y la cuota por persona es la suma. Con META GENERAL no hay máximos por tipo, solo la cuota escrita
  // (a pedido del usuario, el mismo día). Lo escrito en los máximos se conserva si se vuelve a "Por tipo".
  // Una campaña con meta por tipo guardada antes de los máximos abre con su cuota repartida entre sus tipos
  // (la suma da la misma cuota); si no, al editarla pedía "Falta el máximo de fotos por persona".
  const [topes, setTopes] = useState<Partial<Record<DataType, string>>>(() => {
    const guardados = editingCampaign?.cuotaPorTipo ?? {};
    const iniciales =
      editingCampaign && metaPorTipo && Object.keys(guardados).length === 0
        ? maximosDesdeLaCuota(editingCampaign.dataTypes, editingCampaign.quotaPerUser)
        : guardados;
    return Object.fromEntries(Object.entries(iniciales).map(([tipo, n]) => [tipo, String(n)]));
  });
  const cuotaPorTipo: Partial<Record<DataType, number>> = metaPorTipo
    ? Object.fromEntries(dataTypes.filter((t) => (topes[t] ?? "").trim() !== "").map((t) => [t, Number(topes[t])]))
    : {};
  const sumaDeMaximos = Object.values(cuotaPorTipo).reduce((total, n) => total + (Number.isInteger(n) && n > 0 ? n : 0), 0);
  /** La cuota que se guarda: la suma de los máximos (por tipo) o la que escribió (general). */
  const cuotaFinal = metaPorTipo ? sumaDeMaximos : Number(quota);
  function validarTopes(): string | null {
    for (const [tipo, n] of Object.entries(cuotaPorTipo)) {
      const plural = PLURALES_DE_TIPO[tipo as DataType][1];
      if (!Number.isInteger(n) || n < 1) return `El máximo de ${plural} por persona debe ser un número entero mayor a 0`;
    }
    // Una activa o aceptada no puede cambiar sus máximos: no se le exige corregirlos.
    return metaPorTipo && !contenidoBloqueado ? errorDeMaximoSobreLimite(cuotaPorTipo, limitePorTipo) : null;
  }
  function faltaMaximo(): string | null {
    const falta = DATA_TYPES.find((d) => dataTypes.includes(d.value) && !cuotaPorTipo[d.value]);
    return falta ? `Falta el máximo de ${PLURALES_DE_TIPO[falta.value][1]} por persona` : null;
  }
  /** Cuota completa: por tipo, cada tipo con su máximo; general, la cuota escrita. */
  function errorDeCuota(): { campo: CampoDeCampana; mensaje: string } | null {
    if (metaPorTipo) {
      const error = validarTopes() ?? faltaMaximo();
      return error ? { campo: "cuotaPorTipo", mensaje: error } : null;
    }
    if (!Number(quota) || Number(quota) <= 0) return { campo: "cuota", mensaje: "La cuota por persona debe ser mayor a 0" };
    return null;
  }
  /** La meta que se guarda: la suma de los límites (por tipo) o la que escribió (general). */
  const metaFinal = metaPorTipo ? sumaDeLimites : Number(goal);
  function faltaLimite(): string | null {
    const falta = DATA_TYPES.find((d) => dataTypes.includes(d.value) && !limitePorTipo[d.value]);
    return falta ? `Falta el límite de ${PLURALES_DE_TIPO[falta.value][1]}` : null;
  }
  function validarLimites(): string | null {
    for (const [tipo, n] of Object.entries(limitePorTipo)) {
      if (!Number.isInteger(n) || n < 1 || n > LIMITE_MAXIMO_POR_TIPO) {
        return `El límite de ${PLURALES_DE_TIPO[tipo as DataType][1]} debe ser un número entero mayor a 0`;
      }
    }
    return null;
  }
  const [startDate, setStartDate] = useState(editingCampaign?.startDate ?? "");
  const [endDate, setEndDate] = useState(editingCampaign?.endDate ?? "");
  const endTime = editingCampaign?.endTime ?? "";
  const [duracionEnMeses, setDuracionEnMeses] = useState(1);
  const [modoFinalizacion, setModoFinalizacion] = useState<"mensual" | "personalizada">("mensual");
  const [fechaFinPersonalizada, setFechaFinPersonalizada] = useState("");
  const hoyLocal = useSyncExternalStore(suscribirSinCambios, fechaLocalActual, fechaEnServidor);
  const [inicioModificado, setInicioModificado] = useState(false);
  const fechaInicioFormulario = startDate || (!editingCampaign && !inicioModificado ? hoyLocal : "");
  // Solo la programada puede mover su inicio (la pausada lo tiene bloqueado en el formulario).
  const inicioMovido = edicionAmplia && startDate !== (editingCampaign?.startDate ?? "");
  const fechaFinFormulario =
    editingCampaign
      ? endDate
      : modoFinalizacion === "personalizada"
        ? fechaFinPersonalizada
        : endDate || (fechaInicioFormulario ? sumarMeses(fechaInicioFormulario, duracionEnMeses) : "");
  const [locationState, setLocationState] = useState(editingCampaign?.locationState ?? "");
  // Una campaña guardada con estado y sin municipio abarca todo el estado.
  const [locationCity, setLocationCity] = useState(
    editingCampaign?.locationCity || (editingCampaign?.locationState ? TODO_EL_ESTADO : "")
  );
  const municipioReal = locationCity === TODO_EL_ESTADO ? "" : locationCity;
  // Paso "Lugar" (2026-11-03, a pedido del usuario): una de 4 opciones. Una campaña nueva empieza en "Para todo el
  // país" (sin estado ni municipio); al editar, en esa si la tiene y si no en "manual", con los suyos.
  const [modoDeLugar, setModoDeLugar] = useState<ModoDeLugar>(
    editingCampaign && !editingCampaign.todoElPais ? "manual" : "pais"
  );

  useEffect(() => {
    const guardado = leerBorradorDeCampana(claveBorrador);
    borradorLeido.current = true;
    if (!guardado) return;

    restaurandoBorrador.current = true;
    startTransition(() => {
      if (guardado.name !== undefined) setName(guardado.name);
      if (guardado.description !== undefined) setDescription(guardado.description);
      if (guardado.organizer !== undefined) setOrganizer(guardado.organizer || organizacionPerfil);
      if (guardado.proposito !== undefined) setProposito(guardado.proposito);
      if (guardado.propositoOtro !== undefined) setPropositoOtro(guardado.propositoOtro);
      if (guardado.theme !== undefined) setTheme(guardado.theme);
      if (guardado.etiquetas !== undefined) setEtiquetas(guardado.etiquetas);
      if (guardado.dataTypes !== undefined) setDataTypes(guardado.dataTypes);
      if (guardado.formatosDeDocumento !== undefined) setFormatosDeDocumento(guardado.formatosDeDocumento);
      if (guardado.checklists !== undefined) setChecklists(guardado.checklists);
      if (guardado.goal !== undefined) setGoal(guardado.goal);
      if (guardado.quota !== undefined) setQuota(guardado.quota);
      if (guardado.metaPorTipo !== undefined) setMetaPorTipo(guardado.metaPorTipo);
      if (guardado.limites !== undefined) setLimites(guardado.limites);
      if (guardado.topes !== undefined) setTopes(guardado.topes);
      if (!edicionLimitada && guardado.startDate !== undefined) setStartDate(guardado.startDate);
      if (guardado.endDate !== undefined) setEndDate(guardado.endDate);
      if (guardado.duracionEnMeses !== undefined) setDuracionEnMeses(guardado.duracionEnMeses);
      if (guardado.modoFinalizacion !== undefined) setModoFinalizacion(guardado.modoFinalizacion);
      if (guardado.fechaFinPersonalizada !== undefined) setFechaFinPersonalizada(guardado.fechaFinPersonalizada);
      if (!editingCampaign && guardado.inicioModificado !== undefined) setInicioModificado(guardado.inicioModificado);
      if (guardado.locationState !== undefined) setLocationState(guardado.locationState);
      if (guardado.locationCity !== undefined) setLocationCity(guardado.locationCity);
      if (guardado.modoDeLugar !== undefined) setModoDeLugar(guardado.modoDeLugar);
    });
  }, [claveBorrador, editingCampaign, edicionLimitada, organizacionPerfil]);

  useEffect(() => {
    if (!borradorLeido.current) return;
    if (restaurandoBorrador.current) {
      restaurandoBorrador.current = false;
      return;
    }

    try {
      sessionStorage.setItem(
        claveBorrador,
        JSON.stringify({
          name,
          description,
          organizer,
          proposito,
          propositoOtro,
          theme,
          etiquetas,
          dataTypes,
          formatosDeDocumento,
          checklists,
          goal,
          quota,
          metaPorTipo,
          limites,
          topes,
          startDate,
          endDate,
          duracionEnMeses,
          modoFinalizacion,
          fechaFinPersonalizada,
          inicioModificado,
          locationState,
          locationCity,
          modoDeLugar,
        } satisfies BorradorDeCampana)
      );
    } catch {
      // La persistencia es una ayuda de navegación; no debe impedir llenar la campaña.
    }
  }, [
    claveBorrador,
    name,
    description,
    organizer,
    proposito,
    propositoOtro,
    theme,
    etiquetas,
    dataTypes,
    formatosDeDocumento,
    checklists,
    goal,
    quota,
    metaPorTipo,
    limites,
    topes,
    startDate,
    endDate,
    duracionEnMeses,
    modoFinalizacion,
    fechaFinPersonalizada,
    inicioModificado,
    locationState,
    locationCity,
    modoDeLugar,
  ]);
  const todoElPais = modoDeLugar === "pais";
  // Campaña nueva (2026-11-02, a pedido del usuario): si no tiene temáticas de interés, el recuadro
  // campanas/AvisoSinTematicas arriba del formulario.
  const sinTematicas = !editingCampaign && perfil.sinTematicas;
  // Estado y municipio del perfil con los nombres del catálogo; null si no tiene estado (la opción sale desactivada).
  const zonaDelPerfil = perfil.zona ? zonaDelCatalogo(perfil.zona) : null;
  const [buscandoZona, setBuscandoZona] = useState(false);
  const [avisoDeZona, setAvisoDeZona] = useState<{ ok: boolean; texto: string } | null>(null);
  const ubicacion = useRef<ControlDeUbicacion>(null);
  // Sigue en "Mi ubicación actual": una respuesta que llega después de cambiar de opción se ignora.
  const esperandoUbicacion = useRef(false);
  const [reactivando, setReactivando] = useState(false);
  const [reactivarError, setReactivarError] = useState<string | null>(null);
  // Por qué no se puede guardar (2026-10-27, a pedido del usuario): al intentar guardar se juntan
  // todos los problemas (problemasDe), se marcan sus campos y pasos en rojo y se explican en una
  // ventana de la app (ui/VentanaDeProblemas). Después del primer intento se recalculan mientras se
  // corrige; los del servidor (400) se quedan hasta el siguiente intento.
  const [intento, setIntento] = useState<"borrador" | "revision" | "reanudar" | null>(null);
  const [problemasDelServidor, setProblemasDelServidor] = useState<Problema[]>([]);
  const [ventanaDeProblemas, setVentanaDeProblemas] = useState<Problema[] | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [mostrarConfirmacionDeCancelacion, setMostrarConfirmacionDeCancelacion] = useState(false);
  const [errorDeCancelacion, setErrorDeCancelacion] = useState<string | null>(null);
  const propositoEditado =
    proposito !== (editingCampaign?.proposito ?? "") ||
    propositoOtro !== (editingCampaign?.propositoOtro ?? "");

  async function cancelarFormulario() {
    if (cancelando) return;
    setCancelando(true);
    setErrorDeCancelacion(null);
    try {
      if (editingCampaign && restaurarEstado) {
        const response = await fetch(`${BASE_PATH}/api/campanas/${encodeURIComponent(editingCampaign.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "activa" }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudo restaurar la campaña");
      }
      borrarBorradorDeCampana(claveBorrador);
      router.push("/mis-campanas");
    } catch (error) {
      setErrorDeCancelacion(error instanceof Error ? error.message : "No se pudo cancelar la edición");
      setCancelando(false);
    }
  }

  const checklistActual = checklists
    .filter((c) => !c.tipo || dataTypes.includes(c.tipo))
    .map((c) => ({
    titulo: c.titulo.trim(),
    opciones: c.opciones.map((o) => o.texto.trim()),
    ...(c.tipo ? { tipo: c.tipo } : {}),
    }));
  const checklistOriginal = (editingCampaign?.checklistSecciones ?? []).map((c) => ({
    titulo: c.titulo.trim(),
    opciones: c.opciones.map((o) => o.trim()),
    ...(c.tipo ? { tipo: c.tipo } : {}),
  }));
  // Los máximos con los que abrió el formulario: una campaña con meta por tipo sin máximos guardados
  // abre con su cuota repartida (ver `topes`), y eso no cuenta como un cambio.
  const metaPorTipoOriginal = Object.keys(editingCampaign?.limitePorTipo ?? {}).length > 0;
  const maximosGuardados = editingCampaign?.cuotaPorTipo ?? {};
  const maximosOriginales: Partial<Record<DataType, number>> =
    !editingCampaign || !metaPorTipoOriginal
      ? {}
      : Object.keys(maximosGuardados).length > 0
        ? maximosGuardados
        : maximosDesdeLaCuota(editingCampaign.dataTypes, editingCampaign.quotaPerUser);
  // La cuota y sus máximos sí cuentan como cambio amplio (2026-11-07): "Guardar y reanudar" no los
  // manda, y antes ese cambio se perdía sin avisar.
  const cambioBanner = Boolean(bannerFile);
  const soloMetaYFechaCambiables =
    edicionAmplia &&
    !pausadaPorSupervision &&
    !cambioBanner &&
    !inicioMovido &&
    cuotaFinal === (editingCampaign?.quotaPerUser ?? 0) &&
    JSON.stringify(maximosOrdenados(cuotaPorTipo)) === JSON.stringify(maximosOrdenados(maximosOriginales)) &&
    JSON.stringify({
      name,
      description,
      organizer: organizer.trim(),
      theme,
      etiquetas,
      dataTypes,
      formatosDeDocumento,
      checklist: checklistActual,
      proposito,
      propositoOtro,
      todoElPais,
      locationState,
      locationCity: municipioReal,
    }) ===
      JSON.stringify({
        name: editingCampaign?.name ?? "",
        description: editingCampaign?.description ?? "",
        organizer: editingCampaign?.organizer ?? "",
        theme: editingCampaign?.tag ?? "",
        etiquetas: (editingCampaign?.etiquetas ?? []).map((e) => e.nombre),
        dataTypes: editingCampaign?.dataTypes ?? [],
        formatosDeDocumento: editingCampaign?.formatosDeDocumento ?? [],
        checklist: checklistOriginal,
        proposito: editingCampaign?.proposito ?? "",
        propositoOtro: editingCampaign?.propositoOtro ?? "",
        todoElPais: editingCampaign?.todoElPais ?? false,
        locationState: editingCampaign?.locationState ?? "",
        locationCity: editingCampaign?.locationCity ?? "",
      });

  // Una pausada no se guarda como borrador: con la cola llena, sigue pausada sin estos cambios.
  // Lo que dice el botón principal: la programada que solo cambia meta/límites o fin se guarda sin revisión.
  const vaARevisionAlGuardar = !edicionLimitada || (enviarRevisionAlGuardar && !(editaProgramada && soloMetaYFechaCambiables)) || (cambioBanner && !pausadaPorSupervision);
  const avisoDeColaLlena = edicionAmplia
    ? `Ya tienes ${MAX_CAMPANAS_EN_REVISION} campañas en revisión: no puedes enviar estos cambios hasta que la supervisión acepte o rechace alguna`
    : `Ya tienes ${MAX_CAMPANAS_EN_REVISION} campañas en revisión: guárdala como borrador y envíala cuando la supervisión acepte o rechace alguna`;

  function cambiarInicio(fecha: string) {
    setInicioModificado(true);
    setStartDate(fecha);
    if (!editingCampaign) setEndDate(fecha ? sumarMeses(fecha, duracionEnMeses) : "");
  }

  function cambiarDuracion(meses: number) {
    const nuevaDuracion = Math.max(1, duracionEnMeses + meses);
    setDuracionEnMeses(nuevaDuracion);
    if (fechaInicioFormulario) setEndDate(sumarMeses(fechaInicioFormulario, nuevaDuracion));
  }

  async function handleReactivar() {
    if (!editingCampaign || !endDate) return;

    if (!inicioEnElFuturo(endDate, endTime)) {
      setReactivarError("Elige una fecha de finalización futura según el horario que ya tiene la campaña.");
      return;
    }

    setReactivando(true);
    setReactivarError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${editingCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "activa", endDate }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo reactivar la campaña");
      }
      router.push("/mis-campanas");
    } catch (error) {
      setReactivarError(error instanceof Error ? error.message : "No se pudo reactivar la campaña");
      setReactivando(false);
    }
  }

  function cambiarEstado(nuevoEstado: string) {
    setLocationState(nuevoEstado);
    // El municipio pertenece al estado anterior: no tiene sentido conservarlo.
    setLocationCity("");
    setAvisoDeZona(null); // Ya no es la zona que decía el aviso.
  }

  function cambiarMunicipio(nuevoMunicipio: string) {
    setLocationCity(nuevoMunicipio);
    setAvisoDeZona(null);
  }

  // Zona con los nombres del catálogo (lib/mexico-geo), sin importar acentos ni mayúsculas; null si el
  // estado no está en el catálogo (municipio "" si el municipio no está).
  function zonaDelCatalogo(zona: ZonaDetectada): ZonaDetectada | null {
    const clave = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
    const estado = NOMBRES_DE_ESTADOS.find((e) => clave(e) === clave(zona.estado));
    if (!estado) return null;
    const municipio = municipiosDe(estado).find((m) => clave(m) === clave(zona.municipio));
    return { estado, municipio: municipio ?? "" };
  }

  // Pone la zona en la campaña; sin municipio, "Todo el estado".
  function ponerZona(zona: ZonaDetectada) {
    setLocationState(zona.estado);
    setLocationCity(zona.municipio || TODO_EL_ESTADO);
  }

  // Las 4 opciones del paso "Lugar". El perfil y la ubicación actual llenan estado y municipio; "manual" conserva
  // lo que hubiera para poder ajustarlo.
  function elegirLugar(modo: ModoDeLugar) {
    setModoDeLugar(modo);
    setAvisoDeZona(null);
    esperandoUbicacion.current = modo === "actual";
    if (modo === "perfil" && zonaDelPerfil) ponerZona(zonaDelPerfil);
    if (modo === "actual") ubicacion.current?.pedir();
  }

  function recibirUbicacion(zonaDetectada: ZonaDetectada) {
    if (!esperandoUbicacion.current) return;
    const zona = zonaDelCatalogo(zonaDetectada);
    if (!zona) {
      sinUbicacion("No reconocimos tu ubicación.");
      return;
    }
    ponerZona(zona);
    setAvisoDeZona({ ok: true, texto: `Usamos tu ubicación actual: ${textoDeZona(zona)}.` });
  }

  // No se pudo o no quiso compartirla: pasa a "Elegir manualmente" y le dice por qué.
  function sinUbicacion(motivo: string) {
    if (!esperandoUbicacion.current) return;
    esperandoUbicacion.current = false;
    setModoDeLugar("manual");
    setAvisoDeZona({ ok: false, texto: `${motivo} Elige el estado y el municipio a mano.` });
  }

  function toggleDataType(type: DataType) {
    const nuevos = dataTypes.includes(type) ? dataTypes.filter((t) => t !== type) : [...dataTypes, type];
    setDataTypes(nuevos);
  }

  function cambiarChecklist(clave: number, cambios: Partial<ChecklistEditable>) {
    setChecklists((prev) => prev.map((c) => (c.clave === clave ? { ...c, ...cambios } : c)));
  }

  function agregarOpcion(clave: number) {
    setChecklists((prev) =>
      prev.map((c) => {
        const valor = c.nuevaOpcion.trim();
        if (c.clave !== clave || !valor || opcionYaExiste(c, valor)) return c;
        return { ...c, opciones: [...c.opciones, { clave: siguienteClave++, texto: valor }], nuevaOpcion: "" };
      })
    );
  }

  function cambiarOpciones(clave: number, cambiar: (opciones: OpcionEditable[]) => OpcionEditable[]) {
    setChecklists((prev) => prev.map((c) => (c.clave === clave ? { ...c, opciones: cambiar(c.opciones) } : c)));
  }

  const gruposDeChecklists: { tipo: ChecklistEditable["tipo"]; nombre: string; titulo: string; detalle: string }[] = [
    ...(checklists.some((c) => c.tipo === "")
      ? [{ tipo: "" as const, nombre: "", titulo: "Para cualquier tipo de dato", detalle: "Son de antes de que las características fueran por tipo: las ve todo aporte." }]
      : []),
    ...DATA_TYPES.filter((d) => dataTypes.includes(d.value)).map((d) => ({
      tipo: d.value,
      nombre: d.label.toLowerCase(),
      titulo: `Características de ${d.label.toLowerCase()}`,
      detalle: `Solo los ve quien manda ${QUIEN_MANDA[d.value]}.`,
    })),
  ];

  // Los de un tipo que se desmarcó se conservan en pantalla (vuelven si se marca otra vez), pero no se validan ni se guardan.
  const checklistsVigentes = checklists.filter((c) => !c.tipo || dataTypes.includes(c.tipo));

  function validarChecklists(): string | null {
    const vistos: ChecklistEditable[] = [];
    for (const c of checklistsVigentes) {
      const titulo = c.titulo.trim();
      const delTipo = c.tipo ? ` de ${(DATA_TYPES.find((d) => d.value === c.tipo)?.label ?? c.tipo).toLowerCase()}` : "";
      const nombre = titulo ? `"${titulo}"${delTipo}` : `número ${checklists.filter((x) => x.tipo === c.tipo).indexOf(c) + 1}${delTipo}`;
      if (!titulo) return `La característica ${nombre} necesita un título`;
      if (c.opciones.length === 0) return `La característica ${nombre} no tiene opciones`;
      // Un aporte ve los de su tipo y los generales: ahí no se repiten títulos (las respuestas son "Título: opción").
      if (vistos.some((v) => claveDeTexto(v.titulo) === claveDeTexto(titulo) && (!v.tipo || !c.tipo || v.tipo === c.tipo))) {
        return `Hay dos características con el título ${nombre}`;
      }
      vistos.push(c);
      // Las opciones ya se editan: ni vacías ni repetidas (el servidor las quitaría sin avisar).
      const opciones = new Set<string>();
      for (const o of c.opciones) {
        const texto = o.texto.trim();
        if (!texto) return `La característica ${nombre} tiene una opción vacía: escríbela o quítala`;
        if (opciones.has(claveDeTexto(texto))) return `La característica ${nombre} repite la opción "${texto}"`;
        opciones.add(claveDeTexto(texto));
      }
    }
    return null;
  }

  if (soloLectura) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-system-900">{name}</h1>
            <p className="mt-1 text-[13px] text-system-600">
              {"Esta campaña ya finalizó y queda en solo lectura: no se puede editar. Para reactivarla, primero define una nueva fecha de finalización."}
            </p>
          </div>
          <Tag>Finalizada</Tag>
        </div>

        {reactivarError && (
          <div className="mb-4 max-w-lg rounded-lg bg-error-50 p-4 text-[12.5px] text-error-700">
            {reactivarError}
          </div>
        )}

        <div className="mb-4 max-w-md">
          <Field
            label="Nueva fecha de finalización"
            required
            hint="La campaña conservará su horario de finalización actual."
          >
            <CampoDeFecha
              value={endDate}
              aria-label="Nueva fecha de finalización"
              onChange={setEndDate}
              required
            />
          </Field>
        </div>

        <div className="flex gap-2.5">
          <Link href="/mis-campanas">
            <Button>Volver a mis campañas</Button>
          </Link>
          <Button
            variant="primary"
            onClick={handleReactivar}
            disabled={reactivando || !endDate}
          >
            {reactivando ? "Reactivando..." : "Reactivar campaña"}
          </Button>
        </div>
      </div>
    );
  }

  // Solo se exige completo al enviar a revisión o al editar una campaña ya
  // aceptada/activa/pausada: un borrador puede quedar a medias a propósito
  // (es justo lo que permite seguir trabajando con la cola de revisión llena).
  function problemasDe(asDraft: boolean, reanudar = false): Problema[] {
    const lista: Problema[] = [];
    const agregar = (campo: CampoDeCampana, mensaje: string | null | undefined) => {
      if (mensaje && !lista.some((p) => p.campo === campo && p.mensaje === mensaje)) lista.push({ campo, mensaje });
    };
    const vacio = (n: string) => !Number(n) || Number(n) <= 0;
    // Por tipo: cada tipo marcado con su límite. General: la meta escrita.
    const revisarMeta = () => {
      if (metaPorTipo) agregar("limites", validarLimites() ?? faltaLimite());
      else if (vacio(goal)) agregar("meta", "La meta de aportes debe ser mayor a 0");
    };

    if (soloMetaYFechaCambiables) {
      revisarMeta();
      if (!fechaFinFormulario) agregar("fin", "Falta la fecha de finalización");
      else agregar("fin", errorDeFinAntesDeInicio(fechaInicioFormulario, fechaFinFormulario));
      // Reanudada con el cierre vencido, se finalizaría sola en el siguiente minuto.
      if (reanudar && fechaFinFormulario && !inicioEnElFuturo(fechaFinFormulario, endTime)) {
        agregar("fin", "La fecha de finalización ya pasó: pon una futura para reanudar la campaña");
      }
      return lista;
    }
    if (edicionAmplia) {
      if (!name.trim()) agregar("nombre", "Falta el nombre de la campaña");
      if (!description.trim()) agregar("descripcion", "Falta la descripción");
      if (!theme) agregar("tematica", "Elige una temática");
      if (dataTypes.length === 0) agregar("tipos", "Selecciona al menos un tipo de dato");
      agregar("checklists", validarChecklists());
      revisarMeta();
      const cuotaIncompleta = errorDeCuota();
      if (cuotaIncompleta) agregar(cuotaIncompleta.campo, cuotaIncompleta.mensaje);
      if (!fechaInicioFormulario) agregar("inicio", "Falta la fecha de inicio");
      else if (inicioMovido) agregar("inicio", errorDeInicioPasado(fechaInicioFormulario));
      if (!fechaFinFormulario) agregar("fin", "Falta la fecha de finalización");
      else agregar("fin", errorDeFinAntesDeInicio(fechaInicioFormulario, fechaFinFormulario));
      if (!todoElPais && !locationState) agregar("estado", "Selecciona un estado o elige \"Para todo el país\"");
      else if (!todoElPais && !locationCity) agregar("municipio", "Selecciona un municipio o \"Todo el estado\"");
      if (colaLlena) agregar("general", avisoDeColaLlena);
      // Con el cierre vencido, al aprobarse se activaría y finalizaría sola (2026-11-04).
      if (enviarRevisionAlGuardar && fechaFinFormulario && !inicioEnElFuturo(fechaFinFormulario, endTime)) {
        agregar("fin", "La fecha de finalización ya pasó: pon una nueva para enviarla a revisión");
      }
      if (propositoEditado || enviarRevisionAlGuardar) {
        const validado = validarProposito(proposito, propositoOtro, true);
        if (!validado.ok) agregar("proposito", validado.error);
      }
      return lista;
    }
    if (edicionLimitada) {
      revisarMeta();
      if (!fechaFinFormulario) agregar("fin", "Falta la fecha de finalización");
      else agregar("fin", errorDeFinAntesDeInicio(fechaInicioFormulario, fechaFinFormulario));
      return lista;
    }

    // Nombre, descripción, temática, checklists y fechas los exige el servidor incluso en borrador.
    if (!name.trim()) agregar("nombre", "Falta el nombre de la campaña");
    if (!description.trim()) agregar("descripcion", "Falta la descripción");
    if (!theme) agregar("tematica", "Elige una temática");
    agregar("checklists", validarChecklists());
    // En borrador solo se revisa que los límites escritos sean números válidos.
    if (asDraft && metaPorTipo) agregar("limites", validarLimites());
    agregar("cuotaPorTipo", validarTopes());
    agregar("inicio", errorDeInicioPasado(fechaInicioFormulario));
    agregar("fin", errorDeFinAntesDeInicio(fechaInicioFormulario, fechaFinFormulario));
    // El propósito se exige al enviar a revisión; en un borrador solo se revisa si se eligió "Otro".
    const propositoValido = validarProposito(proposito, propositoOtro, !asDraft);
    if (!propositoValido.ok) agregar("proposito", propositoValido.error);
    if (asDraft) return lista;

    if (colaLlena) agregar("general", avisoDeColaLlena);
    if (dataTypes.length === 0) agregar("tipos", "Selecciona al menos un tipo de dato");
    revisarMeta();
    const cuotaIncompleta = errorDeCuota();
    if (cuotaIncompleta) agregar(cuotaIncompleta.campo, cuotaIncompleta.mensaje);
    if (!fechaInicioFormulario) agregar("inicio", "Falta la fecha de inicio");
    if (!fechaFinFormulario) agregar("fin", "Falta la fecha de finalización");
    if (!todoElPais && !locationState) agregar("estado", "Selecciona un estado o elige \"Para todo el país\"");
    else if (!todoElPais && !locationCity) agregar("municipio", "Selecciona un municipio o \"Todo el estado\"");
    return lista;
  }

  async function handleSubmit(e: React.FormEvent, asDraft: boolean, estadoPausada?: "activa" | "pausada") {
    e.preventDefault();
    if (soloLectura) return;

    const reanudar = estadoPausada === "activa";
    const lista = problemasDe(asDraft, reanudar);
    setIntento(asDraft ? "borrador" : reanudar ? "reanudar" : "revision");
    setProblemasDelServidor([]);
    if (lista.length > 0) {
      setVentanaDeProblemas(lista);
      return;
    }

    // Activa o aceptada: solo se guardan meta y fecha de fin. Pausada: también
    // lo de CAMPOS_EDITABLES_EN_PAUSA, y pasa a revisión salvo que la haya pausado la supervisión.
    // En el orden en que se ven (↑/↓).
    const checklistSecciones = checklistsVigentes.map((c) => ({
      titulo: c.titulo.trim(),
      opciones: c.opciones.map((o) => o.texto.trim()),
      ...(c.tipo ? { tipo: c.tipo } : {}),
    }));
    const camposEditables = soloMetaYFechaCambiables && estadoPausada
      ? {
          status: estadoPausada,
          goalContributions: metaFinal,
          metaPorTipo,
          limitePorTipo,
          endDate: fechaFinFormulario,
        }
      : edicionAmplia && !(editaProgramada && soloMetaYFechaCambiables)
      ? {
          status: enviarRevisionAlGuardar ? "en_revision" : undefined,
          ...(propositoEditado || enviarRevisionAlGuardar
            ? { proposito, propositoOtro: proposito === "otro" ? propositoOtro.trim() : "" }
            : {}),
          name,
          description,
          organizer: organizer.trim(),
          tematica: theme,
          tematicaNueva: esTematicaNueva,
          tag: theme,
          etiquetas,
          dataTypes,
          formatosDeDocumento: dataTypes.includes("documento") ? formatosDeDocumento : [],
          checklistSecciones,
          goalContributions: metaFinal,
          quotaPerUser: cuotaFinal,
          cuotaPorTipo,
          metaPorTipo,
          limitePorTipo,
          startDate: fechaInicioFormulario,
          endDate: fechaFinFormulario,
          todoElPais,
          locationCity: todoElPais ? "" : municipioReal,
          locationState: todoElPais ? "" : locationState,
          // Sin campo de colonia desde el 2026-10-31 (a pedido del usuario: irrelevante): va vacía, y al
          // editar una campaña vieja también se le quita.
          locationColonia: "",
        }
      : edicionLimitada
      ? {
          goalContributions: metaFinal,
          metaPorTipo,
          limitePorTipo,
          endDate: fechaFinFormulario,
        }
      : {
          name,
          description,
          tematica: theme,
          tematicaNueva: esTematicaNueva,
          tag: theme,
          etiquetas,
          proposito,
          propositoOtro: proposito === "otro" ? propositoOtro.trim() : "",
          organizer: organizer.trim(),
          status: asDraft ? "borrador" : "en_revision",
          dataTypes,
          formatosDeDocumento: dataTypes.includes("documento") ? formatosDeDocumento : [],
          checklistSecciones,
          goalContributions: metaFinal,
          quotaPerUser: cuotaFinal,
          cuotaPorTipo,
          metaPorTipo,
          limitePorTipo,
          startDate: fechaInicioFormulario,
          endDate: fechaFinFormulario,
          todoElPais,
          locationCity: todoElPais ? "" : municipioReal,
          locationState: todoElPais ? "" : locationState,
          // Sin campo de colonia desde el 2026-10-31 (a pedido del usuario: irrelevante): va vacía, y al
          // editar una campaña vieja también se le quita.
          locationColonia: "",
        };

    try {
      // Editar manda PATCH a la campaña existente; antes siempre mandaba
      // POST a /api/campanas, así que "editar" creaba una campaña nueva en
      // vez de actualizar la que ya existía.
      const datosDeNuevaCampana = {
        ...camposEditables,
        currentContributions: 0,
        approvedContributions: 0,
        pendingContributions: 0,
        rejectedContributions: 0,
        participants: 0,
        xpPerContribution: 50,
        isSpecial: false,
        hasReviewerAssigned: false,
      };
      const formularioDeCampana = new FormData();
      const payloadBase = editingCampaign ? camposEditables : datosDeNuevaCampana;
      const payloadDeCampana = cambioBanner
        ? { ...payloadBase, bannerScale: 1, bannerPositionX: 50, bannerPositionY: 50 }
        : payloadBase;
      formularioDeCampana.append("payload", JSON.stringify(payloadDeCampana));
      if (bannerFile) formularioDeCampana.append("banner", bannerFile);

      const response = editingCampaign
        ? await fetch(`${BASE_PATH}/api/campanas/${editingCampaign.id}`, {
            method: "PATCH",
            ...(cambioBanner ? {} : { headers: { "Content-Type": "application/json" } }),
            body: cambioBanner ? formularioDeCampana : JSON.stringify(camposEditables),
          })
        : await fetch(`${BASE_PATH}/api/campanas`, {
            method: "POST",
            body: formularioDeCampana,
          });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? (editingCampaign ? "No se pudo actualizar la campaña" : "No se pudo crear la campaña"));
      }

      borrarBorradorDeCampana(claveBorrador);
      router.push("/mis-campanas");
    } catch (error) {
      console.error(editingCampaign ? "Error actualizando campaña" : "Error creando campaña", error);
      const mensaje = error instanceof Error ? error.message : "No se pudo guardar la campaña";
      const problema: Problema = { campo: campoDelMensaje(mensaje), mensaje };
      setProblemasDelServidor([problema]);
      setVentanaDeProblemas([problema]);
    }
  }

  // Problemas a la vista: después del primer intento de guardar, se recalculan mientras se corrige.
  const errores: Problema[] = [
    ...(intento ? problemasDe(intento === "borrador", intento === "reanudar") : []),
    ...problemasDelServidor,
  ];
  const errorDe = (campo: CampoDeCampana) =>
    errores.filter((p) => p.campo === campo).map((p) => p.mensaje).join(". ") || null;
  const pasosConProblemas = new Set(errores.map((p) => PASO_DEL_CAMPO[p.campo]).filter(Boolean));

  // Cuándo está completo cada paso (solo informa: lo que se exige al enviar es problemasDe()).
  // En pausa el inicio que ya pasó se conserva; solo un inicio nuevo no puede ser antes de hoy.
  const errorDeFechas = edicionLimitada && !inicioMovido
    ? errorDeFinAntesDeInicio(fechaInicioFormulario, fechaFinFormulario)
    : (errorDeInicioPasado(fechaInicioFormulario) ?? errorDeFinAntesDeInicio(fechaInicioFormulario, fechaFinFormulario));
  const pasos: Paso[] = (
    [
      { id: "paso-datos", titulo: "Datos básicos", completo: Boolean(name.trim() && description.trim() && theme) },
      // Orden de los pasos (2026-11-03, a pedido del usuario): vigencia y lugar van separados, 2.º y 3.º.
      {
        id: "paso-vigencia",
        titulo: "Vigencia",
        completo: Boolean(fechaInicioFormulario && fechaFinFormulario && !errorDeFechas),
      },
      {
        id: "paso-lugar",
        titulo: "Lugar",
        completo: Boolean(todoElPais || (locationState && locationCity)),
      },
      {
        id: "paso-recoleccion",
        titulo: "Qué se recolecta",
        completo: dataTypes.length > 0 && !validarChecklists() && validarProposito(proposito, propositoOtro, true).ok,
      },
      {
        id: "paso-meta",
        titulo: "Meta y cuota",
        completo: (metaPorTipo ? !validarLimites() && !faltaLimite() && sumaDeLimites > 0 : Number(goal) > 0) && !errorDeCuota(),
      },
    ] satisfies Paso[]
  ).map((p) => ({ ...p, conProblemas: pasosConProblemas.has(p.id) }));
  const paso = (id: string) => pasos.find((p) => p.id === id)!;
  const noEditable = contenidoBloqueado ? "No se puede cambiar" : undefined;
  const opcionesDeLugar: { modo: ModoDeLugar; titulo: string; detalle: string; desactivada?: boolean }[] = [
    {
      modo: "pais",
      titulo: "Para todo el país",
      detalle: "La campaña aparece en toda la República y se avisa a quien tenga su temática, viva donde viva.",
    },
    {
      modo: "perfil",
      titulo: "La ubicación de mi perfil",
      detalle: zonaDelPerfil ? textoDeZona(zonaDelPerfil) : "Tu perfil no tiene estado: agrégalo en Mi cuenta para usar esta opción.",
      desactivada: !zonaDelPerfil,
    },
    {
      modo: "actual",
      titulo: "Mi ubicación actual",
      detalle: buscandoZona
        ? "Buscando tu ubicación…"
        : "Tu navegador te pedirá permiso. Solo usamos tu estado y municipio, nunca tus coordenadas.",
    },
    { modo: "manual", titulo: "Elegir manualmente", detalle: "Selecciona el estado y el municipio." },
  ];
  const ubicacionActual =
    modoDeLugar === "actual" && locationState
      ? textoDeZona({ estado: locationState, municipio: locationCity })
      : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">
            {editingCampaign ? "Editar campaña" : "Nueva campaña"}
          </h1>
          <p className="mt-1 text-[13px] text-system-600">
            {editaEnPausa
              ? pausadaPorSupervision
                ? "La supervisión pausó esta campaña: haz los ajustes que te pidió y guárdalos. Sigue pausada hasta que quien la supervisa la reanude."
                : colaLlena
                ? "La campaña está pausada. Tu cola de revisión está llena: todavía no puedes enviar cambios."
                : "La campaña está pausada: puedes editar sus datos. Al guardar, pasará a revisión y no recibirá aportes hasta que la supervisión decida."
              : editaProgramada
              ? colaLlena
                ? "La campaña está programada. Tu cola de revisión está llena: por ahora solo puedes ajustar la meta, los límites y la fecha de finalización."
                : "La campaña está programada: puedes editar sus datos. Si solo cambias la meta, los límites o la fecha de finalización, sigue programada; cualquier otro cambio la manda a revisión y no empezará hasta que la supervisión lo acepte."
              : edicionLimitada
              ? "La campaña ya está en curso: solo puedes ajustar la meta de aportes y la fecha de finalización. Para cambiar lo demás, páusala."
              : "Completa los cinco pasos y envíala a revisión. Puedes guardarla como borrador en cualquier momento."}
          </p>
        </div>
        <Tag tone={colaLlena ? "danger" : (status && ETIQUETA_DE_CAMPANA[status]?.tono) || "default"}>
          {colaLlena ? "Cola de revisión llena" : editingCampaign ? labelEstado(status) : "Borrador"}
        </Tag>
      </div>

      {!editingCampaign && (
        <AvisoSinTematicas sinTematicas={sinTematicas} returnTo={rutaActualParaRegreso()}>
          <p>
            Aún no eliges temáticas de interés. Agrégalas para mostrarte primero las campañas que te interesan y
            avisarte cuando se abra una nueva. Tus avances de esta campaña se conservarán mientras actualizas tu perfil.
          </p>
        </AvisoSinTematicas>
      )}
      {!editingCampaign && <AvisoDeUbicacionAlCrear />}

      {/* Al corregir una rechazada, el motivo a la vista (2026-10-22, lib/campanas/rechazo.ts). */}
      {status === "rechazada" && (
        <div className="mb-6 rounded-lg border border-error-200 bg-error-50 p-4 text-[13px] text-system-900">
          <p className="font-semibold text-error-700">
            {editingCampaign?.rechazo?.porSuperUsuario ? "La supervisión de DataForGood" : "Un supervisor"} rechazó esta campaña
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-system-600">
            Motivo: {editingCampaign?.rechazo?.motivo ?? "sin motivo registrado"}
          </p>
          <CampanasParecidasDelRechazo similares={editingCampaign?.rechazo?.similares ?? []} />
          {editingCampaign?.rechazo?.sancion && (
            <p className="mt-1 text-system-600">Además se aplicó {editingCampaign.rechazo.sancion} a tu cuenta.</p>
          )}
          <p className="mt-1 text-system-600">Corrige lo que se indica y vuelve a enviarla a revisión.</p>
        </div>
      )}

      {colaLlena && (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-lg bg-error-50 p-4 text-[13px] text-error-700">
          <p>
            <b>Ya tienes {MAX_CAMPANAS_EN_REVISION} campañas en revisión.</b>{" "}
            {editaEnPausa
              ? "No puedes enviar cambios hasta que la supervisión acepte o rechace alguna. Mientras tanto, puedes reanudarla sin cambios desde Mis campañas."
              : editaProgramada
              ? "No puedes enviar cambios a revisión hasta que la supervisión acepte o rechace alguna. Mientras tanto, puedes ajustar la meta, los límites y la fecha de finalización: sigue programada."
              : "Puedes guardar esta como borrador y enviarla cuando la supervisión acepte o rechace alguna."}
          </p>
          <Link href="/mis-campanas">
            <Button size="sm">Ver mis campañas</Button>
          </Link>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8">
        <aside>
          <GuiaDePasos pasos={pasos} />
        </aside>

        {/* noValidate: sin los globos del navegador; los problemas los explica la app (2026-10-27). */}
        <form noValidate data-campo="general" className="scroll-mt-24" onSubmit={(e) => handleSubmit(e, false)}>
          <TarjetaDePaso
            id="paso-datos"
            numero={1}
            titulo="Datos básicos"
            descripcion="Cómo se llama la campaña, de qué trata y quién la impulsa."
            completo={paso("paso-datos").completo}
            conProblemas={paso("paso-datos").conProblemas}
            aviso={noEditable}
          >
            <div className="grid grid-cols-1 gap-6">
              <div>
                <Field label="Nombre de la campaña" required error={errorDe("nombre")}>
                  <Input
                    data-campo="nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    required
                    disabled={contenidoBloqueado}
                    className="disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </Field>
                <p className="mb-3 -mt-3 text-right font-mono text-[11px] text-system-500">
                  {name.length} / 80
                </p>

                <Field label="Banner de la campaña" hint={editingCampaign ? (pausadaPorSupervision ? "No se puede cambiar mientras la supervisión mantenga pausada la campaña." : "Puedes cambiar la imagen. Al guardar, deberás enviarla a revisión.") : "Opcional. JPG o PNG, máximo 5 MB."}>
                    {editingCampaign && !mostrarSelectorBanner ? (
                      <button
                        type="button"
                        onClick={() => setMostrarSelectorBanner(true)}
                        disabled={pausadaPorSupervision || soloLectura}
                        className="rounded-pill border border-brand-600 px-3.5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cambiar banner
                      </button>
                    ) : (
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setBannerFile(file);
                          setBannerPreviewUrl(file ? URL.createObjectURL(file) : null);
                        }}
                        disabled={pausadaPorSupervision || soloLectura}
                        className="block w-full rounded border border-system-300 bg-white px-3 py-2 text-sm text-system-700 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700"
                      />
                    )}
                    {(bannerPreviewUrl || editingCampaign?.hasBanner) && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-system-200 bg-system-50">
                        <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-system-500">Vista previa del banner</p>
                        <div
                          className="mx-auto mt-2 h-40 w-full max-w-xl overflow-hidden bg-system-100 sm:h-48"
                          aria-label="Vista previa del banner. Arrastra la imagen para ajustar su posición."
                        >
                          <img
                            src={bannerPreviewUrl ?? `${BASE_PATH}/api/campanas/${editingCampaign?.id}/banner?v=${encodeURIComponent(editingCampaign?.bannerVersion ?? "")}`}
                            alt="Vista previa del banner de la campaña"
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="hidden grid gap-3 border-t border-system-200 p-3 text-[12px] text-system-700 sm:grid-cols-3">
                          <label className="flex flex-col gap-1">
                            <span className="font-semibold">Tamaño</span>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-semibold">Posición horizontal</span>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-semibold">Posición vertical</span>
                          </label>
                        </div>
                      </div>
                    )}
                </Field>

                <p className="mb-1.5 text-[13px] font-medium text-system-900">
                  Temática <span className="text-error-700">*</span>
                </p>
                <div
                  data-campo="tematica"
                  className={`mb-1 ${errorDe("tematica") ? "rounded ring-2 ring-error-700 ring-offset-2" : ""}`}
                >
                  {/* El mismo selector de /cuenta, con una sola temática. opcionesCon conserva
                      la temática de una campaña vieja aunque ya no esté en la lista. Con
                      `proponer` (2026-10-29) se puede proponer una que no está. */}
                  <SelectorDeTemas
                    unica
                    proponer
                    opciones={opcionesCon(theme, catalogoDeTemas)}
                    seleccionados={theme ? [theme] : []}
                    pendientes={tematicasPropias}
                    nuevas={esTematicaNueva ? [theme] : []}
                    onAceptar={(temas) => {
                      const nueva = temas[0] ?? theme;
                      if (nueva !== theme) setEtiquetas([]);
                      setTheme(nueva);
                    }}
                    deshabilitado={contenidoBloqueado}
                    descripcion="Marca una; define en qué categoría aparece la campaña en el catálogo público."
                  />
                </div>
                {errorDe("tematica") && (
                  <p className="mt-1.5 text-[12px] font-medium text-error-700">{errorDe("tematica")}</p>
                )}
                <p className="text-[11.5px] text-system-500">
                  Define en qué categoría aparece la campaña en el catálogo público. Si no está la tuya, puedes
                  proponerla: queda pendiente hasta que la apruebe el SuperUsuario y, si no la acepta, tu campaña
                  pasa a la temática que él elija.
                </p>

                <p className="mb-1.5 mt-4 text-[13px] font-medium text-system-900">
                  Subtemáticas <span className="font-normal text-system-500">(opcional)</span>
                </p>
                <div
                  data-campo="etiquetas"
                  className={`mb-1 ${errorDe("etiquetas") ? "rounded ring-2 ring-error-700 ring-offset-2" : ""}`}
                >
                  <SelectorDeEtiquetas
                    tematica={theme}
                    opciones={(catalogoDeEtiquetas[theme] ?? []).map((e) => e.nombre)}
                    seleccionadas={etiquetas}
                    pendientes={etiquetasPendientes}
                    onCambiar={setEtiquetas}
                    maximo={MAXIMO_DE_ETIQUETAS_POR_CAMPANA}
                    deshabilitado={contenidoBloqueado}
                    tematicas={catalogoDeTemas}
                  />
                </div>
                {errorDe("etiquetas") && (
                  <p className="mt-1.5 text-[12px] font-medium text-error-700">{errorDe("etiquetas")}</p>
                )}
                <p className="text-[11.5px] text-system-500">
                  Subtemáticas que precisan de qué trata (en Protección animal: Perros, Gatos...). Hasta{" "}
                  {MAXIMO_DE_ETIQUETAS_POR_CAMPANA}; una que propongas se ve en tu campaña cuando la aprueba el SuperUsuario.
                </p>
                {theme && (
                  // Vista previa (2026-10-27): la temática y sus etiquetas como se verán en la campaña.
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11.5px] text-system-500">Así se verá:</span>
                    <RutaDeTematica
                      tematica={theme}
                      etiquetas={etiquetas.map((nombre) => ({
                        nombre,
                        pendiente: !(catalogoDeEtiquetas[theme] ?? []).some((e) => e.nombre === nombre),
                      }))}
                    />
                  </div>
                )}
              </div>

              <div>
                <Field label="Descripción" required error={errorDe("descripcion")}>
                  <Textarea
                    data-campo="descripcion"
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    required
                    disabled={contenidoBloqueado}
                    className="disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </Field>
                <p className="-mt-3 mb-3 text-right font-mono text-[11px] text-system-500">
                  {description.length} / 500
                </p>

                {/* Opcional (2026-10-15, a pedido del usuario): antes se mandaba siempre "Ayuntamiento de Tepic".
                    Desde el 2026-10-26 sugiere del catálogo de organizaciones (no da de alta nada) y en una
                    campaña nueva viene con la del perfil. */}
                <Field
                  label="Organización (opcional)"
                  hint="La organización a la que perteneces o que impulsa la campaña. Se muestra como quien la organiza."
                  error={errorDe("organizacion")}
                >
                  <CampoDeOrganizacion
                    data-campo="organizacion"
                    value={organizer}
                    onChange={setOrganizer}
                    maxLength={LARGO_MAXIMO_ORGANIZACION}
                    placeholder="Ej. Colectivo Ambiental de Tepic"
                    disabled={contenidoBloqueado}
                    className="disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </Field>
              </div>
            </div>
          </TarjetaDePaso>

          <TarjetaDePaso
            id="paso-vigencia"
            numero={2}
            titulo="Vigencia"
            descripcion="Cuándo recibe aportes."
            completo={paso("paso-vigencia").completo}
            conProblemas={paso("paso-vigencia").conProblemas}
            aviso={contenidoBloqueado ? "Solo la finalización se puede cambiar" : undefined}
          >
            {!editingCampaign && (
              <fieldset className="mb-4 max-w-xl">
                <legend className="mb-2 text-[12px] font-medium text-system-700">
                  ¿Cómo quieres definir la finalización?
                </legend>
                <div className="flex flex-wrap gap-4 text-[13px] text-system-800">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="modo-finalizacion"
                      value="mensual"
                      checked={modoFinalizacion === "mensual"}
                      onChange={() => setModoFinalizacion("mensual")}
                      className="h-4 w-4 accent-brand-600"
                    />
                    Por mes
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="modo-finalizacion"
                      value="personalizada"
                      checked={modoFinalizacion === "personalizada"}
                      onChange={() => setModoFinalizacion("personalizada")}
                      className="h-4 w-4 accent-brand-600"
                    />
                    Fecha específica (opcional)
                  </label>
                </div>
                <p className="mt-1 text-[12px] text-system-500">
                  Elige una duración en meses o una fecha exacta para finalizar la campaña.
                </p>
              </fieldset>
            )}
            <div className="mb-2 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Inicio" required error={errorDe("inicio")}>
                <div data-campo="inicio" className="flex gap-2">
                  <CampoDeFecha
                    value={fechaInicioFormulario}
                    min={edicionLimitada && !editaProgramada ? undefined : editingCampaign ? hoyEnTepic() : hoyLocal || undefined}
                    aria-label="Fecha de inicio"
                    onChange={cambiarInicio}
                    required
                    // Bloqueado desde que empezó (activa, pausada). Borrador, en revisión y rechazada lo
                    // necesitan: con el inicio vencido no se podrían guardar ni reenviar. La programada
                    // (2026-11-10) lo puede mover; si lo mueve, vuelve a revisión.
                    disabled={edicionLimitada && !editaProgramada}
                  />
                </div>
              </Field>
              <Field label="Finalización" required error={errorDe("fin")}>
                <div data-campo="fin" className="flex flex-col gap-2">
                  {editingCampaign ? (
                    <CampoDeFecha
                      value={fechaFinFormulario}
                      min={fechaInicioFormulario || (edicionLimitada ? undefined : hoyEnTepic())}
                      aria-label="Fecha de finalización"
                      onChange={setEndDate}
                      required
                    />
                  ) : (
                    <>
                      {modoFinalizacion === "mensual" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              aria-label="Restar un mes a la duración"
                              onClick={() => cambiarDuracion(-1)}
                              disabled={duracionEnMeses <= 1 || !fechaInicioFormulario}
                            >
                              −
                            </Button>
                            <p aria-live="polite" className="min-w-0 text-[13px] font-semibold text-system-900">
                              {duracionEnMeses} {duracionEnMeses === 1 ? "mes" : "meses"}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              aria-label="Sumar un mes a la duración"
                              onClick={() => cambiarDuracion(1)}
                              disabled={!fechaInicioFormulario}
                            >
                              +
                            </Button>
                          </div>
                          <p className="text-[12px] text-system-600">
                            {fechaFinFormulario ? `Finaliza el ${fechaDDMMAAAA(fechaFinFormulario)}` : "Selecciona la fecha de inicio"}
                          </p>
                        </>
                      ) : (
                        <CampoDeFecha
                          value={fechaFinPersonalizada}
                          min={fechaInicioFormulario || undefined}
                          aria-label="Fecha específica de finalización"
                          onChange={setFechaFinPersonalizada}
                          required
                        />
                      )}
                    </>
                  )}
                </div>
              </Field>
            </div>
            {errorDeFechas && (fechaInicioFormulario || fechaFinFormulario) && !errorDe("inicio") && !errorDe("fin") && (
              <p className="mt-3 text-[12px] text-error-700">{errorDeFechas}</p>
            )}
          </TarjetaDePaso>

          <TarjetaDePaso
            id="paso-lugar"
            numero={3}
            titulo="Lugar"
            descripcion="En qué parte del país aplica."
            completo={paso("paso-lugar").completo}
            conProblemas={paso("paso-lugar").conProblemas}
            aviso={contenidoBloqueado ? "No se puede cambiar" : undefined}
          >
            <fieldset disabled={contenidoBloqueado} className="mb-4">
              <legend className="mb-2 text-[13px] font-medium text-system-900">¿Dónde aplica la campaña?</legend>
              <div className="flex flex-col gap-2">
                {opcionesDeLugar.map((opcion) => (
                  <label
                    key={opcion.modo}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-system-200 bg-system-50 p-3.5 has-[:checked]:border-brand-600 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                  >
                    <input
                      type="radio"
                      name="lugar-de-la-campana"
                      checked={modoDeLugar === opcion.modo}
                      disabled={opcion.desactivada}
                      onChange={() => elegirLugar(opcion.modo)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-system-900">
                        {opcion.titulo}
                        {opcion.modo === "actual" && ubicacionActual && (
                          <span className="ml-1 font-semibold text-brand-700">: {ubicacionActual}</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-system-600">{opcion.detalle}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {avisoDeZona && !avisoDeZona.ok && (
              <p
                role={avisoDeZona.ok ? "status" : "alert"}
                className={`mb-3 text-[12px] ${avisoDeZona.ok ? "text-system-600" : "text-error-700"}`}
              >
                {avisoDeZona.texto}
              </p>
            )}
            {modoDeLugar === "manual" && (
              // "Vigencia" y "Lugar" son las únicas secciones con campos lado a lado (2026-10-28, a pedido del usuario;
              // el resto del formulario va en una columna). En móvil, en columna.
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Estado" required error={errorDe("estado")}>
                  <select
                    data-campo="estado"
                    value={locationState}
                    onChange={(e) => cambiarEstado(e.target.value)}
                    required={!contenidoBloqueado}
                    disabled={contenidoBloqueado}
                    className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 aria-invalid:border-error-700 aria-invalid:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Selecciona un estado</option>
                    {opcionesCon(locationState, NOMBRES_DE_ESTADOS).map((opcion) => (
                      <option key={opcion}>{opcion}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Municipio" required error={errorDe("municipio")}>
                  <select
                    data-campo="municipio"
                    value={locationCity}
                    onChange={(e) => cambiarMunicipio(e.target.value)}
                    required={!contenidoBloqueado}
                    disabled={!locationState || contenidoBloqueado}
                    className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 aria-invalid:border-error-700 aria-invalid:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {locationState ? "Selecciona un municipio" : "Primero selecciona un estado"}
                    </option>
                    {locationState && <option value={TODO_EL_ESTADO}>Todo el estado</option>}
                    {opcionesCon(municipioReal, municipiosDe(locationState)).map((opcion) => (
                      <option key={opcion}>{opcion}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </TarjetaDePaso>

          <TarjetaDePaso
            id="paso-recoleccion"
            numero={4}
            titulo="Qué se recolecta"
            descripcion="Qué tipo de aporte se pide y cómo lo describe quien participa."
            completo={paso("paso-recoleccion").completo}
            conProblemas={paso("paso-recoleccion").conProblemas}
            aviso={noEditable}
          >
            {/* El propósito se puede actualizar al editar una campaña pausada; el servidor lo valida al guardarlo. */}
            <div className="mb-6">
              <Field label="Propósito — ¿Para qué se utilizarán los datos?" required error={errorDe("proposito")}>
                <select
                  data-campo="proposito"
                  value={proposito}
                  onChange={(e) => setProposito(e.target.value)}
                  disabled={contenidoBloqueado}
                  className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 aria-invalid:border-error-700 aria-invalid:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Elige un propósito</option>
                  {PROPOSITOS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.etiqueta}
                    </option>
                  ))}
                </select>
              </Field>
              {proposito === "otro" && (
                <Input
                  value={propositoOtro}
                  onChange={(e) => setPropositoOtro(e.target.value)}
                  maxLength={LARGO_MAXIMO_PROPOSITO_OTRO}
                  placeholder="Escribe para qué se utilizarán los datos"
                  aria-label="Otro propósito"
                  disabled={contenidoBloqueado}
                  className="-mt-2"
                />
              )}
              <p className="mt-1.5 text-[11.5px] text-system-500">
                Se muestra en la campaña, en el acuerdo que acepta quien participa y en los datos abiertos.
                {contenidoBloqueado && proposito ? " Ya no se cambia: quien participa lo aceptó." : ""}
              </p>
            </div>

            <div className="mb-6">
              <p className="mb-1.5 text-[13px] font-medium text-system-900">
                Tipo de dato solicitado <span className="text-error-700">*</span>
              </p>
              <p className="mb-2.5 text-[12px] text-system-500">Marca uno o varios.</p>
              <div
                data-campo="tipos"
                role="group"
                aria-label="Tipo de dato solicitado"
                aria-describedby={errorDe("tipos") ? "error-de-tipos" : undefined}
                className={`flex flex-wrap gap-2 ${errorDe("tipos") ? "rounded-pill p-1 ring-2 ring-error-700" : ""}`}
              >
                {DATA_TYPES.map((dt) => (
                  <button
                    key={dt.value}
                    type="button"
                    disabled={contenidoBloqueado}
                    onClick={() => toggleDataType(dt.value)}
                    aria-pressed={dataTypes.includes(dt.value)}
                    className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      dataTypes.includes(dt.value)
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-system-300 bg-white text-system-600 hover:border-brand-600"
                    }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
              {errorDe("tipos") && <p id="error-de-tipos" className="mt-1.5 text-[12px] font-medium text-error-700">{errorDe("tipos")}</p>}

              {/* Al marcar "Archivo": qué formatos acepta (2026-10-28). Ninguno marcado = todos. */}
              {dataTypes.includes("documento") && (
                <div className="mt-3 rounded-lg border border-system-200 bg-system-50 p-3.5">
                  <p className="text-[12.5px] font-semibold text-system-900">¿Qué archivos aceptas?</p>
                  <p className="mb-2.5 text-[11.5px] text-system-500">
                    Marca los formatos que se pueden subir. Si no marcas ninguno, se aceptan todos.
                  </p>
                  <div role="group" aria-label="Formatos de archivo aceptados" className="flex flex-wrap gap-2">
                    {FORMATOS_DE_DOCUMENTO.map((formato) => {
                      const marcado = formatosDeDocumento.includes(formato.valor);
                      return (
                        <button
                          key={formato.valor}
                          type="button"
                          disabled={contenidoBloqueado}
                          onClick={() => alternarFormato(formato.valor)}
                          aria-pressed={marcado}
                          className={`rounded-pill border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            marcado
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-system-300 bg-white text-system-600 hover:border-brand-600"
                          }`}
                        >
                          {formato.nombre} <span className="font-mono font-normal">({formato.extensiones.join(", ")})</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11.5px] text-system-600" aria-live="polite">
                    {formatosDeDocumento.length === 0 || formatosDeDocumento.length === FORMATOS_DE_DOCUMENTO.length
                      ? "Se aceptan todos: PDF, Word, PowerPoint y Excel."
                      : `Solo se acepta: ${FORMATOS_DE_DOCUMENTO.filter((f) => formatosDeDocumento.includes(f.valor))
                          .flatMap((f) => f.extensiones)
                          .join(", ")}.`}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 text-[13px] font-medium text-system-900">
                Cómo describe su aporte el participante
              </p>
              <p className="mb-2.5 text-[12px] text-system-500">
                Siempre escribe una descripción con sus palabras. Además, para cada tipo de dato que pides
                puedes agregar características con título para que marque lo que aplique: las que necesites, o
                ninguna. Quien aporta solo ve las del tipo de lo que manda. Para cambiar el orden de las
                características y sus opciones, arrástralas desde ⠿.
              </p>
              {editaEnPausa && (
                <p className="mb-2.5 text-[12px] text-system-500">
                  Los aportes que ya llegaron conservan lo que marcaron, aunque cambies o quites una opción.
                </p>
              )}

              {/* data-orden-grupo / data-orden-elemento: lo que reacomoda ui/AsaDeArrastre. Mientras se arrastra,
                  el elemento lleva data-arrastrando. */}
              {errorDe("checklists") && (
                <p className="mb-2.5 rounded-lg border border-error-700 bg-error-50 p-3 text-[12.5px] font-medium text-error-700">
                  {errorDe("checklists")}
                </p>
              )}
              {/* Checklists por tipo de dato (2026-10-28, a pedido del usuario): un bloque por cada tipo que pide la
                  campaña, cada uno con los suyos; quien aporta solo ve los del tipo de su archivo. */}
              <div data-campo="checklists" className="grid grid-cols-1 gap-4">
                {gruposDeChecklists.length === 0 && (
                  <p className="rounded-lg border border-dashed border-system-300 p-3 text-[12px] text-system-500">
                    Marca arriba los tipos de dato que pides para agregar sus características.
                  </p>
                )}
                {gruposDeChecklists.map((grupo) => {
                  const delGrupo = checklists.filter((c) => c.tipo === grupo.tipo);
                  return (
                    <section key={grupo.tipo || "general"} aria-label={grupo.titulo} className="rounded-lg border border-system-200 p-3.5">
                      <p className="text-[13px] font-semibold text-system-900">{grupo.titulo}</p>
                      <p className="mb-2.5 text-[11.5px] text-system-500">{grupo.detalle}</p>
                      <div data-orden-grupo className="grid grid-cols-1 gap-3">
                        {delGrupo.map((c, i) => (
                          <div
                            key={c.clave}
                            data-orden-elemento={i}
                            className="rounded-lg border border-system-200 bg-system-50 p-3.5 data-[arrastrando]:border-brand-600 data-[arrastrando]:shadow-md"
                          >
                            <div className="mb-2.5 flex items-center gap-2">
                              <AsaDeArrastre
                                etiqueta={`la característica ${c.titulo.trim() || i + 1}`}
                                onMover={(de, a) => setChecklists((prev) => moverEnGrupo(prev, c.tipo, de, a))}
                                deshabilitado={contenidoBloqueado}
                              />
                              <input
                                type="text"
                                value={c.titulo}
                                onChange={(e) => cambiarChecklist(c.clave, { titulo: e.target.value })}
                                maxLength={MAX_LARGO_TEXTO}
                                placeholder="Título de la característica, p. ej. Estado del árbol"
                                aria-label={`Título de la característica ${i + 1}`}
                                disabled={contenidoBloqueado}
                                className="w-full rounded border border-system-300 bg-white px-3 py-2 text-[13px] font-semibold text-system-900 outline-none focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <button
                                type="button"
                                disabled={contenidoBloqueado}
                                onClick={() => setChecklists((prev) => prev.filter((x) => x.clave !== c.clave))}
                                className="whitespace-nowrap text-[11.5px] font-medium text-error-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Quitar característica
                              </button>
                            </div>

                            {c.opciones.length === 0 && (
                              <p className="mb-2 text-[12px] text-system-500">Aún no agregas opciones a esta característica.</p>
                            )}
                            <div data-orden-grupo>
                              {c.opciones.map((opcion, j) => (
                                <div
                                  key={opcion.clave}
                                  data-orden-elemento={j}
                                  className="mb-2 flex items-center gap-2 rounded text-[12.5px] text-system-600 data-[arrastrando]:bg-brand-50 data-[arrastrando]:ring-1 data-[arrastrando]:ring-brand-600"
                                >
                                  <AsaDeArrastre
                                    etiqueta={`la opción ${opcion.texto.trim() || j + 1}`}
                                    onMover={(de, a) => cambiarOpciones(c.clave, (ops) => moverA(ops, de, a))}
                                    deshabilitado={contenidoBloqueado}
                                  />
                                  <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-system-300 bg-white" aria-hidden />
                                  <input
                                    type="text"
                                    value={opcion.texto}
                                    onChange={(e) =>
                                      cambiarOpciones(c.clave, (ops) => ops.map((o) => (o.clave === opcion.clave ? { ...o, texto: e.target.value } : o)))
                                    }
                                    maxLength={MAX_LARGO_TEXTO}
                                    aria-label={`Opción ${j + 1} de la característica ${c.titulo || i + 1}`}
                                    aria-invalid={opcionRepetida(c, j) || undefined}
                                    title={opcionRepetida(c, j) ? "Esta opción está repetida" : undefined}
                                    disabled={contenidoBloqueado}
                                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] text-system-900 outline-none hover:border-system-300 focus:border-brand-600 focus:bg-white aria-invalid:border-error-700 aria-invalid:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    disabled={contenidoBloqueado}
                                    onClick={() => cambiarOpciones(c.clave, (ops) => ops.filter((o) => o.clave !== opcion.clave))}
                                    className="text-[11.5px] font-medium text-error-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              ))}
                            </div>
                            {/* Repetidas al momento (2026-10-31, a pedido del usuario), no solo al enviar. */}
                            {c.opciones.some((_, j) => opcionRepetida(c, j)) && (
                              <p className="mb-2 text-[11.5px] font-medium text-error-700">
                                Hay opciones repetidas: cada opción debe ser distinta. Cambia o quita la marcada en rojo.
                              </p>
                            )}

                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                value={c.nuevaOpcion}
                                aria-invalid={opcionYaExiste(c, c.nuevaOpcion) || undefined}
                                onChange={(e) => cambiarChecklist(c.clave, { nuevaOpcion: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    agregarOpcion(c.clave);
                                  }
                                }}
                                maxLength={MAX_LARGO_TEXTO}
                                placeholder="Nueva opción"
                                aria-label={`Nueva opción de la característica ${c.titulo || i + 1}`}
                                disabled={contenidoBloqueado}
                                className="w-full rounded border border-system-300 bg-white px-3 py-2 text-[12.5px] text-system-900 outline-none focus:border-brand-600 aria-invalid:border-error-700 aria-invalid:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <button
                                type="button"
                                onClick={() => agregarOpcion(c.clave)}
                                disabled={!c.nuevaOpcion.trim() || opcionYaExiste(c, c.nuevaOpcion) || contenidoBloqueado}
                                className="whitespace-nowrap text-[12.5px] font-medium text-brand-600 disabled:opacity-40"
                              >
                                + Agregar opción
                              </button>
                            </div>
                            {opcionYaExiste(c, c.nuevaOpcion) && (
                              <p className="mt-1 text-[11.5px] font-medium text-error-700">
                                Ya existe la opción &quot;{c.nuevaOpcion.trim()}&quot; en esta característica.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      {grupo.tipo && (
                        <div className={delGrupo.length > 0 ? "mt-3" : ""}>
                          <Button
                            type="button"
                            size="sm"
                            disabled={contenidoBloqueado}
                            onClick={() => setChecklists((prev) => [...prev, nuevoChecklist("", [], grupo.tipo)])}
                          >
                                + Agregar característica de {grupo.nombre}
                          </Button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          </TarjetaDePaso>

          <TarjetaDePaso
            id="paso-meta"
            numero={5}
            titulo="Meta y cuota"
            descripcion="Cuántos aportes busca la campaña de cada tipo de dato (o en total) y cuántos puede enviar cada persona."
            completo={paso("paso-meta").completo}
            conProblemas={paso("paso-meta").conProblemas}
            aviso={contenidoBloqueado ? "Solo la meta y los límites por tipo se pueden cambiar" : undefined}
          >
            {/* Cómo se mide la meta (2026-10-28): por tipo de dato (por defecto) o meta general. */}
            <fieldset className="max-w-xl">
              <legend className="mb-2 text-[13px] font-medium text-system-900">¿Cómo se mide la meta?</legend>
              <div role="group" aria-label="Cómo se mide la meta" className="grid grid-cols-1 gap-2">
                {[
                  {
                    valor: true,
                    titulo: "Por tipo de dato",
                    detalle: "Cada tipo tiene su propio límite (p. ej. 100 fotos y 100 videos). La meta es la suma.",
                  },
                  {
                    valor: false,
                    titulo: "Meta general",
                    detalle: "No importa cuántos de cada tipo: una sola meta de aportes aprobados para toda la campaña.",
                  },
                ].map((opcion) => (
                  <button
                    key={opcion.titulo}
                    type="button"
                    onClick={() => setMetaPorTipo(opcion.valor)}
                    aria-pressed={metaPorTipo === opcion.valor}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      metaPorTipo === opcion.valor
                        ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                        : "border-system-300 bg-white hover:border-brand-600"
                    }`}
                  >
                    <span className="block text-[13px] font-semibold text-system-900">{opcion.titulo}</span>
                    <span className="block text-[11.5px] text-system-500">{opcion.detalle}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {metaPorTipo ? (
              <fieldset data-campo="limites" className="mt-4 max-w-xl">
                <legend className="text-[13px] font-medium text-system-900">
                  Límite por tipo de dato <span className="text-error-700">*</span>
                </legend>
                <p className="mb-2.5 text-[11.5px] text-system-500">
                  Cuántos aportes de cada tipo recibe la campaña en total. Al llegar al límite de un tipo, nadie puede mandar
                  más de ese tipo; un aporte rechazado libera su lugar.
                </p>
                {dataTypes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-system-300 p-3 text-[12px] text-system-500">
                    Marca en &quot;Qué se recolecta&quot; los tipos de dato que pides para ponerles límite.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {DATA_TYPES.filter((d) => dataTypes.includes(d.value)).map((d) => {
                      const enviados = editingCampaign?.enviadosPorTipo?.[d.value] ?? 0;
                      return (
                        <Field
                          key={d.value}
                          label={PLURALES_DE_TIPO[d.value][1].replace(/^./, (c) => c.toUpperCase())}
                          required
                          hint={editingCampaign && enviados > 0 ? `Ya recibió ${enviados} (sin contar rechazados).` : undefined}
                        >
                          <Input
                            type="number"
                            min={1}
                            value={limites[d.value] ?? ""}
                            onChange={(e) => setLimites((prev) => ({ ...prev, [d.value]: e.target.value }))}
                            placeholder="Ej. 100"
                            aria-invalid={errorDe("limites") ? true : undefined}
                            className="font-mono"
                          />
                        </Field>
                      );
                    })}
                  </div>
                )}
                {errorDe("limites") && <p className="mt-1.5 text-[12px] text-error-700">{errorDe("limites")}</p>}
                {sumaDeLimites > 0 && (
                  <p className="mt-2 text-[12.5px] text-system-600" aria-live="polite">
                    Meta de la campaña: <span className="font-mono font-semibold text-system-900">{sumaDeLimites}</span> aportes
                    aprobados (la suma de los límites).
                  </p>
                )}
              </fieldset>
            ) : (
              <div className="mt-4 grid max-w-xl grid-cols-1 gap-4">
                <Field label="Meta general" required hint="Solo cuentan los aportes aprobados, de cualquier tipo." error={errorDe("meta")}>
                  <Input
                    data-campo="meta"
                    type="number"
                    min={1}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Ej. 500"
                    required
                    className="font-mono"
                  />
                </Field>
              </div>
            )}

            {/* Con meta por tipo no hay cuota que escribir: es la suma de los máximos de cada tipo (2026-10-31). */}
            {!metaPorTipo && (
            <div className="mt-4 grid max-w-xl grid-cols-1 gap-4">
              <Field label="Cuota por persona" required hint="Máximo de aportes por participante en total, de cualquier tipo." error={errorDe("cuota")}>
                <Input
                  data-campo="cuota"
                  type="number"
                  min={1}
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  placeholder="Ej. 10"
                  required={!contenidoBloqueado}
                  disabled={contenidoBloqueado}
                  className="font-mono disabled:cursor-not-allowed disabled:opacity-50"
                />
              </Field>
            </div>
            )}

            {metaPorTipo && (
              <fieldset data-campo="cuotaPorTipo" className="mt-4 max-w-xl">
                <legend className="text-[13px] font-medium text-system-900">
                  Máximo por persona de cada tipo <span className="text-error-700">*</span>
                </legend>
                <p className="mb-2.5 text-[11.5px] text-system-500">
                  Cuántos aportes de cada tipo puede mandar cada persona, sin pasar del límite de ese tipo. La cuota por persona es la suma.
                </p>
                {dataTypes.length === 0 && (
                  <p className="rounded-lg border border-dashed border-system-300 p-3 text-[12px] text-system-500">
                    Marca en &quot;Qué se recolecta&quot; los tipos de dato que pides para ponerles un máximo.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {DATA_TYPES.filter((d) => dataTypes.includes(d.value)).map((d) => (
                    <Field key={d.value} label={`Máximo de ${PLURALES_DE_TIPO[d.value][1]}`} required>
                      <Input
                        type="number"
                        min={1}
                        value={topes[d.value] ?? ""}
                        onChange={(e) => setTopes((prev) => ({ ...prev, [d.value]: e.target.value }))}
                        placeholder="Ej. 5"
                        aria-invalid={errorDe("cuotaPorTipo") ? true : undefined}
                        disabled={contenidoBloqueado}
                        className="font-mono disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </Field>
                  ))}
                </div>
                {(errorDe("cuotaPorTipo") ?? validarTopes()) && (
                  <p className="mt-1.5 text-[12px] text-error-700">{errorDe("cuotaPorTipo") ?? validarTopes()}</p>
                )}
                {sumaDeMaximos > 0 && (
                  <p className="mt-2 text-[12.5px] text-system-600" aria-live="polite">
                    Cuota por persona: <span className="font-mono font-semibold text-system-900">{sumaDeMaximos}</span> aportes
                    (la suma de los máximos).
                  </p>
                )}
              </fieldset>
            )}

            {!metaPorTipo && sugerencia && (
              <p className="mt-1 max-w-xl text-[12px] text-system-500" aria-live="polite">
                La cuota vale para cualquier tipo de dato. A quien aporte se le sugerirá balancearlos:{" "}
                <span className="font-medium text-system-700">{sugerencia}</span>.
              </p>
            )}
          </TarjetaDePaso>

          {edicionCompleta && (
            <div className="mb-6 max-w-lg rounded-lg bg-warning-50 p-4 text-[12.5px] text-warning-800">
              {status === "en_revision" || status === "rechazada"
                ? "Solo el supervisor revisará tu campaña. Puedes editarla y volver a enviarla mientras no responda."
                : "Al enviar, la campaña pasa a “En revisión” y solo la revisará el supervisor. Podrás seguir editándola mientras no responda."}
            </div>
          )}
          {edicionLimitada && (
            <div className="mb-6 max-w-lg rounded-lg bg-system-100 p-4 text-[12.5px] text-system-600">
              {editaProgramada && soloMetaYFechaCambiables
                ? "La campaña está programada: estos cambios se guardan y sigue programada. Si cambias algo más, pasará a En revisión y no empezará hasta que la supervisión lo acepte."
                : editaProgramada
                ? `${colaLlena ? "Cuando haya un lugar en tu cola de revisión, al guardar" : "Al guardar"}, la campaña pasará a En revisión y no empezará hasta que la supervisión acepte los cambios.`
                : enviarRevisionAlGuardar
                ? `${colaLlena ? "Cuando haya un lugar en tu cola de revisión, al guardar" : "Al guardar"}, la campaña pasará a En revisión. No recibirá aportes nuevos mientras la supervisión revisa los cambios.`
                : pausadaPorSupervision
                ? "La pausó la supervisión: los cambios se guardan, sigue pausada y solo quien la supervisa puede reanudarla."
                : "La campaña está activa: los cambios se guardan y mantiene su estado actual."}
              {editaEnPausa &&
                ` Los aportes que ya llegaron no cambian, aunque su tipo de dato ya no se pida. ${
                  pausadaPorSupervision ? "Quien la supervisa recibe un aviso de lo que cambiaste." : "La supervisión recibe la campaña para revisar los cambios."
                }`}
            </div>
          )}
          {errores.length > 0 && (
            <div
              role="alert"
              className="mb-6 flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-lg border border-error-700 bg-error-50 p-4 text-[12.5px] text-error-700"
            >
              <span>
                <b>No se puede guardar todavía.</b>{" "}
                {errores.length === 1 ? "Hay 1 cosa por corregir" : `Hay ${errores.length} cosas por corregir`}: están marcadas en rojo.
              </span>
              <Button type="button" size="sm" variant="danger" onClick={() => setVentanaDeProblemas(errores)}>
                Ver qué falta
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-system-200 pt-4">
            <p className="w-full font-mono text-[12.5px] text-system-600 sm:w-auto">
              {campanasEnRevision} de {MAX_CAMPANAS_EN_REVISION} campañas en revisión
            </p>
            <div className="flex w-full flex-nowrap justify-end gap-1.5 sm:w-auto sm:gap-2.5">
              {/* Sale sin guardar, tras confirmar: al editar (2026-10-31) y al crear (2026-11-04), a pedido del usuario. */}
              <Button type="button" variant={editingCampaign ? "secondary" : "danger"} size="sm" className="whitespace-nowrap px-2 sm:px-3.5" onClick={() => setMostrarConfirmacionDeCancelacion(true)} disabled={cancelando}>
                Cancelar
              </Button>
              {!edicionLimitada && !enviarRevisionAlGuardar && !soloMetaYFechaCambiables && (
                <Button type="submit" size="sm" className="whitespace-nowrap px-2 sm:px-3.5" aria-label="Guardar borrador" onClick={(e) => handleSubmit(e, true)}>
                  <span className="sm:hidden">Borrador</span>
                  <span className="hidden sm:inline">Guardar borrador</span>
                </Button>
              )}
              {/* Siempre activo (2026-10-27): si falta algo, al tocarlo se explica qué. */}
              {soloMetaYFechaCambiables && editaEnPausa ? (
                <>
                  <Button
                    variant="secondary"
                    type="submit"
                    size="sm"
                    className="whitespace-nowrap px-2 sm:px-3.5"
                    onClick={(e) => handleSubmit(e, false, "pausada")}
                  >
                    Guardar y seguir pausada
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    size="sm"
                    className="whitespace-nowrap px-2 sm:px-3.5"
                    onClick={(e) => handleSubmit(e, false, "activa")}
                  >
                    Guardar y reanudar
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  type="submit"
                  size="sm"
                  className="whitespace-nowrap px-2 sm:px-3.5"
                  aria-label={vaARevisionAlGuardar ? "Enviar a revisión" : "Guardar cambios"}
                >
                  <span className="sm:hidden">{vaARevisionAlGuardar ? "Enviar" : "Guardar"}</span>
                  <span className="hidden sm:inline">{vaARevisionAlGuardar ? "Enviar a revisión" : "Guardar cambios"}</span>
                </Button>
              )}
            </div>
          </div>
          {errorDeCancelacion && (
            <p role="alert" className="mt-3 text-right text-[12px] text-error-700">
              {errorDeCancelacion}
            </p>
          )}
        </form>
      </div>

      <VentanaDeConfirmacion
        abierto={mostrarConfirmacionDeCancelacion}
        titulo={editingCampaign ? "¿Cancelar la edición?" : "¿Cancelar la creación?"}
        textoConfirmar="Sí, cancelar"
        textoOcupado="Cancelando..."
        ocupado={cancelando}
        peligro
        textoCancelar="Seguir editando"
        onCancelar={() => setMostrarConfirmacionDeCancelacion(false)}
        onConfirmar={() => void cancelarFormulario()}
      >
        {editingCampaign ? (
          <>
            <p>Se descartarán todos los cambios realizados en esta campaña.</p>
            {restaurarEstado && (
              <p className="mt-3">
                La campaña volverá a estar activa porque se pausó temporalmente para editarla.
              </p>
            )}
          </>
        ) : (
          <p>Se eliminarán los datos que hayas llenado y no se creará ninguna campaña.</p>
        )}
        {errorDeCancelacion && (
          <p role="alert" className="mt-3 text-error-700">
            {errorDeCancelacion}
          </p>
        )}
      </VentanaDeConfirmacion>

      <VentanaDeProblemas
        abierto={ventanaDeProblemas !== null}
        titulo={editingCampaign ? "No se pudo guardar la campaña" : "Todavía no se puede guardar la campaña"}
        problemas={ventanaDeProblemas ?? []}
        onCerrar={() => setVentanaDeProblemas(null)}
        alIr={irAlCampo}
      />

      <PedirUbicacion
        explicacion="Con tu ubicación llenamos el estado y el municipio de la campaña por ti (puedes cambiarlos) y en Explorar campañas te mostramos las que están cerca. Tu navegador te pedirá permiso; solo guardamos tu estado y municipio, nunca tus coordenadas."
        ref={ubicacion}
        onZona={recibirUbicacion}
        onSinUbicacion={sinUbicacion}
        onOcupado={setBuscandoZona}
      />
    </div>
  );
}
