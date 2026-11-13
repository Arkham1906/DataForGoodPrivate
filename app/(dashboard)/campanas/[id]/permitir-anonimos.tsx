"use client";

// Interruptor "Permitir aportes sin cuenta" de Compartir (/campanas/[id]) y de /mis-campanas/[id].
// Solo lo ve el creador. Llama a PATCH /api/campanas/[id]/enlace { permiteAnonimos }. Apagarlo
// no toca los aportes anónimos ya recibidos: solo hace que /c/[token] pida iniciar sesión.
// Con el interruptor encendido, "¿Cuántos aportes sin cuenta aceptas?" (2026-11-13, a pedido del usuario): el
// creador escribe un número entero desde 1, sin tope, y lo guarda con PATCH { limiteAnonimos }. Vacío guarda null:
// se aceptan `porDefecto`, el 10% de la meta (lib/campanas/tope-anonimos.ts).
// Desde el 2026-11-13 (a pedido del usuario) las campañas nuevas empiezan con el interruptor apagado y, al
// encenderlo, una ventana avisa de los riesgos (contenido basura, inapropiado, falso o con datos de terceros);
// solo se enciende si el creador confirma. Apagarlo no pide confirmación.

import { useRef, useState } from "react";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { BASE_PATH } from "@/lib/base-path";

const nf = new Intl.NumberFormat("es-MX");

function aportes(n: number): string {
  return `${nf.format(n)} ${n === 1 ? "aporte" : "aportes"}`;
}

