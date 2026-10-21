"use client";

// "Compartir en redes" del cuadro Compartir (compartir.tsx), 2026-10-19: mensaje editable y botones
// para WhatsApp, Facebook, X, Telegram, LinkedIn y correo (lib/campanas/compartir.ts). Cada botón abre
// la página de compartir de esa red en otra pestaña con el mensaje y el enlace público. En el teléfono,
// "Más opciones" abre el menú de compartir del sistema (Web Share API), con todas sus apps.

import { useState } from "react";
import Button, { buttonClasses } from "@/components/ui/Button";
import { REDES_SOCIALES, mensajeParaCompartir } from "@/lib/campanas/compartir";

export default function RedesSociales({ url, nombre, tematica }: { url: string; nombre: string; tematica?: string | null }) {
  const [mensaje, setMensaje] = useState(() => mensajeParaCompartir(nombre, tematica));
  const [copiado, setCopiado] = useState(false);
  // Solo existe en navegadores que lo soportan (sobre todo móviles); se revisa al hacer clic.
  const [sinMenuDelSistema, setSinMenuDelSistema] = useState(false);

  async function copiarMensaje() {
    try {
      await navigator.clipboard.writeText(`${mensaje} ${url}`);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  async function masOpciones() {
    if (typeof navigator.share !== "function") {
      setSinMenuDelSistema(true);
      return;
    }
    try {
      await navigator.share({ title: nombre, text: mensaje, url });
    } catch {
      // La persona cerró el menú: no es un error.
    }
  }

  return (
    <div className="mb-4">
      <label htmlFor="mensaje-para-compartir" className="mb-1.5 block text-[13px] font-medium text-system-900">
        Compartir en redes
      </label>
      <textarea
        id="mensaje-para-compartir"
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        rows={3}
        maxLength={500}
        className="w-full resize-y rounded-lg border border-system-300 bg-white px-3 py-2 text-[13px] leading-5 text-system-900 focus:border-brand-600 focus:outline-none"
      />
      <p className="mt-1 text-[11.5px] text-system-500">El enlace se agrega al final. Facebook y LinkedIn solo publican el enlace.</p>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {REDES_SOCIALES.map((red) => (
          <a
            key={red.clave}
            href={red.url(mensaje.trim(), url)}
            target={red.clave === "correo" ? undefined : "_blank"}
            rel="noopener noreferrer"
            className={buttonClasses("secondary", "sm", "whitespace-nowrap")}
          >
            {red.nombre}
          </a>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => void masOpciones()}>
          Más opciones
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void copiarMensaje()}>
          {copiado ? "Mensaje copiado" : "Copiar mensaje y enlace"}
        </Button>
      </div>
      {sinMenuDelSistema && (
        <p role="status" className="mt-1.5 text-[11.5px] text-system-500">
          Este navegador no tiene menú para compartir: usa un botón de arriba o copia el mensaje.
        </p>
      )}
    </div>
  );
}
