"use client";

// "Cambiar ícono" del encabezado de /cuenta (2026-10-13): abre una ventana (<dialog> nativo, como
// PreferenciasDeComunicacion) para elegir las iniciales, un ícono predefinido (masculino, femenino,
// otro) o subir una foto propia (JPG o PNG de hasta 5 MB, con vista previa). Guarda con
// PUT /api/usuarios/[id]/avatar y refresca la página, así cambian también la barra superior y el encabezado.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import Avatar from "@/components/ui/Avatar";
import { BASE_PATH } from "@/lib/base-path";
import {
  ICONOS_PREDEFINIDOS,
  errorDeFotoDePerfil,
  inicialesDe,
  type DatosDeAvatar,
  type EleccionDeAvatar,
} from "@/lib/usuarios/avatar-opciones";

export default function EditarAvatar({ actual }: { actual: DatosDeAvatar }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const entradaDeArchivo = useRef<HTMLInputElement>(null);
  const [eleccion, setEleccion] = useState<EleccionDeAvatar>(actual.avatar ?? "iniciales");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // La vista previa es un object URL: se libera al elegir otra foto, al reabrir y al salir de la página.
  const urlActual = useRef<string | null>(null);
  function ponerVistaPrevia(url: string | null) {
    if (urlActual.current) URL.revokeObjectURL(urlActual.current);
    urlActual.current = url;
    setVistaPrevia(url);
  }
  useEffect(() => () => {
    if (urlActual.current) URL.revokeObjectURL(urlActual.current);
  }, []);

  function abrir() {
    setEleccion(actual.avatar ?? "iniciales");
    setArchivo(null);
    ponerVistaPrevia(null);
    setError(null);
    dialogo.current?.showModal();
  }

  function cerrar() {
    if (!guardando) dialogo.current?.close();
  }

  function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!elegido) return;
    const problema = errorDeFotoDePerfil(elegido);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setArchivo(elegido);
    ponerVistaPrevia(URL.createObjectURL(elegido));
    setEleccion("foto");
  }

  // "Foto propia" sin una foto nueva solo vale si ya tenía una.
  const fotoLista = eleccion !== "foto" || Boolean(archivo) || actual.avatar === "foto";
  const sinCambios = eleccion === (actual.avatar ?? "iniciales") && !archivo;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const datos = new FormData();
      datos.set("avatar", eleccion);
      if (eleccion === "foto" && archivo) datos.set("file", archivo);
      const response = await fetch(`${BASE_PATH}/api/usuarios/${actual.usuarioId}/avatar`, { method: "PUT", body: datos });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo cambiar el ícono");
      dialogo.current?.close();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el ícono");
    } finally {
      setGuardando(false);
    }
  }

  const claseOpcion = (activa: boolean) =>
    `flex flex-col items-center gap-2 rounded-lg border p-3 text-[12.5px] font-semibold transition-colors ${
      activa ? "border-brand-600 bg-brand-50 text-system-900" : "border-system-200 bg-white text-system-600 hover:border-brand-600"
    }`;

  return (
    <>
      <button type="button" onClick={abrir} className="text-[12.5px] font-semibold text-brand-600 hover:underline">
        Cambiar ícono
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby="editar-avatar-titulo"
        onCancel={(e) => {
          if (guardando) e.preventDefault();
        }}
        // Clic en el fondo (fuera de la caja): se cierra.
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="border-b border-system-200 p-5">
            <h2 id="editar-avatar-titulo" className="text-lg font-extrabold text-system-900">Ícono del perfil</h2>
            <p className="mt-1 text-[12.5px] text-system-600">Elige uno de los íconos o sube una foto tuya.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <fieldset>
              <legend className="sr-only">Ícono</legend>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                <label className={claseOpcion(eleccion === "iniciales")}>
                  <input type="radio" name="avatar" className="sr-only" checked={eleccion === "iniciales"} onChange={() => setEleccion("iniciales")} />
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-sm font-extrabold text-white">
                    {inicialesDe(actual.nombre)}
                  </span>
                  Iniciales
                </label>
                {ICONOS_PREDEFINIDOS.map((icono) => (
                  <label key={icono.valor} className={claseOpcion(eleccion === icono.valor)}>
                    <input type="radio" name="avatar" className="sr-only" checked={eleccion === icono.valor} onChange={() => setEleccion(icono.valor)} />
                    <Avatar datos={{ ...actual, avatar: icono.valor, version: null }} tamano="md" />
                    {icono.etiqueta}
                  </label>
                ))}
                <label className={claseOpcion(eleccion === "foto")}>
                  <input
                    type="radio"
                    name="avatar"
                    className="sr-only"
                    checked={eleccion === "foto"}
                    onChange={() => (actual.avatar === "foto" || archivo ? setEleccion("foto") : entradaDeArchivo.current?.click())}
                  />
                  {vistaPrevia ? (
                    // Vista previa local (object URL) de la foto que se va a subir.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vistaPrevia} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : actual.avatar === "foto" ? (
                    <Avatar datos={actual} tamano="md" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-system-300 bg-system-100 text-system-500">
                      {/* Cámara: todavía no hay foto. */}
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
                        <circle cx="12" cy="13" r="3.5" />
                      </svg>
                    </span>
                  )}
                  Foto propia
                </label>
              </div>
            </fieldset>

            <div className="mt-4 rounded-lg border border-dashed border-system-300 bg-system-100 p-4 text-center">
              <input
                ref={entradaDeArchivo}
                id="foto-de-perfil"
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                className="sr-only"
                onChange={elegirFoto}
              />
              <label htmlFor="foto-de-perfil" className="cursor-pointer text-[13px] font-semibold text-brand-600 hover:underline">
                {archivo ? "Elegir otra foto" : actual.avatar === "foto" ? "Subir una foto nueva" : "Subir una foto"}
              </label>
              <p className="mt-1 font-mono text-[11px] text-system-500">
                {archivo ? archivo.name : ".jpg .jpeg .png · máximo 5 MB"}
              </p>
              <p className="mt-1 text-[11.5px] text-system-500">Se recorta en cuadrado y se guarda sin la ubicación ni otros datos de la foto.</p>
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded border border-error-700 bg-error-50 p-2 text-[12px] text-error-700">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-system-200 p-4">
            <Button type="button" variant="ghost" size="sm" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => void guardar()} disabled={guardando || sinCambios || !fotoLista}>
              {guardando ? (
                <span className="inline-flex items-center gap-2">
                  <IndicadorDeCarga />
                  Guardando…
                </span>
              ) : "Guardar"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
