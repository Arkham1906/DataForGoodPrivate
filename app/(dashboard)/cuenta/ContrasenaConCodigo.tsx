"use client";

// Contenido de la ventana de contraseña de /cuenta (CambiarContrasena.tsx): "Cambiar" (modo
// "cambiar") o, en una cuenta de Google, "Crear contraseña" (modo "crear"). No pide la actual.
// Paso 1: POST /api/usuarios/[id]/contrasena/codigo. Paso 2: el código en seis casillas
// (como /verificar) y la contraseña → POST /api/usuarios/[id]/contrasena. La sesión sigue abierta.
// Solo pinta lo de adentro del <dialog>; abrirlo y cerrarlo es de quien lo usa.

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import CodigoDeSeisDigitos from "@/components/ui/CodigoDeSeisDigitos";
import { Field } from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { BASE_PATH } from "@/lib/base-path";
import { REGLAS_DE_CONTRASENA, cumpleReglasDeContrasena } from "@/lib/reglas-contrasena";
import { INTENTOS_POR_CODIGO, MINUTOS_DE_VIGENCIA, SEGUNDOS_ENTRE_ENVIOS } from "@/lib/usuarios/recuperacion-opciones";

type Paso = "aviso" | "codigo" | "listo";

const TEXTOS = {
  crear: {
    titulo: "Crear contraseña",
    aviso: "Con él eliges tu contraseña y podrás entrar también con tu correo. Google seguirá funcionando.",
    listoTitulo: "Contraseña creada",
    listo: "Desde ahora puedes entrar con tu correo y contraseña o con Google. Tu sesión sigue abierta.",
  },
  cambiar: {
    titulo: "Cambiar contraseña",
    aviso: "Con él eliges tu contraseña nueva.",
    listoTitulo: "Contraseña actualizada",
    listo: "La próxima vez que inicies sesión usa tu nueva contraseña. Tu sesión sigue abierta.",
  },
};

export default function ContrasenaConCodigo({
  usuarioId,
  email,
  modo,
  idTitulo,
  onCerrar,
  onGuardada,
}: {
  usuarioId: number;
  email: string;
  modo: "crear" | "cambiar";
  /** id del título, para el aria-labelledby del <dialog>. */
  idTitulo: string;
  onCerrar: () => void;
  onGuardada?: () => void;
}) {
  const textos = TEXTOS[modo];
  const [paso, setPaso] = useState<Paso>("aviso");
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Segundos para poder pedir otro código.
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const temporizador = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [espera]);

  const coinciden = nueva.length > 0 && nueva === confirmacion;
  const puedeGuardar = /^\d{6}$/.test(codigo) && cumpleReglasDeContrasena(nueva) && coinciden && !enviando;

  async function pedirCodigo() {
    setError("");
    setEnviando(true);
    try {
      const response = await fetch(`${BASE_PATH}/api/usuarios/${usuarioId}/contrasena/codigo`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 429) {
        setError(payload.error ?? "No se pudo enviar el código");
        return;
      }
      // 429: ya hay un código enviado hace poco; sigue sirviendo.
      if (response.status === 429) setError(payload.error ?? "");
      setPaso("codigo");
      setCodigo("");
      setEspera(SEGUNDOS_ENTRE_ENVIOS);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeGuardar) return;
    setError("");
    setEnviando(true);
    try {
      const response = await fetch(`${BASE_PATH}/api/usuarios/${usuarioId}/contrasena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, nueva }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo guardar la contraseña");
        setCodigo("");
        return;
      }
      setPaso("listo");
      onGuardada?.();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  if (paso === "listo") {
    return (
      <div className="p-5">
        <h2 id={idTitulo} className="text-lg font-extrabold text-system-900">
          {textos.listoTitulo}
        </h2>
        <p className="mt-1 text-[13px] text-system-600">{textos.listo}</p>
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="primary" size="sm" onClick={onCerrar}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  if (paso === "aviso") {
    return (
      <div className="p-5">
        <h2 id={idTitulo} className="text-lg font-extrabold text-system-900">
          {textos.titulo}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-system-600">
          Para confirmar que eres tú, te enviaremos un código a <span className="font-medium text-system-900">{email}</span>.{" "}
          {textos.aviso}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-[12px] text-error-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={pedirCodigo} disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar código"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="flex max-h-[85vh] flex-col" noValidate>
      <div className="border-b border-system-200 p-5">
        <h2 id={idTitulo} className="text-lg font-extrabold text-system-900">
          {textos.titulo}
        </h2>
        <p className="mt-1 text-[12.5px] text-system-600">
          Escribe el código que enviamos a <span className="font-medium text-system-900">{email}</span> (expira en{" "}
          {MINUTOS_DE_VIGENCIA} minutos, tienes {INTENTOS_POR_CODIGO} intentos) y tu contraseña dos veces.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <p className="mb-2 text-[13px] font-medium text-system-900">Código</p>
        <CodigoDeSeisDigitos valor={codigo} onCambiar={setCodigo} deshabilitado={enviando} autoFocus />
        <button
          type="button"
          onClick={pedirCodigo}
          disabled={enviando || espera > 0}
          className="mb-4 mt-2 text-[12.5px] font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-system-500 disabled:no-underline"
        >
          {espera > 0 ? `Reenviar código en ${espera} s` : "Reenviar código"}
        </button>

        <Field label={modo === "crear" ? "Contraseña" : "Nueva contraseña"} required>
          <PasswordInput
            name="nueva"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            disabled={enviando}
            required
          />
        </Field>
        <Field label="Confirmar contraseña" required>
          <PasswordInput
            name="confirmacion"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            autoComplete="new-password"
            disabled={enviando}
            required
            className={confirmacion.length > 0 && !coinciden ? "border-error-700" : ""}
          />
        </Field>

        <ul className="flex flex-col gap-1.5">
          {REGLAS_DE_CONTRASENA.map((regla) => {
            const cumple = regla.test(nueva);
            return (
              <li key={regla.label} className={`text-[12.5px] ${cumple ? "text-success-700" : "text-system-500"}`}>
                {cumple ? "✓" : "·"} {regla.label}
              </li>
            );
          })}
        </ul>

        {error && (
          <p role="alert" className="mt-4 text-[12px] text-error-700">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-system-200 p-4">
        <Button type="button" variant="secondary" size="sm" onClick={onCerrar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!puedeGuardar}>
          {enviando ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
