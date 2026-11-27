// Celebración de ascenso de rango (2026-11-16; lienzo aprobado el mismo día; RF-GAM-84). Pantalla completa azul
// marino: la insignia anterior gira y sale, la nueva entra girando con rebote, con destello, dos anillos, dos oleadas
// de chispas y rayos que giran despacio; el nombre entra palabra por palabra y las recompensas en escalera. Al final la
// insignia flota. Varios rangos de una vez: se celebra el último y se nombran los intermedios. La insignia es
// InsigniaDeRango (cuando exista el arte final, cambia solo allí). Textos en TEXTOS.celebraciones.

import InsigniaDeRango from "@/components/gamificacion/InsigniaDeRango";
import { rutaDePantalla } from "@/lib/gamificacion/pantallas-de-progreso";
import { TEXTOS, deEnfoque } from "@/lib/gamificacion/textos";
import type { CelebracionDeRango as Datos } from "@/lib/gamificacion/celebraciones-tipos";
import { Accion, Icono, Paso, TRAZOS, retraso } from "./piezas";
import { useEnfoqueDeCelebraciones } from "./enfoque-de-celebraciones";

const T = TEXTOS.celebraciones;
const COLORES = ["var(--color-brand-300)", "var(--color-success-400)", "var(--color-warning-200)", "var(--color-brand-200)", "var(--color-success-300)"];

// Dos oleadas: 10 cerca y 8 más lejos y más pequeñas. Posiciones fijas: no dependen de la persona.
const CHISPAS = [
  ...Array.from({ length: 10 }, (_, i) => {
    const angulo = ((i * 36 - 90) * Math.PI) / 180;
    const distancia = i % 2 ? 84 : 104;
    return { lado: 6, dx: Math.round(Math.cos(angulo) * distancia), dy: Math.round(Math.sin(angulo) * distancia), color: COLORES[i % 5], d: 560 + (i % 3) * 20 };
  }),
  ...Array.from({ length: 8 }, (_, i) => {
    const angulo = ((i * 45 - 70) * Math.PI) / 180;
    return { lado: 4, dx: Math.round(Math.cos(angulo) * 140), dy: Math.round(Math.sin(angulo) * 140), color: COLORES[(i + 2) % 5], d: 760 + (i % 2) * 30 };
  }),
];
const RAYOS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180;
  return { x1: 110 + Math.cos(a) * 78, y1: 110 + Math.sin(a) * 78, x2: 110 + Math.cos(a) * 104, y2: 110 + Math.sin(a) * 104 };
});

type Linea = { clave: string; titulo: string; detalle: string; trazo: string; tono: string };

function lineasDe(r: Datos): Linea[] {
  const lineas: Linea[] = r.intermedios.map((i) => ({
    clave: `i${i.numero}`,
    titulo: T.intermedio(i.numero, i.nombre),
    detalle: T.intermedioDetalle,
    trazo: TRAZOS.palomita,
    tono: "bg-brand-800 text-brand-300",
  }));
  for (const rec of r.recompensas) {
    if (rec.tipo === "etapa_avatar")
      lineas.push({ clave: "etapa", titulo: T.etapa(rec.etapa), detalle: T.etapaDetalle, trazo: TRAZOS.usuario, tono: "bg-success-50 text-success-800" });
    else if (rec.tipo === "insignia")
      lineas.push({ clave: "insignia", titulo: T.insignia(rec.rango), detalle: T.insigniaDetalle, trazo: TRAZOS.insignia, tono: "bg-brand-100 text-brand-700" });
    else
      lineas.push({ clave: "coleccionable", titulo: T.coleccionable(rec.nombre), detalle: T.coleccionableDetalle, trazo: TRAZOS.regalo, tono: "bg-warning-100 text-warning-700" });
  }
  lineas.push(
    r.siguiente
      ? { clave: "revelado", titulo: T.revelado(r.siguiente.numero, r.siguiente.nombre), detalle: T.reveladoDetalle(r.avistado), trazo: TRAZOS.ojo, tono: "border-2 border-dashed border-success-400 text-success-400" }
      : { clave: "ultimo", titulo: T.ultimoRango, detalle: T.ultimoRangoDetalle, trazo: TRAZOS.bandera, tono: "bg-warning-100 text-warning-700" },
  );
  return lineas;
}

