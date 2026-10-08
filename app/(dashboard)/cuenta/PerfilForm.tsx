"use client";

// Perfil de /cuenta: tarjeta superior con "Editar perfil" y "Cerrar sesión", datos
// personales e intereses. Los campos están deshabilitados; "Editar perfil" los habilita y
// muestra "Guardar cambios", que guarda con PATCH /api/usuarios/[id] (solo la propia
// cuenta) y avisa con un mensaje al centro de la pantalla.
// Intereses: texto libre del que salen las temáticas (ui/InteresesDesdeTexto), editable en edición.
// Catálogos: lib/mexico-geo.ts, lib/perfil-opciones.ts; temáticas en GET /api/tematicas.

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import InteresesDesdeTexto from "@/components/ui/InteresesDesdeTexto";
import Tag from "@/components/ui/Tag";
import LogoutButton from "@/components/auth/LogoutButton";
import { ESPECIALIDADES, OTRA_ESPECIALIDAD, opcionesCon } from "@/lib/perfil-opciones";
import { municipiosDe, NOMBRES_DE_ESTADOS } from "@/lib/mexico-geo";
import { BASE_PATH } from "@/lib/base-path";

type Usuario = {
  id: number;
  nombre: string;
  apellidos: string;
  state: string | null;
  city: string | null;
  specialty: string | null;
  intereses: string[];
  interesesTexto: string | null;
  email: string;
};

// Tiempo que se queda en pantalla el aviso de "Cambios guardados".
const DURACION_DEL_AVISO_MS = 2500;

const CLASE_SELECT =
  "w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600";
// Campo deshabilitado (fuera de la edición, o el correo): fondo hundido y sin cursor de texto.
const CLASE_BLOQUEADO = "disabled:cursor-default disabled:bg-system-100";

