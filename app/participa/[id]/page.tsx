// Pantalla /participa/[id] (pública, 2026-11-11, a pedido del usuario): a donde lleva "Aportar sin cuenta"
// de la ficha /campanas/[id] abierta sin sesión desde /explorar. Es lo mismo que /c/[token] (../../c/ficha-publica.tsx)
// pero sin el enlace del creador: no cuenta visitas, no renueva el enlace y el aporte va sin enlace_id, así
// el enlace y sus cifras quedan solo para lo que el creador comparte. Envía a POST /api/campanas/[id]/aporte-sin-cuenta.
// Mismas reglas: campaña activa que permita aportes sin cuenta, UN aporte por dispositivo, tope de anónimos (el número que elige el creador o, sin él, el 10% de la meta; lib/campanas/tope-anonimos.ts).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buscarCampanaParaAportarSinCuenta } from "@/lib/campanas/enlaces";
import { Aviso, AvisoDeCampanaNoActiva, PantallaPublica, ParaAportar } from "../../c/ficha-publica";

function idDe(texto: string): number {
  return /^[1-9]\d{0,8}$/.test(texto) ? Number(texto) : 0;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const base: Metadata = { title: "Participa en una campaña" };
  const { id } = await params;
  const campana = await buscarCampanaParaAportarSinCuenta(idDe(id)).catch(() => null);
  return campana ? { ...base, title: `Participa en «${campana.nombre}»` } : base;
}

export default async function ParticipaSinCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campana = await buscarCampanaParaAportarSinCuenta(idDe(id));

  let contenido: ReactNode;
  if (!campana) {
    contenido = <Aviso titulo="Campaña no encontrada" texto="Esta campaña no existe o todavía no está abierta al público." explorar />;
  } else if (campana.status !== "activa") {
    contenido = <AvisoDeCampanaNoActiva campana={campana} volverMasTarde="Vuelve a intentarlo más tarde." />;
  } else {
    // ParaAportar pone su propio marco: con el formulario anónimo, la pantalla de aporte (2026-11-13).
    return <ParaAportar campana={campana} token={null} urlDeEnvio={`/api/campanas/${campana.id}/aporte-sin-cuenta`} />;
  }

  return <PantallaPublica>{contenido}</PantallaPublica>;
}
