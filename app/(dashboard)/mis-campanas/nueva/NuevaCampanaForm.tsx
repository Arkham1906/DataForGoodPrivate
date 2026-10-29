"use client";

// Formulario de campaña (crear o editar, según ?edit=<id>).
// Crear: POST /api/campanas con status "borrador" o "en_revision".
// Editar: carga con GET /api/campanas?mine=true y guarda con PATCH /api/campanas/[id].
// Qué campos se pueden editar depende del estado; la regla real está en el PATCH (ver docs/datos.md § 3).

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Field, Input, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
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
import { MAX_LARGO_TEXTO } from "@/lib/campanas/checklist";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import CampoDeFecha from "@/components/ui/CampoDeFecha";
import AsaDeArrastre, { moverA } from "@/components/ui/AsaDeArrastre";
import { errorDeFinAntesDeInicio, errorDeInicioPasado, fechaDDMMAAAA, hoyEnTepic, inicioEnElFuturo } from "@/lib/fecha-de-tepic";
import { LARGO_MAXIMO_ORGANIZACION } from "@/lib/campanas/organizacion";
import CampoDeOrganizacion from "@/components/ui/CampoDeOrganizacion";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import { GuiaDePasos, TarjetaDePaso, type Paso } from "./PasosDeCampana";
import { repartoSugerido } from "@/lib/campanas/reparto-sugerido";

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
  inicio: "paso-vigencia",
  fin: "paso-vigencia",
  estado: "paso-vigencia",
  municipio: "paso-vigencia",
  general: null,
};

/** A qué campo se refiere un error del servidor (400), por sus palabras; si no se sabe, "general". */
function campoDelMensaje(mensaje: string): CampoDeCampana {
  const m = mensaje.toLowerCase();
  if (m.includes("propósito") || m.includes("proposito")) return "proposito";
  if (m.includes("checklist") || m.includes("opción")) return "checklists";
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
  if (m.includes("estado") && !m.includes("campañas activas")) return "estado";
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
type ChecklistEditable = { clave: number; titulo: string; opciones: OpcionEditable[]; nuevaOpcion: string };
let siguienteClave = 0;
function nuevoChecklist(titulo = "", opciones: string[] = []): ChecklistEditable {
  return { clave: siguienteClave++, titulo, opciones: opciones.map((texto) => ({ clave: siguienteClave++, texto })), nuevaOpcion: "" };
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

// Opción "Todo el estado" del selector de municipio. Solo vive en el formulario:
// se manda y se guarda como municipio vacío.
const TODO_EL_ESTADO = "__todo_el_estado__";

const MAX_ACTIVE_CAMPAIGNS = 5;

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

export default function NuevaCampanaForm() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const solicitarRevisionAlGuardar = searchParams.get("enviarRevision") === "true";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function loadCampaigns() {
      try {
        const response = await fetch(`${BASE_PATH}/api/campanas?mine=true`);
        if (!response.ok) return;
        const body = await response.json();
        if (activo) setCampaigns(Array.isArray(body.data) ? body.data : []);
      } finally {
        if (activo) setCargando(false);
      }
    }

    loadCampaigns();
    return () => {
      activo = false;
    };
  }, []);

  const editingCampaign = editId ? campaigns.find((campaign) => campaign.id === editId) : undefined;
  const activeCampaigns = campaigns.filter((c) => c.status === "activa");
  const limitReached = !editingCampaign && activeCampaigns.length >= MAX_ACTIVE_CAMPAIGNS;

  // Mientras carga, no se monta el formulario: sus campos leen
  // editingCampaign una sola vez, al montar (ver CampanaFormulario). Si se
  // montara antes de que llegue la campaña a editar, abriría en blanco.
  if (cargando) {
    return <PantallaEsqueleto tipo="formulario" etiqueta="Cargando el formulario…" />;
  }

  return (
    <CampanaFormulario
      key={editingCampaign?.id ?? "nueva"}
      editingCampaign={editingCampaign}
      activeCampaigns={activeCampaigns.length}
      limitReached={limitReached}
      solicitarRevisionAlGuardar={solicitarRevisionAlGuardar}
    />
  );
}

