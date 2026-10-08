"use client";

// Formulario de campaña (crear o editar, según ?edit=<id>).
// Crear: POST /api/campanas con status "borrador" o "en_revision".
// Editar: carga con GET /api/campanas?mine=true y guarda con PATCH /api/campanas/[id].
// Qué campos se pueden editar depende del estado; la regla real está en el PATCH (ver docs/datos.md § 3).

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Field, Input, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import SelectorDeTemas from "@/components/ui/SelectorDeTemas";
import type { Campaign, DataType } from "@/types";
import { municipiosDe, NOMBRES_DE_ESTADOS } from "@/lib/mexico-geo";
import { opcionesCon } from "@/lib/perfil-opciones";
import { TEMAS_DE_INTERES } from "@/lib/intereses";
import { BASE_PATH } from "@/lib/base-path";
import { MAX_LARGO_TEXTO } from "@/lib/campanas/checklist";
import PantallaEsqueleto from "@/components/ui/Esqueletos";

/** Un checklist en edición; `clave` solo sirve como key de React. */
type ChecklistEditable = { clave: number; titulo: string; opciones: string[]; nuevaOpcion: string };
let siguienteClave = 0;
function nuevoChecklist(titulo = "", opciones: string[] = []): ChecklistEditable {
  return { clave: siguienteClave++, titulo, opciones, nuevaOpcion: "" };
}

// Las temáticas de campaña son las mismas que los intereses del perfil: el catálogo de
// GET /api/tematicas (las 23 base y las que salen de los textos de los usuarios). Mientras carga,
// o si falla, se ofrecen las 23 base.
const THEMES = TEMAS_DE_INTERES;

const DATA_TYPES: { value: DataType; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "foto", label: "Foto" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "documento", label: "Documento" },
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
    />
  );
}

