// Pantalla /inicio (2026-10-24, a pedido del usuario): la primera pantalla del usuario común al iniciar sesión.
// Server Component. Acceso: sesión de usuario (exigirUsuario). Datos: obtenerResumenDeInicio() de
// lib/usuarios/inicio.ts. Muestra el resumen de sus aportes y campañas, hasta 3 campañas activas para él (de sus
// intereses, de su estado o las más concurridas), sus últimos aportes y sus notificaciones sin leer.
// Solo lectura: cada bloque enlaza a la pantalla donde se actúa. Se actualiza solo con ActualizacionEnVivo.

import Link from "next/link";
import type { Metadata } from "next";
import ButtonLink from "@/components/ui/ButtonLink";
import Card from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import Tag from "@/components/ui/Tag";
import { exigirUsuario, marcarBienvenidaVista } from "@/lib/session";
import { ahoraEnZona, ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { fechaDeNotificacion, tonoDeNotificacion } from "@/lib/notificaciones/tipos";
import { obtenerResumenDeInicio } from "@/lib/usuarios/inicio";
import CampanasParaTi from "@/components/campanas/CampanasParaTi";

export const metadata: Metadata = { title: "Inicio" };

const nf = new Intl.NumberFormat("es-MX");
const FECHA_DE_APORTE = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONA_DE_CAMPANAS,
});

/** Etiqueta del estado de un aporte, con las mismas palabras que /mis-aportes. */
const ESTADO_DE_APORTE: Record<string, { texto: string; tono: "default" | "ok" | "warn" | "danger" }> = {
  pendiente: { texto: "En revisión", tono: "warn" },
  espera_final: { texto: "En revisión", tono: "warn" },
  aceptado: { texto: "Aceptado", tono: "ok" },
  rechazado: { texto: "Rechazado", tono: "danger" },
};

/** Como Card, pero sin relleno: las filas de la lista llevan el suyo. */
const CAJA_DE_LISTA = "overflow-hidden rounded-lg border border-system-200 bg-white shadow-sm";

function saludoDeInicio(): string {
  const hora = ahoraEnZona().hour;
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function InicioPage() {
  const usuario = await exigirUsuario();
  const mostrarBienvenida = !usuario.bienvenida_vista && (await marcarBienvenidaVista(usuario.id));
  const resumen = await obtenerResumenDeInicio(usuario);
  const { aportes, campanas } = resumen;

  return (
    <div className="space-y-8 max-md:space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">
          {mostrarBienvenida ? `¡Bienvenido a DataForGood, ${usuario.nombre}!` : `${saludoDeInicio()}, ${usuario.nombre}`}
        </h1>
        <p className="mt-1 text-[13px] text-system-600">Esto es lo que pasa con tus aportes y tus campañas.</p>
      </div>

      <section aria-labelledby="inicio-resumen">
        <h2 id="inicio-resumen" className="sr-only">
          Resumen
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Aportes enviados" value={nf.format(aportes.total)} links={[{ label: "Mis aportes", href: "/mis-aportes" }]} />
          <MetricCard label="Aceptados" value={nf.format(aportes.aceptados)} />
          <MetricCard label="En revisión" value={nf.format(aportes.enRevision)} />
          <MetricCard
            label="Campañas creadas"
            value={nf.format(campanas.total)}
            links={[{ label: "Mis campañas", href: "/mis-campanas" }]}
          />
        </div>
        {(aportes.rechazados > 0 || campanas.total > 0) && (
          <p className="mt-2.5 text-[12px] text-system-500">
            {aportes.rechazados > 0 && `${nf.format(aportes.rechazados)} ${aportes.rechazados === 1 ? "aporte rechazado" : "aportes rechazados"}`}
            {aportes.rechazados > 0 && campanas.total > 0 && " · "}
            {campanas.total > 0 &&
              `De tus campañas: ${nf.format(campanas.activas)} ${campanas.activas === 1 ? "activa" : "activas"}, ${nf.format(campanas.enRevision)} en revisión y ${nf.format(campanas.borradores)} en borrador`}
          </p>
        )}
      </section>

      <CampanasParaTi
        id="inicio-para-ti"
        campanas={resumen.paraTi}
        accion={
          <Link href="/campanas" className="text-[13px] font-semibold text-brand-600 hover:underline">
            Ver todas →
          </Link>
        }
        vacio={
          <Card>
            <p className="text-[13px] text-system-600">Por ahora no hay campañas activas para participar.</p>
            <ButtonLink href="/mis-campanas/nueva" variant="secondary" size="sm" className="mt-3">
              Crear una campaña
            </ButtonLink>
          </Card>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="inicio-aportes">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="inicio-aportes" className="text-lg font-extrabold text-system-900">
              Tus últimos aportes
            </h2>
            <Link href="/mis-aportes" className="text-[13px] font-semibold text-brand-600 hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className={CAJA_DE_LISTA}>
            {resumen.recientes.length === 0 ? (
              <p className="p-4 text-[13px] text-system-600">Todavía no envías aportes. Elige una campaña para empezar.</p>
            ) : (
              <ul className="divide-y divide-system-200">
                {resumen.recientes.map((a) => {
                  const estado = ESTADO_DE_APORTE[a.estado] ?? { texto: a.estado, tono: "default" as const };
                  return (
                    <li key={a.id}>
                      <Link href={`/mis-aportes/${a.campanaId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-system-50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-system-900">{a.campana}</span>
                          <span className="block truncate text-[12px] text-system-500">
                            {a.enviadoEn ? FECHA_DE_APORTE.format(new Date(a.enviadoEn)) : ""}
                            {a.descripcion ? ` · ${a.descripcion}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0">
                          <Tag tone={estado.tono}>{estado.texto}</Tag>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="inicio-notificaciones">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="inicio-notificaciones" className="text-lg font-extrabold text-system-900">
              Notificaciones sin leer
              {resumen.notificacionesSinLeer > 0 && (
                <span className="ml-2 align-middle font-mono text-[12px] font-bold text-system-500">
                  {nf.format(resumen.notificacionesSinLeer)}
                </span>
              )}
            </h2>
            <Link href="/notificaciones" className="text-[13px] font-semibold text-brand-600 hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className={CAJA_DE_LISTA}>
            {resumen.notificaciones.length === 0 ? (
              <p className="p-4 text-[13px] text-system-600">Estás al día: no tienes notificaciones sin leer.</p>
            ) : (
              <ul className="divide-y divide-system-200">
                {resumen.notificaciones.map((n) => {
                  const contenido = (
                    <>
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[13.5px] font-semibold text-system-900">{n.title}</span>
                        <span className="shrink-0 font-mono text-[11px] text-system-500">{fechaDeNotificacion(n.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[12px] text-system-600">{n.message}</span>
                      <span className="mt-1.5 block">
                        <Tag tone={tonoDeNotificacion(n.type)}>{n.campaignName ?? "Tu cuenta"}</Tag>
                      </span>
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link href={n.href} className="block px-4 py-3 hover:bg-system-50">
                          {contenido}
                        </Link>
                      ) : (
                        <div className="px-4 py-3">{contenido}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
