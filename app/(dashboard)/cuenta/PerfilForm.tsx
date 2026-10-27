"use client";

// Perfil de /cuenta: tarjeta superior con "Cerrar sesión", datos personales e intereses.
// Desde el 2026-10-20 (a pedido del usuario) los campos se editan directamente, sin "Editar
// perfil": al cambiar algo aparecen "Descartar cambios" y "Guardar cambios", que guarda con
// PATCH /api/usuarios/[id] (solo la propia cuenta) y avisa con un mensaje al centro de la pantalla.
// El correo no se puede cambiar.
// Intereses: texto libre del que salen las temáticas (ui/InteresesDesdeTexto).
// La foto o ícono se cambia con el lápiz sobre el avatar (EditarAvatar, en page.tsx).
// Catálogos: lib/mexico-geo.ts, lib/perfil-opciones.ts; temáticas en GET /api/tematicas; especialidades
// en GET /api/especialidades (ui/CampoDeEspecialidad, 2026-10-26: se elige o se escribe; una nueva se ofrece a todos).

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import InteresesDesdeTexto from "@/components/ui/InteresesDesdeTexto";
import LogoutButton from "@/components/auth/LogoutButton";
import CampoDeEspecialidad from "@/components/ui/CampoDeEspecialidad";
import CampoDeOrganizacion from "@/components/ui/CampoDeOrganizacion";
import { opcionesCon } from "@/lib/perfil-opciones";
import { municipiosDe, NOMBRES_DE_ESTADOS } from "@/lib/mexico-geo";
import { BASE_PATH } from "@/lib/base-path";

type Usuario = {
  id: number;
  nombre: string;
  apellidos: string;
  state: string | null;
  city: string | null;
  specialty: string | null;
  organizacion: string | null;
  intereses: string[];
  interesesTexto: string | null;
  email: string;
};

// Tiempo que se queda en pantalla el aviso de "Cambios guardados".
const DURACION_DEL_AVISO_MS = 2500;

// Un select deshabilitado (municipio sin estado) se ve tenue.
const CLASE_SELECT =
  "w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600 disabled:cursor-default disabled:opacity-50";
// El correo, que no se edita: fondo hundido y sin cursor de texto.
const CLASE_BLOQUEADO = "disabled:cursor-default disabled:bg-system-100";

