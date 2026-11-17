// Celebración de racha (2026-11-16; lienzo aprobado el mismo día; RF-GAM-25, 62). Pantalla completa de fondo cálido
// al estilo del festejo de racha: la llama se enciende con rebote y luego parpadea y suelta brasas; el número de antes
// sale y entra el nuevo; la semana marca el día de hoy. Solo cuando el envío alarga, empieza o reaviva la racha (al
// reavivarla, una llama gris se apaga y se enciende la de color). Reconoce, no presiona. Textos en TEXTOS.celebraciones.

import { TEXTOS } from "@/lib/gamificacion/textos";
import type { CambioDeRacha } from "@/lib/gamificacion/celebraciones-tipos";
import { Accion, Brasas, Icono, Llama, Paso, TRAZOS, retraso } from "./piezas";

const T = TEXTOS.celebraciones;

const diaDeLaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();

export default function CelebracionDeRacha({
  racha,
  paso,
  siguiente,
  alSiguiente,
  alCerrar,
}: {
  racha: CambioDeRacha;
  paso: string | null;
  siguiente: string | null;
  alSiguiente: () => void;
  alCerrar: () => void;
}) {
  const reaviva = racha.tipo === "reaviva";
  const textos = T.racha[racha.tipo];
  return (
    <div className="relative flex min-h-full items-center justify-center px-5 py-16">
      <Paso texto={paso} tono="fuego" />
      <div className="flex w-full max-w-[460px] flex-col items-center gap-2.5 text-center">
        <div aria-hidden="true" className="relative h-[230px] w-[220px]">
          <span
            className="cel-brillo absolute bottom-1.5 left-[30px] block h-40 w-40 rounded-full bg-[var(--fuego-200)] opacity-55 shadow-[0_0_60px_24px_rgba(253,186,116,0.55)]"
            style={retraso(reaviva ? 720 : 300)}
          />
          <Brasas desde={70} arriba={70} inicio={760} />
          {reaviva && (
            <span className="cel-solo-mov cel-apagar absolute bottom-2.5 left-7">
              <Llama ancho={164} apagada />
            </span>
          )}
          <span className="cel-encender absolute bottom-2.5 left-7 block" style={retraso(reaviva ? 620 : 200)}>
            <Llama ancho={164} />
          </span>
        </div>

        <div aria-hidden="true" className="relative h-[104px] min-w-[120px] overflow-hidden font-mono text-[92px] font-extrabold leading-[104px]">
          <span className="cel-solo-mov cel-numero-sale absolute inset-x-0 top-0 text-[var(--fuego-300)]">{racha.antes}</span>
          <span className="cel-numero block text-[var(--fuego-600)]">{racha.ahora}</span>
        </div>
        <span className="sr-only">{T.numeroDeRacha(racha.ahora)}</span>
        <h1 id="celebracion-titulo" className="cel-linea -mt-1 text-[26px] font-extrabold tracking-[-0.01em] text-[var(--fuego-800)]" style={retraso(1060)}>
          {textos.titulo(racha.ahora)}
        </h1>
        <p id="celebracion-texto" className="cel-linea max-w-[420px] text-[15.5px] text-system-700" style={retraso(1120)}>
          {textos.texto}
        </p>

        <ol aria-label={T.semana} className="cel-linea mt-2.5 flex gap-2 rounded-2xl border border-[var(--fuego-100)] bg-white px-3 py-3.5 sm:gap-3 sm:px-[18px]" style={retraso(1180)}>
          {racha.semana.map((d) => {
            const numero = diaDeLaSemana(d.dia);
            return (
              <li key={d.dia} className="flex w-[34px] flex-col items-center gap-1.5">
                <span aria-hidden="true" className={`text-xs font-bold ${d.hoy ? "text-[var(--fuego-700)]" : "text-system-600"}`}>
                  {T.inicialesDeDias[numero]}
                </span>
                {d.hoy ? (
                  <span aria-hidden="true" className="cel-hoy flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fuego-600)] text-white shadow-[0_0_0_4px_var(--fuego-200)]">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" focusable="false">
                      <path d="M12 3q1 4 4 6.5t3 5.5a7 7 0 0 1-14 0 5 5 0 0 1 1-3 3 3 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4Z" />
                    </svg>
                  </span>
                ) : d.conAporte ? (
                  <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fuego-600)] text-white">
                    <Icono trazo={TRAZOS.palomita} className="h-4 w-4" grosor={3} />
                  </span>
                ) : (
                  <span aria-hidden="true" className="block h-8 w-8 rounded-full border-2 border-system-200" />
                )}
                <span className="sr-only">{T.dia(T.nombresDeDias[numero], d.conAporte, d.hoy)}</span>
              </li>
            );
          })}
        </ol>

        <div className="cel-linea mt-3.5 flex w-full justify-center sm:w-auto" style={retraso(1400)}>
          {siguiente ? (
            <Accion tono="principal" alPulsar={alSiguiente} foco>
              {siguiente}
            </Accion>
          ) : (
            <Accion tono="principal" alPulsar={alCerrar} foco>
              {T.continuar}
            </Accion>
          )}
        </div>
      </div>
    </div>
  );
}
