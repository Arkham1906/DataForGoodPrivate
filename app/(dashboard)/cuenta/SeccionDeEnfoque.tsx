"use client";

// «Tu enfoque» en Mi cuenta (RF-GAM-116): el enfoque actual y la ventana para cambiarlo. El estado inicial lo da
// /cuenta desde el servidor; la espera de 7 días la decide el servidor (aquí el botón deshabilitado solo informa, y
// si el PUT responde 409 se muestra la fecha que manda).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Ayuda from "@/components/gamificacion/Ayuda";
import SelectorDeEnfoque, { ExplicacionDelEnfoque, IconoDeEnfoque, estiloDeEnfoque } from "@/components/gamificacion/enfoque/SelectorDeEnfoque";
import { fechaDelEnfoque, guardarEnfoque } from "@/components/gamificacion/enfoque/guardar-enfoque";
import Button from "@/components/ui/Button";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import type { EstadoDelEnfoque } from "@/lib/gamificacion/enfoque-tipos";
import { TEXTOS } from "@/lib/gamificacion/textos";

export default function SeccionDeEnfoque({ inicial }: { inicial: EstadoDelEnfoque }) {
  const T = TEXTOS.enfoque;
  const router = useRouter();
  const [estado, setEstado] = useState(inicial);
  const [abierta, setAbierta] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const { actual, puedeCambiarDesde } = estado;
  const elegidoEsOtro = elegido !== null && elegido !== actual?.clave;
  const nombreElegido = estado.opciones.find((o) => o.clave === elegido)?.nombre ?? "";
  const idEspera = "enfoque-espera";

  function abrir() {
    setElegido(actual?.clave ?? null);
    setError(null);
    setAviso(null);
    setAbierta(true);
  }

  async function guardar() {
    if (!elegido || !elegidoEsOtro) return;
    setGuardando(true);
    setError(null);
    const resultado = await guardarEnfoque(elegido);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setEstado(resultado.estado);
    setAbierta(false);
    if (resultado.estado.actual) setAviso(T.cambio.listo(resultado.estado.actual.nombre));
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-system-200 bg-white p-5 md:col-span-2">
      <div className="mb-4">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-system-500">{T.cuenta.antetitulo}</p>
        <div className="mt-1 flex items-center gap-2">
          <h2 className="text-lg font-extrabold text-system-900">{T.cuenta.titulo}</h2>
          <Ayuda concepto="enfoque" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-system-200 bg-system-100 p-4">
        {actual ? (
          <div className="flex min-w-0 items-center gap-3.5">
            <span className={`grid size-13 shrink-0 place-items-center rounded-xl ${estiloDeEnfoque(actual.clave).fondo}`}>
              <IconoDeEnfoque clave={actual.clave} className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-extrabold text-system-900">{actual.nombre}</p>
              <p className="text-[13px] text-system-600">{actual.subtitulo}</p>
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] text-system-600">{T.cuenta.sinEnfoque}</p>
        )}
        <Button size="sm" onClick={abrir} disabled={Boolean(puedeCambiarDesde)} aria-describedby={puedeCambiarDesde ? idEspera : undefined}>
          {actual ? T.cuenta.cambiar : T.cuenta.elegir}
        </Button>
      </div>
      {puedeCambiarDesde && (
        <p id={idEspera} className="mt-2.5 text-[12.5px] text-system-600">
          {T.cuenta.podrasCambiarlo(fechaDelEnfoque(puedeCambiarDesde))}
        </p>
      )}
      <p aria-live="polite" className={aviso ? "mt-2.5 text-[12.5px] font-semibold text-success-700" : "sr-only"}>
        {aviso}
      </p>

      {abierta && (
        <VentanaDeConfirmacion
          abierto
          titulo={actual ? T.cambio.titulo : T.ventana.titulo}
          textoConfirmar={elegidoEsOtro ? T.cambio.boton(nombreElegido) : actual ? T.cuenta.cambiar : T.ventana.guardar}
          textoOcupado={T.guardando}
          textoCancelar={T.cambio.cancelar}
          ocupado={guardando}
          confirmarDeshabilitado={!elegidoEsOtro}
          onCancelar={() => setAbierta(false)}
          onConfirmar={guardar}
        >
          <fieldset className="space-y-3.5">
            <legend className="text-base font-bold text-system-900">{T.pregunta}</legend>
            {!actual && <ExplicacionDelEnfoque conElige={false} />}
            <SelectorDeEnfoque
              nombre="enfoque-cuenta"
              forma="lista"
              opciones={estado.opciones}
              valor={elegido}
              onCambiar={setElegido}
              actual={actual?.clave}
              deshabilitado={guardando}
            />
          </fieldset>
          <p className="mt-4 text-[13.5px]">
            {elegidoEsOtro ? T.cambio.aviso(nombreElegido, estado.esperaParaCambiarDias) : actual ? T.cambio.eligeOtro : T.queCambia}
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-error-50 px-3.5 py-2.5 text-[13.5px] text-error-700">
              {error}
            </p>
          )}
        </VentanaDeConfirmacion>
      )}
    </section>
  );
}