export default function PerfilForm({
  usuario,
  encabezado,
  children,
}: {
  usuario: Usuario;
  /** Avatar (con el lápiz para cambiarlo), nombre y rol: la parte izquierda de la tarjeta superior. */
  encabezado: ReactNode;
  /** Tarjeta de seguridad, que va junto a los datos personales. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(usuario.nombre);
  const [apellidos, setApellidos] = useState(usuario.apellidos);
  const [state, setState] = useState(usuario.state ?? "");
  const [city, setCity] = useState(usuario.city ?? "");
  const [specialty, setSpecialty] = useState(usuario.specialty ?? "");
  const [organizacion, setOrganizacion] = useState(usuario.organizacion ?? "");
  const [intereses, setIntereses] = useState<string[]>(usuario.intereses);
  const [interesesTexto, setInteresesTexto] = useState(usuario.interesesTexto ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [avisoVisible, setAvisoVisible] = useState(false);

  // Los valores guardados: a ellos vuelve "Descartar cambios".
  const [guardado, setGuardado] = useState({
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    state: usuario.state ?? "",
    city: usuario.city ?? "",
    specialty: usuario.specialty ?? "",
    organizacion: usuario.organizacion ?? "",
    intereses: usuario.intereses,
    interesesTexto: usuario.interesesTexto ?? "",
  });

  // Hay algo distinto de lo guardado: se muestran los botones de guardar y descartar.
  const hayCambios =
    nombre !== guardado.nombre ||
    apellidos !== guardado.apellidos ||
    state !== guardado.state ||
    city !== guardado.city ||
    specialty !== guardado.specialty ||
    organizacion !== guardado.organizacion ||
    interesesTexto !== guardado.interesesTexto ||
    intereses.length !== guardado.intereses.length ||
    intereses.some((tema, i) => tema !== guardado.intereses[i]);

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

  function cancelar() {
    setNombre(guardado.nombre);
    setApellidos(guardado.apellidos);
    setState(guardado.state);
    setCity(guardado.city);
    setSpecialty(guardado.specialty);
    setOrganizacion(guardado.organizacion);
    setIntereses(guardado.intereses);
    setInteresesTexto(guardado.interesesTexto);
    setError("");
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
        organizacion: organizacion.trim(),
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
      // El servidor devuelve los intereses con el nombre del catálogo (p. ej. con otra mayúscula
      // o acento): se muestran esos.
      const guardados = Array.isArray(body.data?.intereses) ? (body.data.intereses as string[]) : intereses;
      // Igual con la especialidad: "biologia" se guarda como "Biología" del catálogo (2026-10-26).
      const especialidad = typeof body.data?.specialty === "string" ? body.data.specialty : body.data ? "" : cambios.specialty;
      const organizacionGuardada =
        typeof body.data?.organizacion === "string" ? body.data.organizacion : body.data ? "" : cambios.organizacion;

      setNombre(cambios.nombre);
      setApellidos(cambios.apellidos);
      setSpecialty(especialidad);
      setOrganizacion(organizacionGuardada);
      setIntereses(guardados);
      setInteresesTexto(cambios.interesesTexto);
      setGuardado({ ...cambios, specialty: especialidad, organizacion: organizacionGuardada, intereses: guardados });
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

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" required>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field label="Apellidos" required>
                <Input
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  maxLength={120}
                />
              </Field>
            </div>

            <Field label="Correo electrónico" hint="El correo no se puede cambiar.">
              <Input disabled value={usuario.email} className={CLASE_BLOQUEADO} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estado">
                <select
                  value={state}
                  onChange={(e) => cambiarEstado(e.target.value)}
                  className={CLASE_SELECT}
                >
                  <option value="">Selecciona un estado</option>
                  {opcionesCon(state, NOMBRES_DE_ESTADOS).map((opcion) => (
                    <option key={opcion}>{opcion}</option>
                  ))}
                </select>
              </Field>
              <Field label="Municipio">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!state}
                  className={CLASE_SELECT}
                >
                  <option value="">
                    {state ? "Selecciona un municipio" : "Primero selecciona un estado"}
                  </option>
                  {opcionesCon(city, municipiosDe(state)).map((opcion) => (
                    <option key={opcion}>{opcion}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="¿En qué área eres experto?" hint="Elige una de la lista o escribe la tuya.">
              <CampoDeEspecialidad value={specialty} onChange={setSpecialty} />
            </Field>

            <Field
              label="¿Perteneces a alguna organización?"
              hint="Opcional. Elige una de la lista o escribe la tuya. Se propone como organizadora al crear una campaña."
            >
              <CampoDeOrganizacion value={organizacion} onChange={setOrganizacion} />
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

          <InteresesDesdeTexto
            texto={interesesTexto}
            onTexto={setInteresesTexto}
            seleccionados={intereses}
            onCambiar={setIntereses}
          />
          <p className="mt-3 text-[12.5px] text-system-600">
            Determinan qué campañas aparecen en “Sugeridas para ti”. Los cambios se aplican al dar “Guardar cambios”.
          </p>
        </section>

        {(hayCambios || error) && (
          <div className="flex flex-wrap items-center justify-end gap-3 md:col-span-2">
            {error && (
              <p role="alert" className="text-[12.5px] text-error-700">
                {error}
              </p>
            )}
            <Button variant="secondary" size="sm" onClick={cancelar} disabled={guardando || !hayCambios}>
              Descartar cambios
            </Button>
            <Button variant="primary" size="sm" onClick={guardar} disabled={guardando || !hayCambios}>
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
