"use client";

// Pantalla /campanas/[id]/aportar: formulario para enviar un aporte (archivo, descripción, checklists).
// Componente cliente. Datos: GET /api/campanas?id= y GET /api/aportes?campaignId=&mine=true (cuota usada).
// El archivo sigue los tipos de la campaña (components/ui/SelectorDeArchivo); con "texto" es opcional.
// Sin archivo (solo texto, 2026-11-11): "Título del texto" + "Texto" (components/aportes/CamposDelAporte).
// Acción: POST /api/aportes (multipart/form-data). El servidor valida cuota, baneo, tipo, tamaño y que
// la persona esté inscrita (aceptó los acuerdos una vez; antes salía una ventana en cada aporte). Si llega
// sin inscribirse (p. ej. desde /c/[token]), arriba del formulario van las casillas (ui/AcuerdosDeAporte).
// Con ?enlace=<token> (viene de /c/[token]) lo reenvía para atribuir el aporte a ese enlace.
// Diseño (2026-11-18, a pedido del usuario): encabezado con banner y avance de la cuota, avisos en un recuadro,
// pasos numerados en tarjetas (Paso, se marcan en verde al quedar listos) y a la derecha "Antes de enviar"
// con lo que falta y el botón (fijo al bajar en escritorio; al final en móvil). Sin lugar para otro aporte
// (cuota, límites o máximo por tipo) se muestra la razón en vez del formulario.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import ProgressBar from "@/components/ui/ProgressBar";
import { IconoFlechaAtras, IconoFoto, IconoInfo, IconoListo, IconoReloj } from "@/components/aportes/IconosDelAporte";
import CamposDelAporte, { camposDelAporteCompletos } from "@/components/aportes/CamposDelAporte";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { EVENTO_CELEBRAR_RACHA } from "@/lib/gamificacion/celebraciones-tipos";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import { respuestasValidas, seccionesParaElAporte } from "@/lib/campanas/checklist";
import ChecklistsDelAporte from "@/components/aportes/ChecklistsDelAporte";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import { AvisoNoEncontrado } from "@/components/ui/AvisoNoEncontrado";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { InscripcionACampana } from "@/components/ui/AcuerdosDeAporte";
import { textoDelProposito } from "@/lib/campanas/proposito";
import SelectorDeArchivo from "@/components/ui/SelectorDeArchivo";
import { archivoEsOpcional, tiposAceptados } from "@/lib/aportes/archivo";
import { avisoDeTodoLleno, resumenDeLimites, tiposConLugar } from "@/lib/campanas/limite-por-tipo";
import { repartoSugerido } from "@/lib/campanas/reparto-sugerido";
import { mapaPorTipo, resumenDeLoQueQueda, tiposDentroDeSuCuota, type MiosPorTipo } from "@/lib/campanas/cuota-por-tipo";

