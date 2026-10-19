"use client";

// Formulario de reporte a la plataforma (2026-10-12): motivo de la lista y/o descripción, con POST a
// `url`. Lo usan "Reportar campaña" (/campanas/[id]) y "Reportar a quien aportó" (detalle de un aporte
// del creador y del revisor). El reporte llega a la bandeja del SuperUsuario (/reportes). Uno por persona:
// con `yaReportado` solo muestra el aviso. Con `enVentana` (2026-10-16, "Reportar campaña") el formulario
// se abre en una ventana emergente (ui/VentanaDeConfirmacion) en vez de desplegarse en la página.

import { useState } from "react";
import Button from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Input";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { BASE_PATH } from "@/lib/base-path";
import { MAXIMO_DESCRIPCION_DE_REPORTE } from "@/lib/reportes/motivos";

export default function ReportarAPlataforma({
  url,
  motivos,
  titulo,
  explicacion,
  placeholder,
  yaReportado,
  textoYaReportado,
  enVentana = false,
  className = "",
}: {
  /** Ruta de la API sin basePath, p. ej. `/api/campanas/116/reportar`. */
  url: string;
  motivos: string[];
  titulo: string;
  explicacion: string;
  placeholder: string;
  yaReportado: boolean;
  textoYaReportado: string;
  /** Abre el formulario en una ventana emergente en vez de desplegarlo en la página. */
  enVentana?: boolean;
  className?: string;
}) {
  const [reportado, setReportado] = useState(yaReportado);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const puedeEnviar = (Boolean(motivo) || descripcion.trim().length > 0) && !enviando;

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo, descripcion }),
      });
      const payload = await response.json().catch(() => ({}));
      // 409: ya lo había reportado (otra pestaña): para la persona es lo mismo.
      if (!response.ok && response.status !== 409) throw new Error(payload.error ?? "No se pudo enviar el reporte");
      setReportado(true);
      setAbierto(false);
      setAviso(payload.message ?? "Gracias. El equipo de DataForGood revisará tu reporte.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el reporte");
    } finally {
      setEnviando(false);
    }
  }

  function cerrar() {
    setAbierto(false);
    setError(null);
  }

  if (reportado) {
    return (
      <p role="status" className={`rounded-lg bg-system-100 p-3 text-center text-[12.5px] text-system-600 ${className}`}>
        {aviso ?? textoYaReportado}
      </p>
    );
  }

  const botonParaAbrir = (
    <button
      type="button"
      onClick={() => setAbierto(true)}
      className={`self-center text-[12.5px] font-semibold text-system-600 underline-offset-2 hover:text-error-700 hover:underline ${className}`}
    >
      {titulo}
    </button>
  );

  const campos = (
    <>
      <label htmlFor="motivo-de-reporte" className="mb-1.5 block text-[13px] font-medium text-system-900">
        ¿Por qué lo reportas? <span className="text-error-700">*</span>
      </label>
      <select
        id="motivo-de-reporte"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="mb-2.5 w-full rounded border border-system-300 bg-white px-3 py-2.5 text-[13px] text-system-900 outline-none focus:border-brand-600"
      >
        <option value="">Selecciona un motivo ▾</option>
        {motivos.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <Field label="Describe lo que viste (opcional si elegiste un motivo)">
        <Textarea
          rows={3}
          maxLength={MAXIMO_DESCRIPCION_DE_REPORTE}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={placeholder}
        />
      </Field>
      {error && (
        <p role="alert" className="mb-3 text-[12.5px] text-error-700">
          {error}
        </p>
      )}
    </>
  );

  if (enVentana) {
    return (
      <>
        {botonParaAbrir}
        <VentanaDeConfirmacion
          abierto={abierto}
          titulo={titulo}
          textoConfirmar="Enviar reporte"
          textoOcupado="Enviando…"
          ocupado={enviando}
          peligro
          confirmarDeshabilitado={!puedeEnviar}
          onCancelar={cerrar}
          onConfirmar={() => void enviar()}
        >
          <p className="mb-4">{explicacion}</p>
          {campos}
        </VentanaDeConfirmacion>
      </>
    );
  }

  if (!abierto) return botonParaAbrir;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
      className={`rounded-lg border border-warning-500 bg-white p-5 ${className}`}
    >
      <h3 className="text-[15px] font-bold text-system-900">{titulo}</h3>
      <p className="mb-3 mt-1 text-[12px] text-system-500">{explicacion}</p>
      {campos}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={cerrar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" variant="danger" size="sm" disabled={!puedeEnviar}>
          {enviando ? "Enviando…" : "Enviar reporte"}
        </Button>
      </div>
    </form>
  );
}
