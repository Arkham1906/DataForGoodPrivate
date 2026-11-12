"use client";

// Protección de las pantallas donde el creador de la campaña y el revisor de aportes ven los aportes
// (2026-11-12, a pedido del usuario: "que no permita hacer captura de pantalla ni copiar y pegar").
//
// Una página web NO puede impedir una captura de pantalla: la hace el sistema operativo (Impr Pant,
// Win+Shift+S, Recortes, el botón del teléfono) sin que el navegador se entere. Esto la dificulta y deja
// rastro:
//   - Copiar, cortar y pegar bloqueados (teclado y menú), sin seleccionar texto (salvo en los campos
//     donde se escribe), sin menú del clic derecho y sin arrastrar imágenes.
//   - Impr Pant: se borra el portapapeles y el contenido se tapa un momento. Ctrl+P y Ctrl+S, bloqueados;
//     al imprimir no sale el contenido (globals.css, .zona-de-aportes-protegida).
//   - Si la ventana pierde el foco (p. ej. al abrir Recortes) o se cambia de pestaña, el contenido se oculta
//     hasta volver. Hacer clic en una vista previa (iframe) no cuenta como salir.
//   - Marca de agua con el nombre de quien revisa y la fecha: una foto con el teléfono dice de quién salió.
//   - Video sin "Descargar" ni imagen en imagen en su menú.
// La usan los layouts de /mis-campanas/[id]/aportes y de /revisiones (campaña y aporte); el visor a
// pantalla completa (ui/BotonPantallaCompletaDeAporte) lee el contexto para poner la marca también ahí.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type Proteccion = { marca: string };

const ContextoDeProteccion = createContext<Proteccion | null>(null);

/** La protección activa (con el texto de la marca de agua), o null fuera de las pantallas protegidas. */
export function useProteccionDeAportes(): Proteccion | null {
  return useContext(ContextoDeProteccion);
}

const AVISO_COPIAR = "Por protección de los aportes no se puede copiar ni pegar en esta pantalla.";
const AVISO_CAPTURA = "Por protección de los aportes no se permiten capturas de pantalla.";
const AVISO_IMPRIMIR = "Por protección de los aportes no se puede imprimir ni guardar esta pantalla.";

function esCampoDeEscritura(objetivo: EventTarget | null): boolean {
  return (
    objetivo instanceof HTMLElement &&
    (objetivo instanceof HTMLInputElement || objetivo instanceof HTMLTextAreaElement || objetivo.isContentEditable)
  );
}

/** Quita "Descargar" e "imagen en imagen" del menú de los videos (ya puestos y los que aparezcan). */
function protegerVideos(raiz: ParentNode) {
  raiz.querySelectorAll("video").forEach((video) => {
    video.setAttribute("controlslist", "nodownload noremoteplayback noplaybackrate");
    video.disablePictureInPicture = true;
  });
}

