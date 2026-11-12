// Tarjetas de la Trayectoria.

import AyudaEmergente from "@/components/ui/AyudaEmergente";
import { buttonClasses } from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import { rutaDePantalla } from "@/lib/gamificacion/pantallas-de-progreso";
import type { HitoDelRecorrido } from "@/lib/gamificacion/mi-progreso-tipos";
import {
  TEXTO_DE_LA_RACHA,
  type FichaDeRangoAvistado,
  type FichaDeRangoSiguiente,
} from "@/lib/gamificacion/rangos";
import InsigniaDeRango from "./InsigniaDeRango";

const TARJETA = "rounded-lg border border-system-200 bg-white shadow-sm";

function Marca({ cumplido }: { cumplido: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill ${cumplido ? "bg-success-100 text-success-800" : "bg-system-100"}`}
    >
      {cumplido && (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

function Recompensa({ titulo, detalle, icono, tono }: { titulo: string; detalle?: string; icono: string; tono: "ok" | "info" }) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-system-200 bg-system-50 px-3 py-2.5">
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${tono === "ok" ? "bg-success-50 text-success-800" : "bg-brand-50 text-brand-700"}`}
      >
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d={icono} />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold text-system-900">{titulo}</span>
        {detalle && <span className="block text-[12px] text-system-600">{detalle}</span>}
      </span>
    </li>
  );
}

const ICONO = {
  avatar: "M7 8a5 5 0 1 0 10 0a5 5 0 1 0 -10 0 M20 21a8 8 0 0 0-16 0",
  insignia:
    "M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15 M11 12 5.12 2.2 M13 12 l5.88-9.8 M8 7h8 M7 17a5 5 0 1 0 10 0a5 5 0 1 0 -10 0",
  revelar: "M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0 M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
};

