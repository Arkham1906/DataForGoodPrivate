// Tarjeta de misiones de un periodo en /progreso/misiones (2026-11-04; diseño v10, RF-GAM-40, 41, 75): cuándo empieza y
// termina el periodo, cada misión con su avance y su recompensa. El estado se dice con texto, no solo con color.
// Sin estado: Server Component.
//
// 2026-11-19 (SRS v1.4: RF-GAM-43, 122; lienzo «Misiones: Envía/Logra, dificultad y recompensa», aprobado): la recompensa
// va con su ícono (EXP, protector o potenciador), las difíciles llevan la etiqueta «Difícil» con ícono, y una línea dice
// cuándo cuenta la misión. 2026-11-20: protector y potenciador con su glifo aprobado (escudo naranja, frasco azul).

import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import type { GrupoDeMisiones as DatosDelGrupo, MisionVigente } from "@/lib/gamificacion/misiones";
import type { MedidaDeMision } from "@/lib/gamificacion/misiones-reglas";
import { TEXTOS } from "@/lib/gamificacion/textos";
import IconoDeMision from "./IconoDeMision";
import { GlifoDeObjeto } from "./ObjetoDeInventario";

const T = TEXTOS.misiones;
const I = TEXTOS.inventario;

/** Hasta cuántos pasos se dibujan como tramos; con más, una barra continua (igual que MisionesDeHoy). */
const MAXIMO_DE_TRAMOS = 5;

// Iconos de prueba de la tabla 4.5 (Lucide, como en el diseño).
const DOCUMENTO = "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2zM14 2v6h6M16 13H8M16 17H8";
const CALENDARIO = "M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 9h18";
const BRUJULA = "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM16.2 7.8l-2 6.4-6.4 2 2-6.4z";
const ICONOS: Record<MedidaDeMision, string> = {
  aportes: DOCUMENTO,
  dias_distintos: CALENDARIO,
  dias_seguidos: CALENDARIO,
  tipos_distintos: "M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3",
  campanas_distintas: BRUJULA,
  campanas_nuevas: BRUJULA,
  tematicas_distintas: BRUJULA,
  tematicas_nuevas: BRUJULA,
  inscripciones: DOCUMENTO,
  cuotas_completadas: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  campanas_guardadas: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z",
};

// EXP, Difícil, enviar y aceptado (Lucide); protector y potenciador, su glifo (ObjetoDeInventario).
const ESTRELLA = "M12 3l1.9 5.8L20 10.7l-5.1 3.7L16.8 21 12 17.3 7.2 21l1.9-6.6L4 10.7l6.1-1.9z";
const MONTANA = "M8 3l4 8 5-5 5 15H2L8 3z";
const ICONO_DE_CUENTA = {
  envio: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  aceptacion: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3",
} as const;
const CLASE_DE_RECOMPENSA = {
  exp: "border-brand-200 bg-brand-50 text-brand-800",
  protector: "border-fuego-200 bg-fuego-50 text-fuego-800",
  potenciador: "border-brand-300 bg-brand-100 text-brand-800",
} as const;

function IconoDeRecompensa({ tipo }: { tipo: "exp" | "potenciador" | "protector" }) {
  return tipo === "exp" ? (
    <Trazo d={ESTRELLA} className="h-[15px] w-[15px]" />
  ) : (
    <GlifoDeObjeto objeto={tipo} className="h-[15px] w-[15px]" />
  );
}

