// Celebración del objeto que entró al inventario («¡Ganaste un protector!»). Mismo armazón que la de medalla: arriba,
// sobre azul oscuro, la ilustración con halo y chispas del color del objeto; abajo, dónde quedó (casillas del
// inventario, o el potenciador corriendo, en espera o ya usado). Ventana; en teléfono, hoja que sube desde abajo.
// Un objeto nuevo solo necesita su imagen (recursos.ts) y sus textos.

import { TEXTOS } from "@/lib/gamificacion/textos";
import type { ObjetoGanado } from "@/lib/gamificacion/celebraciones-tipos";
import { MAXIMO_DE_POTENCIADORES_EN_ESPERA, MAXIMO_DE_PROTECTORES } from "@/lib/gamificacion/progreso-tipos";
import { ImagenDeObjeto } from "../ObjetoDeInventario";
import { useSegundosDelPotenciador } from "../useSegundosDelPotenciador";
import { Accion, Paso, retraso } from "./piezas";

const T = TEXTOS.celebraciones;
const I = TEXTOS.inventario;
const G = TEXTOS.inventario.ganado;
const P = TEXTOS.potenciadorFlotante;

const ESTILO = {
  protector: {
    halo: "border-[var(--fuego-400)]",
    chispa: "var(--fuego-400)",
    eyebrow: "text-[var(--fuego-300)]",
    etiqueta: "bg-[var(--fuego-100)] text-[var(--fuego-800)]",
    caja: "bg-[var(--fuego-50)] text-[var(--fuego-800)]",
  },
  potenciador: {
    halo: "border-[var(--color-avance-claro-2)]",
    chispa: "var(--color-avance-claro-2)",
    eyebrow: "text-brand-300",
    etiqueta: "bg-brand-50 text-brand-800",
    caja: "bg-brand-50 text-brand-800",
  },
} as const;

const CHISPAS = [
  { dx: -78, dy: -44, lado: 6, d: 520 },
  { dx: 80, dy: -34, lado: 5, d: 560 },
  { dx: -64, dy: 52, lado: 5, d: 600 },
  { dx: 70, dy: 56, lado: 6, d: 540 },
  { dx: 0, dy: -86, lado: 4, d: 580 },
  { dx: -92, dy: 6, lado: 4, d: 620 },
  { dx: 94, dy: 4, lado: 5, d: 640 },
];

/** Casillas del inventario: las llenas con la ilustración; la recién ganada, marcada. */
function Casillas({ objeto, llenas, total }: { objeto: ObjetoGanado["objeto"]; llenas: number; total: number }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) =>
        i < llenas ? (
          <span key={i} className={`block rounded-lg ${i === llenas - 1 ? "outline-2 outline-offset-2 outline-success-500" : ""}`}>
            <ImagenDeObjeto objeto={objeto} tamano={32} lado={96} className="h-8 w-8" />
          </span>
        ) : (
          <span key={i} className="m-0.5 block h-7 w-7 rounded-lg border-2 border-dashed border-system-300" />
        ),
      )}
    </span>
  );
}

