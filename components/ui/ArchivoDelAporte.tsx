// Vista del archivo de un aporte según su tipo (2026-10-14): foto como imagen, video y audio
// con su reproductor, documento y texto con un enlace para abrirlo o descargarlo, y un aviso si
// el aporte es de solo texto (sin archivo). Todo sale de GET /api/aportes/[id]/archivo, que
// comprueba el permiso. Sin "use client": sirve en páginas de servidor y de cliente.
// El caso "archivo borrado por el creador" lo resuelve cada pantalla antes de llegar aquí.
// Desde el 2026-11-11 el texto (.txt) se muestra a la vista con ui/TextoDelAporte (componente cliente).

import { BASE_PATH } from "@/lib/base-path";
import TextoDelAporte from "@/components/ui/TextoDelAporte";

const CAJA = "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-system-300 bg-system-100 p-4 text-center text-[12.5px] text-system-600";

function etiquetaDeTipo(tipo: string) {
  switch (tipo) {
    case "foto":
      return "Foto";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "texto":
      return "TXT";
    default:
      return "Archivo";
  }
}

export function MiniaturaDeAporte({
  aporteId,
  tipo,
  sinArchivo = false,
  alt,
  className = "h-14 w-14",
}: {
  aporteId: string | number;
  tipo: string;
  sinArchivo?: boolean;
  alt: string;
  className?: string;
}) {
  const src = `${BASE_PATH}/api/aportes/${aporteId}/archivo`;

  if (sinArchivo) {
    return <div className={`${className} flex items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-[9px] font-semibold uppercase tracking-[0.08em] text-system-600`}>Texto</div>;
  }

  if (tipo === "foto") {
    // eslint-disable-next-line @next/next/no-img-element -- archivo servido por la API con sesión; next/image no aporta aquí
    return <img loading="lazy" src={src} alt={alt} className={`${className} rounded-lg border border-system-300 bg-system-100 object-cover`} />;
  }

  if (tipo === "video") {
    return (
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        controls={false}
        className={`${className} rounded-lg border border-system-300 bg-system-900 object-cover`}
        aria-label={alt}
      />
    );
  }

  if (tipo === "audio") {
    return <div className={`${className} flex items-center justify-center rounded-lg border border-system-300 bg-system-100 text-[9px] font-semibold uppercase tracking-[0.08em] text-system-700`}>Audio</div>;
  }

  return (
    <div className={`${className} flex items-center justify-center rounded-lg border border-system-300 bg-system-100 text-[9px] font-semibold uppercase tracking-[0.08em] text-system-700`}>
      {etiquetaDeTipo(tipo)}
    </div>
  );
}

export default function ArchivoDelAporte({
  aporteId,
  tipo,
  sinArchivo = false,
  alt,
  alto = "aspect-video",
}: {
  aporteId: string | number;
  /** aportes.file_type: foto, video, audio, documento o texto. */
  tipo: string;
  sinArchivo?: boolean;
  alt: string;
  /** Clase de alto de la vista (p. ej. "h-44" o "aspect-video"). */
  alto?: string;
}) {
  const src = `${BASE_PATH}/api/aportes/${aporteId}/archivo`;

  if (sinArchivo) {
    return <div className={`${CAJA} ${alto} border-dashed`}>Aporte de solo texto: la información está en la descripción.</div>;
  }
  if (tipo === "foto") {
    // eslint-disable-next-line @next/next/no-img-element -- archivo servido por la API con sesión; next/image no aporta aquí
    return <img src={src} alt={alt} className={`${alto} w-full rounded-lg border border-system-300 bg-system-100 object-contain`} />;
  }
  if (tipo === "video") {
    return (
      <video src={src} controls preload="metadata" className={`${alto} w-full rounded-lg border border-system-300 bg-system-900`} aria-label={alt}>
        Tu navegador no puede reproducir este video. <a href={src}>Descárgalo</a>.
      </video>
    );
  }
  if (tipo === "audio") {
    return (
      <div className={`${CAJA} ${alto}`}>
        <span className="font-medium text-system-900">Audio</span>
        <audio src={src} controls preload="metadata" className="w-full" aria-label={alt} />
      </div>
    );
  }
  // Texto (.txt): a la vista, con enlace para abrirlo (2026-11-11; antes solo el enlace).
  if (tipo === "texto") return <TextoDelAporte src={src} alto={alto} />;
  // Archivo (PDF, Word, PowerPoint o Excel): se descarga.
  return (
    <div className={`${CAJA} ${alto}`}>
      <span className="font-medium text-system-900">{tipo === "texto" ? "Archivo de texto" : "Archivo"}</span>
      <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">
        {tipo === "texto" ? "Abrir el archivo" : "Descargar el archivo"}
      </a>
    </div>
  );
}
