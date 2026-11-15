// Pantalla /progreso/historial, pestaña Historial de EXP de «Mi progreso» (2026-11-14; lienzo aprobado el mismo día;
// SRS v1.3: RF-GAM-03, 07, 37 a 39; descuento por reporte, A1 de la propuesta v1.4). Documento:
// claude/pantallas-v12/historial-exp-propuesta.md.
// De arriba abajo: EXP acumulada con lo que pide el rango siguiente y de dónde viene (los descuentos solo si hay),
// los movimientos (HistorialDeExp) y «Cómo se calcula» con los parámetros vigentes. El título y las pestañas están en
// ../layout.tsx.
// Server Component. Acceso: sesión de usuario. Datos: obtenerHistorialDeExp() y obtenerResumenDeProgreso().

import type { Metadata } from "next";
import Card from "@/components/ui/Card";
import ButtonLink from "@/components/ui/ButtonLink";
import HistorialDeExp from "@/components/gamificacion/HistorialDeExp";
import { exigirUsuario } from "@/lib/session";
import { obtenerHistorialDeExp } from "@/lib/gamificacion/historial-exp";
import { obtenerResumenDeProgreso } from "@/lib/gamificacion/progreso";
import type { FichaDeRangoSiguiente } from "@/lib/gamificacion/rangos";
import type { ReglasDeExp } from "@/lib/gamificacion/historial-exp-tipos";
import { NOMBRES_DE_ESTRELLAS, calificacionDesde } from "@/lib/aportes/calificacion";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
import type { TipoDeAporte } from "@/lib/gamificacion/exp-reglas";
import { TEXTOS } from "@/lib/gamificacion/textos";

export const metadata: Metadata = { title: "Historial de EXP" };

const T = TEXTOS.historialDeExp;
const nf = new Intl.NumberFormat("es-MX");
const conSigno = (valor: number) => (valor > 0 ? `+${nf.format(valor)}` : valor < 0 ? `−${nf.format(-valor)}` : "0");