function Trazo({ d, className }: { d: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** La recompensa de una misión completada: lo que recibió, o qué pasó con su objeto (2026-11-19). */
function recompensaCompletada(mision: MisionVigente): { tipo: "exp" | "potenciador" | "protector"; texto: string; clase: string } | null {
  if (!mision.recompensa || !mision.tipoDeRecompensa) return null;
  const recibida = "border-success-200 bg-success-50 text-success-800";
  const neutra = "border-system-300 bg-white text-system-600";
  const tipo = mision.tipoDeRecompensa;
  if (mision.objeto === "pendiente") return { tipo, texto: I.tarjeta.pendiente(mision.recompensa), clase: neutra };
  if (mision.objeto === "perdida") return { tipo, texto: I.tarjeta.perdida(mision.recompensa), clase: neutra };
  if (mision.objeto === "cambiada" && tipo !== "exp") {
    const otro = tipo === "protector" ? "potenciador" : "protector";
    return { tipo: otro, texto: I.tarjeta.cambiada(I.nombre(otro)), clase: recibida };
  }
  return { tipo, texto: T.recibiste(mision.recompensa), clase: recibida };
}

function Mision({ mision }: { mision: MisionVigente }) {
  const { completada, objetivo, progreso } = mision;
  const hecha = completada ? recompensaCompletada(mision) : null;
  return (
    <li className="grid grid-cols-[44px_1fr] items-start gap-3.5 border-t border-system-100 py-4 first:border-t-0">
      <IconoDeMision clave={mision.clave} completada={completada} respaldo={ICONOS[mision.mide]} />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
          <span className="inline-flex flex-wrap items-center gap-2">
            <strong className="text-sm text-system-900">{mision.nombre}</strong>
            {mision.dificil && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-brand-950 py-0.5 pl-1.5 pr-2.5 text-[11.5px] font-bold text-white">
                <Trazo d={MONTANA} className="h-3.5 w-3.5" />
                {T.dificil}
              </span>
            )}
          </span>
          <span className={`whitespace-nowrap text-[13px] font-bold ${completada ? "text-success-800" : "text-system-900"}`}>
            {completada ? "Completada" : `${progreso} de ${objetivo}`}
          </span>
        </p>
        <div aria-hidden="true">
          {objetivo <= MAXIMO_DE_TRAMOS ? (
            <div className="flex gap-1">
              {Array.from({ length: objetivo }, (_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-pill ${i >= progreso ? "bg-system-200" : completada ? "bg-success-700" : "bg-brand-600"}`} />
              ))}
            </div>
          ) : (
            <ProgressBar pct={(progreso / objetivo) * 100} tone={completada ? "ok" : "accent"} />
          )}
        </div>
        {(mision.recompensa || (!completada && mision.cuenta !== "accion")) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {mision.recompensa && mision.tipoDeRecompensa && !completada && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-pill border py-1 pl-2 pr-2.5 text-[12.5px] font-bold ${CLASE_DE_RECOMPENSA[mision.tipoDeRecompensa]}`}
              >
                <IconoDeRecompensa tipo={mision.tipoDeRecompensa} />
                {T.recompensa(mision.recompensa)}
              </span>
            )}
            {completada && hecha && (
              <span className={`inline-flex items-center gap-1.5 rounded-pill border py-1 pl-2 pr-2.5 text-[12.5px] font-bold ${hecha.clase}`}>
                <IconoDeRecompensa tipo={hecha.tipo} />
                {hecha.texto}
              </span>
            )}
            {!completada && mision.cuenta !== "accion" && (
              <span className="inline-flex items-start gap-1.5 text-[12.5px] font-semibold text-system-600">
                <Trazo d={ICONO_DE_CUENTA[mision.cuenta]} className="mt-px h-3.5 w-3.5 shrink-0" />
                {T.cuenta[mision.cuenta]}
              </span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

export default function GrupoDeMisiones({
  id,
  titulo,
  grupo,
  etiquetaDelPlazo = "Se renuevan en",
}: {
  id: string;
  titulo: string;
  grupo: DatosDelGrupo;
  /** Las de inicio no se renuevan: terminan con la semana de bienvenida (2026-11-18). */
  etiquetaDelPlazo?: string;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-xl font-extrabold text-system-900">
            {titulo}
          </h2>
          {grupo.periodo && <p className="mt-0.5 text-[13px] text-system-700">Periodo: {grupo.periodo}</p>}
        </div>
        {grupo.seRenuevanEn && (
          <Tag tone="info">
            {etiquetaDelPlazo} {grupo.seRenuevanEn}
          </Tag>
        )}
      </div>
      {grupo.misiones.length === 0 ? (
        <p className="py-3 text-[13px] text-system-600">Por ahora no hay misiones en este periodo.</p>
      ) : (
        <ul>
          {grupo.misiones.map((m) => (
            <Mision key={m.id} mision={m} />
          ))}
        </ul>
      )}
    </section>
  );
}
