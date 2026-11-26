// Pantalla /inicio (2026-10-24, a pedido del usuario): la primera pantalla del usuario común al iniciar sesión.
// Rediseñada el 2026-11-02 según el diseño v9 «Inicio simplificado» (SRS v1.1): arriba el rango y el avance hacia el
// siguiente (ResumenDeRango), luego «Hoy» (potenciador, misiones de hoy y racha: ResumenDeHoy), y después lo que ya
// tenía: resumen de aportes y campañas, campañas para ti, últimos aportes (con sus estrellas, 2026-11-03) y notificaciones.
// El mapa de aportes pasa a Mis aportes (decisión del diseño v9).
// «Aportar a una campaña» va en el encabezado de «Tus últimos aportes», junto a «Ver todos» (2026-11-03, a pedido del
// equipo: arriba de la página quedaba muy lejos de donde se actúa).
// Server Component. Acceso: sesión de usuario (exigirUsuario). Datos: obtenerResumenDeInicio() de
// lib/usuarios/inicio.ts y obtenerResumenDeProgreso() de lib/gamificacion/progreso.ts (null si aún no hay datos de
// progreso: entonces se omiten esos dos bloques). Hasta 3 campañas activas para él, de sus temáticas de interés o de
// su ubicación. Sin temáticas de interés ni ubicación (zona por GPS o estado del perfil) "Campañas para ti" no
// lista campañas, pero el título sigue, con el aviso debajo (2026-11-04, a pedido del usuario; igual que en /campanas).
// La sección solo trae campañas de sus temáticas o de su ubicación, sin las "populares" de otras temáticas. Sin
// temáticas sale además el recuadro campanas/AvisoSinTematicas, con el mismo texto que en /campanas.
// Solo lectura: cada bloque enlaza a la pantalla donde se actúa. Se actualiza solo con ActualizacionEnVivo.
// Desde el 2026-11-12 (decisión del responsable) Inicio es la entrada a Mi progreso: «Ver tu trayectoria» del resumen
// de rango. Recibe del Resumen eliminado de /progreso el calendario de la racha (en «Hoy») y las medallas cerca de
// subir (hasta que exista la pestaña Medallas). Sin datos de progreso queda una tarjeta mínima con la entrada.

import Link from "next/link";
import type { Metadata } from "next";
import ButtonLink from "@/components/ui/ButtonLink";
import Card from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import { ListadoDeAportes, SelectorDeVistaAportes } from "@/components/aportes/ListadoDeAportes";
import { exigirUsuario, marcarBienvenidaVista } from "@/lib/session";
import { ahoraEnZona } from "@/lib/fecha-de-tepic";
import { obtenerResumenDeInicio } from "@/lib/usuarios/inicio";
import { obtenerResumenDeProgreso } from "@/lib/gamificacion/progreso";
import { obtenerMedallasCercaDeSubir } from "@/lib/gamificacion/mi-progreso";
import { zonaDetectadaDe } from "@/lib/ubicacion/zona-detectada";
import CampanasParaTi from "@/components/campanas/CampanasParaTi";
import TarjetaDeCampanaPublica from "@/components/campanas/TarjetaDeCampanaPublica";
import BotonCrearCampana from "@/components/campanas/BotonCrearCampana";
import AvisoSinTematicas from "@/components/campanas/AvisoSinTematicas";
import ResumenDeRango from "@/components/gamificacion/ResumenDeRango";
import ResumenDeHoy from "@/components/gamificacion/ResumenDeHoy";
import CalendarioDeRacha from "@/components/gamificacion/CalendarioDeRacha";
import MedallasCercaDeSubir from "@/components/gamificacion/MedallasCercaDeSubir";
import { rutaDePantalla } from "@/lib/gamificacion/pantallas-de-progreso";

export const metadata: Metadata = { title: "Inicio" };

