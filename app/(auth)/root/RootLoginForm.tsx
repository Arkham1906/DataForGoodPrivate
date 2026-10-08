"use client";

// Formulario de /root. Acción: POST /api/auth/root, que crea la cookie root_session_token.

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
          : "La credencial no es válida."
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
      <Field label="Identificador" required>
        <Input
          name="identificador"
          type="text"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          placeholder="Tu identificador"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={enviando}
          required
        />
      </Field>
      <Field label="Credencial" required>
        <Input
          name="credencial"
          type="password"
          value={credencial}
          onChange={(e) => setCredencial(e.target.value)}
          placeholder="••••••••••••"
          autoComplete="off"
          disabled={enviando}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : undefined}
          required
        />
        {error && (
          <p className="mt-1.5 text-[12px] text-error-700" id={idError} role="alert">
            {error}
          </p>
        )}
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