/** «Foto y archivo» → 20: los tipos con la misma base van juntos, en el orden del catálogo. */
function basesAgrupadas(expBase: ReglasDeExp["expBase"]): { tipos: string; base: number }[] {
  const grupos = new Map<number, string[]>();
  for (const [tipo, base] of Object.entries(expBase) as [TipoDeAporte, number][]) {
    grupos.set(base, [...(grupos.get(base) ?? []), NOMBRE_DE_TIPO[tipo]]);
  }
  return [...grupos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([base, nombres]) => ({
      base,
      tipos: nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1].toLowerCase()}` : nombres[0],
    }));
}

function ComoSeCalcula({ reglas, hayDescuentos }: { reglas: ReglasDeExp; hayDescuentos: boolean }) {
  return (
    <div className="flex flex-col gap-3 text-[13.5px] text-system-900">
      <p className="text-brand-800">
        <strong>{T.comoFormula}</strong>
        {T.comoRedondeo}
      </p>
      <dl aria-label={T.comoTiposEtiqueta} className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-3 gap-y-1">
        {basesAgrupadas(reglas.expBase).map((g) => (
          <div key={g.base} className="contents">
            <dt>{g.tipos}</dt>
            <dd className="font-bold">{T.comoBase(g.base)}</dd>
          </div>
        ))}
      </dl>
      <dl
        aria-label={T.comoCalificacionesEtiqueta}
        className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-3 gap-y-1 border-t border-brand-200 pt-2.5"
      >
        {reglas.multiplicadores.map((m) => {
          const calificacion = calificacionDesde(m.calificacion);
          return (
            <div key={m.calificacion} className="contents">
              <dt>
                {m.calificacion}★ {calificacion ? NOMBRES_DE_ESTRELLAS[calificacion] : ""}
              </dt>
              <dd className="font-mono font-bold">{T.comoMultiplicador(m.multiplicador)}</dd>
            </div>
          );
        })}
      </dl>
      <ul className="list-disc space-y-2 pl-4 text-[13px] text-brand-800">
        <li>{T.comoPotenciador(reglas.bonificacionPotenciador)}</li>
        <li>{T.comoBono(reglas.bono.porcentaje, reglas.bono.cuotaMinima, reglas.bono.minimo, reglas.bono.maximo)}</li>
        <li>{T.comoMisiones}</li>
        {hayDescuentos && <li>{T.comoDescuento}</li>}
      </ul>
      <p className="text-xs text-brand-800">{T.comoPie}</p>
    </div>
  );
}

export default async function HistorialDeExpPage() {
  const usuario = await exigirUsuario();
  const [datos, progreso] = await Promise.all([obtenerHistorialDeExp(usuario.id), obtenerResumenDeProgreso(usuario.id)]);

  if (!datos) {
    return (
      <Card>
        <p className="text-[13px] text-system-600">{T.error}</p>
      </Card>
    );
  }

  const siguiente = progreso?.fichas.find((f): f is FichaDeRangoSiguiente => f.estado === "siguiente");
  const meta = siguiente?.requisitos.find((r) => r.clave === "exp");
  const desglose = [
    { clave: "aportes", etiqueta: T.desglose.aportes, valor: datos.desglose.aportes, ver: true },
    { clave: "misiones", etiqueta: T.desglose.misiones, valor: datos.desglose.misiones, ver: true },
    { clave: "bonos", etiqueta: T.desglose.bonos, valor: datos.desglose.bonos, ver: true },
    { clave: "descuentos", etiqueta: T.desglose.descuentos, valor: datos.desglose.descuentos, ver: datos.hayDescuentos },
    { clave: "ajustes", etiqueta: T.desglose.ajustes, valor: datos.desglose.ajustes, ver: datos.hayAjustes },
  ].filter((d) => d.ver);

  return (
    <div className="space-y-5">
      <section aria-labelledby="historial-titulo" className="flex flex-col gap-5 rounded-lg bg-brand-950 p-6 text-white max-md:p-4">
        <div className="flex flex-wrap items-end justify-between gap-6 max-md:gap-4">
          <div className="min-w-0 flex-[1_1_320px]">
            <h2 id="historial-titulo" className="text-[26px] font-extrabold leading-tight max-md:text-[22px]">
              {T.titulo}
            </h2>
            <p className="mt-2 text-sm text-brand-200">{T.intro}</p>
          </div>
          <div className="flex min-w-0 flex-[0_1_300px] flex-col gap-2 rounded-lg bg-brand-900 px-5 py-4 max-md:flex-auto max-md:px-4 max-md:py-3">
            <p className="flex items-baseline gap-2.5">
              <span className="font-mono text-[26px] font-extrabold leading-none">{nf.format(datos.total)}</span>
              <span className="text-[13px] text-brand-200">{T.total}</span>
            </p>
            {meta && siguiente && <p className="text-[13px] font-semibold text-success-100">{T.siguiente(siguiente.numero, meta.meta, meta.faltan)}</p>}
          </div>
        </div>
        {datos.hayMovimientos && (
          <ul aria-label={T.desgloseEtiqueta} className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 max-md:grid-cols-2 max-md:gap-2">
            {desglose.map((d) => (
              <li key={d.clave} className="flex flex-col gap-0.5 rounded-lg bg-brand-900 px-4 py-3 max-md:px-3 max-md:py-2.5">
                <span className="text-[12.5px] text-brand-200 max-md:text-xs">{d.etiqueta}</span>
                <span className={`font-mono text-xl font-extrabold max-md:text-[17px] ${d.valor < 0 ? "text-error-300" : ""}`}>{conSigno(d.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {datos.enCamino > 0 && (
        <p role="status" className="flex items-center gap-2.5 rounded-lg border border-dashed border-brand-200 bg-brand-50 px-4 py-2.5 text-[13px] text-brand-800">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M5 22h14 M5 2h14 M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22 M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
          </svg>
          <span>
            <strong>{T.enCamino(datos.enCamino)}</strong> {T.enCaminoDetalle}
          </span>
        </p>
      )}

      {datos.hayMovimientos ? (
        <div className="grid items-start gap-5 lg:grid-cols-[2fr_1fr]">
          <HistorialDeExp inicial={datos.pagina} hayDescuentos={datos.hayDescuentos} />
          {datos.reglas && (
            <>
              <aside aria-labelledby="historial-como" className="rounded-lg bg-brand-100 p-5 max-lg:hidden">
                <h2 id="historial-como" className="mb-2.5 text-lg font-extrabold text-system-900">
                  {T.comoTitulo}
                </h2>
                <ComoSeCalcula reglas={datos.reglas} hayDescuentos={datos.hayDescuentos} />
              </aside>
              <details className="rounded-lg bg-brand-100 px-4 lg:hidden">
                <summary className="flex min-h-11 cursor-pointer items-center text-base font-extrabold text-system-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                  {T.comoTitulo}
                </summary>
                <div className="pb-4">
                  <ComoSeCalcula reglas={datos.reglas} hayDescuentos={datos.hayDescuentos} />
                </div>
              </details>
            </>
          )}
        </div>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-success-50 text-success-700">
              <svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor">
                <path d="M8 1.2c.3 0 .5.2.6.5l.9 3.3c.1.4.4.7.8.8l3.3.9c.3.1.5.3.5.6s-.2.5-.5.6l-3.3.9c-.4.1-.7.4-.8.8l-.9 3.3c-.1.3-.3.5-.6.5s-.5-.2-.6-.5l-.9-3.3c-.1-.4-.4-.7-.8-.8l-3.3-.9c-.3-.1-.5-.3-.5-.6s.2-.5.5-.6l3.3-.9c.4-.1.7-.4.8-.8l.9-3.3c.1-.3.3-.5.6-.5Z" />
              </svg>
            </span>
            <h2 className="text-[15px] font-bold text-system-900">{T.vacioTitulo}</h2>
            <p className="max-w-sm text-[13.5px] text-system-600">{T.vacioTexto}</p>
            <ButtonLink href="/explorar" variant="primary">{T.vacioCta}</ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
