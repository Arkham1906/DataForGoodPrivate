"use client";

// Pantalla /entrar: inicio de sesión con correo/contraseña o Google.
// Acciones: POST /api/auth/login; Google vía GET /api/auth/google?next=...
// Respeta ?next= (lib/redireccion.ts) para volver a la pantalla que se pidió.
// Si iniciar sesión canceló una baja de cuenta (bajaCancelada en la respuesta del login, o
// ?baja=cancelada desde el regreso de Google), muestra el aviso antes de seguir.
// "¿Olvidaste tu contraseña?" lleva a /recuperar, que regresa con ?contrasena=cambiada.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { retraso } from "@/lib/animaciones";
import { BASE_PATH } from "@/lib/base-path";
import { conDestino, destinoSeguro } from "@/lib/redireccion";

const ERRORES_DE_URL: Record<string, string> = {
  google: "No se pudo iniciar sesión con Google. Intenta de nuevo.",
  // Google con un correo de la lista negra y sin cuenta (lib/usuarios/lista-negra.ts).
  correo_bloqueado: "Este correo no puede usarse en DataForGood porque su cuenta fue baneada.",
};

export default function EntrarPage() {
  return (
    <Suspense fallback={null}>
      <EntrarForm />
    </Suspense>
  );
}

function EntrarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // El error que llega en la URL (?error=google|bloqueada, desde el login con
  // Google) es el valor inicial; enviar el formulario lo limpia.
  const [serverError, setServerError] = useState(
    () => ERRORES_DE_URL[searchParams.get("error") ?? ""] ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  // La sesión ya está abierta: el aviso solo explica y deja continuar.
  const [bajaCancelada, setBajaCancelada] = useState(() => searchParams.get("baja") === "cancelada");
  // Viene de /recuperar tras cambiar la contraseña.
  const contrasenaCambiada = searchParams.get("contrasena") === "cambiada";
  // Pantalla que se pidió sin sesión (proxy.ts la manda en ?next=).
  const next = searchParams.get("next");
  const destino = destinoSeguro(next);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    setSubmitting(true);

    try {
      const response = await fetch(`${BASE_PATH}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        if (payload.requiresVerification) {
          router.push(conDestino("/verificar", next));
          return;
        }

        setServerError(payload.error ?? "No se pudo iniciar sesión");
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (payload.bajaCancelada) {
        setBajaCancelada(true);
        return;
      }

      continuar();
    } catch {
      setServerError("No se pudo conectar con el servicio de usuarios");
    } finally {
      setSubmitting(false);
    }
  }

  function continuar() {
    router.push(destino);
    router.refresh();
  }

  if (bajaCancelada) {
    return (
      <div className="rounded-lg border border-system-200 bg-white p-8" role="status">
        <p className="mb-2 font-mono text-[10.5px] uppercase tracking-widest text-success-700">Baja cancelada</p>
        <h1 className="text-xl font-extrabold text-system-900">Tu cuenta sigue activa</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-system-600">
          Al iniciar sesión cancelamos la baja que habías pedido: no se borrará nada y tus aportes se quedan como
          estaban.
        </p>
        <p className="mt-3 rounded-lg bg-system-100 p-3.5 text-[12.5px] leading-relaxed text-system-600">
          Las campañas que se finalizaron al pedir la baja siguen finalizadas: puedes reactivarlas desde{" "}
          <span className="font-semibold text-system-900">Mis campañas</span> con una nueva fecha de fin. Las que no tenían
          aportes se borraron y no se pueden recuperar.
        </p>
        <Button variant="primary" className="mt-5 w-full" onClick={continuar}>
          Continuar
        </Button>
      </div>
    );
  }

  return (
    <div className="landing-entrada rounded-lg border border-system-200 bg-white p-8">
      <div style={retraso(120)} className="landing-entrada mb-6 text-center">
        <h1 className="text-xl font-extrabold text-system-900">Entra a tu cuenta</h1>
        <p className="mt-1 text-[13px] text-system-600">
          Participa en campañas o administra las tuyas.
        </p>
      </div>

      {contrasenaCambiada && (
        <div role="status" className="mb-5 rounded-lg bg-success-50 p-3.5 text-[12.5px] leading-relaxed text-success-700">
          Tu contraseña se cambió y cerramos tu sesión en todos los dispositivos. Ya puedes entrar con la nueva.
        </div>
      )}

      <form onSubmit={handleSubmit} style={retraso(220)} className="landing-entrada flex flex-col">
        <Field label="Correo" required>
          <Input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@correo.com"
            required
          />
        </Field>
        <Field label="Contraseña" required>
          <PasswordInput
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {serverError && (
            <p className="mt-1.5 text-[12px] text-error-700">{serverError}</p>
          )}
        </Field>

        <Link href={conDestino("/recuperar", next)} className="mb-5 text-[13px] font-medium text-brand-600 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>

        <Button variant="primary" type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </Button>
        <Button
          variant="secondary"
          type="button"
          className="mt-2.5 w-full"
          onClick={() => {
            window.location.href = `${BASE_PATH}${conDestino("/api/auth/google", next)}`;
          }}
        >
          Continuar con Google
        </Button>
      </form>

      <p style={retraso(320)} className="landing-entrada mt-6 text-center text-[13px] text-system-600">
        ¿No tienes cuenta?{" "}
        <Link href={conDestino("/registro", next)} className="font-medium text-brand-600 hover:underline">
          Regístrate
        </Link>
      </p>

      <div style={retraso(400)} className="landing-entrada mt-6 rounded-lg bg-system-100 p-4 text-[12.5px] leading-relaxed text-system-600">
        Toda cuenta entra como usuario común. El rol de supervisor solo lo
        asigna el SuperUsuario; el de revisor de aportes te lo ofrece quien
        creó una campaña, y lo aceptas desde tus notificaciones. Aparecen
        dentro de la misma sesión.
      </div>
    </div>
  );
}
