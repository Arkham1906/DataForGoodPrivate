"use client";

// "Compartir en redes" del cuadro Compartir (compartir.tsx), 2026-10-19: mensaje editable y botones
// para WhatsApp, Facebook, X, Telegram, LinkedIn y correo (lib/campanas/compartir.ts). Cada botón abre
// la página de compartir de esa red en otra pestaña con el mensaje y el enlace público. En el teléfono,
// "Más opciones" abre el menú de compartir del sistema (Web Share API), con todas sus apps.
// Banner (2026-11-13, a pedido del usuario): las redes lo muestran en la vista previa del enlace porque /c/[token]
// lo da como og:image; aquí se ve cómo quedará y, en "Más opciones", va además como imagen adjunta donde el
// sistema acepta archivos (si no, se comparte solo texto y enlace, como antes).

import { useEffect, useRef, useState } from "react";
import Button, { buttonClasses } from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";
import { REDES_SOCIALES, mensajeParaCompartir, type DatosDelMensaje } from "@/lib/campanas/compartir";

export default function RedesSociales({
  url,
  banner,
  ...datos
}: {
  url: string;
  /** Ruta del banner sin BASE_PATH, o null si la campaña no tiene. */
  banner?: string | null;
} & DatosDelMensaje) {
  const { nombre } = datos;
  const [mensaje, setMensaje] = useState(() => mensajeParaCompartir(datos));
  const [copiado, setCopiado] = useState(false);
  // Solo existe en navegadores que lo soportan (sobre todo móviles); se revisa al hacer clic.
  const [sinMenuDelSistema, setSinMenuDelSistema] = useState(false);
  // El banner como archivo, listo antes del clic: navigator.share debe llamarse enseguida tras el gesto.
  const archivoDelBanner = useRef<File | null>(null);
  const [bannerRoto, setBannerRoto] = useState(false);

  useEffect(() => {
    archivoDelBanner.current = null;
    if (!banner || typeof navigator.canShare !== "function") return;
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch(`${BASE_PATH}${banner}`);
        if (!respuesta.ok) return;
        const blob = await respuesta.blob();
        const extension = blob.type === "image/png" ? "png" : "jpg";
        const archivo = new File([blob], `banner-campana.${extension}`, { type: blob.type || "image/jpeg" });
        if (vigente && navigator.canShare({ files: [archivo] })) archivoDelBanner.current = archivo;
      } catch {
        // Sin el archivo, "Más opciones" comparte solo el texto y el enlace.
      }
    })();
    return () => {
      vigente = false;
    };
  }, [banner]);

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
    const archivo = archivoDelBanner.current;
    try {
      // Con imagen, el enlace va dentro del texto: varias apps descartan `url` cuando llegan archivos.
      if (archivo) await navigator.share({ title: nombre, text: `${mensaje} ${url}`, files: [archivo] });
      else await navigator.share({ title: nombre, text: mensaje, url });
    } catch (error) {
      // La persona cerró el menú: no es un error. Si fue la imagen la que no pasó, se reintenta sin ella.
      if (archivo && error instanceof Error && error.name !== "AbortError") {
        try {
          await navigator.share({ title: nombre, text: mensaje, url });
        } catch {
          // Cerró el menú.
        }
      }
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
        rows={5}
        maxLength={500}
        className="w-full resize-y rounded-lg border border-system-300 bg-white px-3 py-2 text-[13px] leading-5 text-system-900 focus:border-brand-600 focus:outline-none"
      />
      <p className="mt-1 text-[11.5px] text-system-500">El enlace se agrega al final. Facebook y LinkedIn solo publican el enlace.</p>

      {banner && !bannerRoto && (
        // Cómo se verá el enlace al compartirlo: las redes arman su tarjeta con el banner, el nombre y el sitio.
        <figure className="mt-2.5 overflow-hidden rounded-lg border border-system-200 bg-system-50">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen servida por la API; next/image no aporta aquí */}
          <img
            src={`${BASE_PATH}${banner}`}
            alt={`Banner de ${nombre}`}
            onError={() => setBannerRoto(true)}
            className="aspect-[1.91/1] w-full bg-system-100 object-cover"
          />
          <figcaption className="px-3 py-2">
            <span className="block truncate text-[12.5px] font-semibold text-system-900">Participa en «{nombre}»</span>
            <span className="block text-[11px] text-system-500">
              DataForGood · Así se verá la vista previa al compartir el enlace
            </span>
          </figcaption>
        </figure>
      )}

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
