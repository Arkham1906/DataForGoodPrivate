"use client";

// Campo "Enlace público" del cuadro Compartir (compartir.tsx): la URL con botón de
// copiar y la cuenta regresiva del token. Al caducar con el cuadro abierto avisa
// con onVencer para que el cuadro vuelva a pedir el enlace y oculte el QR.

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";

function restante(hasta: number, ahora: number): string {
  const ms = hasta - ahora;
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  if (horas > 0) return `${horas} h ${String(minutos).padStart(2, "0")} min`;
  const segundos = Math.floor((ms % 60_000) / 1000);
  return `${minutos} min ${String(segundos).padStart(2, "0")} s`;
}

function transcurrido(desde: number, ahora: number): string {
  const ms = ahora - desde;
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  return horas > 0 ? `${horas} h ${String(minutos).padStart(2, "0")} min` : `${minutos} min`;
}

export default function EnlacePublico({
  url,
  expiraEnIso,
  onVencer,
}: {
  url: string;
  expiraEnIso: string;
  onVencer: () => void;
}) {
  const expira = new Date(expiraEnIso).getTime();

  // El reloj arranca en null y se fija en el primer tick (no en el render), así
  // el primer pintado no depende de la hora del navegador.
  const [ahora, setAhora] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yaAviso = useRef(false);

  useEffect(() => {
    const marcar = () => setAhora(Date.now());
    const primero = setTimeout(marcar, 0);
    const intervalo = setInterval(marcar, 1000);
    return () => {
      clearTimeout(primero);
      clearInterval(intervalo);
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const vencido = ahora !== null && ahora >= expira;

  useEffect(() => {
    // Caducó con el cuadro abierto: que el cuadro decida qué mostrar ahora.
    if (vencido && !yaAviso.current && Date.now() - expira < 5_000) {
      yaAviso.current = true;
      onVencer();
    }
  }, [vencido, expira, onVencer]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: se selecciona para que la persona lo copie.
      const campo = document.getElementById("enlace-publico");
      if (campo instanceof HTMLInputElement) campo.select();
    }
  }

  return (
    <div className="mb-4">
      <label htmlFor="enlace-publico" className="mb-1.5 block text-[13px] font-medium text-system-900">
        Enlace público
      </label>
      <div
        className={`flex min-h-11 items-center justify-between gap-2 rounded border py-1.5 pl-3.5 pr-1.5 focus-within:border-brand-600 ${
          vencido ? "border-error-700 bg-error-50" : "border-system-300 bg-white"
        }`}
      >
        <input
          id="enlace-publico"
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          className={`min-w-0 flex-1 truncate bg-transparent font-mono text-[13px] outline-none ${
            vencido ? "text-error-700 line-through opacity-70" : "text-system-900"
          }`}
        />
        {vencido ? (
          <Tag tone="danger">Expirado</Tag>
        ) : (
          <Button size="sm" onClick={copiar}>
            {copiado ? "Copiado" : "Copiar"}
          </Button>
        )}
      </div>
      <p className={`mt-1.5 text-[11.5px] ${vencido ? "font-medium text-error-700" : "text-warning-800"}`} aria-live="polite">
        {ahora === null
          ? "Calculando la vigencia del token…"
          : vencido
            ? `Caducó hace ${transcurrido(expira, ahora)}. Quien lo abra verá un aviso de enlace no válido.`
            : `El token expira en ${restante(expira, ahora)}`}
      </p>
    </div>
  );
}
