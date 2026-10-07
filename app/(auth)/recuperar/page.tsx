"use client";

// Pantalla /recuperar: "¿Olvidaste tu contraseña?" desde /entrar. Libre, sin sesión.
// Paso 1: el correo → POST /api/auth/recuperar (responde igual tenga o no cuenta).
// Paso 2: el código del correo y la contraseña nueva → POST /api/auth/recuperar/restablecer.
// Al terminar manda a /entrar?contrasena=cambiada (se cerraron todas las sesiones).
// Respeta ?next= (lib/redireccion.ts) para que /entrar regrese a la pantalla que se pidió.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { BASE_PATH } from "@/lib/base-path";
import { conDestino } from "@/lib/redireccion";
import { REGLAS_DE_CONTRASENA, cumpleReglasDeContrasena } from "@/lib/reglas-contrasena";
import { INTENTOS_POR_CODIGO, MINUTOS_DE_VIGENCIA, SEGUNDOS_ENTRE_ENVIOS } from "@/lib/usuarios/recuperacion-opciones";

export default function RecuperarPage() {
  return (
    <Suspense fallback={null}>
      <RecuperarForm />
    </Suspense>
  );
}

function RecuperarForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Segundos que faltan para poder pedir otro código (la ruta ignora los que lleguen antes).
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const temporizador = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [espera]);

  const coinciden = nueva.length > 0 && nueva === confirmar;
  const puedeCambiar = /^\d{6}$/.test(codigo) && cumpleReglasDeContrasena(nueva) && coinciden;

  async function pedirCodigo() {
    setError("");
    setEnviando(true);
    try {
      const response = await fetch(`${BASE_PATH}/api/auth/recuperar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "No se pudo enviar el código");
        return;
      }
      setPaso("codigo");
      setCodigo("");
      setEspera(SEGUNDOS_ENTRE_ENVIOS);
    } catch {
      setError("No se pudo conectar con el servicio de usuarios");
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarContrasena(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeCambiar) return;
    setError("");
    setEnviando(true);
    try {
      const response = await fetch(`${BASE_PATH}/api/auth/recuperar/restablecer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codigo, nueva }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cambiar la contraseña");
        setCodigo("");
        return;
      }
      router.push(conDestino("/entrar?contrasena=cambiada", next));
    } catch {
      setError("No se pudo conectar con el servicio de usuarios");
    } finally {
      setEnviando(false);
    }
  }

  if (paso === "correo") {
    return (
      <div className="rounded-lg border border-line bg-surface p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-extrabold text-ink">Recupera tu contraseña</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Escribe el correo de tu cuenta y te enviaremos un código para elegir una contraseña nueva.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            pedirCodigo();
          }}
          className="flex flex-col"
        >
          <Field label="Correo" required>
            <Input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.com"
              required
            />
            {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
          </Field>

          <Button variant="primary" type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar código"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-ink-2">
          ¿La recordaste?{" "}
          <Link href={conDestino("/entrar", next)} className="font-medium text-accent hover:underline">
            Volver a entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-8">
      <div className="mb-5 text-center">
        <h1 className="text-xl font-extrabold text-ink">Elige una contraseña nueva</h1>
        <p className="mt-2 text-[13px] text-ink-2">
          Si <span className="font-medium text-ink">{email}</span> tiene una cuenta, le enviamos un código de 6
          dígitos. Expira en {MINUTOS_DE_VIGENCIA} minutos y tienes {INTENTOS_POR_CODIGO} intentos.
        </p>
      </div>

      <form onSubmit={cambiarContrasena} className="flex flex-col">
        <Field label="Código" required>
          <Input
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="font-mono tracking-[0.3em]"
            required
          />
        </Field>

        <Field label="Contraseña nueva" required>
          <PasswordInput
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>

        <Field label="Confirmar contraseña" required>
          <PasswordInput
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="••••••••"
            required
            className={confirmar.length > 0 && !coinciden ? "border-danger" : ""}
          />
        </Field>

        <ul className="mb-4 flex flex-col gap-1.5">
          {REGLAS_DE_CONTRASENA.map((regla) => {
            const cumple = regla.test(nueva);
            return (
              <li key={regla.label} className={`text-[12.5px] ${cumple ? "text-ok" : "text-ink-3"}`}>
                {cumple ? "✓" : "·"} {regla.label}
              </li>
            );
          })}
        </ul>

        <div className="mb-5 rounded-lg bg-sunken p-3.5 text-[12.5px] leading-relaxed text-ink-2">
          Al cambiarla se cerrará tu sesión en todos los dispositivos y tendrás que volver a activar los avisos en
          tu teléfono.
        </div>

        {error && <p className="mb-3 text-[12px] text-danger">{error}</p>}

        <Button variant="primary" type="submit" className="w-full" disabled={!puedeCambiar || enviando}>
          {enviando ? "Guardando..." : "Cambiar contraseña"}
        </Button>
        <Button
          variant="secondary"
          type="button"
          className="mt-2.5 w-full"
          onClick={pedirCodigo}
          disabled={enviando || espera > 0}
        >
          {espera > 0 ? `Reenviar código en ${espera} s` : "Reenviar código"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[12px] text-ink-3">
        Si no lo encuentras, revisa la carpeta de correo no deseado.{" "}
        <button
          type="button"
          onClick={() => {
            setPaso("correo");
            setError("");
          }}
          className="font-medium text-accent hover:underline"
        >
          Usar otro correo
        </button>
      </p>
    </div>
  );
}
