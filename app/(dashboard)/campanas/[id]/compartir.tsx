"use client";

// Botón "Compartir" de /campanas/[id] y su cuadro (<dialog> nativo) con el enlace
// público (/c/[token]), "Compartir en redes" (redes-sociales.tsx: WhatsApp, Facebook, X...)
// y el código QR de la campaña. Cualquiera con sesión puede copiar el enlace, compartirlo y
// descargar el QR; solo el creador lo regenera y ve sus visitas y aportes. El enlace se genera
// solo cuando la campaña queda activa. /mis-campanas lo abre en modo controlado (abierto/onCerrar).
// Datos: GET /api/campanas/[id]/enlace al abrir. QR: GET /api/campanas/[id]/qr.
// Regenerar: regenerar.tsx (POST /api/campanas/[id]/enlace). Aportes sin cuenta:
// permitir-anonimos.tsx (PATCH /api/campanas/[id]/enlace), solo el creador.

import { useCallback, useEffect, useRef, useState } from "react";
import Button, { buttonClasses } from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { BASE_PATH } from "@/lib/base-path";
import EnlacePublico from "./enlace-publico";
import BotonRegenerar from "./regenerar";
import PermitirAnonimos from "./permitir-anonimos";
import RedesSociales from "./redes-sociales";

type Enlace = {
  url: string;
  token: string;
  creadoEn: string;
  expiraEn: string;
  vigente: boolean;
  visitas?: number;
  aportesRecibidos?: number;
};

type Datos = { enlace: Enlace | null; status: string; esCreador: boolean; permiteAnonimos: boolean };

const numero = new Intl.NumberFormat("es-MX");
const fechaConHora = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Mazatlan",
});

