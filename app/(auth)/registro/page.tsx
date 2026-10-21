"use client";

// Pantalla /registro: alta de cuenta.
// Acción: POST /api/usuarios (crea la cuenta sin verificar y envía el código) → /verificar.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { REGLAS_DE_CONTRASENA } from "@/lib/reglas-contrasena";
import { BASE_PATH } from "@/lib/base-path";
import { conDestino } from "@/lib/redireccion";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-label="Google">
      <path
        fill="#4285F4"
        d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.2 3-7.3z"
      />
      <path
        fill="#34A853"
        d="M12 21c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2.1.9-3.5.9-2.7 0-5-1.8-5.8-4.2H.5v2.6A10 10 0 0 0 12 21z"
      />
      <path
        fill="#FBBC05"
        d="M6.2 14.6a6.1 6.1 0 0 1 0-3.9V8.1H.5a10 10 0 0 0 0 9.1l5.7-4.6z"
      />
      <path
        fill="#EA4335"
        d="M12 6c1.5 0 2.9.6 4 1.7l3-3C17 1.7 14.7 0 12 0A10 10 0 0 0 .5 17.2l5.7-4.5C7.1 7.8 9.3 6 12 6z"
      />
    </svg>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegistroForm />
    </Suspense>
  );
}

function RegistroForm() {
  const router = useRouter();
  // Pantalla a la que volver al terminar el registro (?next=, ver lib/redireccion.ts).
  const next = useSearchParams().get("next");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allRulesPass = REGLAS_DE_CONTRASENA.every((r) => r.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = nombre && apellidos && email && allRulesPass && passwordsMatch && acceptedTerms;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    setEmailTaken(false);

    if (!canSubmit) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${BASE_PATH}/api/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          apellidos,
          email,
          password,
          role: "usuario",
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          setEmailTaken(true);
          setServerError("Ese correo ya está registrado");
        } else {
          setServerError(payload.error ?? "No se pudo crear la cuenta");
        }
        return;
      }

      router.push(conDestino("/verificar", next));
    } catch (error) {
      setServerError("No se pudo conectar con el servicio de usuarios");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-system-200 bg-white p-8">
      <div className="mb-2 text-center">
        <h1 className="text-xl font-extrabold text-system-900">Crea tu cuenta</h1>
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-wider text-brand-600">
          Paso 1 de 4 · Tus datos
        </p>
      </div>

      <div className="my-5 flex gap-1.5">
        <div className="h-1 flex-1 rounded-pill bg-brand-600" />
        <div className="h-1 flex-1 rounded-pill bg-system-200" />
        <div className="h-1 flex-1 rounded-pill bg-system-200" />
        <div className="h-1 flex-1 rounded-pill bg-system-200" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col">
        <Field label="Nombre" required>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Carlos"
            required
          />
        </Field>

        <Field label="Apellidos" required>
          <Input
            value={apellidos}
            onChange={(e) => setApellidos(e.target.value)}
            placeholder="Pérez"
            required
          />
        </Field>

        <Field label="Correo" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // El aviso de correo ya registrado es de este campo: se quita al corregirlo.
              if (emailTaken) {
                setEmailTaken(false);
                setServerError("");
              }
            }}
            placeholder="carlos@correo.com"
            required
            className={emailTaken ? "border-error-700 bg-error-50" : ""}
          />
          {serverError && (
            <p className="mt-1.5 text-[12px] text-error-700">{serverError}</p>
          )}
        </Field>

        <Field label="Contraseña" required>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>

        <Field label="Confirmar contraseña" required>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            className={
              confirmPassword.length > 0 && !passwordsMatch ? "border-error-700" : ""
            }
          />
        </Field>

        <ul className="mb-4 flex flex-col gap-1.5">
          {REGLAS_DE_CONTRASENA.map((rule) => {
            const pass = rule.test(password);
            return (
              <li
                key={rule.label}
                className={`text-[12.5px] ${pass ? "text-success-700" : "text-system-500"}`}
              >
                {pass ? "✓" : "·"} {rule.label}
              </li>
            );
          })}
        </ul>

        <label className="mb-5 flex items-start gap-2.5 text-[12.5px] text-system-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5"
          />
          {/* En otra pestaña: así no se pierde lo que ya se escribió en el formulario. */}
          <span>
            Acepto los{" "}
            <Link href="/terminos" target="_blank" rel="noopener" className="text-brand-600 hover:underline">
              términos de uso
            </Link>{" "}
            y el{" "}
            <Link href="/privacidad" target="_blank" rel="noopener" className="text-brand-600 hover:underline">
              aviso de privacidad
            </Link>
          </span>
        </label>

        <Button variant="primary" type="submit" className="w-full" disabled={!canSubmit || submitting}>
          {submitting ? "Creando cuenta..." : "Continuar"}
        </Button>

        <Button
          variant="secondary"
          type="button"
          className="mt-3 w-full"
          // Con Google también se crea la cuenta: primero hay que aceptar los términos.
          disabled={!acceptedTerms}
          onClick={() => {
            window.location.href = `${BASE_PATH}${conDestino("/api/auth/google", next)}`;
          }}
        >
          <GoogleLogo />
          <span>Continuar con Google</span>
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-system-600">
        ¿Ya tienes cuenta?{" "}
        <Link href={conDestino("/entrar", next)} className="font-medium text-brand-600 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