export default function PermitirAnonimos({
  campanaId,
  inicial,
  onCambio,
  limiteInicial,
  porDefecto,
  onLimite,
  compacto = false,
}: {
  campanaId: string;
  inicial: boolean;
  onCambio: (permitir: boolean) => void;
  /** El número que eligió el creador; null = el 10% de la meta. */
  limiteInicial: number | null;
  /** Lo que se acepta sin número: el 10% de la meta, hacia abajo. */
  porDefecto: number;
  onLimite?: (limite: number | null) => void;
  compacto?: boolean;
}) {
  const [permitir, setPermitir] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El número guardado (null = el 10%) y lo que hay escrito en el campo (vacío = el 10%).
  const [limite, setLimite] = useState<number | null>(limiteInicial);
  const [escrito, setEscrito] = useState(limiteInicial === null ? "" : String(limiteInicial));
  const [aviso, setAviso] = useState<string | null>(null);
  // Ventana de riesgos abierta (al intentar encender el interruptor).
  const [confirmando, setConfirmando] = useState(false);
  // Al confirmar, el foco va al campo de la cantidad (2026-11-13: el usuario no veía dónde ajustarla).
  const campoDeCantidad = useRef<HTMLInputElement>(null);

  const vacio = escrito.trim() === "";
  const numero = Number(escrito);
  const valido = vacio || (Number.isInteger(numero) && numero >= 1);
  const pedido = vacio ? null : numero;
  const sinCambios = valido && pedido === limite;
  const vigente = limite ?? porDefecto;

  async function guardar(cuerpo: { permiteAnonimos?: boolean; limiteAnonimos?: number | null }) {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campanaId}/enlace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el cambio");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el cambio");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function cambiar(valor: boolean): Promise<boolean> {
    if (!(await guardar({ permiteAnonimos: valor }))) return false;
    setPermitir(valor);
    onCambio(valor);
    return true;
  }

  /** Encender pasa antes por la ventana de riesgos; apagar es inmediato. */
  function alPulsar(valor: boolean) {
    if (valor) setConfirmando(true);
    else void cambiar(false);
  }

  async function confirmarActivacion() {
    const activado = await cambiar(true);
    // Si falló, el error se ve bajo el interruptor; la ventana se cierra igual para que se lea.
    setConfirmando(false);
    // El campo aparece al encender: se enfoca cuando ya está pintado y la ventana cerrada.
    if (activado) setTimeout(() => campoDeCantidad.current?.focus(), 50);
  }

  async function guardarLimite() {
    if (!valido) {
      setError("Escribe un número entero mayor que 0, o déjalo vacío para usar el 10% de la meta.");
      return;
    }
    if (await guardar({ limiteAnonimos: pedido })) {
      setLimite(pedido);
      onLimite?.(pedido);
      setAviso(
        pedido === null
          ? `Listo: se usa el 10% de la meta, ${aportes(porDefecto)} sin cuenta.`
          : `Listo: la campaña acepta hasta ${aportes(pedido)} sin cuenta.`,
      );
    }
  }

  const texto = compacto ? "text-[10px]" : "text-[11.5px]";

  return (
    <div
      className={
        compacto
          ? "relative z-10 mb-2 rounded-lg border border-system-200 bg-system-50 px-2.5 py-2"
          : "mb-4 rounded-lg border border-system-200 px-3.5 py-3"
      }
    >
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-system-900">
        <input
          type="checkbox"
          role="switch"
          checked={permitir}
          disabled={guardando}
          aria-haspopup={permitir ? undefined : "dialog"}
          onChange={(e) => alPulsar(e.target.checked)}
          className="relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-system-300 transition-colors before:absolute before:left-1 before:top-1 before:size-4 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:bg-brand-600 checked:before:translate-x-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-wait disabled:opacity-60"
        />
        <span>
          <span className={`font-medium ${compacto ? "text-[11.5px]" : ""}`}>Permitir aportes sin cuenta</span>
          <span className={`block text-system-500 ${texto}`}>
            {permitir
              ? "Quien tenga el enlace podrá aportar sin iniciar sesión. Al desactivarlo, los aportes recibidos se conservan."
              : "Los aportes anónimos están desactivados; quien tenga el enlace deberá iniciar sesión."}
          </span>
        </span>
      </label>

      {permitir && (
        <form
          className="mt-3 border-t border-system-200 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void guardarLimite();
          }}
        >
          <label htmlFor={`limite-anonimos-${campanaId}`} className={`block font-medium text-system-900 ${compacto ? "text-[11.5px]" : "text-[13px]"}`}>
            ¿Cuántos aportes sin cuenta aceptas?
          </label>
          <p id={`limite-anonimos-ayuda-${campanaId}`} className={`mb-2 text-system-500 ${texto}`}>
            Escribe un número entero. Si lo dejas vacío, se usa el 10% de la meta ({aportes(porDefecto)}). Ahora acepta{" "}
            {aportes(vigente)}
            {limite === null ? " (el 10%)" : ""}. Los que ya llegaron no se borran aunque elijas menos.
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={campoDeCantidad}
              id={`limite-anonimos-${campanaId}`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={escrito}
              placeholder={String(porDefecto)}
              disabled={guardando}
              onChange={(e) => {
                setEscrito(e.target.value);
                setAviso(null);
                setError(null);
              }}
              aria-describedby={`limite-anonimos-ayuda-${campanaId}`}
              aria-invalid={!valido ? true : undefined}
              className="w-28 rounded border border-system-300 bg-white px-3 py-2 text-[14px] text-system-900 outline-none focus:border-brand-600 aria-invalid:border-error-700 aria-invalid:bg-error-50"
            />
            <button
              type="submit"
              disabled={guardando || !valido || sinCambios}
              className="rounded-pill bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {aviso && (
        <p className="mt-1.5 text-[12px] font-medium text-success-700" role="status">
          {aviso}
        </p>
      )}
      {error && (
        <p className="mt-1.5 text-[12px] font-medium text-error-700" role="alert">
          {error}
        </p>
      )}

      <VentanaDeConfirmacion
        abierto={confirmando}
        titulo="¿Permitir aportes sin cuenta?"
        textoConfirmar="Sí, permitir aportes sin cuenta"
        textoOcupado="Activando…"
        ocupado={guardando}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => void confirmarActivacion()}
      >
        <p className="mb-3 rounded-lg border border-warning-200 bg-warning-50 p-3 text-warning-800">
          Cualquier persona con el enlace podrá enviar aportes sin identificarse. Antes de activarlo, ten en cuenta los riesgos:
        </p>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-system-700">
          <li>
            <strong className="font-semibold text-system-900">Contenido basura o spam:</strong> archivos sin relación con la
            campaña, repetidos, de prueba o sin sentido.
          </li>
          <li>
            <strong className="font-semibold text-system-900">Contenido inapropiado u ofensivo:</strong> imágenes, videos, audios
            o textos violentos, sexuales o que agreden a alguien, y que te tocará ver al revisarlos.
          </li>
          <li>
            <strong className="font-semibold text-system-900">Información falsa o engañosa</strong> que puede bajar la calidad de
            los datos de tu campaña.
          </li>
          <li>
            <strong className="font-semibold text-system-900">Datos personales de otras personas</strong> (rostros, placas,
            direcciones o documentos) subidos sin su permiso.
          </li>
          <li>
            <strong className="font-semibold text-system-900">Nadie responde por el aporte:</strong> sin cuenta no hay a quién
            sancionar; solo puedes rechazarlo, marcarlo como inapropiado o bloquear el dispositivo.
          </li>
        </ul>
        <p className="text-system-600">
          Todos los aportes sin cuenta quedan pendientes hasta que tú o tus revisores los acepten, y solo los aceptados
          cuentan para la meta. Puedes limitar cuántos recibes y desactivar la opción cuando quieras.
        </p>
      </VentanaDeConfirmacion>
    </div>
  );
}
