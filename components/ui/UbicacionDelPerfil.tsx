"use client";

// Ubicación del perfil (2026-11-04, a pedido del usuario): "Usar mi ubicación" pide el permiso y llena
// estado y municipio. Los campos (`children`) solo aparecen si no se pudo o no quiso compartirla: mientras
// tanto no se ven. Tampoco se ven con la ubicación ya llenada, salvo con "Cambiar a mano", por si el
// municipio detectado no es el correcto. Si en este navegador ya dijo que no, salen desde el principio.
// En /bienvenida (paso 3) la ventana sale sola al llegar (`pedirAlEntrar`); en /cuenta solo con el botón,
// para no preguntar en cada visita. Las coordenadas no se guardan (lib/ubicacion/en-el-navegador.ts).

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import PedirUbicacion, { type ControlDeUbicacion } from "@/components/ui/PedirUbicacion";
import { hayGeolocalizacion, preferenciaDeUbicacion, type ZonaDetectada } from "@/lib/ubicacion/en-el-navegador";

const sinSuscripcion = () => () => {};
const noSePuedePedir = () => !hayGeolocalizacion() || preferenciaDeUbicacion() === "no";

export default function UbicacionDelPerfil({
  onZona,
  pedirAlEntrar = false,
  ubicacionActual = "",
  sinUbicacion,
  conUbicacion,
  children,
}: {
  onZona: (zona: ZonaDetectada) => void;
  pedirAlEntrar?: boolean;
  /** Estado y municipio que ya tiene, para mostrarlos con los campos ocultos. */
  ubicacionActual?: string;
  /** Qué sigue si no se pudo (p. ej. elegirlos a mano). */
  sinUbicacion: string;
  /** Qué sigue si se llenó (p. ej. guardar). */
  conUbicacion: string;
  /** Campos para elegir estado y municipio a mano. */
  children: ReactNode;
}) {
  const control = useRef<ControlDeUbicacion>(null);
  const yaPedida = useRef(false);
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [aMano, setAMano] = useState(false);
  // En el servidor no se sabe: false, para que la hidratación coincida.
  const sinPermiso = useSyncExternalStore(sinSuscripcion, noSePuedePedir, () => false);
  const verCampos = aMano || sinPermiso;

  useEffect(() => {
    if (!pedirAlEntrar || yaPedida.current || preferenciaDeUbicacion() === "no") return;
    yaPedida.current = true;
    control.current?.pedir();
  }, [pedirAlEntrar]);

  return (
    <>
      <div className="mb-4 rounded border border-system-200 bg-system-100 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-system-600">
            {ubicacionActual && !verCampos ? (
              <>
                Tu ubicación: <b className="text-system-900">{ubicacionActual}</b>
              </>
            ) : (
              "Podemos llenar tu estado y municipio con tu ubicación."
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {ubicacionActual && !verCampos && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setAMano(true)}>
                Cambiar a mano
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={buscando}
              onClick={() => {
                setMensaje(null);
                control.current?.pedir();
              }}
            >
              {buscando ? "Buscando tu ubicación…" : "Usar mi ubicación"}
            </Button>
          </div>
        </div>
        <p aria-live="polite" className={mensaje ? "mt-2 text-[12px] font-medium text-brand-600" : "sr-only"}>
          {mensaje}
        </p>
        <PedirUbicacion
          ref={control}
          explicacion="Con tu ubicación llenamos tu estado y municipio y en Explorar campañas te mostramos las que están cerca. Tu navegador te pedirá permiso; solo guardamos tu estado y municipio, nunca tus coordenadas."
          onZona={(zona) => {
            onZona(zona);
            setAMano(false);
            setMensaje(`Estás en ${zona.municipio ? `${zona.municipio}, ` : ""}${zona.estado}. ${conUbicacion}`);
          }}
          onSinUbicacion={(motivo) => {
            setAMano(true);
            setMensaje(`${motivo} ${sinUbicacion}`);
          }}
          onOcupado={setBuscando}
        />
      </div>
      {verCampos && children}
    </>
  );
}
