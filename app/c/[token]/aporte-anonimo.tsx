"use client";

// Formulario de /c/[token] para aportar SIN cuenta. Envía a POST /api/c/[token]/aportes,
// que valida el enlace, la cuota por dispositivo, el tope por IP y la espera entre aportes.
// Después de enviar, la persona solo ve cuántos aportes le quedan y una cuenta regresiva
// hasta el siguiente: no puede consultar ni editar lo que mandó.
// Sin cuenta no hay inscripción: las dos casillas de los acuerdos (ui/AcuerdosDeAporte) van en el
// formulario, sin ventana, y se quedan marcadas entre aportes de la misma visita (2026-10-15).

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import { CasillasDeAcuerdos, SIN_ACUERDOS, acuerdosCompletos, agregarAcuerdos } from "@/components/ui/AcuerdosDeAporte";
import { Field, Textarea } from "@/components/ui/Input";
import SelectorDeArchivo from "@/components/ui/SelectorDeArchivo";
import { LARGO_MAXIMO_DESCRIPCION, archivoEsOpcional, type TipoDeArchivo } from "@/lib/aportes/archivo";
import { BASE_PATH } from "@/lib/base-path";
import { etiquetaDeRespuesta, type SeccionDeChecklist } from "@/lib/campanas/checklist";

export default function AporteAnonimo({
  token,
  secciones,
  tipos,
  cuota,
  restantesIniciales,
  esperaInicial,
}: {
  token: string;
  secciones: SeccionDeChecklist[];
  /** Tipos de archivo que acepta la campaña; con "texto", el archivo es opcional. */
  tipos: TipoDeArchivo[];
  cuota: number;
  restantesIniciales: number;
  /** Segundos que faltan para poder enviar otro (lo calcula el servidor). */
  esperaInicial: number;
}) {
  const [restantes, setRestantes] = useState(restantesIniciales);
  const [espera, setEspera] = useState(esperaInicial);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [acuerdos, setAcuerdos] = useState(SIN_ACUERDOS);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  // Cambia la key del input de archivo para vaciarlo después de enviar.
  const [vuelta, setVuelta] = useState(0);

  // Cuenta regresiva de la espera. Solo informa: el servidor la vuelve a comprobar.
  const enEspera = espera > 0;
  useEffect(() => {
    if (!enEspera) return;
    const intervalo = setInterval(() => setEspera((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(intervalo);
  }, [enEspera]);

  function alternar(valor: string) {
    setMarcadas((actual) => (actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor]));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError(null);
    try {
      const datos = new FormData();
      if (archivo) datos.set("file", archivo);
      datos.set("description", descripcion);
      marcadas.forEach((valor) => datos.append("caracteristicas", valor));
      agregarAcuerdos(datos, acuerdos);
      const response = await fetch(`${BASE_PATH}/api/c/${encodeURIComponent(token)}/aportes`, { method: "POST", body: datos });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        // La espera no es un error: el botón muestra la cuenta regresiva.
        if (payload.esperaSegundos) {
          setEspera(Number(payload.esperaSegundos));
          return;
        }
        throw new Error(payload.error ?? "No se pudo enviar el aporte");
      }
      setRestantes(Number(payload.data?.restantes ?? 0));
      setEspera(Number(payload.data?.esperaSegundos ?? 0));
      setEnviado(true);
      setArchivo(null);
      setDescripcion("");
      setMarcadas([]);
      setVuelta((v) => v + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el aporte");
    } finally {
      setEnviando(false);
    }
  }

  if (restantes <= 0) {
    return (
      <p className="rounded-lg border border-success-700 bg-success-50 p-3.5 text-[13px] text-success-700">
        {enviado ? "¡Gracias! Tu aporte quedó pendiente de revisión. " : ""}
        Ya enviaste los {cuota} {cuota === 1 ? "aporte" : "aportes"} que permite esta campaña desde este dispositivo.
      </p>
    );
  }

  const puedeEnviar =
    (Boolean(archivo) || archivoEsOpcional(tipos)) &&
    descripcion.trim().length > 0 &&
    descripcion.length <= LARGO_MAXIMO_DESCRIPCION &&
    acuerdosCompletos(acuerdos) &&
    !enviando &&
    espera === 0;

  return (
    <form onSubmit={(e) => void enviar(e)}>
      {enviado && (
        <p className="mb-4 rounded-lg border border-success-700 bg-success-50 p-3.5 text-[13px] text-success-700" role="status">
          ¡Gracias! Tu aporte quedó pendiente de revisión. Puedes enviar {restantes} más.
        </p>
      )}

      <SelectorDeArchivo
        className="mb-4"
        tipos={tipos}
        archivo={archivo}
        error={errorArchivo}
        reinicio={vuelta}
        onCambio={(elegido, problema) => {
          setArchivo(elegido);
          setErrorArchivo(problema);
        }}
      />

      <Field label="Descripción" required>
        <Textarea
          rows={4}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Describe lo que aportas"
          maxLength={LARGO_MAXIMO_DESCRIPCION}
          required
        />
      </Field>
      <p className="mb-4 text-right font-mono text-[11px] text-system-500">
        {descripcion.length} / {LARGO_MAXIMO_DESCRIPCION}
      </p>

      {secciones.map((seccion, i) => (
        <fieldset key={seccion.titulo || i} className="mb-4 rounded-lg border border-system-200 bg-white p-3.5">
          <legend className="px-1 text-[13px] font-medium text-system-900">{seccion.titulo || "Marca lo que aplique"}</legend>
          {seccion.opciones.map((opcion) => {
            const valor = etiquetaDeRespuesta(seccion.titulo, opcion);
            return (
              <label key={opcion} className="mb-2 flex items-center gap-2 text-[12.5px] text-system-600 last:mb-0">
                <input type="checkbox" checked={marcadas.includes(valor)} onChange={() => alternar(valor)} />
                {opcion}
              </label>
            );
          })}
        </fieldset>
      ))}

      <div className="mb-4 rounded-lg border border-system-200 bg-white p-3.5">
        <CasillasDeAcuerdos acuerdos={acuerdos} onCambio={setAcuerdos} deshabilitado={enviando} />
      </div>

      {error && (
        <p className="mb-3 rounded border border-error-700 bg-error-50 p-2 text-[12px] text-error-700" role="alert">
          {error}
        </p>
      )}

      <Button variant="primary" type="submit" className="w-full" disabled={!puedeEnviar}>
        {enviando ? (
          <span className="inline-flex items-center gap-2">
            <IndicadorDeCarga />
            Enviando…
          </span>
        ) : espera > 0 ? `Podrás enviar otro en ${espera} s` : "Enviar aporte sin cuenta"}
      </Button>
      <p className="mt-2 text-center text-[11.5px] text-system-500">
        Se registra como anónimo y queda pendiente de revisión. Te quedan {restantes} de {cuota} desde este dispositivo.
      </p>
    </form>
  );
}
