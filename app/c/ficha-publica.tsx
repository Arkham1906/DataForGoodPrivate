// Contenido compartido de las dos páginas públicas para aportar sin cuenta (2026-11-11):
//   - /c/[token]: el enlace o el QR que comparte el creador (cuenta visitas; el aporte guarda enlace_id);
//   - /participa/[id]: "Aportar sin cuenta" de la ficha /campanas/[id] abierta desde /explorar, sin usar
//     el enlace del creador (no cuenta visitas ni lo renueva; el aporte va sin enlace_id).
// Con sesión invita a aportar con la cuenta; sin sesión muestra el formulario anónimo (aporte-anonimo.tsx),
// UN aporte por dispositivo y campaña, o el aviso de por qué no (motivoSinFormulario).

import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import type { ReactNode } from "react";
import PublicFooter from "@/components/layout/PublicFooter";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import PublicHeader from "@/components/layout/PublicHeader";
import ButtonLink from "@/components/ui/ButtonLink";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { repartoSugerido } from "@/lib/campanas/reparto-sugerido";
import { avisoDeTodoLleno, resumenDeLimites, tiposConLugar } from "@/lib/campanas/limite-por-tipo";
import { avisoDePausa } from "@/lib/campanas/pausa";
import { COOKIE_ANONIMO, dispositivoValido, hashDeDispositivo } from "@/lib/aportes/anonimato";
import { aportesDeLaPersonaPorTipo } from "@/lib/aportes/comun";
import { resumenDeCuotaPorTipo, tiposDentroDeSuCuota, type MiosPorTipo } from "@/lib/campanas/cuota-por-tipo";
import {
  MENSAJE_BLOQUEADO,
  aportesDelDispositivo,
  avisoDeTopeAnonimoLleno,
  cuotaSinCuenta,
  bloqueoParaLaPagina,
  esperaDelDispositivo,
} from "@/lib/campanas/aportes-anonimos";
import { conDestino } from "@/lib/redireccion";
import { getSessionUser } from "@/lib/session";
import AporteAnonimo from "./[token]/aporte-anonimo";
import { cookies } from "next/headers";
import type { CampanaDelEnlace } from "@/lib/campanas/enlaces";

const numero = new Intl.NumberFormat("es-MX");
// fechaFin viene como "AAAA-MM-DD" (DATE sin hora): se formatea en UTC para no correr el día.
const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Marco de la página pública: encabezado, contenido y pie. */
export function PantallaPublica({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />
      <main id="contenido" className="mx-auto max-w-xl px-6 pb-24 pt-14 max-md:px-4 max-md:pt-8">{children}</main>
      <ActualizacionEnVivo />
      <PublicFooter />
    </div>
  );
}

/** Aviso de una campaña que existe pero no está activa. */
export function AvisoDeCampanaNoActiva({ campana, volverMasTarde }: { campana: CampanaDelEnlace; volverMasTarde: string }) {
  return (
    <Aviso
      titulo={campana.nombre}
      texto={campana.status === "pausada" ? avisoDePausa(campana.pausa, volverMasTarde) : "Esta campaña ya no está recibiendo aportes."}
      explorar
    />
  );
}

/** La invitación a aportar de una campaña activa, con o sin sesión. */
export async function ParaAportar({ campana, token, urlDeEnvio }: { campana: CampanaDelEnlace; token: string | null; urlDeEnvio: string }) {
  const usuario = await getSessionUser();
  // Sin sesión: cuántos aportes le quedan a este dispositivo (cookie anónima).
  const dispositivo = dispositivoValido((await cookies()).get(COOKIE_ANONIMO)?.value);
  const usados = usuario ? 0 : await aportesDelDispositivo(campana.id, dispositivo);
  // Y de cada tipo, para el máximo por persona de cada tipo (2026-10-31).
  const misPorTipo: MiosPorTipo =
    usuario || !dispositivo ? {} : await aportesDeLaPersonaPorTipo(campana.id, { anonimoId: hashDeDispositivo(dispositivo) });
  // Si recarga justo después de aportar, el formulario arranca con la cuenta regresiva.
  const espera = usuario ? 0 : await esperaDelDispositivo(dispositivo);
  return (
    <Invitacion
      campana={campana}
      token={token}
      urlDeEnvio={urlDeEnvio}
      conSesion={usuario !== null}
      restantes={Math.max(0, cuotaSinCuenta(campana.cuotaPorPersona) - usados)}
      misPorTipo={misPorTipo}
      espera={espera}
      sinFormulario={usuario ? null : await motivoSinFormulario(campana, dispositivo, misPorTipo)}
    />
  );
}

/** Por qué no se muestra el formulario anónimo, o null si se muestra. El servidor vuelve a comprobarlo al enviar. */
async function motivoSinFormulario(campana: CampanaDelEnlace, dispositivo: string | null, misPorTipo: MiosPorTipo): Promise<string | null> {
  if (!campana.permiteAnonimos) return "Esta campaña solo recibe aportes con cuenta.";
  const topeLleno = await avisoDeTopeAnonimoLleno(campana.id, campana.meta);
  if (topeLleno) return topeLleno;
  const lleno = avisoDeTodoLleno(campana.tiposDeArchivo, campana.limitePorTipo, campana.enviadosPorTipo);
  if (lleno) return lleno;
  const conLugar = tiposConLugar(campana.tiposDeArchivo, campana.limitePorTipo, campana.enviadosPorTipo);
  if (tiposDentroDeSuCuota(conLugar, campana.cuotaPorTipo, misPorTipo).length === 0) {
    return "Ya enviaste el máximo de cada tipo que permite esta campaña desde este dispositivo.";
  }
  return (await bloqueoParaLaPagina(campana.id, dispositivo)) ? MENSAJE_BLOQUEADO : null;
}

