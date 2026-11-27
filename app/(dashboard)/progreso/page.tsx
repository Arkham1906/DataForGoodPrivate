// Pantalla /progreso, pestaña Resumen de «Mi progreso» (2026-11-23; pedido del Dr., lienzo «Resumen e Inicio compacto»
// aprobado el mismo día). Del 12 al 23 nov esta ruta redirigía a Trayectoria (hoy «Progreso»); vuelve a ser la entrada.
// Cada dato se ve completo en una sola pestaña; aquí va su versión corta con el enlace:
// rango en una fila (requisitos en Progreso) · cifras · las 2 misiones más cerca de completarse (todas en Misiones) junto
// a la racha con protectores y calendario · EXP reciente (Historial). Sin medalla ni potenciador (2026-11-23, decisión
// del responsable): la medalla sobresalía y el potenciador pasó al menú lateral.
// Server Component. Acceso: sesión de usuario. Solo lectura. Datos: obtenerResumenDeProgreso(), obtenerMisiones(),
// obtenerPantallaDeMedallas() y obtenerHistorialDeExp(), los mismos de cada pestaña. Si falla uno, su bloque lo dice
// y los demás siguen; sin el progreso no hay pantalla.

import type { Metadata } from "next";
import Card from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import { exigirUsuario } from "@/lib/session";
import { obtenerResumenDeProgreso } from "@/lib/gamificacion/progreso";
import { obtenerMisiones } from "@/lib/gamificacion/misiones";
import { obtenerPantallaDeMedallas } from "@/lib/gamificacion/medallas-pantalla";
import { obtenerHistorialDeExp } from "@/lib/gamificacion/historial-exp";
import { rutaDePantalla } from "@/lib/gamificacion/pantallas-de-progreso";
import { TEXTOS } from "@/lib/gamificacion/textos";
import Ayuda from "@/components/gamificacion/Ayuda";
import RangoCompacto from "@/components/gamificacion/RangoCompacto";
import MisionesDelResumen from "@/components/gamificacion/MisionesDelResumen";
import RachaSemanal from "@/components/gamificacion/RachaSemanal";
import CalendarioDeRacha from "@/components/gamificacion/CalendarioDeRacha";
import ExpReciente from "@/components/gamificacion/ExpReciente";

export const metadata: Metadata = { title: "Mi progreso" };

const T = TEXTOS.resumen;
const nf = new Intl.NumberFormat("es-MX");
/** Movimientos de EXP que muestra el Resumen; el resto, en el Historial. */
const MOVIMIENTOS_RECIENTES = 3;
const TARJETA = "flex min-w-0 flex-col gap-2.5 rounded-lg border border-system-200 bg-white p-5 shadow-sm";

function Aviso({ que }: { que: string }) {
  return (
    <Card>
      <p className="text-[13px] text-system-600">{T.error(que)}</p>
    </Card>
  );
}

export default async function ResumenPage() {
  const usuario = await exigirUsuario();
  const [progreso, misiones, medallas, historial] = await Promise.all([
    obtenerResumenDeProgreso(usuario.id),
    obtenerMisiones(usuario.id),
    obtenerPantallaDeMedallas(usuario.id),
    obtenerHistorialDeExp(usuario.id),
  ]);

  if (!progreso) return <Aviso que="tu progreso" />;

  const rutas = {
    progreso: rutaDePantalla("trayectoria"),
    misiones: rutaDePantalla("misiones"),
    medallas: rutaDePantalla("medallas"),
    historial: rutaDePantalla("historial"),
  };
  const enlace = (label: string, href: string | null) => (href ? [{ label, href }] : undefined);
  const conNivel = medallas ? medallas.medallas.filter((m) => m.nivel > 0).length : null;

  return (
    <div className="space-y-5">
      <RangoCompacto progreso={progreso} enlace={rutas.progreso} idDelTitulo="resumen-rango" textoDelEnlace={T.verRangos} />

      <section aria-label="Tus cifras" className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <MetricCard
          label={T.cifras.exp}
          ayuda={<Ayuda concepto="exp" />}
          value={historial ? nf.format(historial.total) : "—"}
          links={enlace(T.cifras.historial, rutas.historial)}
        />
        <MetricCard
          label={T.cifras.misiones}
          value={misiones ? nf.format(misiones.total) : "—"}
          links={enlace(T.cifras.verMisiones, rutas.misiones)}
        />
        <MetricCard
          label={T.cifras.medallas}
          ayuda={<Ayuda concepto="medallas" />}
          value={medallas && conNivel !== null ? T.cifras.deTotal(conNivel, medallas.medallas.length) : "—"}
          links={enlace(T.cifras.verMedallas, rutas.medallas)}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        {misiones ? (
          <MisionesDelResumen diarias={misiones.diarias} semanales={misiones.semanales} enlace={rutas.misiones} />
        ) : (
          <Aviso que="tus misiones" />
        )}
        <div className={TARJETA}>
          <RachaSemanal racha={progreso.racha} accion={<CalendarioDeRacha racha={progreso.racha} />} />
        </div>
      </div>

      {historial ? (
        <ExpReciente movimientos={historial.pagina.movimientos.slice(0, MOVIMIENTOS_RECIENTES)} enlace={rutas.historial} />
      ) : (
        <Aviso que="tu EXP" />
      )}
    </div>
  );
}