export default function CelebracionDeRango({
  rango,
  paso,
  siguiente,
  alSiguiente,
  alCerrar,
}: {
  rango: Datos;
  paso: string | null;
  /** Texto del botón al siguiente paso de la cola; null si es el último. */
  siguiente: string | null;
  alSiguiente: () => void;
  alCerrar: () => void;
}) {
  const lineaDelEnfoque = deEnfoque(useEnfoqueDeCelebraciones(), "rango");
  const varios = rango.intermedios.length > 0;
  const palabras = rango.nombre.split(/\s+/);
  const trayectoria = rutaDePantalla("trayectoria");
  return (
    <div className="relative flex min-h-full items-center justify-center px-5 py-16">
      <Paso texto={paso} tono="oscuro" />
      <div className="cel-entra flex w-full max-w-[620px] flex-col items-center gap-3.5 text-center">
        <div aria-hidden="true" className="relative flex h-[220px] w-[240px] items-center justify-center">
          <span className="cel-solo-mov cel-rayos absolute left-[10px] top-0 h-[220px] w-[220px]">
            <svg viewBox="0 0 220 220" width="220" height="220" focusable="false">
              <g stroke="var(--color-brand-300)" strokeWidth="3" strokeLinecap="round" opacity="0.45">
                {RAYOS.map((y, i) => (
                  <line key={i} x1={y.x1} y1={y.y1} x2={y.x2} y2={y.y2} />
                ))}
              </g>
            </svg>
          </span>
          <span className="cel-solo-mov cel-destello absolute h-[150px] w-[150px] rounded-full bg-brand-300 shadow-[0_0_60px_30px_rgba(159,191,244,0.55)]" />
          <span className="cel-solo-mov cel-anillo absolute h-[140px] w-[140px] rounded-[42px] border-2 border-brand-300" style={retraso(560)} />
          <span className="cel-solo-mov cel-anillo absolute h-[140px] w-[140px] rounded-[42px] border-2 border-success-400" style={retraso(740)} />
          {CHISPAS.map((c, i) => (
            <span
              key={i}
              className="cel-solo-mov cel-chispa absolute rounded-full"
              style={retraso(c.d, {
                left: `calc(50% - ${c.lado / 2}px)`,
                top: `calc(50% - ${c.lado / 2}px)`,
                width: c.lado,
                height: c.lado,
                background: c.color,
                ["--dx" as string]: `${c.dx}px`,
                ["--dy" as string]: `${c.dy}px`,
              })}
            />
          ))}
          <span className="cel-flotar relative block h-32 w-32 [perspective:600px]">
            {rango.anterior > 0 && (
              <span className="cel-solo-mov cel-giro-sale absolute inset-0">
                <InsigniaDeRango numero={rango.anterior} estado="alcanzado" tamano="xl" />
              </span>
            )}
            <span className="cel-giro-entra absolute inset-0 rounded-lg shadow-[0_0_0_10px_rgba(159,191,244,0.16),0_0_0_24px_rgba(159,191,244,0.06)]">
              <InsigniaDeRango numero={rango.numero} estado="actual" tamano="xl" />
            </span>
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="cel-linea text-[15px] font-bold text-brand-300" style={retraso(700)}>
            {varios ? T.rangosEyebrow(rango.intermedios.length + 1, rango.numero, rango.total) : T.rangoEyebrow(rango.numero, rango.total)}
          </p>
          <h1 id="celebracion-titulo" className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[46px]">
            {palabras.map((p, i) => (
              <span key={i} className="cel-palabra mx-[0.12em]" style={retraso(760 + i * 60)}>
                {p}
              </span>
            ))}
          </h1>
          <p className="cel-linea mt-1 max-w-[480px] text-base text-brand-100" style={retraso(920)}>
            {lineaDelEnfoque && <span className="block font-semibold text-white">{lineaDelEnfoque}</span>}
            {varios ? T.rangosTexto(rango.numero) : T.rangoTexto}
          </p>
        </div>

        <ul className="mt-1 flex w-full flex-col gap-2 text-left">
          {lineasDe(rango).map((l, i) => (
            <li key={l.clave} className="cel-linea flex items-center gap-3.5 rounded-[14px] border border-brand-800 bg-brand-900/60 px-3.5 py-2.5" style={retraso(1000 + i * 70)}>
              <span aria-hidden="true" className={`cel-pop flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl ${l.tono}`} style={retraso(1100 + i * 70)}>
                <Icono trazo={l.trazo} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[14.5px]">{l.titulo}</strong>
                <span className="block text-[13px] text-brand-200">{l.detalle}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="cel-linea mt-1 flex w-full flex-col-reverse justify-center gap-2.5 sm:w-auto sm:flex-row" style={retraso(1400)}>
          {siguiente ? (
            <>
              <Accion tono="oscuro" href={trayectoria} alPulsar={alCerrar}>
                {T.verTrayectoria}
              </Accion>
              <Accion tono="principal" alPulsar={alSiguiente} foco>
                {siguiente}
              </Accion>
            </>
          ) : (
            <>
              <Accion tono="oscuro" alPulsar={alCerrar}>
                {T.cerrar}
              </Accion>
              <Accion tono="principal" href={trayectoria} alPulsar={alCerrar} foco>
                {T.verTrayectoria}
              </Accion>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