const nf = new Intl.NumberFormat("es-MX");
function saludoDeInicio(): string {
  const hora = ahoraEnZona().hour;
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function InicioPage() {
  const usuario = await exigirUsuario();
  const mostrarBienvenida = !usuario.bienvenida_vista && (await marcarBienvenidaVista(usuario.id));
  const zona = await zonaDetectadaDe(Number(usuario.id)).catch(() => null);
  const [resumen, progreso, medallasCerca] = await Promise.all([
    obtenerResumenDeInicio(usuario, zona),
    obtenerResumenDeProgreso(usuario.id),
    obtenerMedallasCercaDeSubir(usuario.id),
  ]);
  const trayectoria = rutaDePantalla("trayectoria") ?? "/progreso";
  const conParaTi = usuario.intereses.length > 0 || Boolean(usuario.state?.trim()) || zona !== null;
  const { aportes, campanas } = resumen;
  // Va debajo del título de "Campañas para ti" (2026-11-13); sin nada "para ti", con "Ahora no" queda una línea para
  // que el título no se quede solo.
  const avisoSinTematicas = (
    <AvisoSinTematicas
      sinTematicas={usuario.intereses.length === 0}
      siCerrado={
        !conParaTi && (
          <p className="text-[13px] text-system-600">
            Agrega temáticas de interés en Mi cuenta o activa tu ubicación en Explorar campañas para ver aquí tus recomendaciones.
          </p>
        )
      }
    >
      <p>
        Aún no eliges temáticas de interés. Agrégalas para mostrarte primero las campañas que te interesan y
        avisarte cuando se abra una nueva.
      </p>
    </AvisoSinTematicas>
  );

  return (
    <div className="space-y-8 max-md:space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">
          {mostrarBienvenida ? `¡Bienvenido a DataForGood, ${usuario.nombre}!` : `${saludoDeInicio()}, ${usuario.nombre}`}
        </h1>
        <p className="mt-1 text-[13px] text-system-600">Esto es lo que pasa con tu progreso, tus aportes y tus campañas.</p>
      </div>

      {progreso ? (
        <>
          <ResumenDeRango progreso={progreso} enlaces={{ trayectoria }} idDelTitulo="inicio-rango" />
          <ResumenDeHoy progreso={progreso} accionDeRacha={<CalendarioDeRacha racha={progreso.racha} />} />
          {medallasCerca && medallasCerca.length > 0 && <MedallasCercaDeSubir medallas={medallasCerca} />}
        </>
      ) : (
        // Sin datos de progreso (cuenta recién creada o un fallo al leerlos): Mi progreso no tiene otra entrada.
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-system-900">Tu trayectoria</h2>
            <p className="text-[13px] text-system-600">Tu rango, tus misiones y tu racha están en Mi progreso.</p>
          </div>
          <ButtonLink href={trayectoria} variant="secondary" size="sm">
            Ver tu trayectoria
          </ButtonLink>
        </Card>
      )}

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
        renderTarjeta={(c) => c.tarjeta ? <TarjetaDeCampanaPublica campana={c.tarjeta} indice={resumen.paraTi.indexOf(c)} nivel="h3" compacta /> : null}
        id="inicio-para-ti"
        campanas={conParaTi ? resumen.paraTi : []}
        accion={
          <Link href="/campanas" className="text-[13px] font-semibold text-brand-600 hover:underline">
            Ver todas →
          </Link>
        }
        // El aviso de temáticas va debajo del título, como en /campanas (2026-11-13, a pedido del usuario; antes
        // iba antes de la sección, o en su lugar si no había nada para ti).
        avisos={avisoSinTematicas}
        vacio={
          !conParaTi ? null : (
            <Card>
              <p className="text-[13px] text-system-600">Por ahora no hay campañas activas de tus temáticas de interés ni de tu zona.</p>
              <BotonCrearCampana variant="secondary" size="sm" className="mt-3">
                Crear una campaña
              </BotonCrearCampana>
            </Card>
          )
        }
      />

      <div className="space-y-8 max-md:space-y-6">
        <section aria-labelledby="inicio-aportes">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="inicio-aportes" className="text-lg font-extrabold text-system-900">
              Tus últimos aportes
            </h2>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
              <ButtonLink href="/campanas" size="sm">
                Aportar a una campaña
              </ButtonLink>
              <div className="flex flex-col items-end gap-2">
                <Link href="/mis-aportes" className="text-[13px] font-semibold text-brand-600 hover:underline">
                  Ver todos →
                </Link>
                <SelectorDeVistaAportes />
              </div>
            </div>
          </div>
          {resumen.recientes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">Todavía no envías aportes. Elige una campaña para empezar.</p>
          ) : (
            <ListadoDeAportes items={resumen.recientes.map((a) => ({
              id: a.id, campaignId: a.campanaId, campaignName: a.campana,
              campaignTematica: a.tematica, fileType: a.tipo, fileMimeType: a.mimeType,
              sinArchivo: a.sinArchivo, status: a.estado, calificacion: a.calificacion ?? undefined,
              expOtorgada: a.expOtorgada, submittedAt: a.enviadoEn,
            }))} />
          )}
        </section>
      </div>
    </div>
  );
}
