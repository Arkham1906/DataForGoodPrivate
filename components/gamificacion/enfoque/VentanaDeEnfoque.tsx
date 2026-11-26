"use client";

// Ventana para las cuentas que aún no tienen enfoque (RF-GAM-115). La pone ShellDeUsuario solo cuando falta, y mientras
// está abierta no se muestran las celebraciones. No se puede cerrar sin elegir: sin «×», Esc no la cierra y un clic
// afuera tampoco. Al guardar se cierra y la página se vuelve a pedir, así que ya no vuelve a salir.

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Ayuda from "@/components/gamificacion/Ayuda";
import Button from "@/components/ui/Button";
import { VENTANA, claseDeVentana } from "@/components/ui/ventana-emergente";
import type { OpcionDeEnfoque } from "@/lib/gamificacion/enfoque-tipos";
import { TEXTOS } from "@/lib/gamificacion/textos";
import SelectorDeEnfoque, { ExplicacionDelEnfoque } from "./SelectorDeEnfoque";
import { guardarEnfoque } from "./guardar-enfoque";

export default function VentanaDeEnfoque({ opciones }: { opciones: OpcionDeEnfoque[] }) {
  const T = TEXTOS.enfoque;
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [elegido, setElegido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cerrada, setCerrada] = useState(false);

  useEffect(() => {
    const el = dialogo.current;
    if (el && !el.open && !cerrada) el.showModal();
  }, [cerrada]);

  async function guardar() {
    if (!elegido) return;
    setGuardando(true);
    setError(null);
    const resultado = await guardarEnfoque(elegido);
    if (!resultado.ok) {
      setError(resultado.error);
      setGuardando(false);
      return;
    }
    dialogo.current?.close();
    setCerrada(true);
    router.refresh();
  }

  if (cerrada) return null;
  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      onCancel={(e) => e.preventDefault()}
      className={claseDeVentana("amplia")}
    >
      <div className={VENTANA.marco}>
        <div className={VENTANA.encabezado}>
          <p className="text-[13.5px] font-bold text-brand-600">{T.ventana.antetitulo}</p>
          <div className="mt-1 flex items-center gap-2">
            {/* El foco empieza en el título: si fuera al primer botón, abriría la ayuda sola. */}
            <h2 id={idTitulo} tabIndex={-1} autoFocus className={`${VENTANA.titulo} outline-none`}>
              {T.ventana.titulo}
            </h2>
            <Ayuda concepto="enfoque" />
          </div>
        </div>
        <div className={VENTANA.cuerpo}>
          <fieldset className="space-y-4">
            <legend className="text-base font-bold text-system-900">{T.pregunta}</legend>
            <ExplicacionDelEnfoque />
            <SelectorDeEnfoque nombre="enfoque-ventana" opciones={opciones} valor={elegido} onCambiar={setElegido} deshabilitado={guardando} />
          </fieldset>
          <p className="mt-4 text-[13px] text-system-600">{T.queCambia}</p>
        </div>
        <div className={VENTANA.pie}>
          {error && (
            <p role="alert" className="mr-auto text-[13.5px] text-error-700">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={guardar} disabled={!elegido || guardando} aria-busy={guardando || undefined}>
            {guardando ? T.guardando : T.ventana.guardar}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
