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
import CodigoDeSeisDigitos from "@/components/ui/CodigoDeSeisDigitos";
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
      <div className="rounded-lg border border-system-200 bg-white p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-extrabold text-system-900">Recupera tu contraseña</h1>
          <p className="mt-1 text-[13px] text-system-600">
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
            {error && <p className="mt-1.5 text-[12px] text-error-700">{error}</p>}
          </Field>

          <Button variant="primary" type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar código"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-system-600">
          ¿La recordaste?{" "}
          <Link href={conDestino("/entrar", next)} className="font-medium text-brand-600 hover:underline">
            Volver a entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-system-200 bg-white p-8">
      <div className="mb-5 text-center">
        <h1 className="text-xl font-extrabold text-system-900">Elige una contraseña nueva</h1>
        <p className="mt-2 text-[13px] text-system-600">
          Si <span className="font-medium text-system-900">{email}</span> tiene una cuenta, le enviamos un código de 6
          dígitos. Expira en {MINUTOS_DE_VIGENCIA} minutos y tienes {INTENTOS_POR_CODIGO} intentos.
        </p>
      </div>

      <form onSubmit={cambiarContrasena} className="flex flex-col">
        <div className="mb-4">
          <p className="mb-2 text-[13px] font-medium text-system-900">Código</p>
          <CodigoDeSeisDigitos valor={codigo} onCambiar={setCodigo} deshabilitado={enviando} autoFocus />
        </div>

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
            className={confirmar.length > 0 && !coinciden ? "border-error-700" : ""}
          />
        </Field>

        <ul className="mb-4 flex flex-col gap-1.5">
          {REGLAS_DE_CONTRASENA.map((regla) => {
            const cumple = regla.test(nueva);
            return (
              <li key={regla.label} className={`text-[12.5px] ${cumple ? "text-success-700" : "text-system-400"}`}>
                {cumple ? "✓" : "·"} {regla.label}
              </li>
            );
          })}
        </ul>

        <div className="mb-5 rounded-lg bg-system-100 p-3.5 text-[12.5px] leading-relaxed text-system-600">
          Al cambiarla se cerrará tu sesión en todos los dispositivos y tendrás que volver a activar los avisos en
          tu teléfono.
        </div>

        {error && <p className="mb-3 text-[12px] text-error-700">{error}</p>}

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

      <p className="mt-5 text-center text-[12px] text-system-400">
        Si no lo encuentras, revisa la carpeta de correo no deseado.{" "}
        <button
          type="button"
          onClick={() => {
            setPaso("correo");
            setError("");
          }}
          className="font-medium text-brand-600 hover:underline"
        >
          Usar otro correo
        </button>
      </p>
    </div>
  );
}
