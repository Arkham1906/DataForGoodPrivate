"use client";

// Celebraciones de la app (2026-11-16; lienzo aprobado el mismo día; RF-GAM-84). Documento:
// claude/pantallas-v12/celebracion-propuesta.md. Va una sola vez en ShellDeUsuario.
//
// Arma una cola de pasos y los muestra uno a uno en un <dialog> nativo:
//   racha (si el envío la hizo crecer) → rango (uno solo, aunque hayan sido varios) → medallas (todas juntas).
// De dónde salen:
//   - Al cargar la app y con cada aviso en vivo (EVENTO_NOTIFICACIONES): GET /api/progreso/celebraciones, las
//     pendientes de rango y medalla. Así salen en vivo cuando aceptan el aporte que hizo subir, o al volver.
//   - La pantalla de aportar avisa con EVENTO_CELEBRAR_RACHA el cambio de racha que devolvió POST /api/aportes; la
//     racha va primero y después se piden las pendientes (Llama Constante puede subir con el mismo envío).
// «Siguiente» marca vistas las del paso y pasa al otro; «Cerrar», un enlace o Esc marcan vistas todas las de la cola.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BASE_PATH } from "@/lib/base-path";
import { EVENTO_NOTIFICACIONES } from "@/lib/notificaciones/tipos";
import { TEXTOS } from "@/lib/gamificacion/textos";
import {
  EVENTO_CELEBRAR_RACHA,
  type CambioDeRacha,
  type CelebracionDeMedalla,
  type CelebracionDeRango as DatosDeRango,
  type CelebracionesPendientes,
} from "@/lib/gamificacion/celebraciones-tipos";
import CelebracionDeRacha from "./CelebracionDeRacha";
import CelebracionDeRango from "./CelebracionDeRango";
import CelebracionDeMedallas from "./CelebracionDeMedallas";

const T = TEXTOS.celebraciones;

type Paso =
  | { clave: string; tipo: "racha"; racha: CambioDeRacha }
  | { clave: string; tipo: "rango"; rango: DatosDeRango }
  | { clave: string; tipo: "medallas"; medallas: CelebracionDeMedalla[] };

const RUTA = `${BASE_PATH}/api/progreso/celebraciones`;

function marcarVistas(pasos: Paso[]) {
  const rangos = pasos.flatMap((p) => (p.tipo === "rango" ? p.rango.ids : []));
  const medallas = pasos.flatMap((p) => (p.tipo === "medallas" ? p.medallas.flatMap((m) => m.ids) : []));
  if (rangos.length === 0 && medallas.length === 0) return;
  // keepalive: el enlace «Ver tu trayectoria» navega en seguida.
  void fetch(RUTA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rangos, medallas }), keepalive: true }).catch(() => {});
}

function textoDeSiguiente(paso: Paso | undefined): string | null {
  if (!paso) return null;
  if (paso.tipo === "racha") return T.siguiente.racha;
  return paso.tipo === "rango" ? T.siguiente.rango : T.siguiente.medallas(paso.medallas.length, paso.medallas[0]?.nombre ?? "");
}

const MARCO = "celebracion m-0 max-h-none max-w-none border-0 p-0 overflow-y-auto";
const CLASE_DE_VENTANA: Record<Paso["tipo"], string> = {
  rango: `${MARCO} fixed inset-0 h-dvh w-full bg-brand-950 text-white`,
  racha: `${MARCO} fixed inset-0 h-dvh w-full bg-[var(--fuego-50)] text-system-900`,
  // Teléfono: hoja pegada abajo. Desde sm: ventana centrada.
  medallas: `${MARCO} mt-auto w-full max-h-[92dvh] rounded-t-3xl bg-white text-system-900 shadow-2xl backdrop:bg-system-900/55 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-[520px] sm:rounded-2xl`,
};

/** El <dialog> de un paso: se abre como modal antes de pintarse (sin parpadeo entre pasos) y enfoca su botón principal. */
function Ventana({ tipo, alEscapar, children }: { tipo: Paso["tipo"]; alEscapar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const ventana = ref.current;
    if (!ventana) return;
    if (!ventana.open) ventana.showModal();
    ventana.querySelector<HTMLElement>("[data-foco]")?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="celebracion-titulo"
      aria-describedby={tipo === "racha" ? "celebracion-texto" : undefined}
      className={CLASE_DE_VENTANA[tipo]}
      onCancel={(e) => {
        e.preventDefault();
        alEscapar();
      }}
    >
      {children}
    </dialog>
  );
}