/** GET /api/campanas/[id]/enlace, ya convertido a Datos. Lanza con el mensaje del servidor. */
async function pedirEnlace(campanaId: string): Promise<Datos> {
  const response = await fetch(`${BASE_PATH}/api/campanas/${campanaId}/enlace`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar el enlace");
  return {
    enlace: payload.data ?? null,
    status: payload.campana?.status ?? "",
    esCreador: Boolean(payload.viewer?.esCreador),
    permiteAnonimos: payload.campana?.permiteAnonimos !== false,
  };
}

export default function CompartirCampana({
  campanaId,
  nombre,
  tematica,
  abierto,
  onCerrar,
}: {
  campanaId: string;
  nombre: string;
  /** Para el mensaje que se propone al compartir en redes. */
  tematica?: string | null;
  /**
   * Modo controlado (p. ej. "Compartir" del menú Más de /mis-campanas): sin botón propio, el cuadro se
   * abre cuando `abierto` pasa a true y avisa con onCerrar al cerrarse.
   */
  abierto?: boolean;
  onCerrar?: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controlado = abierto !== undefined;

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await pedirEnlace(campanaId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el enlace");
    }
  }, [campanaId]);

  function abrir() {
    setDatos(null);
    dialogo.current?.showModal();
    void cargar();
  }

  function cerrar() {
    dialogo.current?.close();
  }

  // Modo controlado: quien lo usa lo monta de nuevo cada vez (sin datos previos), así que solo
  // hay que mostrar el cuadro y pedir el enlace.
  useEffect(() => {
    if (!abierto) return;
    if (!dialogo.current?.open) dialogo.current?.showModal();
    let vigente = true;
    pedirEnlace(campanaId)
      .then((d) => vigente && setDatos(d))
      .catch((cause) => vigente && setError(cause instanceof Error ? cause.message : "No se pudo cargar el enlace"));
    return () => {
      vigente = false;
    };
  }, [abierto, campanaId]);

  const enlace = datos?.enlace ?? null;
  const caducado = enlace !== null && !enlace.vigente;

  return (
    <>
      {!controlado && (
        <Button variant="secondary" size="sm" onClick={abrir}>
          Compartir
        </Button>
      )}

      <dialog
        ref={dialogo}
        aria-labelledby="compartir-titulo"
        // Con Esc, la ×, el fondo o al cambiar de pantalla: quien lo abrió se entera.
        onClose={() => onCerrar?.()}
        // Clic en el fondo (fuera de la caja): se cierra.
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
      >
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-system-200 p-5 max-md:p-4">
            <div className="min-w-0">
              <h2 id="compartir-titulo" className="text-lg font-extrabold text-system-900">
                Compartir campaña
              </h2>
              <p className="mt-0.5 truncate text-[12.5px] text-system-600">{nombre}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {caducado && <Tag tone="danger">Enlace caducado</Tag>}
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                className="rounded-pill px-2 py-1 text-lg leading-none text-system-600 hover:bg-system-100 hover:text-system-900"
              >
                ×
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-5 max-md:p-4">
            {error ? (
              <p className="rounded-lg bg-error-50 p-3.5 text-[12.5px] text-error-700">{error}</p>
            ) : !datos ? (
              <p className="text-[13px] text-system-600">Cargando enlace…</p>
            ) : datos.status !== "activa" ? (
              <div className="max-w-md">
                <p className="mb-4 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">
                  Esta campaña no está recibiendo aportes, así que no tiene un enlace para compartir.
                </p>
                {datos.esCreador && enlace && <Actividad enlace={enlace} titulo="Actividad del último enlace" />}
              </div>
            ) : !enlace ? (
              datos.esCreador ? (
                <div className="max-w-md">
                  <p className="mb-4 rounded-lg border-l-4 border-brand-600 bg-system-100 p-3.5 text-[12.5px] text-system-600">
                    Esta campaña todavía no tiene enlace público. Genéralo para invitar a participar.
                  </p>
                  <BotonRegenerar campanaId={campanaId} modo="crear" onListo={cargar} />
                </div>
              ) : (
                <p className="max-w-md rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">
                  Quien organiza esta campaña todavía no genera su enlace público.
                </p>
              )
            ) : (
              <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
                <div>
                  <EnlacePublico url={enlace.url} expiraEnIso={enlace.expiraEn} onVencer={cargar} />

                  {!caducado && <RedesSociales url={enlace.url} nombre={nombre} tematica={tematica} />}

                  {!caducado ? (
                    <p className="mb-4 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">
                      {datos.permiteAnonimos
                        ? "Quien abra el enlace ve la campaña y puede aportar sin cuenta o con la suya, mientras el token siga vigente."
                        : "Quien abra el enlace ve la campaña y puede aportar al iniciar sesión o crear una cuenta, mientras el token siga vigente."}
                    </p>
                  ) : datos.esCreador ? (
                    <p className="mb-4 rounded-lg bg-warning-50 p-3.5 text-[12.5px] text-warning-800">
                      Los aportes ya recibidos por este enlace se conservan. Al regenerar el token se crea una dirección
                      nueva y la anterior queda inutilizable de forma permanente.
                    </p>
                  ) : (
                    <p className="mb-4 rounded-lg bg-warning-50 p-3.5 text-[12.5px] text-warning-800">
                      Este enlace caducó. Pide a quien organiza la campaña que genere uno nuevo.
                    </p>
                  )}

                  {datos.esCreador && (
                    <>
                      <PermitirAnonimos
                        campanaId={campanaId}
                        inicial={datos.permiteAnonimos}
                        onCambio={(permitir) => setDatos((actual) => (actual ? { ...actual, permiteAnonimos: permitir } : actual))}
                      />
                      <BotonRegenerar campanaId={campanaId} modo={caducado ? "vencido" : "regenerar"} onListo={cargar} />
                    </>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-system-900">Código QR</p>
                  {!caducado ? (
                    <>
                      <div className="mb-3 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-system-300 bg-system-100 p-5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- SVG servido por la API con sesión; next/image no aporta aquí */}
                        <img
                          src={`${BASE_PATH}/api/campanas/${campanaId}/qr?formato=svg&t=${enlace.token}`}
                          alt={`Código QR del enlace ${enlace.url}`}
                          width={148}
                          height={148}
                          className="h-37 w-37 rounded-md"
                        />
                        <span className="font-mono text-[11.5px] text-system-500">{enlace.token} · 512 × 512 px</span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          className={buttonClasses("secondary", "sm", "flex-1 whitespace-nowrap")}
                          href={`${BASE_PATH}/api/campanas/${campanaId}/qr?formato=png`}
                          download={`qr-${enlace.token}.png`}
                        >
                          Descargar PNG
                        </a>
                        <a
                          className={buttonClasses("secondary", "sm", "flex-1 whitespace-nowrap")}
                          href={`${BASE_PATH}/api/campanas/${campanaId}/qr?formato=svg`}
                          download={`qr-${enlace.token}.svg`}
                        >
                          Descargar SVG
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-3 flex min-h-42 items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 opacity-40">
                        <span className="font-mono text-[12.5px] text-system-500">QR inactivo</span>
                      </div>
                      {datos.esCreador && <Actividad enlace={enlace} titulo="Actividad del enlace caducado" />}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Lo que logró un enlace. Solo para el creador: la API no manda estos datos a los demás. */
function Actividad({ enlace, titulo }: { enlace: Enlace; titulo: string }) {
  const filas: [string, string][] = [
    ["Aportes recibidos", numero.format(enlace.aportesRecibidos ?? 0)],
    ["Visitas", numero.format(enlace.visitas ?? 0)],
    ["Vigencia", `${fechaConHora.format(new Date(enlace.creadoEn))} – ${fechaConHora.format(new Date(enlace.expiraEn))}`],
  ];
  return (
    <div className="rounded-lg border border-system-200 bg-system-100 px-4 py-3">
      <p className="mb-1 text-[12.5px] font-bold text-system-900">{titulo}</p>
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="flex justify-between gap-3 border-b border-system-200 py-2 text-[13px] last:border-b-0">
          <span className="text-system-600">{etiqueta}</span>
          <span className="text-right font-mono font-medium text-system-900">{valor}</span>
        </div>
      ))}
    </div>
  );
}