export default function PerfilForm({
  usuario,
  encabezado,
  children,
}: {
  usuario: Usuario;
  /** Avatar, nombre y rol: la parte izquierda de la tarjeta superior. */
  encabezado: ReactNode;
  /** Tarjeta de seguridad, que va junto a los datos personales. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(usuario.nombre);
  const [apellidos, setApellidos] = useState(usuario.apellidos);
  const [state, setState] = useState(usuario.state ?? "");
  const [city, setCity] = useState(usuario.city ?? "");
  const [specialty, setSpecialty] = useState(usuario.specialty ?? "");
  const [especialidadPersonalizada, setEspecialidadPersonalizada] = useState(
    () => specialty !== "" && !ESPECIALIDADES.includes(specialty),
  );
  const [intereses, setIntereses] = useState<string[]>(usuario.intereses);
  const [interesesTexto, setInteresesTexto] = useState(usuario.interesesTexto ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [avisoVisible, setAvisoVisible] = useState(false);
  // En edición, un select deshabilitado (municipio sin estado) se ve tenue; fuera de ella, solo bloqueado.
  const claseSelect = `${CLASE_SELECT} ${CLASE_BLOQUEADO} ${editando ? "disabled:opacity-50" : ""}`;

  // Los valores guardados: a ellos vuelve "Cancelar".
  const [guardado, setGuardado] = useState({
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    state: usuario.state ?? "",
    city: usuario.city ?? "",
    specialty: usuario.specialty ?? "",
    intereses: usuario.intereses,
    interesesTexto: usuario.interesesTexto ?? "",
  });

  useEffect(() => {
    if (!avisoVisible) return;
    const temporizador = setTimeout(() => setAvisoVisible(false), DURACION_DEL_AVISO_MS);
    return () => clearTimeout(temporizador);
  }, [avisoVisible]);

  function cambiarEstado(nuevoEstado: string) {
    setState(nuevoEstado);
    // El municipio pertenece al estado anterior: no tiene sentido conservarlo.
    setCity("");
  }

  function elegirEspecialidad(valor: string) {
    if (valor === OTRA_ESPECIALIDAD) {
      setEspecialidadPersonalizada(true);
      setSpecialty("");
    } else {
      setEspecialidadPersonalizada(false);
      setSpecialty(valor);
    }
  }

  function cancelar() {
    setNombre(guardado.nombre);
    setApellidos(guardado.apellidos);
    setState(guardado.state);
    setCity(guardado.city);
    setSpecialty(guardado.specialty);
    setEspecialidadPersonalizada(guardado.specialty !== "" && !ESPECIALIDADES.includes(guardado.specialty));
    setIntereses(guardado.intereses);
    setInteresesTexto(guardado.interesesTexto);
    setError("");
    setEditando(false);
  }

  async function guardar() {
    if (!nombre.trim() || !apellidos.trim()) {
      setError("El nombre y los apellidos son obligatorios.");
      return;
    }

    setGuardando(true);
    setError("");
    try {
      const cambios = {
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        state,
        city,
        specialty: specialty.trim(),
        intereses,
        interesesTexto: interesesTexto.trim(),
      };
      const response = await fetch(`${BASE_PATH}/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar el perfil");
      // El servidor devuelve los intereses con el nombre del catálogo (p. ej. una temática nueva
      // que otra persona creó con otra mayúscula): se muestran esos.
      const guardados = Array.isArray(body.data?.intereses) ? (body.data.intereses as string[]) : intereses;

      setNombre(cambios.nombre);
      setApellidos(cambios.apellidos);
      setSpecialty(cambios.specialty);
      setIntereses(guardados);
      setInteresesTexto(cambios.interesesTexto);
      setGuardado({ ...cambios, intereses: guardados });
      setEditando(false);
      setAvisoVisible(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el perfil");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <section className="rounded-lg border border-system-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {encabezado}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={editando ? cancelar : () => setEditando(true)}
              disabled={guardando}
            >
              {editando ? "Cancelar edición" : "Editar perfil"}
            </Button>
            <LogoutButton />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-system-200 bg-white p-5">
          <div className="mb-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-system-500">
              Perfil
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-system-900">Datos personales</h2>
          </div>

          {/* Los mismos campos en los dos modos; fuera de la edición quedan deshabilitados. */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" required={editando}>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={120}
                  disabled={!editando}
                  className={CLASE_BLOQUEADO}
                />
              </Field>
              <Field label="Apellidos" required={editando}>
                <Input
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  maxLength={120}
                  disabled={!editando}
                  className={CLASE_BLOQUEADO}
                />
              </Field>
            </div>

            <Field label="Correo electrónico" hint={editando ? "El correo no se puede cambiar." : undefined}>
              <Input disabled value={usuario.email} className={CLASE_BLOQUEADO} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estado">
                <select
                  value={state}
                  onChange={(e) => cambiarEstado(e.target.value)}
                  disabled={!editando}
                  className={claseSelect}
                >
                  <option value="">{editando ? "Selecciona un estado" : "Sin especificar"}</option>
                  {opcionesCon(state, NOMBRES_DE_ESTADOS).map((opcion) => (
                    <option key={opcion}>{opcion}</option>
                  ))}
                </select>
              </Field>
              <Field label="Municipio">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!editando || !state}
                  className={claseSelect}
                >
                  <option value="">
                    {!editando ? "Sin especificar" : state ? "Selecciona un municipio" : "Primero selecciona un estado"}
                  </option>
                  {opcionesCon(city, municipiosDe(state)).map((opcion) => (
                    <option key={opcion}>{opcion}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Especialidad">
              <select
                value={especialidadPersonalizada ? OTRA_ESPECIALIDAD : specialty}
                onChange={(e) => elegirEspecialidad(e.target.value)}
                disabled={!editando}
                className={claseSelect}
              >
                <option value="">{editando ? "Selecciona una especialidad" : "Sin especificar"}</option>
                {ESPECIALIDADES.map((opcion) => (
                  <option key={opcion}>{opcion}</option>
                ))}
                <option value={OTRA_ESPECIALIDAD}>Otra (especifica)</option>
              </select>
              {especialidadPersonalizada && (
                <Input
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Escribe tu especialidad"
                aria-label="Tu especialidad"
                  maxLength={150}
                  disabled={!editando}
                  className={`mt-2 ${CLASE_BLOQUEADO}`}
                />
              )}
            </Field>
          </div>
        </section>

        {children}

        <section className="rounded-lg border border-system-200 bg-white p-5 md:col-span-2">
          <div className="mb-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-system-500">
              Mis intereses
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-system-900">Temáticas que guían tus aportes</h2>
          </div>

          {editando ? (
            <InteresesDesdeTexto
              texto={interesesTexto}
              onTexto={setInteresesTexto}
              seleccionados={intereses}
              onCambiar={setIntereses}
            />
          ) : (
            <>
              {interesesTexto && (
                <p className="mb-3 whitespace-pre-line text-[13px] text-system-600">«{interesesTexto}»</p>
              )}
              {intereses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {intereses.map((tema) => (
                    <Tag key={tema}>{tema}</Tag>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-system-500">
                  Aún no tienes temáticas. Da “Editar perfil” y cuéntanos qué te gusta hacer.
                </p>
              )}
            </>
          )}
          <p className="mt-3 text-[12.5px] text-system-600">
            Determinan qué campañas aparecen en “Sugeridas para ti”.
            {editando && " Los cambios se aplican al dar “Guardar cambios”."}
          </p>
        </section>

        {editando && (
          <div className="flex flex-wrap items-center justify-end gap-3 md:col-span-2">
            {error && (
              <p role="alert" className="text-[12.5px] text-error-700">
                {error}
              </p>
            )}
            <Button variant="secondary" size="sm" onClick={cancelar} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}
      </div>

      {avisoVisible && (
        // Aviso al centro de la pantalla; se va solo o con un clic.
        <div
          role="status"
          aria-live="polite"
          onClick={() => setAvisoVisible(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-system-900/20 p-4"
        >
          <div className="flex flex-col items-center gap-3 rounded-lg border border-system-200 bg-white px-8 py-7 text-center shadow-lg">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-700">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <p className="text-base font-extrabold text-system-900">Cambios Guardados Correctamente</p>
          </div>
        </div>
      )}
    </>
  );
}
