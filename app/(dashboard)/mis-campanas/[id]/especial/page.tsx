"use client";

// Pantalla /mis-campanas/[id]/especial (SCR-WEB-13): convertir la campaña en especial o editar sus
// incentivos. Componente cliente. Datos: GET /api/campanas/[id] (viewer.isCreator).
// Acciones: PUT /api/campanas/[id]/especial (publicar o guardar) y DELETE (quitar incentivos).
// Solo el creador y solo con la campaña activa o pausada. Guarda la configuración; otorgar el XP
// es de la gamificación (multiplicadorDeXp() en lib/campanas/especial.ts).

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { AvisoNoEncontrado } from "@/components/ui/AvisoNoEncontrado";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import type { Campaign, DataType } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import {
  BONO_POR_CUOTA,
  LARGO_MAXIMO_DE_INSIGNIA,
  MULTIPLICADOR_MAXIMO,
  XP_BASE_POR_TIPO,
  textoDelPeriodo,
} from "@/lib/campanas/especial-reglas";

const ORDEN_DE_TIPOS: DataType[] = ["texto", "foto", "documento", "audio", "video"];
const NOMBRE_DEL_TIPO: Record<DataType, string> = { texto: "Texto", foto: "Foto", documento: "Documento", audio: "Audio", video: "Video" };

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const valor = new Date(y, m - 1, d + dias);
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}-${String(valor.getDate()).padStart(2, "0")}`;
}

export default function CampanaEspecialPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [multiplicador, setMultiplicador] = useState(2);
  const [insignia, setInsignia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const response = await fetch(`${BASE_PATH}/api/campanas/${encodeURIComponent(params.id)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      // Otra persona no ve la pantalla (la API igual responde 403 al guardar).
      if (!response.ok || !payload.viewer?.isCreator) {
        setNoEncontrada(true);
        return;
      }
      const datos = payload.data as Campaign;
      setCampaign(datos);
      if (datos.especial) {
        setInicio(datos.especial.inicio);
        setFin(datos.especial.fin);
        setMultiplicador(datos.especial.multiplicador);
        setInsignia(datos.especial.insignia ?? "");
      } else {
        // Propuesta: una semana desde hoy (o desde que empieza), sin pasar del cierre.
        const desde = datos.startDate && datos.startDate > hoy() ? datos.startDate : hoy();
        const semana = sumarDias(desde, 7);
        setInicio(desde);
        setFin(datos.endDate && datos.endDate < semana ? datos.endDate : semana);
      }
    }
    if (params.id) void cargar();
  }, [params.id]);

  if (noEncontrada) return <AvisoNoEncontrado volverA="/mis-campanas" textoVolver="Volver a Mis campañas" />;
  if (!campaign) return <PantallaEsqueleto tipo="formulario" etiqueta="Cargando campaña…" />;

  const especial = campaign.especial ?? null;
  const puedeSerEspecial = campaign.status === "activa" || campaign.status === "pausada";
  const tipos = ORDEN_DE_TIPOS.filter((t) => campaign.dataTypes.includes(t));
  const minimoInicio = campaign.startDate && campaign.startDate > hoy() ? campaign.startDate : hoy();

  async function publicar() {
    setGuardando(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaign!.id}/especial`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicio, fin, multiplicador, insignia }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar la campaña especial");
      router.push("/mis-campanas");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la campaña especial");
      setGuardando(false);
    }
  }

  async function quitar() {
    setQuitando(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaign!.id}/especial`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron quitar los incentivos");
      router.push("/mis-campanas");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron quitar los incentivos");
      setQuitando(false);
      setConfirmarQuitar(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">Campaña especial</h1>
          <p className="mt-1 text-[13px] text-system-600">{campaign.name}</p>
        </div>
        {especial ? <Tag tone="ok">Especial ×{especial.multiplicador}</Tag> : <Tag tone="warn">Sin publicar</Tag>}
      </div>

      {!puedeSerEspecial && (
        <p className="mb-5 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">
          Solo las campañas activas o pausadas pueden ser especiales. Esta campaña está {campaign.status.replace("_", " ")}.
        </p>
      )}
      {especial && (
        <p className="mb-5 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">
          Publicada: {textoDelPeriodo(especial)}. Puedes cambiar los incentivos o quitarlos.
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <Field label="Periodo especial" hint="Dentro de la vigencia de la campaña">
            <div className="flex gap-3">
              <Input
                type="date"
                value={inicio}
                min={especial && especial.inicio < minimoInicio ? especial.inicio : minimoInicio}
                max={campaign.endDate ?? undefined}
                aria-label="Inicio del periodo especial"
                onChange={(e) => setInicio(e.target.value)}
                disabled={!puedeSerEspecial}
                className="font-mono"
              />
              <Input
                type="date"
                value={fin}
                min={inicio || minimoInicio}
                max={campaign.endDate ?? undefined}
                aria-label="Fin del periodo especial"
                onChange={(e) => setFin(e.target.value)}
                disabled={!puedeSerEspecial}
                className="font-mono"
              />
            </div>
          </Field>

          <Field label="Multiplicador de experiencia" hint={`Tope máximo del sistema: ×${MULTIPLICADOR_MAXIMO}`}>
            <select
              value={multiplicador}
              onChange={(e) => setMultiplicador(Number(e.target.value))}
              disabled={!puedeSerEspecial}
              className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none focus:border-brand-600"
            >
              {Array.from({ length: MULTIPLICADOR_MAXIMO }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  ×{m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Bonificación por cuota completa">
            <Input value={`${BONO_POR_CUOTA} XP`} disabled className="bg-system-100 font-mono" />
          </Field>

          <Field label="Insignia exclusiva (opcional)" hint="Al completar la cuota. Escribe su nombre, p. ej. Guardián verde">
            <Input
              value={insignia}
              maxLength={LARGO_MAXIMO_DE_INSIGNIA}
              placeholder="Sin insignia"
              onChange={(e) => setInsignia(e.target.value)}
              disabled={!puedeSerEspecial}
            />
          </Field>
        </div>

        <div>
          <div className="mb-4 rounded-lg bg-system-100 p-4">
            <p className="mb-2.5 text-[12px] font-medium text-system-900">Con ×{multiplicador}, cada aporte aprobado otorga</p>
            {tipos.map((tipo, i) => (
              <div
                key={tipo}
                className={`flex justify-between py-1.5 text-[13px] ${i < tipos.length - 1 ? "border-b border-system-300" : ""}`}
              >
                <span className="text-system-600">{NOMBRE_DEL_TIPO[tipo]}</span>
                <span className="font-mono">
                  {XP_BASE_POR_TIPO[tipo]} → {XP_BASE_POR_TIPO[tipo] * multiplicador} XP
                </span>
              </div>
            ))}
          </div>

          <div className="mb-5 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">
            El tope diario de experiencia por usuario sigue vigente durante el periodo especial.
          </div>

          {error && (
            <p role="alert" className="mb-3 rounded-lg bg-error-50 p-3 text-[12.5px] text-error-700">
              {error}
            </p>
          )}

          <Button variant="primary" className="w-full" onClick={() => void publicar()} disabled={!puedeSerEspecial || guardando || quitando}>
            {guardando ? (
              <span className="inline-flex items-center gap-2">
                <IndicadorDeCarga />
                Guardando…
              </span>
            ) : especial ? "Guardar incentivos" : "Publicar campaña especial"}
          </Button>
          {especial && (
            <Button variant="danger" className="mt-2.5 w-full" onClick={() => setConfirmarQuitar(true)} disabled={guardando || quitando}>
              Quitar incentivos
            </Button>
          )}
        </div>
      </div>

      <VentanaDeConfirmacion
        abierto={confirmarQuitar}
        titulo="¿Quitar los incentivos?"
        textoConfirmar="Quitar incentivos"
        textoOcupado="Quitando…"
        ocupado={quitando}
        peligro
        onCancelar={() => setConfirmarQuitar(false)}
        onConfirmar={() => void quitar()}
      >
        <p>
          La campaña deja de ser especial: sin multiplicador de experiencia ni insignia. Los aportes aprobados
          hasta ahora conservan lo que ya ganaron. Puedes volver a hacerla especial después.
        </p>
      </VentanaDeConfirmacion>
    </div>
  );
}
