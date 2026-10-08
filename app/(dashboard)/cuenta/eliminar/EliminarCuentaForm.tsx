"use client";

// Formulario de /cuenta/eliminar: destino de los aportes y confirmación (contraseña si la
// cuenta tiene una, y escribir ELIMINAR). Acción: DELETE /api/usuarios/[id]. Si sale bien,
// la sesión ya está cerrada y se va a /baja-solicitada con la fecha y lo aplicado.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Tag from "@/components/ui/Tag";
import { Field, Input } from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { BASE_PATH } from "@/lib/base-path";
import {
  DESTINOS_DE_APORTES,
  PALABRA_DE_CONFIRMACION,
  type DestinoDeAportes,
} from "@/lib/usuarios/baja-opciones";

export default function EliminarCuentaForm({
  usuarioId,
  tieneContrasena,
  aportes,
  xp,
}: {
  usuarioId: number;
  tieneContrasena: boolean;
  aportes: { total: number; utilizados: number; campanas: number };
  xp: number;
}) {
  const router = useRouter();
  // Sin aportes la elección no cambia nada: se manda "anonimizar" sin preguntar.
  const [destino, setDestino] = useState<DestinoDeAportes | null>(aportes.total === 0 ? "anonimizar" : null);
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const puedeEnviar =
    destino !== null &&
    confirmacion === PALABRA_DE_CONFIRMACION &&
    (!tieneContrasena || contrasena.length > 0) &&
    !enviando;

  function descripcionDe(valor: DestinoDeAportes, base: string): string {
    if (valor === "eliminar" && aportes.utilizados > 0) {
      const borrables = aportes.total - aportes.utilizados;
      const borrado = borrables === 1 ? "Solo se borraría 1" : `Solo se borrarían ${borrables}`;
      const resto =
        aportes.utilizados === 1
          ? "El ya utilizado pasaría a anónimo de todos modos."
          : `Los ${aportes.utilizados} ya utilizados pasarían a anónimos de todos modos.`;
      return `${borrado} de ${aportes.total}. ${resto}`;
    }
    return base;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar || !destino) return;
    setEnviando(true);
    setError("");
    try {
      const response = await fetch(`${BASE_PATH}/api/usuarios/${usuarioId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destino, contrasena, confirmacion }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "No se pudo registrar la baja");
        setEnviando(false);
        return;
      }
      const datos = new URLSearchParams({
        hasta: payload.data.efectivaEn,
        finalizadas: String(payload.data.campanasFinalizadas),
        aportes: String(aportes.total),
        xp: String(xp),
        destino,
      });
      router.replace(`/baja-solicitada?${datos}`);
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-6">
      {aportes.total > 0 && (
        <section className="rounded-lg border border-system-200 bg-white p-5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-system-400">
            ¿Qué hacemos con tus aportes?
          </p>
          <p className="mt-1 text-[12.5px] text-system-600">
            Tienes {aportes.total} {aportes.total === 1 ? "aporte" : "aportes"} en {aportes.campanas}{" "}
            {aportes.campanas === 1 ? "campaña" : "campañas"}. Elige una opción.
          </p>
          <div className="mt-3 space-y-2.5" role="radiogroup" aria-label="Destino de tus aportes">
            {DESTINOS_DE_APORTES.map((opcion) => {
              const elegido = destino === opcion.valor;
              return (
                <label
                  key={opcion.valor}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-colors ${
                    elegido ? "border-brand-600 bg-brand-50" : "border-system-300 hover:border-brand-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="destino"
                    value={opcion.valor}
                    checked={elegido}
                    onChange={() => setDestino(opcion.valor)}
                    className="mt-1 accent-brand-600"
                  />
                  <span>
                    <span className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-system-900">
                      {opcion.titulo}
                      {opcion.valor === "eliminar" && aportes.utilizados > 0 && <Tag tone="warn">Parcial</Tag>}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-system-600">
                      {descripcionDe(opcion.valor, opcion.descripcion)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-system-200 bg-white p-5">
        {tieneContrasena && (
          <Field label="Confirma con tu contraseña" required>
            <PasswordInput
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
        )}
        <Field label={`Escribe ${PALABRA_DE_CONFIRMACION} para confirmar`} required>
          <Input
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={PALABRA_DE_CONFIRMACION}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </Field>

        {error && (
          <p className="mb-3 rounded-lg bg-error-50 px-3.5 py-2.5 text-[13px] text-error-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2.5">
          <ButtonLink href="/cuenta" variant="secondary">
            Cancelar
          </ButtonLink>
          <Button type="submit" variant="danger" disabled={!puedeEnviar}>
            {enviando ? "Registrando…" : "Eliminar mi cuenta"}
          </Button>
        </div>
      </section>
    </form>
  );
}
