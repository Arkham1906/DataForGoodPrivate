// Pantalla /progreso/misiones, pestaña Misiones de «Mi progreso» (2026-11-04; diseño v10, SRS v1.3: RF-GAM-40 a 45, 75).
// De arriba abajo: total de misiones y lo que pide el rango siguiente, misiones diarias y semanales vigentes, historial
// y «Cómo cuentan». El título y las pestañas están en ../layout.tsx.
// Server Component. Acceso: sesión de usuario. Datos: obtenerMisiones() (lib/gamificacion/misiones.ts) y
// obtenerResumenDeProgreso(). Solo muestra: el avance se calcula al enviar, aceptar o guardar.

import type { Metadata } from "next";
import Card from "@/components/ui/Card";
import GrupoDeMisiones from "@/components/gamificacion/GrupoDeMisiones";
import HistorialDeMisiones from "@/components/gamificacion/HistorialDeMisiones";
import { exigirUsuario } from "@/lib/session";
import { obtenerMisiones } from "@/lib/gamificacion/misiones";
import { obtenerResumenDeProgreso } from "@/lib/gamificacion/progreso";
import type { FichaDeRangoSiguiente } from "@/lib/gamificacion/rangos";

export const metadata: Metadata = { title: "Misiones" };

const nf = new Intl.NumberFormat("es-MX");

const COMO_CUENTAN = [
  "Tus periodos empiezan a la hora de tu primer inicio de sesión: los diarios duran 24 horas y los semanales 7 días.",
  "Cada periodo trae misiones distintas, elegidas al azar entre las que puedes cumplir con las campañas activas.",
  "Solo cuentan aportes con cuenta, según la hora en que el servidor los recibió. Si uno se acepta después, cuenta para el periodo en que lo enviaste.",
  "Cada misión completada suma al total que piden los rangos y se cuenta una sola vez.",
  "Un aporte aceptado no se revierte: la misión que ayudó a completar queda completada.",
];

export default async function MisionesPage() {
  const usuario = await exigirUsuario();
  const [datos, progreso] = await Promise.all([obtenerMisiones(usuario.id), obtenerResumenDeProgreso(usuario.id)]);

  if (!datos) {
    return (
      <Card>
        <p className="text-[13px] text-system-600">Todavía no podemos mostrar tus misiones. Intenta de nuevo en unos minutos.</p>
      </Card>
    );
  }

  const siguiente = progreso?.fichas.find((f): f is FichaDeRangoSiguiente => f.estado === "siguiente");
  const meta = siguiente?.requisitos.find((r) => r.clave === "misiones");

  return (
    <div className="space-y-5">
      <section aria-labelledby="misiones-titulo" className="flex flex-wrap items-end justify-between gap-6 rounded-lg bg-brand-950 p-6 text-white max-md:p-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <h2 id="misiones-titulo" className="text-[26px] font-extrabold leading-tight">
            Misiones
          </h2>
          <p className="mt-2 text-sm text-brand-200">
            Objetivos diarios y semanales que premian la variedad de aportes. Cambian en cada periodo y cada una que completes
            suma a lo que piden los rangos.
          </p>
        </div>
        <div className="flex min-w-0 flex-[0_1_300px] flex-col gap-2 rounded-lg bg-brand-900 px-5 py-4">
          <p className="flex items-baseline gap-2.5">
            <span className="font-mono text-[26px] font-extrabold leading-none">{nf.format(datos.total)}</span>
            <span className="text-[13px] text-brand-200">{datos.total === 1 ? "misión completada" : "misiones completadas"} en total</span>
          </p>
          {meta && siguiente && (
            <p className="text-[13px] font-semibold text-success-100">
              {meta.cumplido
                ? `Ya cumples lo que pide el rango ${siguiente.numero}.`
                : `El rango ${siguiente.numero} pide ${nf.format(meta.meta)}: ${meta.faltan === 1 ? "te falta 1" : `te faltan ${nf.format(meta.faltan)}`}.`}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <GrupoDeMisiones id="misiones-diarias" titulo="Diarias" grupo={datos.diarias} />
        <GrupoDeMisiones id="misiones-semanales" titulo="Semanales" grupo={datos.semanales} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[2fr_1fr]">
        <HistorialDeMisiones historial={datos.historial} />
        <aside aria-labelledby="misiones-como" className="rounded-lg bg-brand-100 p-5">
          <h2 id="misiones-como" className="text-lg font-extrabold text-system-900">
            Cómo cuentan
          </h2>
          <ul className="mt-2.5 list-disc space-y-2 pl-4 text-[13px] text-brand-800">
            {COMO_CUENTAN.map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
