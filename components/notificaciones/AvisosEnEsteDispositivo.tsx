"use client";

// Recuadro "Avisos en este dispositivo" de /notificaciones: activa o desactiva las notificaciones push en
// este navegador o teléfono (lib/notificaciones/registro-push.ts → /api/push). Explica qué hacer si el
// navegador no las permite, si el permiso está bloqueado o si es un iPhone sin la app en la pantalla de inicio.

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { activarPush, desactivarPush, estadoDePush, type EstadoDePush } from "@/lib/notificaciones/registro-push";

const TEXTOS: Record<EstadoDePush, { titulo: string; texto: string }> = {
  activo: {
    titulo: "Avisos activados en este dispositivo",
    texto: "Te llegarán como notificación del teléfono aunque tengas la app cerrada.",
  },
  inactivo: {
    titulo: "Recibe avisos en este dispositivo",
    texto: "Activa las notificaciones para enterarte al momento cuando revisen tus aportes o cambie algo de tus campañas, aunque tengas la app cerrada.",
  },
  bloqueado: {
    titulo: "Las notificaciones están bloqueadas",
    texto: "Bloqueaste las notificaciones de este sitio. Para recibirlas, permítelas en los ajustes del navegador (ícono junto a la dirección) y vuelve aquí.",
  },
  "instalar-en-ios": {
    titulo: "En iPhone, primero agrega la app a tu pantalla de inicio",
    texto: "Toca el botón Compartir de Safari, elige \"Agregar a pantalla de inicio\", abre DataForGood desde ese ícono y vuelve a esta página para activar los avisos. Necesitas iOS 16.4 o más nuevo.",
  },
  "sin-soporte": {
    titulo: "Este navegador no permite avisos push",
    texto: "En Android usa Chrome o Firefox. Mientras tanto, tus notificaciones siguen apareciendo en la campana.",
  },
};

export default function AvisosEnEsteDispositivo() {
  // null mientras se averigua: el estado depende del navegador y no existe al dibujar en el servidor.
  const [estado, setEstado] = useState<EstadoDePush | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    void estadoDePush().then((e) => {
      if (activo) setEstado(e);
    });
    return () => {
      activo = false;
    };
  }, []);

  async function activar() {
    setOcupado(true);
    setError(null);
    const fallo = await activarPush();
    if (fallo) setError(fallo);
    setEstado(await estadoDePush());
    setOcupado(false);
  }

  async function desactivar() {
    setOcupado(true);
    setError(null);
    await desactivarPush();
    setEstado(await estadoDePush());
    setOcupado(false);
  }

  if (!estado) return null;
  const { titulo, texto } = TEXTOS[estado];

  return (
    <section className={`rounded-lg border p-4 ${estado === "activo" ? "border-success-700 bg-success-50" : "border-system-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[13.5px] font-bold ${estado === "activo" ? "text-success-700" : "text-system-900"}`}>{titulo}</p>
          <p className="mt-1 text-[12.5px] leading-5 text-system-600">{texto}</p>
        </div>
        {estado === "inactivo" && (
          <Button size="sm" variant="primary" onClick={() => void activar()} disabled={ocupado}>
            {ocupado ? "Activando…" : "Activar avisos"}
          </Button>
        )}
        {estado === "activo" && (
          <Button size="sm" variant="ghost" onClick={() => void desactivar()} disabled={ocupado}>
            Desactivar
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-error-700">
          {error}
        </p>
      )}
    </section>
  );
}
