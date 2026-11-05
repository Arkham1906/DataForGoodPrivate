"use client";

// Formulario de /root. Acción: POST /api/auth/root, que crea la cookie root_session_token.
// Si falla, una alerta arriba del formulario (2026-11-04, a pedido del usuario; antes una línea bajo la
// credencial que pasaba desapercibida). Se quita al volver a escribir.

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/sistema/Button";
import { Field, Input } from "@/components/sistema/Input";
import { BASE_PATH } from "@/lib/base-path";

/** Destino tras validar la credencial: SCR-WEB-28, Panel del sistema. */
const PANEL_DEL_SISTEMA = "/sistema";

export default function RootLoginForm() {
  const router = useRouter();
  const idError = useId();

  const [identificador, setIdentificador] = useState("");
  const [credencial, setCredencial] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const incompleto = identificador.trim() === "" || credencial === "";

  function alEscribir(guardar: (valor: string) => void, valor: string) {
    guardar(valor);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando || incompleto) return;

    setEnviando(true);
    setError("");

    try {
      const response = await fetch(`${BASE_PATH}/api/auth/root`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // La cookie de sesión la emite el servidor; nunca se toca desde el cliente.
        credentials: "same-origin",
        body: JSON.stringify({ identificador: identificador.trim(), credencial }),
      });

      if (response.ok) {
        setCredencial("");
        router.replace(PANEL_DEL_SISTEMA);
        router.refresh();
        return;
      }

      // Un mensaje único para credencial inexistente o incorrecta: distinguirlas
      // permitiría enumerar identificadores válidos.
      setError(
        response.status === 429
          ? "Demasiados intentos. Espera un minuto antes de volver a intentarlo."
          : "Credenciales incorrectas. Revisa tu identificador y tu credencial e inténtalo de nuevo."
      );
      setCredencial("");
    } catch {
      setError("No se pudo contactar al servidor. Revisa tu conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col" noValidate>
      {error && (
        <div id={idError} role="alert" className="mb-4 rounded-lg border border-error-700/40 bg-error-50 p-3 text-[13px] font-semibold text-error-700">
          {error}
        </div>
      )}
      <Field label="Identificador" required>
        <Input
          name="identificador"
          type="text"
          value={identificador}
          onChange={(e) => alEscribir(setIdentificador, e.target.value)}
          placeholder="Tu identificador"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={enviando}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : undefined}
          required
        />
      </Field>
      <Field label="Credencial" required>
        <Input
          name="credencial"
          type="password"
          value={credencial}
          onChange={(e) => alEscribir(setCredencial, e.target.value)}
          placeholder="••••••••••••"
          autoComplete="off"
          disabled={enviando}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : undefined}
          required
        />
      </Field>

      <Button
        variant="primary"
        type="submit"
        className="w-full"
        disabled={enviando || incompleto}
      >
        {enviando ? "Verificando…" : "Acceder"}
      </Button>
    </form>
  );
}