function Invitacion({
  campana,
  token,
  urlDeEnvio,
  conSesion,
  restantes,
  misPorTipo,
  espera,
  sinFormulario,
}: {
  campana: CampanaDelEnlace;
  /** Enlace del creador (/c/[token]) o null desde la ficha (/participa/[id]). */
  token: string | null;
  /** A dónde envía el formulario anónimo (sin BASE_PATH). */
  urlDeEnvio: string;
  conSesion: boolean;
  restantes: number;
  misPorTipo: MiosPorTipo;
  espera: number;
  sinFormulario: string | null;
}) {
  const pct = porcentajeDeMeta(campana.aportesAprobados, campana.meta);
  const lugar = textoDeUbicacion({ todoElPais: campana.todoElPais, municipio: campana.ciudad, estado: campana.estado });
  const aportar = token ? `/campanas/${campana.id}/aportar?enlace=${token}` : `/campanas/${campana.id}/aportar`;

  return (
    <>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-brand-600">{token ? "Te invitaron a participar" : "Participa sin cuenta"}</p>
      <Card>
        <div className="mb-1 flex items-start justify-between gap-2">
          <h1 className="text-xl font-extrabold text-system-900">{campana.nombre}</h1>
          <Tag tone="ok">Activa</Tag>
        </div>
        <p className="text-[12.5px] text-system-600">
          {campana.organizador}
          {lugar ? ` · ${lugar}` : ""}
        </p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-system-600">{campana.descripcion}</p>
        {campana.tematica && (
          <div className="mt-3">
            <Tag>{campana.tematica}</Tag>
          </div>
        )}
        <div className="mt-4">
          <ProgressBar pct={pct} tone="ok" />
          <p className="mt-2 font-mono text-[11px] text-system-500">
            {numero.format(campana.aportesAprobados)} de {numero.format(campana.meta)} aportes aprobados · hasta{" "}
            {numero.format(campana.cuotaPorPersona)} por persona
            {resumenDeCuotaPorTipo(campana.tiposDeArchivo, campana.cuotaPorTipo)
              ? ` (${resumenDeCuotaPorTipo(campana.tiposDeArchivo, campana.cuotaPorTipo)})`
              : repartoSugerido(campana.cuotaPorPersona, campana.tiposDeArchivo)
                ? ` (sugerido: ${repartoSugerido(campana.cuotaPorPersona, campana.tiposDeArchivo)})`
                : ""}
            {resumenDeLimites(campana.tiposDeArchivo, campana.limitePorTipo, campana.enviadosPorTipo)
              ? ` · máximo ${resumenDeLimites(campana.tiposDeArchivo, campana.limitePorTipo, campana.enviadosPorTipo)}`
              : ""}
            {campana.fechaFin ? ` · cierra el ${fecha.format(new Date(`${campana.fechaFin}T00:00:00Z`))}` : ""}
          </p>
        </div>
      </Card>

      {conSesion ? (
        <div className="mt-5">
          <ButtonLink href={aportar} variant="primary" className="w-full">
            Aportar a esta campaña
          </ButtonLink>
        </div>
      ) : (
        <>
          {sinFormulario ? (
            <>
              <p className="mt-5 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">{sinFormulario}</p>
              <div className="mt-5 flex flex-col gap-2.5">
                <p className="text-center text-[12px] text-system-500">Puedes aportar con una cuenta.</p>
                <BotonesDeCuenta entrar={conDestino("/entrar", aportar)} registro={conDestino("/registro", aportar)} />
              </div>
            </>
          ) : (
            // El formulario y la invitación a crear una cuenta van juntos: al enviar el aporte sin cuenta,
            // el formulario se cambia por la invitación sin recargar.
            <AporteAnonimo
              urlDeEnvio={urlDeEnvio}
              secciones={campana.secciones}
              tipos={tiposDentroDeSuCuota(
                tiposConLugar(campana.tiposDeArchivo, campana.limitePorTipo, campana.enviadosPorTipo),
                campana.cuotaPorTipo,
                misPorTipo,
              )}
              formatosDeDocumento={campana.formatosDeDocumento}
              restantesIniciales={restantes}
              esperaInicial={espera}
              proposito={campana.proposito}
              entrar={conDestino("/entrar", aportar)}
              registro={conDestino("/registro", aportar)}
            />
          )}
        </>
      )}
    </>
  );
}

function BotonesDeCuenta({ entrar, registro }: { entrar: string; registro: string }) {
  return (
    <div className="flex gap-2.5 max-md:flex-col">
      <ButtonLink href={entrar} className="flex-1">
        Iniciar sesión
      </ButtonLink>
      <ButtonLink href={registro} className="flex-1">
        Crear una cuenta
      </ButtonLink>
    </div>
  );
}

export function Aviso({ titulo, texto, explorar = false }: { titulo: string; texto: string; explorar?: boolean }) {
  return (
    <Card>
      <h1 className="mb-2 text-xl font-extrabold text-system-900">{titulo}</h1>
      <p className="text-[13.5px] text-system-600">{texto}</p>
      {explorar && (
        <ButtonLink href="/explorar" className="mt-4">
          Ver campañas activas
        </ButtonLink>
      )}
    </Card>
  );
}