function CampanaFormulario({
  editingCampaign,
  activeCampaigns,
  limitReached,
  solicitarRevisionAlGuardar,
}: {
  editingCampaign: Campaign | undefined;
  activeCampaigns: number;
  limitReached: boolean;
  solicitarRevisionAlGuardar: boolean;
}) {
  const router = useRouter();

  // Reglas de edición por estado (dominio.md): una campaña en revisión o
  // rechazada se puede editar por completo y reenviar; activa, pausada o
  // aceptada (aprobada, esperando su fecha de inicio) solo permiten ajustar
  // meta y fecha de finalización, sin tocar su estado; pausada permite casi
  // todo (2026-10-22: no la organización) y normalmente sigue pausada. El
  // flujo de edición iniciado desde una activa la envía a revisión al guardar;
  // finalizada queda en solo lectura.
  const status = editingCampaign?.status;
  const soloLectura = status === "finalizada";
  const edicionLimitada = status === "activa" || status === "pausada" || status === "aceptada";
  const edicionCompleta = !edicionLimitada && !soloLectura;
  const editaEnPausa = status === "pausada";
  const enviarRevisionAlGuardar =
    solicitarRevisionAlGuardar && editaEnPausa && editingCampaign?.pausa?.por === "creador";
  // Lo que solo se edita por completo o en pausa (nombre, temática, tipos, cuota, inicio, ubicación).
  const contenidoBloqueado = edicionLimitada && !editaEnPausa;

  const [name, setName] = useState(editingCampaign?.name ?? "");
  const [description, setDescription] = useState(editingCampaign?.description ?? "");
  const [organizer, setOrganizer] = useState(editingCampaign?.organizer ?? "");
  // Propósito: ¿para qué se usarán los datos? (2026-10-27). Uno de la lista u "Otro" con una frase.
  const [proposito, setProposito] = useState(editingCampaign?.proposito ?? "");
  const [propositoOtro, setPropositoOtro] = useState(editingCampaign?.propositoOtro ?? "");
  // Campaña nueva: se propone la organización del perfil (2026-10-26, a pedido del usuario); el
  // creador puede cambiarla o borrarla. Al editar, se queda la que tiene la campaña.
  useEffect(() => {
    if (editingCampaign) return;
    let vigente = true;
    fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const delPerfil = typeof body?.data?.organizacion === "string" ? (body.data.organizacion as string) : "";
        // Solo si el creador todavía no escribió nada.
        if (vigente && delPerfil) setOrganizer((actual) => actual || delPerfil);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [editingCampaign]);
  // Una campaña nueva empieza sin temática, sin tipos de dato y con meta y cuota vacías
  // (2026-10-21, a pedido del usuario; antes venían "Medio ambiente", Foto, 500 y 10).
  const [theme, setTheme] = useState(editingCampaign?.tag ?? "");
  const [catalogoDeTemas, setCatalogoDeTemas] = useState<string[]>(THEMES);
  useEffect(() => {
    let vigente = true;
    fetch(`${BASE_PATH}/api/tematicas`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (vigente && Array.isArray(body?.data)) setCatalogoDeTemas(body.data as string[]);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);
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
  // Sin ejemplos: una campaña nueva empieza sin checklists. Los de campañas
  // viejas (lista plana, sin título) se titulan "Checklist" para poder guardarlos.
  const [checklists, setChecklists] = useState<ChecklistEditable[]>(() =>
    (editingCampaign?.checklistSecciones ?? []).map((s) => nuevoChecklist(s.titulo || "Checklist", s.opciones))
  );
  // Un borrador guardado sin meta o sin cuota trae 0: se muestra vacío, no "0".
  const [goal, setGoal] = useState(editingCampaign?.goalContributions ? String(editingCampaign.goalContributions) : "");
  const [quota, setQuota] = useState(editingCampaign?.quotaPerUser ? String(editingCampaign.quotaPerUser) : "");
  // Sin reparto de la cuota por tipo desde el 2026-10-27 (a pedido del usuario): la cuota vale
  // para cualquier tipo y debajo solo se muestra un reparto sugerido (lib/campanas/reparto-sugerido.ts).
  const sugerencia = repartoSugerido(Number(quota), dataTypes);
  const [startDate, setStartDate] = useState(editingCampaign?.startDate ?? "");
  const startTime = editingCampaign?.startTime ?? "";
  const [endDate, setEndDate] = useState(editingCampaign?.endDate ?? "");
  const endTime = editingCampaign?.endTime ?? "";
  const [duracionEnMeses, setDuracionEnMeses] = useState(1);
  const hoyLocal = useSyncExternalStore(suscribirSinCambios, fechaLocalActual, fechaEnServidor);
  const [inicioModificado, setInicioModificado] = useState(false);
  const fechaInicioFormulario = startDate || (!editingCampaign && !inicioModificado ? hoyLocal : "");
  const fechaFinFormulario =
    endDate || (!editingCampaign && fechaInicioFormulario ? sumarMeses(fechaInicioFormulario, duracionEnMeses) : "");
  const [locationState, setLocationState] = useState(editingCampaign?.locationState ?? "");
  // Una campaña guardada con estado y sin municipio abarca todo el estado.
  const [locationCity, setLocationCity] = useState(
    editingCampaign?.locationCity || (editingCampaign?.locationState ? TODO_EL_ESTADO : "")
  );
  const municipioReal = locationCity === TODO_EL_ESTADO ? "" : locationCity;
  const [locationColonia, setLocationColonia] = useState(editingCampaign?.locationColonia ?? "");
  // Para todo el país (2026-10-21, a pedido del usuario): sin estado, municipio ni colonia.
  const [todoElPais, setTodoElPais] = useState(editingCampaign?.todoElPais ?? false);
  const [reactivando, setReactivando] = useState(false);
  const [reactivarError, setReactivarError] = useState<string | null>(null);
  // Por qué no se puede guardar (2026-10-27, a pedido del usuario): al intentar guardar se juntan
  // todos los problemas (problemasDe), se marcan sus campos y pasos en rojo y se explican en una
  // ventana de la app (ui/VentanaDeProblemas). Después del primer intento se recalculan mientras se
  // corrige; los del servidor (400) se quedan hasta el siguiente intento.
  const [intento, setIntento] = useState<"borrador" | "revision" | null>(null);
  const [problemasDelServidor, setProblemasDelServidor] = useState<Problema[]>([]);
  const [ventanaDeProblemas, setVentanaDeProblemas] = useState<Problema[] | null>(null);
  // Pausada (2026-10-27): "Guardar y reanudar" (o "Guardar y programar" si el inicio quedó en el
  // futuro) o "Guardar y dejar pausada". Si se guardó pero no se pudo reanudar, aquí va el motivo.
  const [sinReanudar, setSinReanudar] = useState<string | null>(null);
  // La que pausó la supervisión solo la reanuda la supervisión (2026-10-15).
  const pausadaPorSupervision = editaEnPausa && editingCampaign?.pausa?.por === "supervision";
  const propositoEditado =
    proposito !== (editingCampaign?.proposito ?? "") ||
    propositoOtro !== (editingCampaign?.propositoOtro ?? "");

  const limiteActivasAlcanzado = activeCampaigns >= MAX_ACTIVE_CAMPAIGNS;

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
    if (!editingCampaign || limiteActivasAlcanzado || !endDate) return;

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
    // El municipio (y la colonia, que depende del municipio) pertenecen al
    // estado anterior: no tiene sentido conservarlos.
    setLocationCity("");
    setLocationColonia("");
  }

  function cambiarMunicipio(nuevoMunicipio: string) {
    setLocationCity(nuevoMunicipio);
    // Con "Todo el estado" la colonia no tiene a qué pertenecer.
    if (!nuevoMunicipio || nuevoMunicipio === TODO_EL_ESTADO) setLocationColonia("");
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
        if (c.clave !== clave || !valor || c.opciones.some((o) => o.texto.trim() === valor)) return c;
        return { ...c, opciones: [...c.opciones, { clave: siguienteClave++, texto: valor }], nuevaOpcion: "" };
      })
    );
  }

  function cambiarOpciones(clave: number, cambiar: (opciones: OpcionEditable[]) => OpcionEditable[]) {
    setChecklists((prev) => prev.map((c) => (c.clave === clave ? { ...c, opciones: cambiar(c.opciones) } : c)));
  }

  function validarChecklists(): string | null {
    const titulos = new Set<string>();
    for (const [i, c] of checklists.entries()) {
      const titulo = c.titulo.trim();
      const nombre = titulo ? `"${titulo}"` : `número ${i + 1}`;
      if (!titulo) return `El checklist ${nombre} necesita un título`;
      if (c.opciones.length === 0) return `El checklist ${nombre} no tiene opciones`;
      if (titulos.has(titulo.toLowerCase())) return `Hay dos checklists con el título ${nombre}`;
      titulos.add(titulo.toLowerCase());
      // Las opciones ya se editan: ni vacías ni repetidas (el servidor las quitaría sin avisar).
      const opciones = new Set<string>();
      for (const o of c.opciones) {
        const texto = o.texto.trim();
        if (!texto) return `El checklist ${nombre} tiene una opción vacía: escríbela o quítala`;
        if (opciones.has(texto.toLowerCase())) return `El checklist ${nombre} repite la opción "${texto}"`;
        opciones.add(texto.toLowerCase());
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
              Esta campaña ya finalizó y queda en solo lectura: no se puede editar. Para
              reactivarla, primero define una nueva fecha de finalización.
            </p>
          </div>
          <Tag>Finalizada</Tag>
        </div>

        {limiteActivasAlcanzado && (
          <div className="mb-4 max-w-lg rounded-lg bg-warning-50 p-4 text-[12.5px] text-warning-800">
            Ya tienes {MAX_ACTIVE_CAMPAIGNS} campañas activas. Pausa o finaliza otra antes de
            reactivar esta.
          </div>
        )}
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
              disabled={limiteActivasAlcanzado}
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
            disabled={limiteActivasAlcanzado || reactivando || !endDate}
          >
            {reactivando ? "Reactivando..." : "Reactivar campaña"}
          </Button>
        </div>
      </div>
    );
  }

  // Solo se exige completo al enviar a revisión o al editar una campaña ya
  // aceptada/activa/pausada: un borrador puede quedar a medias a propósito
  // (es justo lo que permite seguir bajo el límite de 5 campañas activas).
  function problemasDe(asDraft: boolean): Problema[] {
    const lista: Problema[] = [];
    const agregar = (campo: CampoDeCampana, mensaje: string | null | undefined) => {
      if (mensaje) lista.push({ campo, mensaje });
    };
    const vacio = (n: string) => !Number(n) || Number(n) <= 0;

    if (editaEnPausa) {
      if (!name.trim()) agregar("nombre", "Falta el nombre de la campaña");
      if (!description.trim()) agregar("descripcion", "Falta la descripción");
      if (!theme) agregar("tematica", "Elige una temática");
      if (dataTypes.length === 0) agregar("tipos", "Selecciona al menos un tipo de dato");
      agregar("checklists", validarChecklists());
      if (vacio(goal)) agregar("meta", "La meta de aportes debe ser mayor a 0");
      if (vacio(quota)) agregar("cuota", "La cuota por persona debe ser mayor a 0");
      if (!fechaInicioFormulario) agregar("inicio", "Falta la fecha de inicio");
      else if (inicioMovido) agregar("inicio", errorDeInicioPasado(fechaInicioFormulario));
      if (!fechaFinFormulario) agregar("fin", "Falta la fecha de finalización");
      else agregar("fin", errorDeFinAntesDeInicio(fechaInicioFormulario, fechaFinFormulario));
      if (!todoElPais && !locationState) agregar("estado", "Selecciona un estado o marca que la campaña es para todo el país");
      else if (!todoElPais && !locationCity) agregar("municipio", "Selecciona un municipio o \"Todo el estado\"");
      if (propositoEditado || enviarRevisionAlGuardar) {
        const validado = validarProposito(proposito, propositoOtro, true);
        if (!validado.ok) agregar("proposito", validado.error);
      }
      return lista;
    }
    if (edicionLimitada) {
      if (vacio(goal)) agregar("meta", "La meta de aportes debe ser mayor a 0");
      if (!fechaFinFormulario) agregar("fin", "Falta la fecha de finalización");
      else agregar("fin", errorDeFinAntesDeInicio(fechaInicioFormulario, fechaFinFormulario));
      return lista;
    }

    // Nombre, descripción, temática, checklists y fechas los exige el servidor incluso en borrador.
    if (!name.trim()) agregar("nombre", "Falta el nombre de la campaña");
    if (!description.trim()) agregar("descripcion", "Falta la descripción");
    if (!theme) agregar("tematica", "Elige una temática");
    agregar("checklists", validarChecklists());
    agregar("inicio", errorDeInicioPasado(fechaInicioFormulario));
    agregar("fin", errorDeFinAntesDeInicio(fechaInicioFormulario, fechaFinFormulario));
    // El propósito se exige al enviar a revisión; en un borrador solo se revisa si se eligió "Otro".
    const propositoValido = validarProposito(proposito, propositoOtro, !asDraft);
    if (!propositoValido.ok) agregar("proposito", propositoValido.error);
    if (asDraft) return lista;

    if (limitReached) {
      agregar("general", `Ya tienes ${MAX_ACTIVE_CAMPAIGNS} campañas activas: guárdala como borrador y envíala cuando pauses o finalices otra`);
    }
    if (dataTypes.length === 0) agregar("tipos", "Selecciona al menos un tipo de dato");
    if (vacio(goal)) agregar("meta", "La meta de aportes debe ser mayor a 0");
    if (vacio(quota)) agregar("cuota", "La cuota por persona debe ser mayor a 0");
    if (!fechaInicioFormulario) agregar("inicio", "Falta la fecha de inicio");
    if (!fechaFinFormulario) agregar("fin", "Falta la fecha de finalización");
    if (!todoElPais && !locationState) agregar("estado", "Selecciona un estado o marca que la campaña es para todo el país");
    else if (!todoElPais && !locationCity) agregar("municipio", "Selecciona un municipio o \"Todo el estado\"");
    return lista;
  }

  // alGuardar: pausa manual, el estado al que pasa después de guardar ("activa" reanuda,
  // "aceptada" la programa). El envío del flujo de edición de una activa va en el PATCH de edición.
  async function handleSubmit(e: React.FormEvent, asDraft: boolean, alGuardar: "activa" | "aceptada" | null = null) {
    e.preventDefault();
    if (soloLectura) return;

    const lista = problemasDe(asDraft);
    setIntento(asDraft ? "borrador" : "revision");
    setProblemasDelServidor([]);
    setSinReanudar(null);
    if (lista.length > 0) {
      setVentanaDeProblemas(lista);
      return;
    }

    // Activa o aceptada: solo se guardan meta y fecha de fin. Pausada: también
    // lo de CAMPOS_EDITABLES_EN_PAUSA. En los tres el estado no se manda, así la
    // campaña se mantiene en el estado en el que estaba.
    // En el orden en que se ven (↑/↓).
    const checklistSecciones = checklists.map((c) => ({ titulo: c.titulo.trim(), opciones: c.opciones.map((o) => o.texto.trim()) }));
    const camposEditables = editaEnPausa
      ? {
          status: enviarRevisionAlGuardar ? "en_revision" : undefined,
          ...(propositoEditado || enviarRevisionAlGuardar
            ? { proposito, propositoOtro: proposito === "otro" ? propositoOtro.trim() : "" }
            : {}),
          name,
          description,
          tematica: theme,
          tag: theme,
          etiquetas,
          dataTypes,
          checklistSecciones,
          goalContributions: Number(goal),
          quotaPerUser: Number(quota),
          startDate: fechaInicioFormulario,
          endDate: fechaFinFormulario,
          todoElPais,
          locationCity: todoElPais ? "" : municipioReal,
          locationState: todoElPais ? "" : locationState,
          locationColonia: todoElPais ? "" : locationColonia,
        }
      : edicionLimitada
      ? {
          goalContributions: Number(goal),
          endDate: fechaFinFormulario,
        }
      : {
          name,
          description,
          tematica: theme,
          tag: theme,
          etiquetas,
          proposito,
          propositoOtro: proposito === "otro" ? propositoOtro.trim() : "",
          organizer: organizer.trim(),
          status: asDraft ? "borrador" : "en_revision",
          dataTypes,
          checklistSecciones,
          goalContributions: Number(goal),
          quotaPerUser: Number(quota),
          startDate: fechaInicioFormulario,
          endDate: fechaFinFormulario,
          todoElPais,
          locationCity: todoElPais ? "" : municipioReal,
          locationState: todoElPais ? "" : locationState,
          locationColonia: todoElPais ? "" : locationColonia,
        };

    try {
      // Editar manda PATCH a la campaña existente; antes siempre mandaba
      // POST a /api/campanas, así que "editar" creaba una campaña nueva en
      // vez de actualizar la que ya existía.
      const response = editingCampaign
        ? await fetch(`${BASE_PATH}/api/campanas/${editingCampaign.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(camposEditables),
          })
        : await fetch(`${BASE_PATH}/api/campanas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...camposEditables,
              currentContributions: 0,
              approvedContributions: 0,
              pendingContributions: 0,
              rejectedContributions: 0,
              participants: 0,
              xpPerContribution: 50,
              isSpecial: false,
              daysRemaining: null,
              hasReviewerAssigned: false,
              shareToken: "",
              shareTokenExpiresAt: null,
              aportes: [],
            }),
          });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? (editingCampaign ? "No se pudo actualizar la campaña" : "No se pudo crear la campaña"));
      }

      if (editingCampaign && alGuardar) {
        const cambio = await fetch(`${BASE_PATH}/api/campanas/${editingCampaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: alGuardar }),
        });
        if (!cambio.ok) {
          // Los cambios ya se guardaron: se queda aquí y explica por qué sigue pausada.
          const body = await cambio.json().catch(() => ({}));
          setSinReanudar(body.error ?? (alGuardar === "aceptada" ? "No se pudo programar la campaña" : "No se pudo reanudar la campaña"));
          return;
        }
      }

      router.push("/mis-campanas");
    } catch (error) {
      console.error(editingCampaign ? "Error actualizando campaña" : "Error creando campaña", error);
      const mensaje = error instanceof Error ? error.message : "No se pudo guardar la campaña";
      const problema: Problema = { campo: campoDelMensaje(mensaje), mensaje };
      setProblemasDelServidor([problema]);
      setVentanaDeProblemas([problema]);
    }
  }

  const inicioMovido = editaEnPausa && startDate !== (editingCampaign?.startDate ?? "");
  // Inicio todavía por llegar: se programa (vuelve a "aceptada") en vez de reanudarse.
  const programar = editaEnPausa && inicioEnElFuturo(fechaInicioFormulario, startTime);
  // Problemas a la vista: después del primer intento de guardar, se recalculan mientras se corrige.
  const errores: Problema[] = [...(intento ? problemasDe(intento === "borrador") : []), ...problemasDelServidor];
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
      {
        id: "paso-recoleccion",
        titulo: "Qué se recolecta",
        completo: dataTypes.length > 0 && !validarChecklists() && validarProposito(proposito, propositoOtro, true).ok,
      },
      { id: "paso-meta", titulo: "Meta y cuota", completo: Number(goal) > 0 && Number(quota) > 0 },
      {
        id: "paso-vigencia",
        titulo: "Vigencia y lugar",
        completo: Boolean(fechaInicioFormulario && fechaFinFormulario && !errorDeFechas && (todoElPais || (locationState && locationCity))),
      },
    ] satisfies Paso[]
  ).map((p) => ({ ...p, conProblemas: pasosConProblemas.has(p.id) }));
  const noEditable = contenidoBloqueado ? "No se puede cambiar" : undefined;

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
                ? "La campaña está pausada por la supervisión: puedes cambiar todo menos la organización. Sigue pausada al guardar y se avisa a quien la supervisa."
                : "La campaña está pausada: puedes cambiar todo menos la organización. Al guardar eliges si la reanudas o la dejas pausada; se avisa a quien la supervisa."
              : edicionLimitada
              ? status === "aceptada"
                ? "La campaña ya fue aceptada y espera su fecha de inicio: solo puedes ajustar la meta de aportes y la fecha de finalización."
                : "La campaña ya está en curso: solo puedes ajustar la meta de aportes y la fecha de finalización. Para cambiar lo demás, páusala."
              : "Completa los cuatro pasos y envíala a revisión. Puedes guardarla como borrador en cualquier momento."}
          </p>
        </div>
        <Tag tone={limitReached ? "danger" : (status && ETIQUETA_DE_CAMPANA[status]?.tono) || "default"}>
          {limitReached ? "Límite alcanzado" : editingCampaign ? labelEstado(status) : "Borrador"}
        </Tag>
      </div>

      {/* Al corregir una rechazada, el motivo a la vista (2026-10-22, lib/campanas/rechazo.ts). */}
      {status === "rechazada" && (
        <div className="mb-6 rounded-lg border border-error-200 bg-error-50 p-4 text-[13px] text-system-900">
          <p className="font-semibold text-error-700">
            {editingCampaign?.rechazo?.porSuperUsuario ? "La supervisión de DataForGood" : "Un supervisor"} rechazó esta campaña
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-system-600">
            Motivo: {editingCampaign?.rechazo?.motivo ?? "sin motivo registrado"}
          </p>
          {editingCampaign?.rechazo?.sancion && (
            <p className="mt-1 text-system-600">Además se aplicó {editingCampaign.rechazo.sancion} a tu cuenta.</p>
          )}
          <p className="mt-1 text-system-600">Corrige lo que se indica y vuelve a enviarla a revisión.</p>
        </div>
      )}

      {limitReached && (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-lg bg-error-50 p-4 text-[13px] text-error-700">
          <p>
            <b>Ya tienes {MAX_ACTIVE_CAMPAIGNS} campañas activas.</b> El sistema permite un
            máximo de {MAX_ACTIVE_CAMPAIGNS} en simultáneo. Puedes guardar esta como
            borrador y publicarla cuando finalices o pauses alguna de las otras.
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
            completo={pasos[0].completo}
            conProblemas={pasos[0].conProblemas}
            aviso={editaEnPausa ? "La organización no se puede cambiar" : noEditable}
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

                <p className="mb-1.5 text-[13px] font-medium text-system-900">
                  Temática <span className="text-error-700">*</span>
                </p>
                <div
                  data-campo="tematica"
                  className={`mb-1 ${errorDe("tematica") ? "rounded ring-2 ring-error-700 ring-offset-2" : ""}`}
                >
                  {/* El mismo selector de /cuenta, con una sola temática. opcionesCon conserva
                      la temática de una campaña vieja aunque ya no esté en la lista. */}
                  <SelectorDeTemas
                    unica
                    opciones={opcionesCon(theme, catalogoDeTemas)}
                    seleccionados={theme ? [theme] : []}
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
                  Define en qué categoría aparece la campaña en el catálogo público.
                </p>

                <p className="mb-1.5 mt-4 text-[13px] font-medium text-system-900">
                  Etiquetas <span className="font-normal text-system-500">(opcional)</span>
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
                    disabled={edicionLimitada}
                    className="disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </Field>
              </div>
            </div>
          </TarjetaDePaso>

          <TarjetaDePaso
            id="paso-recoleccion"
            numero={2}
            titulo="Qué se recolecta"
            descripcion="Qué tipo de aporte se pide y cómo lo describe quien participa."
            completo={pasos[1].completo}
            conProblemas={pasos[1].conProblemas}
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
            </div>

            <div>
              <p className="mb-1 text-[13px] font-medium text-system-900">
                Cómo describe su aporte el participante
              </p>
              <p className="mb-2.5 text-[12px] text-system-500">
                Siempre escribe una descripción con sus palabras. Además puedes agregar
                checklists con título para que marque lo que aplique: los que necesites, o ninguno.
                Para cambiar el orden de los checklists y sus opciones, arrástralos desde ⠿.
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
              <div data-orden-grupo data-campo="checklists" className="grid grid-cols-1 gap-3">
                {checklists.map((c, i) => (
                  <div
                    key={c.clave}
                    data-orden-elemento={i}
                    className="rounded-lg border border-system-200 bg-system-50 p-3.5 data-[arrastrando]:border-brand-600 data-[arrastrando]:shadow-md"
                  >
                    <div className="mb-2.5 flex items-center gap-2">
                      <AsaDeArrastre
                        etiqueta={`el checklist ${c.titulo.trim() || i + 1}`}
                        onMover={(de, a) => setChecklists((prev) => moverA(prev, de, a))}
                        deshabilitado={contenidoBloqueado}
                      />
                      <input
                        type="text"
                        value={c.titulo}
                        onChange={(e) => cambiarChecklist(c.clave, { titulo: e.target.value })}
                        maxLength={MAX_LARGO_TEXTO}
                        placeholder="Título del checklist, p. ej. Estado del árbol"
                        aria-label={`Título del checklist ${i + 1}`}
                        disabled={contenidoBloqueado}
                        className="w-full rounded border border-system-300 bg-white px-3 py-2 text-[13px] font-semibold text-system-900 outline-none focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <button
                        type="button"
                        disabled={contenidoBloqueado}
                        onClick={() => setChecklists((prev) => prev.filter((x) => x.clave !== c.clave))}
                        className="whitespace-nowrap text-[11.5px] font-medium text-error-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Quitar checklist
                      </button>
                    </div>

                    {c.opciones.length === 0 && (
                      <p className="mb-2 text-[12px] text-system-500">Aún no agregas opciones a este checklist.</p>
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
                            aria-label={`Opción ${j + 1} del checklist ${c.titulo || i + 1}`}
                            disabled={contenidoBloqueado}
                            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] text-system-900 outline-none hover:border-system-300 focus:border-brand-600 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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

                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={c.nuevaOpcion}
                        onChange={(e) => cambiarChecklist(c.clave, { nuevaOpcion: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            agregarOpcion(c.clave);
                          }
                        }}
                        maxLength={MAX_LARGO_TEXTO}
                        placeholder="Nueva opción"
                        aria-label={`Nueva opción del checklist ${c.titulo || i + 1}`}
                        disabled={contenidoBloqueado}
                        className="w-full rounded border border-system-300 bg-white px-3 py-2 text-[12.5px] text-system-900 outline-none focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => agregarOpcion(c.clave)}
                        disabled={!c.nuevaOpcion.trim() || contenidoBloqueado}
                        className="whitespace-nowrap text-[12.5px] font-medium text-brand-600 disabled:opacity-40"
                      >
                        + Agregar opción
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className={checklists.length > 0 ? "mt-3" : ""}>
                <Button
                  type="button"
                  size="sm"
                  disabled={contenidoBloqueado}
                  onClick={() => setChecklists((prev) => [...prev, nuevoChecklist()])}
                >
                  + Agregar checklist
                </Button>
              </div>
            </div>
          </TarjetaDePaso>

          <TarjetaDePaso
            id="paso-meta"
            numero={3}
            titulo="Meta y cuota"
            descripcion="Cuántos aportes aprobados busca la campaña y cuántos puede enviar cada persona."
            completo={pasos[2].completo}
            conProblemas={pasos[2].conProblemas}
            aviso={contenidoBloqueado ? "Solo la meta se puede cambiar" : undefined}
          >
            <div className="grid max-w-xl grid-cols-1 gap-4">
              <Field label="Meta total" required hint="Solo cuentan los aportes aprobados." error={errorDe("meta")}>
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
              <Field label="Cuota por persona" required hint="Máximo de aportes por participante." error={errorDe("cuota")}>
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

            {sugerencia && (
              <p className="mt-1 max-w-xl text-[12px] text-system-500" aria-live="polite">
                La cuota vale para cualquier tipo de dato. A quien aporte se le sugerirá balancearlos:{" "}
                <span className="font-medium text-system-700">{sugerencia}</span>.
              </p>
            )}
          </TarjetaDePaso>

          <TarjetaDePaso
            id="paso-vigencia"
            numero={4}
            titulo="Vigencia y lugar"
            descripcion="Cuándo recibe aportes y en qué parte del país."
            completo={pasos[3].completo}
            conProblemas={pasos[3].conProblemas}
            aviso={contenidoBloqueado ? "Solo la finalización se puede cambiar" : undefined}
          >
            <p className="mb-3 text-[12px] text-system-500">
              Solo se eligen fechas: las campañas nuevas usan la hora de creación y al editar se conserva la hora guardada.
            </p>
            <div className="mb-2 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Inicio" required error={errorDe("inicio")}>
                <div data-campo="inicio" className="flex gap-2">
                  <CampoDeFecha
                    value={fechaInicioFormulario}
                    min={edicionLimitada ? undefined : editingCampaign ? hoyEnTepic() : hoyLocal || undefined}
                    aria-label="Fecha de inicio"
                    onChange={cambiarInicio}
                    required
                    disabled={contenidoBloqueado}
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
                  )}
                </div>
              </Field>
            </div>
            {errorDeFechas && (fechaInicioFormulario || fechaFinFormulario) && !errorDe("inicio") && !errorDe("fin") && (
              <p className="-mt-2 mb-4 text-[12px] text-error-700">{errorDeFechas}</p>
            )}

            <p className="mb-2 text-[13px] font-medium text-system-900">¿Dónde aplica la campaña?</p>
            <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-system-200 bg-system-50 p-3.5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
              <input
                type="checkbox"
                checked={todoElPais}
                onChange={(e) => setTodoElPais(e.target.checked)}
                disabled={contenidoBloqueado}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
              />
              <span>
                <span className="block text-[13px] font-semibold text-system-900">
                  Para todo el país (sin limitar por ubicación)
                </span>
                <span className="mt-0.5 block text-[12px] text-system-600">
                  La campaña aparece en toda la República y se avisa a quien tenga su temática, viva donde viva.
                  Déjala sin marcar para limitarla a un estado o municipio.
                </span>
              </span>
            </label>

            {!todoElPais && (
              // "Vigencia y lugar" es la única sección con campos lado a lado (2026-10-28, a pedido del usuario;
              // el resto del formulario va en una columna). En móvil, en columna.
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                <Field label="Colonia (opcional)" hint="Para segmentar la campaña dentro del municipio.">
                  <Input
                    value={locationColonia}
                    onChange={(e) => setLocationColonia(e.target.value)}
                    maxLength={150}
                    placeholder={municipioReal ? "p. ej. Centro" : "Primero selecciona un municipio"}
                    disabled={!municipioReal || contenidoBloqueado}
                    className="disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </Field>
              </div>
            )}
          </TarjetaDePaso>

          {edicionCompleta && (
            <div className="mb-6 max-w-lg rounded-lg bg-warning-50 p-4 text-[12.5px] text-warning-800">
              {status === "en_revision" || status === "rechazada"
                ? "Puedes editar la campaña y volver a enviarla a revisión mientras el supervisor no responda."
                : "Al enviar, la campaña pasa a “En revisión”; podrás seguir editándola mientras el supervisor no responda."}
            </div>
          )}
          {edicionLimitada && (
            <div className="mb-6 max-w-lg rounded-lg bg-system-100 p-4 text-[12.5px] text-system-600">
              {enviarRevisionAlGuardar
                ? "Al guardar, la campaña pasará a En revisión. No recibirá aportes nuevos mientras la supervisión revisa los cambios."
                : !editaEnPausa
                ? `La campaña está ${status === "aceptada" ? "aceptada" : "activa"}: los cambios se guardan y mantiene su estado actual.`
                : pausadaPorSupervision
                ? "La pausó la supervisión: los cambios se guardan, sigue pausada y la supervisión decide cuándo reanudarla."
                : programar
                ? `Empieza el ${fechaDDMMAAAA(fechaInicioFormulario)}: con «Guardar y programar» queda programada y empieza sola ese día.`
                : "Con «Guardar y reanudar» vuelve a recibir aportes en cuanto guardas; con «Guardar y dejar pausada» la reanudas después desde Mis campañas."}
              {editaEnPausa &&
                " Los aportes que ya llegaron no cambian, aunque su tipo de dato ya no se pida. Quien la supervisa recibe un aviso de lo que cambiaste."}
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

          {sinReanudar && (
            <div
              role="alert"
              className="mb-6 flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-50 p-4 text-[12.5px] text-warning-800"
            >
              <span>
                <b>Los cambios se guardaron, pero la campaña sigue pausada.</b> {sinReanudar}
              </span>
              <ButtonLink href="/mis-campanas" size="sm">
                Ir a Mis campañas
              </ButtonLink>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-system-200 pt-4">
            <p className="font-mono text-[12.5px] text-system-600">
              {activeCampaigns} de {MAX_ACTIVE_CAMPAIGNS} campañas activas usadas
            </p>
            <div className="flex flex-wrap gap-2.5">
              {!edicionLimitada && !enviarRevisionAlGuardar && (
                <Button type="submit" onClick={(e) => handleSubmit(e, true)}>
                  Guardar borrador
                </Button>
              )}
              {editaEnPausa && !pausadaPorSupervision && !enviarRevisionAlGuardar ? (
                <>
                  <Button type="submit" onClick={(e) => handleSubmit(e, false)}>
                    Guardar y dejar pausada
                  </Button>
                  <Button variant="primary" type="submit" onClick={(e) => handleSubmit(e, false, programar ? "aceptada" : "activa")}>
                    {programar ? "Guardar y programar" : "Guardar y reanudar"}
                  </Button>
                </>
              ) : (
                /* Siempre activo (2026-10-27): si falta algo, al tocarlo se explica qué. */
                <Button variant="primary" type="submit">
                  {enviarRevisionAlGuardar ? "Enviar a revisión" : edicionLimitada ? "Guardar cambios" : "Enviar a revisión"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>

      <VentanaDeProblemas
        abierto={ventanaDeProblemas !== null}
        titulo={editingCampaign ? "No se pudo guardar la campaña" : "Todavía no se puede guardar la campaña"}
        problemas={ventanaDeProblemas ?? []}
        onCerrar={() => setVentanaDeProblemas(null)}
        alIr={irAlCampo}
      />
    </div>
  );
}
