// Pantalla /c/[token] (pública): a donde lleva el enlace o el QR que comparte el creador.
// Server Component. Datos: buscarEnlacePorToken() de lib/campanas/enlaces.ts; cada
// apertura de un enlace vigente suma una visita (registrarVisita: una por IP cada 30 min).
// Si el enlace sirve y la campaña está activa, invita a aportar:
//   - con sesión: botón a /campanas/[id]/aportar?enlace=<token> (aporta con su cuenta);
//   - sin sesión: formulario anónimo (aporte-anonimo.tsx → POST /api/c/[token]/aportes),
//     con la cuota por dispositivo, y la opción de entrar o registrarse con ?next=.
//     Sin formulario (solo el aviso) si el creador apagó los aportes sin cuenta o si el
//     dispositivo está bloqueado (lib/aportes/sanciones-anonimas.ts).
// Es TODO lo que ve una persona anónima: la campaña compartida y su formulario.

import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import PublicFooter from "@/components/layout/PublicFooter";
import PublicHeader from "@/components/layout/PublicHeader";
import ButtonLink from "@/components/ui/ButtonLink";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import { buscarEnlacePorToken, registrarVisita, type CampanaDelEnlace } from "@/lib/campanas/enlaces";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { repartoSugerido } from "@/lib/campanas/reparto-sugerido";
import { avisoDePausa } from "@/lib/campanas/pausa";
import { COOKIE_ANONIMO, dispositivoValido } from "@/lib/aportes/anonimato";
import {
  MENSAJE_BLOQUEADO,
  aportesDelDispositivo,
  bloqueoParaLaPagina,
  esperaDelDispositivo,
} from "@/lib/campanas/aportes-anonimos";
import { ipDelCliente } from "@/lib/ip";
import { conDestino } from "@/lib/redireccion";
import { getSessionUser } from "@/lib/session";
import { cookies, headers } from "next/headers";
import AporteAnonimo from "./aporte-anonimo";

/**
 * Título y vista previa del enlace (2026-10-19): WhatsApp, Facebook, X y las demás redes muestran el
 * nombre y la descripción de la campaña al pegar el enlace (Open Graph). Solo lee: no cuenta visita.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  // El token es un acceso temporal: que no lo indexen los buscadores.
  const base: Metadata = { title: "Participa en una campaña", robots: { index: false, follow: false } };
  const { token } = await params;
  const resultado = await buscarEnlacePorToken(token.toLowerCase()).catch(() => null);
  if (!resultado || resultado.tipo !== "valido") return base;
  const titulo = `Participa en «${resultado.campana.nombre}»`;
  const descripcion =
    resultado.campana.descripcion.trim().slice(0, 200) || "Una campaña de DataForGood para reunir datos de la comunidad.";
  return {
    ...base,
    title: titulo,
    description: descripcion,
    openGraph: { title: titulo, description: descripcion, siteName: "DataForGood", type: "website", locale: "es_MX" },
    twitter: { card: "summary", title: titulo, description: descripcion },
  };
}

const numero = new Intl.NumberFormat("es-MX");
// fechaFin viene como "AAAA-MM-DD" (DATE sin hora): se formatea en UTC para no correr el día.
const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function EnlacePublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resultado = await buscarEnlacePorToken(token.toLowerCase());

  let contenido: ReactNode;
  if (resultado.tipo === "inexistente") {
    contenido = <Aviso titulo="Enlace no válido" texto="Esta dirección no corresponde a ninguna campaña. Revisa que la hayas copiado completa." />;
  } else if (resultado.tipo === "revocado") {
    contenido = (
      <Aviso
        titulo="Este enlace ya no funciona"
        texto="Quien organiza la campaña generó un enlace nuevo. Pídele la dirección actualizada o busca la campaña en Explorar."
        explorar
      />
    );
  } else if (resultado.tipo === "caducado") {
    contenido = (
      <Aviso
        titulo="Este enlace caducó"
        texto="Los enlaces para participar valen un tiempo limitado. Pide uno nuevo a quien organiza la campaña o búscala en Explorar."
        explorar
      />
    );
  } else if (resultado.campana.status !== "activa") {
    contenido = (
      <Aviso
        titulo={resultado.campana.nombre}
        texto={
          resultado.campana.status === "pausada"
            ? avisoDePausa(resultado.campana.pausa, "Vuelve a abrir este enlace más tarde.")
            : "Esta campaña ya no está recibiendo aportes."
        }
        explorar
      />
    );
  } else {
    await registrarVisita(resultado.enlace.id, ipDelCliente(await headers()));
    const usuario = await getSessionUser();
    // Sin sesión: cuántos aportes le quedan a este dispositivo (cookie anónima).
    const dispositivo = dispositivoValido((await cookies()).get(COOKIE_ANONIMO)?.value);
    const usados = usuario ? 0 : await aportesDelDispositivo(resultado.campana.id, dispositivo);
    // Si recarga justo después de aportar, el formulario arranca con la cuenta regresiva.
    const espera = usuario ? 0 : await esperaDelDispositivo(dispositivo);
    contenido = (
      <Invitacion
        campana={resultado.campana}
        token={resultado.enlace.token}
        conSesion={usuario !== null}
        restantes={Math.max(0, resultado.campana.cuotaPorPersona - usados)}
        espera={espera}
        sinFormulario={usuario ? null : await motivoSinFormulario(resultado.campana, dispositivo)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />
      <main id="contenido" className="mx-auto max-w-xl px-6 pb-24 pt-14 max-md:px-4 max-md:pt-8">{contenido}</main>
      <PublicFooter />
    </div>
  );
}

/** Por qué no se muestra el formulario anónimo, o null si se muestra. El servidor vuelve a comprobarlo al enviar. */
async function motivoSinFormulario(campana: CampanaDelEnlace, dispositivo: string | null): Promise<string | null> {
  if (!campana.permiteAnonimos) return "Esta campaña solo recibe aportes con cuenta.";
  return (await bloqueoParaLaPagina(campana.id, dispositivo)) ? MENSAJE_BLOQUEADO : null;
}

