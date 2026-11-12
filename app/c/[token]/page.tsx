// Pantalla /c/[token] (pública): a donde lleva el enlace o el QR que comparte el creador.
// Server Component. Datos: buscarEnlacePorToken() de lib/campanas/enlaces.ts; cada
// apertura de un enlace vigente suma una visita (registrarVisita: una por IP cada 30 min).
// Si el enlace sirve y la campaña está activa, invita a aportar:
//   - con sesión: botón a /campanas/[id]/aportar?enlace=<token> (aporta con su cuenta);
//   - sin sesión: formulario anónimo (aporte-anonimo.tsx → POST /api/c/[token]/aportes),
//     UN aporte por dispositivo y campaña (2026-11-09), y la opción de entrar o registrarse con
//     ?next=. Ya enviado ese aporte, el formulario se cambia por la invitación a crear una cuenta.
//     Sin formulario (solo el aviso) si el creador apagó los aportes sin cuenta o si el
//     dispositivo está bloqueado (lib/aportes/sanciones-anonimas.ts).
// Es TODO lo que ve una persona anónima: la campaña compartida y su formulario.
// El contenido (invitación, formulario y avisos) es el mismo que en /participa/[id]: ../ficha-publica.tsx.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { buscarEnlacePorToken, registrarVisita } from "@/lib/campanas/enlaces";
import { ipDelCliente } from "@/lib/ip";
import { Aviso, AvisoDeCampanaNoActiva, PantallaPublica, ParaAportar } from "../ficha-publica";


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
    contenido = <AvisoDeCampanaNoActiva campana={resultado.campana} volverMasTarde="Vuelve a abrir este enlace más tarde." />;
  } else {
    await registrarVisita(resultado.enlace.id, ipDelCliente(await headers()));
    contenido = (
      <ParaAportar
        campana={resultado.campana}
        token={resultado.enlace.token}
        urlDeEnvio={`/api/c/${encodeURIComponent(resultado.enlace.token)}/aportes`}
      />
    );
  }

  return <PantallaPublica>{contenido}</PantallaPublica>;
}
