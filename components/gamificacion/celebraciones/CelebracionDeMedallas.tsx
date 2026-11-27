// Celebración de niveles de medalla (2026-11-16; lienzo aprobado el mismo día; RF-GAM-46, 84). Ventana; en teléfono,
// hoja que sube desde abajo.
// - Una medalla: la ilustración de antes se funde en la nueva con un halo y se llena el tramo nuevo de la barra de
//   niveles. Sin nivel antes, la de antes es la del nivel 1 en gris.
// - Una medalla que mide la racha (Llama Constante; MEDIDAS_CON_FUEGO): una llama se enciende detrás, la ilustración
//   de antes se apaga y la nueva surge del fuego, con halo naranja y brasas (decisión del 2026-11-16).
// - Varias: una ventana con todas, cada una en su versión breve.
// Textos en TEXTOS.celebraciones y TEXTOS.medallas.

import { rutaDePantalla } from "@/lib/gamificacion/pantallas-de-progreso";
import { TEXTOS, deEnfoque } from "@/lib/gamificacion/textos";
import type { CelebracionDeMedalla } from "@/lib/gamificacion/celebraciones-tipos";
import { Accion, Brasas, Llama, Paso, retraso } from "./piezas";
import { useEnfoqueDeCelebraciones } from "./enfoque-de-celebraciones";

const T = TEXTOS.celebraciones;
const M = TEXTOS.medallas;

function estado(m: CelebracionDeMedalla): string {
  return m.nivel >= m.totalNiveles ? M.nivelMaximo(m.nombreDelNivel) : M.nivelDe(m.nombreDelNivel, m.nivel, m.totalNiveles);
}

/** La ilustración de antes y la nueva, una encima de la otra. */
function Ilustraciones({ m, lado, entrada, inicio = 0 }: { m: CelebracionDeMedalla; lado: number; entrada: "aparece" | "surge"; inicio?: number }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={m.imagenAntes}
        alt=""
        width={lado}
        height={lado}
        className={`cel-solo-mov cel-sale absolute inset-0 ${m.nivelAntes === 0 ? "opacity-45 grayscale" : ""}`}
        style={retraso((entrada === "surge" ? 520 : 300) + inicio)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={m.imagen} alt="" width={lado} height={lado} className={`cel-${entrada} absolute inset-0`} style={retraso((entrada === "surge" ? 640 : 380) + inicio)} />
    </>
  );
}

