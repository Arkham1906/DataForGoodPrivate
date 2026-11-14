"use client";

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import Button from "@/components/ui/Button";

const EVENTO_CAMBIO_VISTA = "dfg:selector-vista-campanas:cambio";
const vistasEnMemoria = new Map<string, boolean>();

function leerVistaGuardada(clave: string | undefined): boolean {
  if (!clave) return true;
  try {
    const guardada = window.localStorage.getItem(clave);
    if (guardada === "lista") return false;
    if (guardada === "cuadricula") return true;
  } catch {
    return vistasEnMemoria.get(clave) ?? true;
  }
  return vistasEnMemoria.get(clave) ?? true;
}

function suscribirVistaGuardada(clave: string | undefined, alCambiar: () => void): () => void {
  if (!clave) return () => {};
  const alCambiarDesdeOtraPestana = (evento: StorageEvent) => {
    if (evento.key === null || evento.key === clave) alCambiar();
  };
  window.addEventListener("storage", alCambiarDesdeOtraPestana);
  window.addEventListener(EVENTO_CAMBIO_VISTA, alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiarDesdeOtraPestana);
    window.removeEventListener(EVENTO_CAMBIO_VISTA, alCambiar);
  };
}

function guardarVista(clave: string | undefined, vistaCuadricula: boolean): void {
  if (!clave) return;
  vistasEnMemoria.set(clave, vistaCuadricula);
  try {
    window.localStorage.setItem(clave, vistaCuadricula ? "cuadricula" : "lista");
  } catch {
    // La preferencia queda en memoria si el navegador bloquea localStorage.
  }
  window.dispatchEvent(new Event(EVENTO_CAMBIO_VISTA));
}

export default function SelectorDeVistaCampanas({
  children,
  toolbar,
  renderChildren,
  persistKey,
}: {
  children?: ReactNode;
  toolbar: ReactNode;
  renderChildren?: (vistaCuadricula: boolean) => ReactNode;
  persistKey?: string;
}) {
  const [vistaLocal, setVistaLocal] = useState(true);
  const suscribir = useCallback(
    (alCambiar: () => void) => suscribirVistaGuardada(persistKey, alCambiar),
    [persistKey]
  );
  const leer = useCallback(() => leerVistaGuardada(persistKey), [persistKey]);
  const vistaGuardada = useSyncExternalStore(suscribir, leer, () => true);
  const vistaCuadricula = persistKey ? vistaGuardada : vistaLocal;

  function cambiarVista(vista: boolean) {
    if (persistKey) guardarVista(persistKey, vista);
    else setVistaLocal(vista);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">{toolbar}</div>
        <div role="group" aria-label="Cambiar vista de campañas" className="relative flex shrink-0 gap-0 overflow-hidden rounded-lg border border-system-300 bg-system-100 p-1">
          <span aria-hidden="true" className={`pointer-events-none absolute left-[3px] top-[3px] z-0 h-8 w-8 rounded-md bg-brand-600 shadow-inner transition-transform duration-200 ease-out motion-reduce:transition-none ${vistaCuadricula ? "translate-x-full" : "translate-x-0"}`} />
          <Button type="button" size="sm" className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${!vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`} onClick={() => cambiarVista(false)} aria-label="Vista de lista" aria-pressed={!vistaCuadricula} title="Vista de lista">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Button>
          <Button type="button" size="sm" className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`} onClick={() => cambiarVista(true)} aria-label="Vista cuadriculada" aria-pressed={vistaCuadricula} title="Vista cuadriculada">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
          </Button>
        </div>
      </div>
      <div data-vista={vistaCuadricula ? "cuadricula" : "lista"} className={`group ${vistaCuadricula ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3 [&_[data-campana-banner]]:hidden"}`}>
        {renderChildren ? renderChildren(vistaCuadricula) : children}
      </div>
    </div>
  );
}
