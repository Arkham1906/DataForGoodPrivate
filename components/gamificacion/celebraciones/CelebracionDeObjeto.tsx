"use client";

// Ventana «ya tienes el máximo» (2026-11-19; lienzo «Misiones: Envía/Logra, dificultad y recompensa», aprobado el mismo
// día). Sale en la cola de las celebraciones cuando el objeto de una misión difícil no cabe en el inventario:
// - Hay lugar para el otro objeto: «Cambiar por un …» o «No, gracias» (se pierde).
// - Los dos están al máximo: solo avisa que se pierde, con «Entendido».
// Cerrarla con Esc no decide nada: vuelve en la siguiente visita. La decisión la toma el servidor con el inventario de
// ese momento (lib/gamificacion/inventario.ts, decidirObjeto). Ventana; en teléfono, hoja que sube desde abajo.
// Íconos de protector y potenciador provisionales (tabla 4.5).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";
import { TEXTOS } from "@/lib/gamificacion/textos";
import type { DecisionDeObjeto, ObjetoPorDecidir } from "@/lib/gamificacion/celebraciones-tipos";
import { Accion, Icono, Paso, TRAZOS } from "./piezas";

const I = TEXTOS.inventario;

const ESTILO = {
  protector: { trazo: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", caja: "border-system-300 bg-system-100", color: "text-system-800" },
  potenciador: { trazo: "M13 2L3 14h9l-1 8 10-12h-9l1-8z", caja: "border-warning-200 bg-warning-50", color: "text-warning-800" },
} as const;

function Casillas({ objeto, cuantas }: { objeto: "protector" | "potenciador"; cuantas: number }) {
  return (
    <>
      {Array.from({ length: cuantas }, (_, i) => (
        <span key={`${objeto}-${i}`} className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white ${ESTILO[objeto].color}`}>
          <Icono trazo={ESTILO[objeto].trazo} className="h-4 w-4" grosor={2} />
        </span>
      ))}
    </>
  );
}

export default function CelebracionDeObjeto({
  datos,
  paso,
  alSiguiente,
}: {
  datos: ObjetoPorDecidir;
  paso: string | null;
  /** Pasa al siguiente paso (o cierra) sin marcar nada visto: la decisión ya la guardó el servidor. */
  alSiguiente: () => void;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const { objeto, alternativa } = datos;
  const potenciadores = Number(datos.potenciadorActivo) + datos.potenciadoresEnEspera;

  async function decidir(accion: DecisionDeObjeto["accion"]) {
    if (enviando) return;
    setEnviando(true);
    const cuerpo: { objeto: DecisionDeObjeto } = { objeto: { instancia: datos.instanciaId, accion } };
    await fetch(`${BASE_PATH}/api/progreso/celebraciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }).catch(() => {});
    // El inventario de Inicio y la tarjeta de la misión cambian.
    router.refresh();
    alSiguiente();
  }

  return (
    <div className="cel-ventana relative overflow-hidden">
      <div className="flex flex-col gap-3 px-6 pb-4 pt-6">
        <p className="inline-flex items-center gap-1.5 pr-16 text-[12.5px] font-bold text-success-800">
          <Icono trazo={TRAZOS.palomita} className="h-4 w-4" grosor={2.2} />
          {I.completada(datos.mision)}
        </p>
        <h2 id="celebracion-titulo" className="text-[22px] font-extrabold leading-tight text-system-900">
          {alternativa ? I.tituloLleno(objeto) : I.tituloAmbos}
        </h2>
        <div className="flex items-center gap-2.5 rounded-xl bg-system-100 px-3 py-2.5">
          <span className="flex-1 text-[13px] font-semibold text-system-700">
            {alternativa
              ? I.tienes(objeto, datos.protectores, datos.potenciadorActivo, datos.potenciadoresEnEspera)
              : I.tienesAmbos(datos.protectores, potenciadores)}
          </span>
          <span aria-hidden="true" className="flex flex-wrap justify-end gap-1">
            {(alternativa ? objeto === "protector" : true) && <Casillas objeto="protector" cuantas={datos.protectores} />}
            {(alternativa ? objeto === "potenciador" : true) && <Casillas objeto="potenciador" cuantas={potenciadores} />}
          </span>
        </div>
        <p className="text-sm text-system-800">{alternativa ? I.noCabe(objeto, alternativa) : I.noCabeAmbos(objeto)}</p>
        {alternativa && (
          <div className={`grid grid-cols-[40px_1fr] items-start gap-3 rounded-xl border px-3.5 py-3 ${ESTILO[alternativa].caja}`}>
            <span aria-hidden="true" className={`flex h-10 w-10 items-center justify-center rounded-[10px] bg-white ${ESTILO[alternativa].color}`}>
              <Icono trazo={ESTILO[alternativa].trazo} className="h-[22px] w-[22px]" grosor={2} />
            </span>
            <span className="flex flex-col gap-0.5">
              <strong className={`text-sm ${ESTILO[alternativa].color}`}>{I.nombre(alternativa)}</strong>
              <span className="text-[13px] text-system-700">{I.explica[alternativa]}</span>
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 px-6 pb-6">
        {alternativa && <p className="text-[12.5px] text-system-600">{I.nota(objeto)}</p>}
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          {alternativa ? (
            <>
              <Accion tono="claro" alPulsar={() => void decidir("rechazar")}>
                {I.noGracias}
              </Accion>
              <Accion tono="principal" alPulsar={() => void decidir("cambiar")} foco>
                {I.cambiar(alternativa)}
              </Accion>
            </>
          ) : (
            <Accion tono="principal" alPulsar={() => void decidir("rechazar")} foco>
              {I.entendido}
            </Accion>
          )}
        </div>
      </div>
      <Paso texto={paso} tono="claro" />
    </div>
  );
}