export function TarjetaDelSiguienteRango({
  ficha,
  total,
  onAbrir,
}: {
  ficha: FichaDeRangoSiguiente;
  total: number;
  onAbrir: (numero: number) => void;
}) {
  const ultimo = ficha.numero >= total;
  return (
    <section aria-labelledby="siguiente-titulo" className={`flex min-w-0 flex-[2_1_520px] flex-col gap-4 p-6 max-md:p-4 ${TARJETA}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Tag tone="ok">Siguiente</Tag>
          <h2 id="siguiente-titulo" className="mt-2 text-[26px] font-extrabold leading-tight max-md:text-xl">
            <span className="block text-[15px] font-semibold text-system-700 max-md:text-[13px]">Rango {ficha.numero}</span>
            {ficha.nombre}
          </h2>
          {ficha.descripcion && <p className="mt-1.5 text-sm text-system-700">{ficha.descripcion}</p>}
        </div>
        <InsigniaDeRango numero={ficha.numero} estado="siguiente" tamano="lg" />
      </div>

      <div className="rounded-lg bg-system-100 px-3.5 py-3">
        <p className="text-[15px] font-bold text-system-900 max-md:text-sm">{ficha.textoQueFalta}</p>
        <p className="mt-0.5 text-[13px] text-system-700">
          Cumples {ficha.cumplidos} de {ficha.requisitos.length}. Subes en cuanto cumplas todos a la vez.
        </p>
      </div>

      <ul aria-label={`Requisitos del rango ${ficha.numero}`}>
        {ficha.requisitos.map((r) => (
          <li key={r.clave} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 border-t border-system-100 py-2.5">
            <Marca cumplido={r.cumplido} />
            <span className="flex items-center gap-1 text-sm font-semibold text-system-900">
              {r.etiqueta}
              {r.clave === "racha" && <AyudaEmergente etiqueta="Cómo cuenta la racha">{TEXTO_DE_LA_RACHA}</AyudaEmergente>}
            </span>
            <span className={`font-mono text-[13px] font-bold ${r.cumplido ? "text-success-800" : "text-system-900"}`}>{r.textoAvance}</span>
            <span className="col-start-2 col-end-4">
              <ProgressBar pct={r.porcentaje} tone={r.cumplido ? "ok" : "accent"} />
            </span>
          </li>
        ))}
      </ul>
      <p className="-mt-2 text-[12.5px] text-system-600">Un aporte de 5★ también cuenta en «4★ o más».</p>

      <div>
        <h3 className="mb-2 text-sm font-extrabold text-system-900">Al subir recibes</h3>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
          <Recompensa icono={ICONO.avatar} tono="ok" titulo={`Etapa ${ficha.etapaDelAvatar} de tu avatar`} detalle="Tu avatar evoluciona y no retrocede." />
          <Recompensa icono={ICONO.insignia} tono="info" titulo={`Insignia del rango ${ficha.numero}`} detalle="Su emblema, aparte de tu avatar." />
          <Recompensa
            icono={ICONO.revelar}
            tono="info"
            titulo={ultimo ? `Los ${total} rangos completos` : `El rango ${ficha.numero + 1} completo`}
            detalle={ultimo ? "No queda ninguno por descubrir." : ficha.numero + 2 <= total ? `Y la pista del ${ficha.numero + 2}.` : undefined}
          />
        </ul>
      </div>

      <div className="mt-auto flex flex-wrap gap-2.5 border-t border-system-100 pt-3.5">
        <ButtonLink href="/campanas" variant="primary">
          Aportar a una campaña
        </ButtonLink>
        <button type="button" onClick={() => onAbrir(ficha.numero)} aria-haspopup="dialog" className={buttonClasses("secondary")}>
          Ver la ficha del rango {ficha.numero}
        </button>
      </div>
    </section>
  );
}

export function TrayectoriaCompleta({ total }: { total: number }) {
  const medallas = rutaDePantalla("medallas");
  return (
    <section aria-labelledby="completa-titulo" className={`flex min-w-0 flex-[2_1_520px] flex-col gap-3 p-7 max-md:p-4 ${TARJETA}`}>
      <Tag tone="ok" className="self-start">
        Trayectoria completa
      </Tag>
      <h2 id="completa-titulo" className="text-[26px] font-extrabold leading-tight max-md:text-xl">
        No hay un rango {total + 1}
      </h2>
      <p className="max-w-xl text-[15px] text-system-700 max-md:text-sm">
        Los {total} rangos son tuyos y ninguno se pierde. Tus medallas siguen subiendo con cada aporte aceptado.
      </p>
      <div className="mt-2 flex flex-wrap gap-2.5">
        {/* Medallas aún no existe: el botón sale solo cuando tenga ruta (pantallas-de-progreso.ts). */}
        {medallas && (
          <ButtonLink href={medallas} variant="primary">
            Ver tus medallas
          </ButtonLink>
        )}
        <ButtonLink href="/campanas" variant={medallas ? "secondary" : "primary"}>
          Aportar a una campaña
        </ButtonLink>
      </div>
    </section>
  );
}

export function TarjetaDelAvistado({ ficha, onAbrir }: { ficha: FichaDeRangoAvistado; onAbrir: (numero: number) => void }) {
  return (
    <section aria-labelledby="avistado-titulo" className="flex flex-col gap-2.5 rounded-lg bg-brand-50 p-5">
      <p className="text-[12.5px] font-bold text-brand-700">Avistado</p>
      <div className="flex items-center gap-3.5">
        <InsigniaDeRango numero={ficha.numero} estado="avistado" tamano="md" />
        <div>
          <h2 id="avistado-titulo" className="text-xl font-extrabold text-brand-950">
            Rango {ficha.numero}
          </h2>
          <p className="text-[13px] text-brand-800">Nombre por descubrir</p>
        </div>
      </div>
      <p className="text-[15px] font-bold text-brand-950">{ficha.pista}</p>
      <button
        type="button"
        onClick={() => onAbrir(ficha.numero)}
        aria-haspopup="dialog"
        className="self-start py-1.5 text-[13.5px] font-bold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Ver todo lo que pide
      </button>
    </section>
  );
}

export function RecorridoDeRangos({
  recorrido,
  actual,
  onAbrir,
}: {
  recorrido: HitoDelRecorrido[];
  actual: number;
  onAbrir: (numero: number) => void;
}) {
  return (
    <section aria-labelledby="recorrido-titulo" className={`flex flex-[1_1_auto] flex-col gap-1.5 px-4 pt-5 pb-3.5 ${TARJETA}`}>
      <h2 id="recorrido-titulo" className="mx-2 mb-1 text-lg font-extrabold text-system-900">
        Tu recorrido
      </h2>
      <ol className="flex max-h-[360px] flex-col gap-0.5 overflow-y-auto">
        {recorrido.map((h) => (
          <li key={h.numero}>
            <button
              type="button"
              onClick={() => onAbrir(h.numero)}
              aria-haspopup="dialog"
              aria-current={h.numero === actual ? "step" : undefined}
              aria-label={`Rango ${h.numero}, ${h.nombre}${h.numero === actual ? ", tu rango actual" : ""}${h.fecha ? `, alcanzado ${h.fecha === "hoy" ? "hoy" : `el ${h.fecha}`}` : ""}${h.lapso ? `, ${h.lapso.toLowerCase()}` : ""}. Abre su ficha.`}
              className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] p-2 text-left hover:bg-system-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <InsigniaDeRango numero={h.numero} estado={h.numero === actual ? "actual" : "alcanzado"} tamano="sm" />
              <span className="min-w-0 text-sm font-semibold text-system-900">{h.nombre}</span>
              <span className="text-right">
                {h.fecha && <span className="block text-[12.5px] font-semibold text-system-900">{h.fecha}</span>}
                {h.lapso && <span className="block text-[11.5px] text-system-500">{h.lapso}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