export default function ZonaDeAportesProtegida({
  marca,
  sinProteccionEn = [],
  children,
}: {
  /** Texto de la marca de agua: nombre de quien revisa y fecha. */
  marca: string;
  /** Partes de la ruta donde no se protege (p. ej. la lista de revisores, que no muestra aportes). */
  sinProteccionEn?: string[];
  children: ReactNode;
}) {
  const ruta = usePathname();
  const activa = !sinProteccionEn.some((parte) => ruta.includes(parte));
  const [fueraDeLaVentana, setFueraDeLaVentana] = useState(false);
  const [tapado, setTapado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const temporizadores = useRef<{ aviso?: number; tapado?: number }>({});

  useEffect(() => {
    if (!activa) return;
    const relojes = temporizadores.current;

    function avisar(texto: string) {
      setAviso(texto);
      window.clearTimeout(relojes.aviso);
      relojes.aviso = window.setTimeout(() => setAviso(null), 3000);
    }
    function taparUnMomento() {
      setTapado(true);
      window.clearTimeout(relojes.tapado);
      relojes.tapado = window.setTimeout(() => setTapado(false), 1500);
    }
    function vaciarPortapapeles() {
      navigator.clipboard?.writeText("").catch(() => {});
    }

    const bloquearCopia = (e: Event) => {
      e.preventDefault();
      avisar(AVISO_COPIAR);
    };
    const bloquearSinAviso = (e: Event) => e.preventDefault();
    const bloquearSeleccion = (e: Event) => {
      if (!esCampoDeEscritura(e.target)) e.preventDefault();
    };
    const alPresionar = (e: KeyboardEvent) => {
      const tecla = e.key.toLowerCase();
      if (e.key === "PrintScreen") {
        e.preventDefault();
        vaciarPortapapeles();
        taparUnMomento();
        avisar(AVISO_CAPTURA);
        return;
      }
      const conControl = e.ctrlKey || e.metaKey;
      // Mac: Cmd+Shift+3/4/5 (si el sistema deja que llegue al navegador).
      if (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(tecla)) {
        taparUnMomento();
        avisar(AVISO_CAPTURA);
        return;
      }
      if (!conControl) return;
      if (tecla === "c" || tecla === "x" || tecla === "v" || tecla === "insert") {
        e.preventDefault();
        avisar(AVISO_COPIAR);
      } else if (tecla === "p" || tecla === "s") {
        e.preventDefault();
        avisar(AVISO_IMPRIMIR);
      } else if (tecla === "a" && !esCampoDeEscritura(e.target)) {
        e.preventDefault();
      }
    };
    // En Windows, Impr Pant solo llega al soltarla (la captura ya se hizo): se borra el portapapeles.
    const alSoltar = (e: KeyboardEvent) => {
      if (e.key !== "PrintScreen") return;
      vaciarPortapapeles();
      taparUnMomento();
      avisar(AVISO_CAPTURA);
    };
    const alSalir = () => {
      // Al hacer clic en una vista previa (iframe) la ventana "pierde" el foco, pero se sigue en la pantalla.
      window.setTimeout(() => {
        if (document.activeElement instanceof HTMLIFrameElement) return;
        setFueraDeLaVentana(true);
      }, 0);
    };
    const alVolver = () => setFueraDeLaVentana(false);
    const alCambiarDePestana = () => setFueraDeLaVentana(document.visibilityState === "hidden");

    const opciones = { capture: true } as const;
    document.addEventListener("copy", bloquearCopia, opciones);
    document.addEventListener("cut", bloquearCopia, opciones);
    document.addEventListener("paste", bloquearCopia, opciones);
    document.addEventListener("contextmenu", bloquearSinAviso, opciones);
    document.addEventListener("dragstart", bloquearSinAviso, opciones);
    document.addEventListener("selectstart", bloquearSeleccion, opciones);
    document.addEventListener("keydown", alPresionar, opciones);
    document.addEventListener("keyup", alSoltar, opciones);
    document.addEventListener("visibilitychange", alCambiarDePestana);
    window.addEventListener("blur", alSalir);
    window.addEventListener("focus", alVolver);
    const alImprimir = () => avisar(AVISO_IMPRIMIR);
    window.addEventListener("beforeprint", alImprimir);

    protegerVideos(document);
    const observador = new MutationObserver(() => protegerVideos(document));
    observador.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("copy", bloquearCopia, opciones);
      document.removeEventListener("cut", bloquearCopia, opciones);
      document.removeEventListener("paste", bloquearCopia, opciones);
      document.removeEventListener("contextmenu", bloquearSinAviso, opciones);
      document.removeEventListener("dragstart", bloquearSinAviso, opciones);
      document.removeEventListener("selectstart", bloquearSeleccion, opciones);
      document.removeEventListener("keydown", alPresionar, opciones);
      document.removeEventListener("keyup", alSoltar, opciones);
      document.removeEventListener("visibilitychange", alCambiarDePestana);
      window.removeEventListener("blur", alSalir);
      window.removeEventListener("focus", alVolver);
      window.removeEventListener("beforeprint", alImprimir);
      observador.disconnect();
      window.clearTimeout(relojes.aviso);
      window.clearTimeout(relojes.tapado);
    };
  }, [activa]);

  if (!activa) return <>{children}</>;

  const oculto = fueraDeLaVentana || tapado;
  return (
    <ContextoDeProteccion.Provider value={{ marca }}>
      {/* data-oculto oculta también las ventanas (<dialog>) abiertas dentro, como la pantalla completa. */}
      <div className="zona-de-aportes-protegida" data-oculto={oculto ? "" : undefined}>
        {children}
        <MarcaDeAgua marca={marca} />
      </div>
      {oculto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-system-950 p-6 text-center text-white">
          <p className="max-w-sm text-[14px] leading-relaxed">
            {tapado
              ? AVISO_CAPTURA
              : "Los aportes se ocultan mientras estás fuera de esta ventana. Vuelve a ella para seguir revisando."}
          </p>
        </div>
      )}
      {aviso && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-[80] w-[min(92vw,420px)] -translate-x-1/2 rounded-lg bg-system-900 px-4 py-3 text-center text-[12.5px] text-white shadow-lg"
        >
          {aviso}
        </p>
      )}
    </ContextoDeProteccion.Provider>
  );
}

/**
 * Marca de agua en toda la pantalla, sin bloquear clics. La usa también el visor a pantalla completa,
 * que se abre por encima de todo (top layer) y taparía la de la página.
 */
export function MarcaDeAgua({ marca, clara = false }: { marca: string; /** Pantalla completa: gris que se ve sobre el fondo oscuro y sobre la foto. */ clara?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] select-none overflow-hidden">
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-wrap content-start gap-x-24 gap-y-20 p-8">
        {Array.from({ length: 120 }, (_, i) => (
          <span key={i} className={`whitespace-nowrap text-[13px] font-semibold ${clara ? "text-system-400/[0.3]" : "text-system-900/[0.07]"}`}>
            {marca}
          </span>
        ))}
      </div>
    </div>
  );
}