/** El potenciador activo con su reloj corriendo, igual que en el menú lateral. */
function PotenciadorActivo({ p, caja }: { p: Extract<NonNullable<ObjetoGanado["potenciador"]>, { estado: "activo" }>; caja: string }) {
  // `p` viene estable de la cola; el gancho reinicia la cuenta si cambia el objeto.
  const segundos = useSegundosDelPotenciador(p);
  return (
    <>
      <div className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 ${caja}`}>
        <ImagenDeObjeto objeto="potenciador" tamano={48} lado={96} className="h-12 w-12 shrink-0" />
        <div>
          <p role="timer" aria-label={P.quedan(segundos)} className="font-mono text-2xl font-extrabold leading-none text-system-900">
            {P.reloj(segundos)}
          </p>
          <p className="mt-1 text-[13px]">
            {p.alVolver ? G.activoAlVolver : G.activo} {P.suma(p.bonificacion)}
          </p>
        </div>
      </div>
      <p className="text-[12.5px] text-system-600">{G.dondeVerlo}</p>
    </>
  );
}

function Detalle({ datos }: { datos: ObjetoGanado }) {
  const estilo = ESTILO[datos.objeto];
  if (datos.objeto === "protector") {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-system-100 px-3.5 py-2.5">
          <span className="text-[13.5px] font-semibold text-system-700">{I.tienes("protector", datos.protectores, false, 0)}</span>
          <Casillas objeto="protector" llenas={Math.min(datos.protectores, MAXIMO_DE_PROTECTORES)} total={MAXIMO_DE_PROTECTORES} />
        </div>
        <p className={`rounded-xl px-3.5 py-2.5 text-[13.5px] ${estilo.caja}`}>
          {I.explica.protector} {G.protectorSolo}
        </p>
      </>
    );
  }
  const p = datos.potenciador;
  if (p?.estado === "activo") return <PotenciadorActivo p={p} caja={estilo.caja} />;
  if (p?.estado === "espera") {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-system-100 px-3.5 py-2.5">
          <span className="text-[13.5px] font-semibold text-system-700">{G.enEspera(datos.potenciadoresEnEspera, MAXIMO_DE_POTENCIADORES_EN_ESPERA)}</span>
          <Casillas
            objeto="potenciador"
            llenas={Math.min(datos.potenciadoresEnEspera, MAXIMO_DE_POTENCIADORES_EN_ESPERA)}
            total={MAXIMO_DE_POTENCIADORES_EN_ESPERA}
          />
        </div>
        <p className={`rounded-xl px-3.5 py-2.5 text-[13.5px] ${estilo.caja}`}>
          {G.espera(p.segundosDelActivo !== null ? P.reloj(p.segundosDelActivo) : null)}
        </p>
      </>
    );
  }
  return <p className={`rounded-xl px-3.5 py-2.5 text-[13.5px] ${estilo.caja}`}>{G.usado}</p>;
}

export default function CelebracionDeObjetoGanado({
  datos,
  paso,
  siguiente,
  alSiguiente,
  alCerrar,
}: {
  datos: ObjetoGanado;
  paso: string | null;
  /** Texto del botón al siguiente paso de la cola; null si es el último. */
  siguiente: string | null;
  alSiguiente: () => void;
  alCerrar: () => void;
}) {
  const estilo = ESTILO[datos.objeto];
  const alVolver = datos.potenciador?.estado === "activo" && datos.potenciador.alVolver;
  return (
    <div className="cel-ventana relative overflow-hidden">
      <div className="flex flex-col items-center gap-2.5 bg-brand-950 px-6 pb-6 pt-7 text-center text-white">
        <span aria-hidden="true" className="relative flex h-[168px] w-[168px] items-center justify-center">
          <span className={`cel-solo-mov cel-halo absolute inset-2 rounded-full border-2 ${estilo.halo}`} />
          {CHISPAS.map((c, i) => (
            <span
              key={i}
              className="cel-solo-mov cel-chispa absolute rounded-full"
              style={retraso(c.d, {
                left: `calc(50% - ${c.lado / 2}px)`,
                top: `calc(50% - ${c.lado / 2}px)`,
                width: c.lado,
                height: c.lado,
                background: estilo.chispa,
                ["--dx" as string]: `${c.dx}px`,
                ["--dy" as string]: `${c.dy}px`,
              })}
            />
          ))}
          <span className="cel-aparece relative block" style={retraso(200)}>
            <ImagenDeObjeto objeto={datos.objeto} tamano={128} lado={192} className="h-32 w-32" />
          </span>
        </span>
        <p className={`cel-linea text-sm font-bold ${estilo.eyebrow}`} style={retraso(520)}>
          {alVolver ? G.eyebrowAlVolver : G.eyebrow}
        </p>
        <h2 id="celebracion-titulo" className="cel-linea text-[30px] font-extrabold leading-[1.1] tracking-[-0.015em]" style={retraso(570)}>
          {G.titulo(datos.objeto)}
        </h2>
        <span className={`cel-linea rounded-lg px-2.5 py-0.5 text-[12.5px] font-bold ${estilo.etiqueta}`} style={retraso(620)}>
          {datos.mision}
        </span>
      </div>
      <div className="flex flex-col gap-3.5 px-6 pb-6 pt-5">
        <Detalle datos={datos} />
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          {siguiente ? (
            <>
              <Accion tono="claro" alPulsar={alCerrar}>
                {T.cerrar}
              </Accion>
              <Accion tono="principal" alPulsar={alSiguiente} foco>
                {siguiente}
              </Accion>
            </>
          ) : (
            <Accion tono="principal" alPulsar={alSiguiente} foco>
              {I.entendido}
            </Accion>
          )}
        </div>
      </div>
      <Paso texto={paso} tono="oscuro" />
    </div>
  );
}
