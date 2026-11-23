"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { CasillasDeAcuerdos, SIN_ACUERDOS, acuerdosCompletos } from "@/components/ui/AcuerdosDeAporte";
import { guardarAcuerdosPrevios } from "@/lib/aportes/acuerdos-previos";
import { conDestino } from "@/lib/redireccion";

export default function AcuerdosAntesDeAportar({ campanaId, modo, proposito, onCerrar }: {
  campanaId: string; modo: "cuenta" | "anonimo"; proposito?: string | null; onCerrar: () => void;
}) {
  const router = useRouter();
  const [acuerdos, setAcuerdos] = useState(SIN_ACUERDOS);
  const [error, setError] = useState("");
  return <VentanaDeConfirmacion abierto titulo="Acuerdos para aportar" textoConfirmar="Aceptar y aportar" textoOcupado="Continuando…"
    confirmarDeshabilitado={!acuerdosCompletos(acuerdos)} onCancelar={onCerrar} onConfirmar={() => {
      if (!acuerdosCompletos(acuerdos)) return;
      try { guardarAcuerdosPrevios(campanaId, modo, proposito); }
      catch { setError("Permite el almacenamiento de esta pestaña para continuar."); return; }
      router.push(modo === "cuenta" ? conDestino("/entrar", `/campanas/${campanaId}/aportar`) : `/participa/${campanaId}`);
    }}>
    <p className="mb-4 text-system-600">Para aportar en esta campaña, acepta los dos acuerdos.</p>
    <CasillasDeAcuerdos acuerdos={acuerdos} onCambio={setAcuerdos} proposito={proposito} />
    {error && <p role="alert" className="mt-3 text-error-700">{error}</p>}
  </VentanaDeConfirmacion>;
}