function CampanaFormulario({
  editingCampaign,
  activeCampaigns,
  limitReached,
}: {
  editingCampaign: Campaign | undefined;
  activeCampaigns: number;
  limitReached: boolean;
}) {
  const router = useRouter();

  // Reglas de edición por estado (dominio.md): una campaña en revisión o
  // rechazada se puede editar por completo y reenviar; activa, pausada o
  // aceptada (aprobada, esperando su fecha de inicio) solo permiten ajustar
  // meta y fecha de finalización, sin tocar su estado; finalizada queda en
  // solo lectura.
  const status = editingCampaign?.status;
  const soloLectura = status === "finalizada";
  const edicionLimitada = status === "activa" || status === "pausada" || status === "aceptada";
  const edicionCompleta = !edicionLimitada && !soloLectura;

  const [name, setName] = useState(editingCampaign?.name ?? "");
  const [description, setDescription] = useState(editingCampaign?.description ?? "");
  const [theme, setTheme] = useState(editingCampaign?.tag || THEMES[0]);
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
  const [dataTypes, setDataTypes] = useState<DataType[]>(editingCampaign?.dataTypes ?? ["foto"]);
  // Sin ejemplos: una campaña nueva empieza sin checklists. Los de campañas
  // viejas (lista plana, sin título) se titulan "Checklist" para poder guardarlos.
  const [checklists, setChecklists] = useState<ChecklistEditable[]>(() =>
    (editingCampaign?.checklistSecciones ?? []).map((s) => nuevoChecklist(s.titulo || "Checklist", s.opciones))
  );
  const [goal, setGoal] = useState(String(editingCampaign?.goalContributions ?? 500));
  const [quota, setQuota] = useState(String(editingCampaign?.quotaPerUser ?? 10));
  const [startDate, setStartDate] = useState(editingCampaign?.startDate ?? "");
  const [startTime, setStartTime] = useState(editingCampaign?.startTime ?? "");
  const [endDate, setEndDate] = useState(editingCampaign?.endDate ?? "");
  const [endTime, setEndTime] = useState(editingCampaign?.endTime ?? "");
  const [locationState, setLocationState] = useState(editingCampaign?.locationState ?? "");
  // Una campaña guardada con estado y sin municipio abarca todo el estado.
  const [locationCity, setLocationCity] = useState(
    editingCampaign?.locationCity || (editingCampaign?.locationState ? TODO_EL_ESTADO : "")
  );
  const municipioReal = locationCity === TODO_EL_ESTADO ? "" : locationCity;
  const [locationColonia, setLocationColonia] = useState(editingCampaign?.locationColonia ?? "");
  const [reactivando, setReactivando] = useState(false);
  const [reactivarError, setReactivarError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const limiteActivasAlcanzado = activeCampaigns >= MAX_ACTIVE_CAMPAIGNS;

  // Si la campaña llegó a "finalizada" porque su fecha/hora de fin ya se
  // cumplió (lo normal: finalizeExpiredCampaigns), reactivarla sin mover esa
  // fecha hace que la próxima lectura de /api/campanas la vuelva a cerrar de
  // inmediato. Por eso al reactivar se exige una fecha/hora de fin futura.
  function momentoDe(fecha: string, hora: string): number | null {
    if (!fecha) return null;
    const [year, month, day] = fecha.split("-").map(Number);
    const [hour, minute] = (hora || "00:00").split(":").map(Number);
    return new Date(year, month - 1, day, hour || 0, minute || 0).getTime();
  }

  async function handleReactivar() {
    if (!editingCampaign || limiteActivasAlcanzado || !endDate) return;

    const moment = momentoDe(endDate, endTime);
    if (moment === null || moment <= Date.now()) {
      setReactivarError("Elige una fecha/hora de finalización posterior a ahora.");
      return;
    }

    setReactivando(true);
    setReactivarError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${editingCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "activa", endDate, endTime: endTime || null }),
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
    setDataTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function cambiarChecklist(clave: number, cambios: Partial<ChecklistEditable>) {
    setChecklists((prev) => prev.map((c) => (c.clave === clave ? { ...c, ...cambios } : c)));
  }

  function agregarOpcion(clave: number) {
    setChecklists((prev) =>
      prev.map((c) => {
        const valor = c.nuevaOpcion.trim();
        if (c.clave !== clave || !valor || c.opciones.includes(valor)) return c;
        return { ...c, opciones: [...c.opciones, valor], nuevaOpcion: "" };
      })
    );
  }

  function quitarOpcion(clave: number, opcion: string) {
    setChecklists((prev) =>
      prev.map((c) => (c.clave === clave ? { ...c, opciones: c.opciones.filter((o) => o !== opcion) } : c))
    );
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
              reactivarla, primero define una nueva fecha/hora de finalización.
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
            hint="Debe ser posterior a este momento; si no, la campaña volvería a finalizar de inmediato."
          >
            <div className="flex gap-2">
              <Input
                type="date"
                value={endDate}
                aria-label="Nueva fecha de finalización"
                onChange={(e) => setEndDate(e.target.value)}
                disabled={limiteActivasAlcanzado}
                required
                className="font-mono disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Input
                type="time"
                value={endTime}
                aria-label="Nueva hora de finalización (opcional)"
                onChange={(e) => setEndTime(e.target.value)}
                disabled={limiteActivasAlcanzado}
                className="font-mono disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
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
  function validar(asDraft: boolean): string | null {
    if (edicionLimitada) {
      if (!Number(goal) || Number(goal) <= 0) return "La meta de aportes debe ser mayor a 0";
      if (!endDate) return "Falta la fecha de finalización";
      return null;
    }

    const errorDeChecklist = validarChecklists();
    if (errorDeChecklist) return errorDeChecklist;

    if (asDraft) return null;

    if (!name.trim()) return "Falta el nombre de la campaña";
    if (!description.trim()) return "Falta la descripción";
    if (dataTypes.length === 0) return "Selecciona al menos un tipo de dato";
    if (!goal || Number(goal) <= 0) return "La meta de aportes debe ser mayor a 0";
    if (!quota || Number(quota) <= 0) return "La cuota por persona debe ser mayor a 0";
    if (!startDate) return "Falta la fecha de inicio";
    if (!endDate) return "Falta la fecha de finalización";
    if (endDate < startDate) return "La fecha de finalización no puede ser anterior a la de inicio";
    if (!locationState) return "Selecciona un estado";
    if (!locationCity) return "Selecciona un municipio o \"Todo el estado\"";

    return null;
  }

  async function handleSubmit(e: React.FormEvent, asDraft: boolean) {
    e.preventDefault();
    if (soloLectura) return;

    const error = validar(asDraft);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);

    // Activa, pausada o aceptada: solo se guardan meta y fecha/hora de fin,
    // y el estado no se manda, así la campaña se mantiene en el estado en el
    // que estaba.
    const camposEditables = edicionLimitada
      ? {
          goalContributions: Number(goal),
          endDate,
          endTime: endTime || null,
        }
      : {
          name,
          description,
          tematica: theme,
          tag: theme,
          status: asDraft ? "borrador" : "en_revision",
          dataTypes,
          checklistSecciones: checklists.map((c) => ({ titulo: c.titulo.trim(), opciones: c.opciones })),
          goalContributions: Number(goal),
          quotaPerUser: Number(quota),
          startDate,
          startTime: startTime || null,
          endDate,
          endTime: endTime || null,
          locationCity: municipioReal,
          locationState,
          locationColonia,
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
              organizer: "Ayuntamiento de Tepic",
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

      router.push("/mis-campanas");
    } catch (error) {
      console.error(editingCampaign ? "Error actualizando campaña" : "Error creando campaña", error);
      setFormError(error instanceof Error ? error.message : "No se pudo guardar la campaña");
    }
  }

  const canPublish = edicionLimitada
    ? Boolean(goal) && Boolean(endDate)
    : !limitReached && Boolean(name) && Boolean(description) && dataTypes.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">
            {editingCampaign ? "Editar campaña" : "Nueva campaña"}
          </h1>
          <p className="mt-1 text-[13px] text-system-600">
            {edicionLimitada
              ? status === "aceptada"
                ? "La campaña ya fue aceptada y espera su fecha de inicio: solo puedes ajustar la meta de aportes y la fecha/hora de finalización."
                : "La campaña ya está en curso: solo puedes ajustar la meta de aportes y la fecha/hora de finalización."
              : "Completa los tres bloques y envíala a revisión"}
          </p>
        </div>
        <Tag tone={limitReached ? "danger" : "default"}>
          {limitReached ? "Límite alcanzado" : editingCampaign ? labelEstado(status) : "Borrador"}
        </Tag>
      </div>

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

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <p className="mb-3 font-mono text-[12px] uppercase tracking-wide text-system-500">
          1 · Datos básicos
        </p>
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <Field label="Nombre de la campaña" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                disabled={edicionLimitada}
                className="disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
            <p className="mb-3 -mt-3 text-right font-mono text-[11px] text-system-500">
              {name.length} / 80
            </p>

            <p className="mb-1.5 text-[13px] font-medium text-system-900">
              Temática <span className="text-error-700">*</span>
            </p>
            <div className="mb-1">
              {/* El mismo selector de /cuenta, con una sola temática. opcionesCon conserva
                  la temática de una campaña vieja aunque ya no esté en la lista. */}
              <SelectorDeTemas
                unica
                opciones={opcionesCon(theme, catalogoDeTemas)}
                seleccionados={theme ? [theme] : []}
                onAceptar={(temas) => setTheme(temas[0] ?? theme)}
                deshabilitado={edicionLimitada}
                descripcion="Marca una; define en qué categoría aparece la campaña en el catálogo público."
              />
            </div>
            <p className="text-[11.5px] text-system-500">
              Define en qué categoría aparece la campaña en el catálogo público.
            </p>
          </div>

          <div>
            <Field label="Descripción" required>
              <Textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                required
                disabled={edicionLimitada}
                className="disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
            <p className="-mt-3 text-right font-mono text-[11px] text-system-500">
              {description.length} / 500
            </p>
          </div>
        </div>

        <p className="mb-3 font-mono text-[12px] uppercase tracking-wide text-system-500">
          2 · Qué se recolecta
        </p>
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-system-900">
              Tipo de dato solicitado <span className="text-error-700">*</span>
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {DATA_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  type="button"
                  disabled={edicionLimitada}
                  onClick={() => toggleDataType(dt.value)}
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

            <div className="flex gap-3">
              <Field label="Meta total" required>
                <Input
                  type="number"
                  min={1}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  required
                  className="font-mono"
                />
              </Field>
              <Field label="Cuota por persona" required>
                <Input
                  type="number"
                  min={1}
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  required={!edicionLimitada}
                  disabled={edicionLimitada}
                  className="font-mono disabled:cursor-not-allowed disabled:opacity-50"
                />
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[13px] font-medium text-system-900">
              Cómo describe su aporte el participante
            </p>
            <p className="mb-2.5 text-[12px] text-system-500">
              Siempre escribe una descripción con sus palabras. Además puedes agregar
              checklists con título para que marque lo que aplique: los que necesites, o ninguno.
            </p>

            {checklists.map((c, i) => (
              <div key={c.clave} className="mb-3 rounded-lg border border-system-200 bg-white p-3.5">
                <div className="mb-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={c.titulo}
                    onChange={(e) => cambiarChecklist(c.clave, { titulo: e.target.value })}
                    maxLength={MAX_LARGO_TEXTO}
                    placeholder="Título del checklist, p. ej. Estado del árbol"
                    aria-label={`Título del checklist ${i + 1}`}
                    disabled={edicionLimitada}
                    className="w-full rounded border border-system-300 bg-white px-3 py-2 text-[13px] font-semibold text-system-900 outline-none focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={edicionLimitada}
                    onClick={() => setChecklists((prev) => prev.filter((x) => x.clave !== c.clave))}
                    className="whitespace-nowrap text-[11.5px] font-medium text-error-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Quitar checklist
                  </button>
                </div>

                {c.opciones.length === 0 && (
                  <p className="mb-2 text-[12px] text-system-500">Aún no agregas opciones a este checklist.</p>
                )}
                {c.opciones.map((opcion) => (
                  <div key={opcion} className="mb-2 flex items-center justify-between gap-2 text-[12.5px] text-system-600">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 rounded-sm border border-system-300" aria-hidden />
                      {opcion}
                    </span>
                    <button
                      type="button"
                      disabled={edicionLimitada}
                      onClick={() => quitarOpcion(c.clave, opcion)}
                      className="text-[11.5px] font-medium text-error-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  </div>
                ))}

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
                    disabled={edicionLimitada}
                    className="w-full rounded border border-system-300 bg-white px-3 py-2 text-[12.5px] text-system-900 outline-none focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => agregarOpcion(c.clave)}
                    disabled={!c.nuevaOpcion.trim() || edicionLimitada}
                    className="whitespace-nowrap text-[12.5px] font-medium text-brand-600 disabled:opacity-40"
                  >
                    + Agregar opción
                  </button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              size="sm"
              disabled={edicionLimitada}
              onClick={() => setChecklists((prev) => [...prev, nuevoChecklist()])}
            >
              + Agregar checklist
            </Button>
          </div>
        </div>

        <p className="mb-3 font-mono text-[12px] uppercase tracking-wide text-system-500">
          3 · Vigencia
        </p>
        <div className="mb-2 max-w-md">
          <Field label="Vigencia" required hint="La hora es opcional: sin hora, la campaña activa o finaliza desde el inicio de ese día.">
            <div className="flex flex-wrap gap-3">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  aria-label="Fecha de inicio"
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={edicionLimitada}
                  className="font-mono disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Input
                  type="time"
                  value={startTime}
                  aria-label="Hora de inicio (opcional)"
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={edicionLimitada}
                  className="font-mono disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={endDate}
                  aria-label="Fecha de finalización"
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="font-mono"
                />
                <Input
                  type="time"
                  value={endTime}
                  aria-label="Hora de finalización (opcional)"
                  onChange={(e) => setEndTime(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </Field>
        </div>
        <p className="mb-3 font-mono text-[12px] uppercase tracking-wide text-system-500">
          Ubicación
        </p>
        <div className="mb-6 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Estado" required>
            <select
              value={locationState}
              onChange={(e) => cambiarEstado(e.target.value)}
              required={!edicionLimitada}
              disabled={edicionLimitada}
              className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Selecciona un estado</option>
              {opcionesCon(locationState, NOMBRES_DE_ESTADOS).map((opcion) => (
                <option key={opcion}>{opcion}</option>
              ))}
            </select>
          </Field>
          <Field label="Municipio" required>
            <select
              value={locationCity}
              onChange={(e) => cambiarMunicipio(e.target.value)}
              required={!edicionLimitada}
              disabled={!locationState || edicionLimitada}
              className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
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
              disabled={!municipioReal || edicionLimitada}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            />
          </Field>
        </div>

        {edicionCompleta && (
          <div className="mb-6 max-w-lg rounded-lg bg-warning-50 p-4 text-[12.5px] text-warning-800">
            {status === "en_revision" || status === "rechazada"
              ? "Puedes editar la campaña y volver a enviarla a revisión mientras el supervisor no responda."
              : "Al enviar, la campaña pasa a “En revisión”; podrás seguir editándola mientras el supervisor no responda."}
          </div>
        )}
        {edicionLimitada && (
          <div className="mb-6 max-w-lg rounded-lg bg-system-100 p-4 text-[12.5px] text-system-600">
            La campaña está {status === "pausada" ? "pausada" : status === "aceptada" ? "aceptada" : "activa"}: los cambios se
            guardan y mantiene su estado actual.
          </div>
        )}
        {formError && (
          <div className="mb-6 max-w-lg rounded-lg border border-error-700 bg-error-50 p-4 text-[12.5px] text-error-700">
            {formError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-system-200 pt-4">
          <p className="font-mono text-[12.5px] text-system-600">
            {activeCampaigns} de {MAX_ACTIVE_CAMPAIGNS} campañas activas usadas
          </p>
          <div className="flex gap-2.5">
            {!edicionLimitada && (
              <Button type="submit" onClick={(e) => handleSubmit(e, true)}>
                Guardar borrador
              </Button>
            )}
            <Button variant="primary" type="submit" disabled={!canPublish}>
              {edicionLimitada ? "Guardar cambios" : "Enviar a revisión"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