function Una({ m }: { m: CelebracionDeMedalla }) {
  const fuego = m.conFuego;
  const saltos = m.nivel - m.nivelAntes;
  const sube = deEnfoque(useEnfoqueDeCelebraciones(), "logroSube") ?? T.medallaEyebrow;
  const eyebrow = fuego ? T.medallaFuego : m.nivelAntes === 0 ? T.medallaPrimera : saltos > 1 ? T.medallaSalto(saltos) : sube;
  const textos = fuego ? 860 : 560;
  const unidad = M.unidad(m.mide, m.valor);
  const faltan = m.siguiente ? Math.max(0, m.siguiente.umbral - m.valor) : null;
  return (
    <>
      <div className="flex flex-col items-center gap-2.5 bg-brand-950 px-6 pb-6 pt-7 text-center text-white">
        {fuego ? (
          <span aria-hidden="true" className="relative block h-[200px] w-[200px]">
            <span className="cel-solo-mov cel-halo absolute left-[26px] top-[46px] h-[148px] w-[148px] rounded-full border-2 border-[var(--fuego-400)]" style={retraso(680)} />
            <Brasas desde={60} arriba={30} inicio={700} />
            {/* La llama, más grande que la medalla, asoma por arriba y por los lados: la medalla surge de ella. */}
            <span className="cel-encender absolute bottom-0 left-[15px] block" style={retraso(200)}>
              <Llama ancho={170} />
            </span>
            <span className="absolute left-[34px] top-[52px] block h-[132px] w-[132px]">
              <Ilustraciones m={m} lado={132} entrada="surge" />
            </span>
          </span>
        ) : (
          <span aria-hidden="true" className="relative flex h-[168px] w-[168px] items-center justify-center">
            <span className="cel-solo-mov cel-halo absolute inset-2 rounded-full border-2 border-success-400" />
            <span className="relative block h-[152px] w-[152px]">
              <Ilustraciones m={m} lado={152} entrada="aparece" />
            </span>
          </span>
        )}
        <p className={`cel-linea text-sm font-bold ${fuego ? "text-[var(--fuego-300)]" : "text-success-300"}`} style={retraso(textos)}>
          {eyebrow}
        </p>
        <h2 id="celebracion-titulo" className="cel-linea text-[30px] font-extrabold leading-[1.1] tracking-[-0.015em]" style={retraso(textos + 50)}>
          {m.nombre}
        </h2>
        <span
          className={`cel-linea rounded-lg px-2.5 py-0.5 text-[12.5px] font-bold ${fuego ? "bg-[var(--fuego-100)] text-[var(--fuego-800)]" : "bg-success-50 text-success-800"}`}
          style={retraso(textos + 100)}
        >
          {estado(m)}
        </span>
      </div>
      <div className="flex flex-col gap-3.5 px-6 pb-6 pt-5">
        <div aria-hidden="true" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${m.totalNiveles}, minmax(0, 1fr))` }}>
          {Array.from({ length: m.totalNiveles }, (_, i) => {
            const relleno = fuego ? "bg-[var(--fuego-600)]" : "bg-success-700";
            const nuevo = i >= m.nivelAntes && i < m.nivel;
            return (
              <span key={i} className={`block h-2 overflow-hidden rounded-pill ${i < m.nivelAntes ? relleno : "bg-system-200"}`}>
                {nuevo && <span className={`cel-llenar block h-2 ${relleno}`} style={retraso((fuego ? 980 : 700) + (i - m.nivelAntes) * 80)} />}
              </span>
            );
          })}
        </div>
        <p className={`flex items-baseline gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] ${fuego ? "bg-[var(--fuego-50)] text-[var(--fuego-800)]" : "bg-brand-50 text-brand-800"}`}>
          <strong className={`font-mono text-[22px] ${fuego ? "text-[var(--fuego-900)]" : "text-brand-950"}`}>{m.valor}</strong>
          <span>
            {M.valorHoy(unidad, faltan, m.siguiente?.nombre ?? null)}
            {m.intermedios.length > 0 && ` ${T.pasastePor(m.intermedios)}`}
          </span>
        </p>
      </div>
    </>
  );
}

function Varias({ medallas }: { medallas: CelebracionDeMedalla[] }) {
  return (
    <>
      <div className="px-6 pb-2 pt-6 text-center">
        <p className="text-sm font-bold text-success-800">{T.medallasEyebrow}</p>
        <h2 id="celebracion-titulo" className="mt-1 text-[26px] font-extrabold tracking-[-0.015em] text-system-900">
          {T.medallasTitulo(medallas.length)}
        </h2>
      </div>
      <ul className="grid grid-cols-2 gap-3 px-6 pb-1.5 pt-3.5">
        {medallas.map((m, i) => (
          <li key={m.clave} className="cel-linea flex flex-col items-center gap-2 rounded-[14px] border border-system-200 px-3 py-4 text-center" style={retraso(160 + i * 80)}>
            <span aria-hidden="true" className="relative block h-28 w-28">
              <Ilustraciones m={m} lado={112} entrada="aparece" inicio={i * 80} />
            </span>
            <strong className="text-[15px] text-system-900">{m.nombre}</strong>
            <span className={`rounded-lg px-2.5 py-0.5 text-[12.5px] font-bold ${m.conFuego ? "bg-[var(--fuego-100)] text-[var(--fuego-800)]" : "bg-success-50 text-success-800"}`}>
              {estado(m)}
            </span>
            <span className="text-[12.5px] text-system-600">
              {m.valor} {M.unidad(m.mide, m.valor)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function CelebracionDeMedallas({
  medallas,
  paso,
  siguiente,
  alSiguiente,
  alCerrar,
}: {
  medallas: CelebracionDeMedalla[];
  paso: string | null;
  siguiente: string | null;
  alSiguiente: () => void;
  alCerrar: () => void;
}) {
  const ruta = rutaDePantalla("medallas");
  return (
    <div className="cel-ventana relative overflow-hidden">
      {medallas.length === 1 ? <Una m={medallas[0]} /> : <Varias medallas={medallas} />}
      <div className="px-6 pb-6">
        
        <div className="mt-3.5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          {siguiente ? (
            <>
              <Accion tono="claro" href={ruta} alPulsar={alCerrar}>
                {T.verMedallas}
              </Accion>
              <Accion tono="principal" alPulsar={alSiguiente} foco>
                {siguiente}
              </Accion>
            </>
          ) : (
            <>
              <Accion tono="claro" alPulsar={alCerrar}>
                {T.cerrar}
              </Accion>
              <Accion tono="principal" href={ruta} alPulsar={alCerrar} foco>
                {T.verMedallas}
              </Accion>
            </>
          )}
        </div>
      </div>
      <Paso texto={paso} tono={medallas.length === 1 ? "oscuro" : "claro"} />
    </div>
  );
}