function Invitacion({
  campana,
  token,
  conSesion,
  restantes,
  espera,
  sinFormulario,
}: {
  campana: CampanaDelEnlace;
  token: string;
  conSesion: boolean;
  restantes: number;
  espera: number;
  sinFormulario: string | null;
}) {
  const pct = porcentajeDeMeta(campana.aportesAprobados, campana.meta);
  const lugar = textoDeUbicacion({ todoElPais: campana.todoElPais, municipio: campana.ciudad, estado: campana.estado });
  const aportar = `/campanas/${campana.id}/aportar?enlace=${token}`;

  return (
    <>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-brand-600">Te invitaron a participar</p>
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
            {repartoSugerido(campana.cuotaPorPersona, campana.tiposDeArchivo) ? ` (sugerido: ${repartoSugerido(campana.cuotaPorPersona, campana.tiposDeArchivo)})` : ""}
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
            <p className="mt-5 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">{sinFormulario}</p>
          ) : (
            <Card className="mt-5">
              <h2 className="mb-1 text-[15px] font-bold text-system-900">Aporta sin crear una cuenta</h2>
              <p className="mb-4 text-[12.5px] text-system-600">
                No pedimos tu nombre ni tu correo: el aporte se registra como anónimo. Las fotos y los documentos se
                guardan sin sus metadatos (ubicación, fecha, modelo del teléfono, autor).
              </p>
              <AporteAnonimo
                token={token}
                secciones={campana.secciones}
                tipos={campana.tiposDeArchivo}
                cuota={campana.cuotaPorPersona}
                restantesIniciales={restantes}
                esperaInicial={espera}
                proposito={campana.proposito}
              />
            </Card>
          )}
          <div className="mt-5 flex flex-col gap-2.5">
            <p className="text-center text-[12px] text-system-500">
              {sinFormulario ? "Puedes aportar con una cuenta." : "¿Prefieres que tus aportes queden en tu historial?"}
            </p>
            <div className="flex gap-2.5 max-md:flex-col">
              <ButtonLink href={conDestino("/entrar", aportar)} className="flex-1">
                Iniciar sesión
              </ButtonLink>
              <ButtonLink href={conDestino("/registro", aportar)} className="flex-1">
                Crear una cuenta
              </ButtonLink>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Aviso({ titulo, texto, explorar = false }: { titulo: string; texto: string; explorar?: boolean }) {
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