export default function Celebraciones() {
  const [cola, setCola] = useState<Paso[]>([]);
  const [hechos, setHechos] = useState(0);
  // Ids ya puestos en la cola: un aviso en vivo no repite lo que ya se está mostrando.
  const enCola = useRef(new Set<string>());
  const origen = useRef<HTMLElement | null>(null);
  const colaRef = useRef<Paso[]>([]);
  useLayoutEffect(() => {
    colaRef.current = cola;
  }, [cola]);

  const agregar = useCallback((nuevos: Paso[], alFrente = false) => {
    if (nuevos.length === 0) return;
    if (colaRef.current.length === 0) origen.current = document.activeElement as HTMLElement | null;
    // Al frente, pero sin tapar el paso que ya se está viendo.
    setCola((c) => (alFrente && c.length > 0 ? [c[0], ...nuevos, ...c.slice(1)] : alFrente ? [...nuevos, ...c] : [...c, ...nuevos]));
  }, []);

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch(RUTA, { cache: "no-store" });
      if (!respuesta.ok) return;
      const pendientes: CelebracionesPendientes = await respuesta.json();
      const nuevos: Paso[] = [];
      const libres = (prefijo: string, ids: number[]) => ids.every((id) => !enCola.current.has(`${prefijo}${id}`));
      const reservar = (prefijo: string, ids: number[]) => ids.forEach((id) => enCola.current.add(`${prefijo}${id}`));
      const { rango } = pendientes;
      if (rango && libres("r", rango.ids)) {
        reservar("r", rango.ids);
        nuevos.push({ clave: `rango-${rango.ids.join("-")}`, tipo: "rango", rango });
      }
      const medallas = pendientes.medallas.filter((m) => libres("m", m.ids));
      if (medallas.length > 0) {
        medallas.forEach((m) => reservar("m", m.ids));
        nuevos.push({ clave: `medallas-${medallas.flatMap((m) => m.ids).join("-")}`, tipo: "medallas", medallas });
      }
      agregar(nuevos);
    } catch {
      // Sin red no hay celebración: lo pendiente sale en la siguiente carga.
    }
  }, [agregar]);

  useEffect(() => {
    // La cola cambia después de la respuesta, no durante el efecto: es la suscripción a lo pendiente del servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    const alAviso = () => void cargar();
    const alCrecerLaRacha = (evento: Event) => {
      const racha = (evento as CustomEvent<CambioDeRacha>).detail;
      if (racha) agregar([{ clave: `racha-${Date.now()}`, tipo: "racha", racha }], true);
      void cargar();
    };
    window.addEventListener(EVENTO_NOTIFICACIONES, alAviso);
    window.addEventListener(EVENTO_CELEBRAR_RACHA, alCrecerLaRacha);
    return () => {
      window.removeEventListener(EVENTO_NOTIFICACIONES, alAviso);
      window.removeEventListener(EVENTO_CELEBRAR_RACHA, alCrecerLaRacha);
    };
  }, [cargar, agregar]);

  const terminar = useCallback(() => {
    setHechos(0);
    const volver = origen.current;
    origen.current = null;
    // El foco vuelve a donde estaba, si sigue en la página (tras enviar un aporte ya no está).
    window.setTimeout(() => {
      if (volver?.isConnected) volver.focus();
    }, 0);
  }, []);

  const alSiguiente = useCallback(() => {
    const [actual, ...resto] = colaRef.current;
    if (!actual) return;
    marcarVistas([actual]);
    setCola(resto);
    if (resto.length === 0) terminar();
    else setHechos((h) => h + 1);
  }, [terminar]);

  const alCerrar = useCallback(() => {
    marcarVistas(colaRef.current);
    setCola([]);
    terminar();
  }, [terminar]);

  const actual = cola[0];
  if (!actual) return null;
  const total = hechos + cola.length;
  const paso = total > 1 ? T.paso(hechos + 1, total) : null;
  const siguiente = textoDeSiguiente(cola[1]);
  const comunes = { paso, siguiente, alSiguiente, alCerrar };

  return (
    <Ventana key={actual.clave} tipo={actual.tipo} alEscapar={alCerrar}>
      {actual.tipo === "racha" && <CelebracionDeRacha racha={actual.racha} {...comunes} />}
      {actual.tipo === "rango" && <CelebracionDeRango rango={actual.rango} {...comunes} />}
      {actual.tipo === "medallas" && <CelebracionDeMedallas medallas={actual.medallas} {...comunes} />}
    </Ventana>
  );
}