export default function AportarPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  // Si se llegó desde un enlace público (/c/[token]), el aporte se atribuye a ese enlace.
  const enlace = useSearchParams().get("enlace");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [baneado, setBaneado] = useState(false);
  const [motivoDeBaneo, setMotivoDeBaneo] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  // Cuántos lleva de cada tipo, para el máximo por persona de cada tipo (2026-10-31).
  const [misPorTipo, setMisPorTipo] = useState<MiosPorTipo>({});
  // Tipo de cada aporte ya enviado, para lo que queda de cada tipo (cuota por tipo).
  const [loadError, setLoadError] = useState<string | null>(null);
  // 404: no existe o no la puede ver (lib/campanas/visibilidad.ts).
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [texto, setTexto] = useState("");
  const [caracteristicas, setCaracteristicas] = useState<string[]>([]);
  const [inscrito, setInscrito] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aporteEnviado, setAporteEnviado] = useState(false);
  const rachaPorCelebrar = useRef<unknown>(null);

  // En vivo (2026-10-31): si la campaña se pausa, finaliza o se llena, o banean a la persona, la
  // pantalla lo muestra sin recargar. Solo vuelve a leer la campaña y la cuota: lo escrito no se pierde.
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function loadCampaign() {
      try {
        const [campaignRes, aportesRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas?id=${encodeURIComponent(params.id)}`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/aportes?campaignId=${encodeURIComponent(params.id)}&mine=true`, { cache: "no-store" }),
        ]);

        const campaignPayload = await campaignRes.json().catch(() => ({}));
        if (campaignRes.status === 404) {
          setNoEncontrada(true);
          return;
        }
        if (!campaignRes.ok) throw new Error(campaignPayload.error ?? "No se pudo cargar la campaña");
        setCampaign(campaignPayload.data as Campaign);
        setIsCreator(Boolean(campaignPayload.viewer?.isCreator));
        setBaneado(Boolean(campaignPayload.viewer?.baneado));
        setMotivoDeBaneo(campaignPayload.viewer?.motivoDeBaneo ?? null);
        setInscrito(Boolean(campaignPayload.viewer?.inscrito));

        const aportesPayload = await aportesRes.json().catch(() => ({}));
        if (aportesRes.ok) {
          const enviados: unknown[] = Array.isArray(aportesPayload.data) ? aportesPayload.data : [];
          setSubmittedCount(enviados.length);
          const porTipo: Record<string, number> = {};
          for (const aporte of enviados as { fileType?: string }[]) {
            const tipo = String(aporte.fileType ?? "");
            porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
          }
          setMisPorTipo(mapaPorTipo(porTipo));
        }
      } catch (cause) {
        setLoadError(cause instanceof Error ? cause.message : "No se pudo cargar la campaña");
      }
    }
    void loadCampaign();
  }, [params.id, recarga]);

  if (noEncontrada) return <AvisoNoEncontrado volverA="/campanas" textoVolver="Volver a campañas" />;
  if (loadError) return <p className="text-sm text-error-700">{loadError}</p>;
  if (!campaign) return <PantallaEsqueleto tipo="formulario" etiqueta="Cargando campaña…" />;
  if (isCreator) return <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">No puedes aportar en una campaña que creaste.</p>;
  // El servidor también lo rechaza (POST /api/aportes); esto evita llenar el formulario en balde.
  if (baneado) {
    return (
      <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">
        Quien creó esta campaña te retiró la posibilidad de aportar en ella.
        {motivoDeBaneo && <span className="mt-1 block font-semibold">Motivo: {motivoDeBaneo}</span>}
      </p>
    );
  }

  const quotaReached = submittedCount >= campaign.quotaPerUser;
  // Solo cuota general (2026-10-27): el reparto por tipo es una sugerencia, no un límite.
  const sugerencia = repartoSugerido(campaign.quotaPerUser, campaign.dataTypes);
  // Tipos que acepta la campaña; con "texto", el archivo es opcional. Desde el 2026-10-28 sin los
  // que ya llegaron a su límite total (lib/campanas/limite-por-tipo.ts); el servidor lo vuelve a revisar.
  const limitePorTipo = campaign.limitePorTipo ?? {};
  const enviadosPorTipo = campaign.enviadosPorTipo ?? {};
  const todosLosTipos = tiposAceptados(campaign.dataTypes);
  // Y sin los que ya llegaron a su máximo por persona (2026-10-31, lib/campanas/cuota-por-tipo.ts).
  const cuotaPorTipo = campaign.cuotaPorTipo ?? {};
  const tiposConEspacio = tiposConLugar(todosLosTipos, limitePorTipo, enviadosPorTipo);
  const tipos = tiposDentroDeSuCuota(tiposConEspacio, cuotaPorTipo, misPorTipo);
  const loQueQueda = resumenDeLoQueQueda(todosLosTipos, cuotaPorTipo, misPorTipo);
  const sinTiposPropios = tiposConEspacio.length > 0 && tipos.length === 0;
  const resumenLimites = resumenDeLimites(todosLosTipos, limitePorTipo, enviadosPorTipo);
  const todoLleno = avisoDeTodoLleno(todosLosTipos, limitePorTipo, enviadosPorTipo);
  // La API ya convierte las campañas viejas (lista plana) en un checklist sin título. Solo se
  // muestran los del tipo de lo que se manda (2026-10-28).
  const { visibles, faltaArchivo } = seccionesParaElAporte(campaign.checklistSecciones ?? [], tipos, file);
  // Sin archivo en una campaña que acepta texto: título + texto en vez de descripción (2026-11-11).
  const soloTexto = !file && archivoEsOpcional(tipos);

  function toggleCaracteristica(value: string) {
    setCaracteristicas((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaign || !canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.set("campaignId", campaign.id);
      formData.set("description", description);
      if (file) formData.set("file", file);
      // Solo texto (2026-11-11): description es el título y el texto va aparte; el servidor lo guarda como .txt.
      else if (soloTexto) formData.set("texto", texto);
      // Solo lo marcado en los checklists que se ven (cambiar de archivo puede esconder alguno).
      respuestasValidas(caracteristicas, visibles).forEach((item) => formData.append("caracteristicas", item));
      if (enlace) formData.set("enlace", enlace);

      const response = await fetch(`${BASE_PATH}/api/aportes`, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo enviar el aporte");

      // Si el envío hizo crecer la racha, las celebraciones del panel la muestran (2026-11-16, Andrey), pero
      // después de la ventana "Aporte enviado" (Gerard): se guarda aquí y se avisa al cerrarla, para no abrir
      // las dos ventanas a la vez.
      rachaPorCelebrar.current = payload.racha ?? null;
      setSubmitting(false);
      setAporteEnviado(true);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "No se pudo enviar el aporte");
      setSubmitting(false);
    }
  }

  // Al cerrar "Aporte enviado": primero se avisa la racha (las celebraciones viven en ShellDeUsuario y siguen
  // abiertas tras navegar) y luego se vuelve a la campaña.
  function salirTrasEnviar() {
    const racha = rachaPorCelebrar.current;
    rachaPorCelebrar.current = null;
    if (racha) window.dispatchEvent(new CustomEvent(EVENTO_CELEBRAR_RACHA, { detail: racha }));
    if (campaign) router.push(`/campanas/${campaign.id}`);
  }

  const canSubmit = inscrito && !quotaReached && !todoLleno && !sinTiposPropios && (Boolean(file) || archivoEsOpcional(tipos)) && camposDelAporteCompletos(soloTexto, description, texto) && !submitting;

  // Pasos (2026-11-18, rediseño a pedido del usuario): cada tarjeta numerada se marca en verde al quedar lista.
  const archivoListo = Boolean(file) || (soloTexto && archivoEsOpcional(tipos));
  const camposListos = camposDelAporteCompletos(soloTexto, description, texto);
  const conChecklists = visibles.length > 0 || faltaArchivo;
  const pasoInscripcion = 1;
  const pasoArchivo = inscrito ? 1 : 2;
  const pasoCampos = pasoArchivo + 1;
  const pasoChecklists = pasoCampos + 1;
  // Sin lugar para otro aporte: en vez del formulario, un aviso con la razón.
  const bloqueo = quotaReached
    ? "Alcanzaste tu cuota en esta campaña. La campaña sigue abierta para otras personas, pero ya no puedes enviar más aportes."
    : todoLleno || (sinTiposPropios ? "Ya enviaste el máximo de cada tipo que permite esta campaña." : null);
  const avisos = [
    loQueQueda && <>Máximo por persona de cada tipo. Te quedan <b className="font-semibold text-system-900">{loQueQueda}</b>.</>,
    sugerencia && !loQueQueda && <>Puedes mandar cualquier tipo. Para que los datos queden balanceados, te sugerimos <b className="font-semibold text-system-900">{sugerencia}</b>.</>,
    resumenLimites && <>Esta campaña recibe en total como máximo <b className="font-semibold text-system-900">{resumenLimites}</b>.</>,
  ].filter(Boolean);
  const requisitos = [
    ...(!inscrito ? [{ listo: false, texto: "Inscribirte en la campaña" }] : []),
    { listo: archivoListo, texto: soloTexto ? "Archivo opcional: va solo el texto" : "Elegir tu archivo" },
    { listo: camposListos, texto: soloTexto ? "Escribir el título y el texto" : "Escribir la descripción" },
  ];

  return (
    // Mientras se envía y mientras está "Aporte enviado", las celebraciones que llegan en vivo con el mismo envío
    // (rango, medalla) esperan a que se salga de aquí (components/gamificacion/celebraciones/Celebraciones.tsx).
    <div className="mx-auto max-w-5xl" data-pausar-celebraciones={submitting || aporteEnviado ? "" : undefined}>
      <Link
        href={`/campanas/${campaign.id}`}
        className="mb-3 inline-flex items-center gap-1.5 rounded-pill px-1 text-[13px] font-semibold text-system-600 hover:text-brand-700"
      >
        <IconoFlechaAtras className="size-4" />
        Volver a la campaña
      </Link>

      <header className="mb-5 flex items-center gap-4 overflow-hidden rounded-xl border border-system-200 bg-white p-4 shadow-sm max-sm:flex-col max-sm:items-stretch">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-system-200 bg-gradient-to-br from-brand-100 to-success-100 text-brand-400 max-sm:h-32 max-sm:w-full">
          {!campaign.hasBanner && <IconoFoto className="size-8" />}
          {campaign.hasBanner && (
            // eslint-disable-next-line @next/next/no-img-element -- el banner se sirve por una API autenticada.
            <img
              src={`${BASE_PATH}/api/campanas/${campaign.id}/banner?v=${encodeURIComponent(campaign.bannerVersion ?? "")}`}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `${campaign.bannerPositionX ?? 50}% ${campaign.bannerPositionY ?? 50}%`, transform: `scale(${campaign.bannerScale ?? 1})` }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-brand-600">Nuevo aporte</p>
          <h1 className="mt-0.5 line-clamp-2 break-words text-xl font-extrabold text-system-900" title={campaign.name}>{campaign.name}</h1>
          <div className="mt-2.5 max-w-md">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px] text-system-600">
              <span>
                {quotaReached ? "Cuota completa" : <>Este es tu aporte <b className="font-semibold text-system-900">{Math.min(submittedCount + 1, campaign.quotaPerUser)}</b> de {campaign.quotaPerUser}</>}
              </span>
              <span className="font-mono text-[11px]">{submittedCount} {submittedCount === 1 ? "enviado" : "enviados"}</span>
            </div>
            <ProgressBar pct={campaign.quotaPerUser > 0 ? (submittedCount / campaign.quotaPerUser) * 100 : 0} tone="ok" />
          </div>
        </div>
      </header>

      {avisos.length > 0 && !bloqueo && (
        <div className="mb-5 flex gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3.5 text-[12.5px] leading-5 text-system-700">
          <IconoInfo className="mt-0.5 size-5 shrink-0 text-brand-600" />
          <ul className="flex flex-col gap-1">
            {avisos.map((aviso, i) => <li key={i}>{aviso}</li>)}
          </ul>
        </div>
      )}

      {bloqueo ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-system-200 bg-white px-6 py-10 text-center shadow-sm">
          <span className={`flex size-12 items-center justify-center rounded-full ${quotaReached ? "bg-success-100 text-success-700" : "bg-system-100 text-system-600"}`}>
            {quotaReached ? <IconoListo className="size-6" /> : <IconoInfo className="size-6" />}
          </span>
          <p className="max-w-md text-[14px] leading-6 text-system-700">{bloqueo}</p>
          <ButtonLink href={`/campanas/${campaign.id}`}>Volver a la campaña</ButtonLink>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="flex min-w-0 flex-col gap-4">
            {!inscrito && (
              <Paso numero={pasoInscripcion} titulo="Inscríbete en la campaña" listo={false}>
                <InscripcionACampana
                  campanaId={campaign.id}
                  onInscrito={() => setInscrito(true)}
                  proposito={textoDelProposito(campaign.proposito, campaign.propositoOtro)}
                />
              </Paso>
            )}

            <Paso
              numero={pasoArchivo}
              titulo={archivoEsOpcional(tipos) ? "Elige tu archivo o envía solo texto" : "Elige tu archivo"}
              nota={archivoEsOpcional(tipos) ? "Opcional" : undefined}
              listo={Boolean(file)}
            >
              <SelectorDeArchivo
                amplio
                tipos={tipos}
                formatosDeDocumento={campaign.formatosDeDocumento ?? []}
                archivo={file}
                error={fileError}
                onCambio={(elegido, problema) => {
                  setFile(elegido);
                  setFileError(problema);
                }}
              />
            </Paso>

            <Paso numero={pasoCampos} titulo={soloTexto ? "Escribe tu texto" : "Describe tu aporte"} listo={camposListos}>
              <CamposDelAporte
                soloTexto={soloTexto}
                descripcion={description}
                onDescripcion={setDescription}
                texto={texto}
                onTexto={setTexto}
              />
            </Paso>

            {conChecklists && (
              <Paso numero={pasoChecklists} titulo="Marca lo que aplique" nota="Opcional" listo={respuestasValidas(caracteristicas, visibles).length > 0}>
                <ChecklistsDelAporte
                  fichas
                  visibles={visibles}
                  faltaArchivo={faltaArchivo}
                  marcadas={caracteristicas}
                  onAlternar={toggleCaracteristica}
                />
              </Paso>
            )}
          </div>

          <aside className="flex flex-col gap-3 rounded-xl border border-system-200 bg-white p-4 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-[14px] font-bold text-system-900">Antes de enviar</h2>
            <ul className="flex flex-col gap-2">
              {requisitos.map((r) => (
                <li key={r.texto} className={`flex items-center gap-2 text-[12.5px] ${r.listo ? "text-system-700" : "text-system-500"}`}>
                  <span
                    aria-hidden="true"
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${r.listo ? "border-success-700 bg-success-700 text-white" : "border-system-300 bg-white"}`}
                  >
                    {r.listo && <IconoListo className="size-3.5" strokeWidth={2.5} />}
                  </span>
                  <span className={r.listo ? "font-medium" : ""}>{r.texto}</span>
                  <span className="sr-only">{r.listo ? "(listo)" : "(pendiente)"}</span>
                </li>
              ))}
            </ul>

            {submitError && <p role="alert" className="rounded-lg border border-error-700 bg-error-50 p-2.5 text-[12px] text-error-700">{submitError}</p>}

            <Button variant="primary" type="submit" className="w-full" disabled={!canSubmit}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <IndicadorDeCarga />
                  Enviando…
                </span>
              ) : "Enviar aporte"}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-system-500">
              <IconoReloj className="size-3.5" />
              Quedará pendiente de revisión
            </p>
          </aside>
        </form>
      )}
      <VentanaDeConfirmacion
        abierto={aporteEnviado}
        titulo="Aporte enviado"
        ocultarCancelar
        textoConfirmar="Continuar"
        textoOcupado="Abriendo…"
        onCancelar={salirTrasEnviar}
        onConfirmar={salirTrasEnviar}
      >
        <p className="text-[13px] leading-5 text-system-700">
          Tu aporte fue enviado correctamente y quedó pendiente de revisión.
        </p>
      </VentanaDeConfirmacion>
    </div>
  );
}

/** Tarjeta numerada de un paso del formulario; el número cambia a una palomita verde cuando queda listo. */
function Paso({ numero, titulo, nota, listo, children }: { numero: number; titulo: string; nota?: string; listo: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border bg-white p-4 shadow-sm transition-colors sm:p-5 ${listo ? "border-success-300" : "border-system-200"}`}>
      <div className="mb-3.5 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${listo ? "bg-success-700 text-white" : "bg-brand-50 text-brand-700 ring-1 ring-brand-200"}`}
        >
          {listo ? <IconoListo className="size-4" strokeWidth={2.5} /> : numero}
        </span>
        <h2 className="min-w-0 flex-1 text-[15px] font-bold text-system-900">
          <span className="sr-only">Paso {numero}: </span>
          {titulo}
        </h2>
        {nota && <span className="shrink-0 rounded-pill bg-system-100 px-2 py-0.5 text-[11px] font-medium text-system-600">{nota}</span>}
      </div>
      <div className="[&>*:last-child]:mb-0">{children}</div>
    </section>
  );
}
