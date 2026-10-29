"use client";

// Pantalla /bienvenida: perfil inicial tras verificar, en dos pasos del registro: paso 3 (estado y
// municipio) y paso 4 (especialidad, organización desde el 2026-10-26, e intereses). Se puede omitir.
// Datos: GET /api/auth/sesion. Guarda con PATCH /api/usuarios/[id] al pasar al paso 4 y al finalizar.
// Intereses: la persona escribe qué le gusta y de ahí salen sus temáticas (ui/InteresesDesdeTexto).
// Catálogos: lib/mexico-geo.ts, lib/perfil-opciones.ts; temáticas en GET /api/tematicas; especialidades
// en GET /api/especialidades (ui/CampoDeEspecialidad: se elige o se escribe; una nueva se ofrece a todos).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import InteresesDesdeTexto from "@/components/ui/InteresesDesdeTexto";
import SubtematicasDelPerfil from "@/components/ui/SubtematicasDelPerfil";
import Skeleton from "@/components/ui/Skeleton";
import CampoDeEspecialidad from "@/components/ui/CampoDeEspecialidad";
import CampoDeOrganizacion from "@/components/ui/CampoDeOrganizacion";
import { opcionesCon, validarEspecialidad, validarOrganizacion } from "@/lib/perfil-opciones";
import { municipiosDe, NOMBRES_DE_ESTADOS } from "@/lib/mexico-geo";
import { BASE_PATH } from "@/lib/base-path";
import { conDestino, destinoSeguro } from "@/lib/redireccion";
import type { EtiquetaNueva } from "@/lib/etiquetas/reglas";

type SessionUser = {
  id: number;
  nombre: string;
  apellidos: string;
  state?: string | null;
  city?: string | null;
  specialty?: string | null;
  organizacion?: string | null;
  intereses?: string[];
  intereses_texto?: string | null;
};

export default function BienvenidaPage() {
  return (
    <Suspense fallback={null}>
      <BienvenidaForm />
    </Suspense>
  );
}

function BienvenidaForm() {
  const router = useRouter();
  // Pantalla a la que volver al terminar el registro (?next=, ver lib/redireccion.ts).
  const next = useSearchParams().get("next");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  // Subtemáticas (etiquetas) de esos intereses, opcionales (2026-10-27). Empiezan vacías.
  const [etiquetas, setEtiquetas] = useState<number[]>([]);
  // Las que escribe porque no estaban (2026-10-28): se crean pendientes al terminar.
  const [etiquetasNuevas, setEtiquetasNuevas] = useState<EtiquetaNueva[]>([]);
  const [errorDeEtiquetas, setErrorDeEtiquetas] = useState<string | null>(null);
  const [textoDeIntereses, setTextoDeIntereses] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [errorDeEspecialidad, setErrorDeEspecialidad] = useState<string | null>(null);
  const [organizacion, setOrganizacion] = useState("");
  const [errorDeOrganizacion, setErrorDeOrganizacion] = useState<string | null>(null);
  // Paso 3: ubicación. Paso 4: especialidad y temáticas.
  const [paso, setPaso] = useState<3 | 4>(3);

  useEffect(() => {
    async function loadUser() {
      const response = await fetch(`${BASE_PATH}/api/auth/sesion`);
      if (!response.ok) {
        router.push(conDestino("/entrar", next));
        return;
      }

      const body = await response.json();
      const currentUser = body.data as SessionUser | undefined;
      if (!currentUser) return;

      setUser(currentUser);
      setSelected(currentUser.intereses ?? ["Medio ambiente", "Educación"]);
      setTextoDeIntereses(currentUser.intereses_texto ?? "");
      setState(currentUser.state ?? "");
      setCity(currentUser.city ?? "");
      setSpecialty(currentUser.specialty ?? "");
      setOrganizacion(currentUser.organizacion ?? "");
    }

    loadUser();
  }, [router, next]);

  function cambiarEstado(nuevoEstado: string) {
    setState(nuevoEstado);
    // El municipio pertenece al estado anterior: no tiene sentido conservarlo.
    setCity("");
  }

  /** Guarda en el perfil. Devuelve el error del servidor (400), o null si se guardó o si falló la red (no se detiene el registro). */
  async function guardar(campos: Record<string, unknown>): Promise<string | null> {
    if (!user?.id) return null;
    try {
      const respuesta = await fetch(`${BASE_PATH}/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      });
      if (respuesta.status === 400) {
        const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
        return cuerpo.error ?? "Revisa tus datos";
      }
    } catch (error) {
      console.error("No se pudo guardar el perfil del usuario", error);
    }
    return null;
  }

  // La ubicación se guarda ya al avanzar: si la persona cierra en el paso 4, no la pierde.
  async function siguiente() {
    await guardar({ state, city });
    setPaso(4);
  }

  async function finish() {
    // Especialidad y organización escritas se revisan antes con las mismas reglas que el servidor,
    // para no perder el resto del perfil por un 400.
    const validada = specialty.trim() ? validarEspecialidad(specialty) : null;
    const organizacionValidada = organizacion.trim() ? validarOrganizacion(organizacion) : null;
    if (validada && !validada.ok) setErrorDeEspecialidad(validada.error);
    if (organizacionValidada && !organizacionValidada.ok) setErrorDeOrganizacion(organizacionValidada.error);
    if ((validada && !validada.ok) || (organizacionValidada && !organizacionValidada.ok)) return;

    setErrorDeEtiquetas(null);
    const error = await guardar({
      state,
      city,
      specialty,
      organizacion,
      intereses: selected,
      interesesTexto: textoDeIntereses,
      etiquetas,
      etiquetasNuevas,
    });
    if (error) {
      if (error.startsWith("La organización")) setErrorDeOrganizacion(error);
      else if (/etiqueta|subtemática/i.test(error)) setErrorDeEtiquetas(error);
      else setErrorDeEspecialidad(error);
      return;
    }
    router.push(destinoSeguro(next));
  }

  // Mientras llega el perfil: la misma tarjeta con bloques grises, para no mostrar campos vacíos
  // que luego cambian solos.
  if (!user) {
    return (
      <div role="status" aria-live="polite" className="rounded-lg border border-system-200 bg-white p-8">
        <span className="sr-only">Cargando tu perfil…</span>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-3 w-36" />
        <Skeleton className="mb-4 mt-3 h-3.5 w-64 max-w-full" />
        <div className="mb-5 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-1 flex-1 rounded-pill" />
          ))}
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="mb-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-2 h-11 w-full" />
          </div>
        ))}
        <div className="flex justify-end gap-2.5">
          <Skeleton className="h-10 w-36 rounded-pill" />
          <Skeleton className="h-10 w-28 rounded-pill" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-system-200 bg-white p-8 lg:relative lg:left-1/2 lg:w-[min(92vw,1280px)] lg:max-w-none lg:-translate-x-1/2 lg:p-10">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-system-900 lg:text-2xl">Cuéntanos de ti</h1>
          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-brand-600">
            {paso === 3 ? "Paso 3 de 4 · Tu ubicación" : "Paso 4 de 4 · Tus intereses"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={finish}>
          Omitir
        </Button>
      </div>
      <p className="mb-4 text-[13px] text-system-600">
        {paso === 3 ? "Con esto te mostramos campañas cercanas." : "Con esto te mostramos campañas relevantes para ti."}
      </p>

      <div className="mb-5 flex gap-1.5">
        <div className="h-1 flex-1 rounded-pill bg-brand-600" />
        <div className="h-1 flex-1 rounded-pill bg-brand-600" />
        <div className="h-1 flex-1 rounded-pill bg-brand-600" />
        <div className={`h-1 flex-1 rounded-pill ${paso === 4 ? "bg-brand-600" : "bg-system-200"}`} />
      </div>

      {paso === 3 ? (
        <>
          <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
            <Field label="Estado">
              <select
                value={state}
                onChange={(e) => cambiarEstado(e.target.value)}
                className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none focus:border-brand-600"
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
                className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none focus:border-brand-600 disabled:opacity-50"
              >
                <option value="">{state ? "Selecciona un municipio" : "Primero selecciona un estado"}</option>
                {opcionesCon(city, municipiosDe(state)).map((opcion) => (
                  <option key={opcion}>{opcion}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={finish}>
              Omitir por ahora
            </Button>
            <Button variant="primary" onClick={siguiente}>
              Siguiente
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
            <div>
            <Field
              label="¿En qué te especializas?"
              hint="Elige una de la lista o escribe la tuya. Si más adelante te asignan el rol de supervisor, se usará para repartirte campañas de tu área."
            >
              <CampoDeEspecialidad
                value={specialty}
                onChange={(valor) => {
                  setSpecialty(valor);
                  setErrorDeEspecialidad(null);
                }}
                aria-invalid={errorDeEspecialidad ? true : undefined}
              />
              {errorDeEspecialidad && (
                <p role="alert" className="mt-1.5 text-[12.5px] text-error-700">
                  {errorDeEspecialidad}
                </p>
              )}
            </Field>

            <Field
              label="¿Perteneces a alguna organización? (opcional)"
              hint="Elige una de la lista o escribe la tuya. Se propondrá como organizadora cuando crees una campaña."
            >
              <CampoDeOrganizacion
                value={organizacion}
                onChange={(valor) => {
                  setOrganizacion(valor);
                  setErrorDeOrganizacion(null);
                }}
                aria-invalid={errorDeOrganizacion ? true : undefined}
              />
              {errorDeOrganizacion && (
                <p role="alert" className="mt-1.5 text-[12.5px] text-error-700">
                  {errorDeOrganizacion}
                </p>
              )}
            </Field>
            </div>

            <div className="mb-3">
              <InteresesDesdeTexto
                texto={textoDeIntereses}
                onTexto={setTextoDeIntereses}
                seleccionados={selected}
                onCambiar={setSelected}
              />
              <SubtematicasDelPerfil
                texto={textoDeIntereses}
                intereses={selected}
                seleccionadas={etiquetas}
                onCambiar={setEtiquetas}
                nuevas={etiquetasNuevas}
                onNuevas={setEtiquetasNuevas}
                error={errorDeEtiquetas}
              />
            </div>
          </div>
          <p className="mb-5 text-[11.5px] text-system-500">
            Podrás cambiar tu texto y tus temáticas en cualquier momento desde tu perfil.
          </p>

          <div className="mb-5 rounded-lg bg-system-100 p-4 text-[12.5px] text-system-600">
            Si omites este paso te asignamos etiquetas por defecto según las
            campañas más populares de tu zona.
          </div>

          <div className="flex flex-wrap justify-between gap-2.5 lg:flex-nowrap">
            <Button variant="ghost" onClick={() => setPaso(3)}>
              ← Atrás
            </Button>
            <div className="grid w-full grid-cols-2 gap-2.5 lg:w-[560px] lg:max-w-full">
              <Button
                variant="secondary"
                className="w-full whitespace-nowrap px-1.5 text-[11px] lg:px-5 lg:text-sm"
                onClick={finish}
              >
                Omitir por ahora
              </Button>
              <Button
                variant="primary"
                className="w-full whitespace-nowrap px-1.5 text-[11px] lg:px-5 lg:text-sm"
                onClick={finish}
              >
                <span className="lg:hidden">Finalizar</span>
                <span className="hidden lg:inline">Finalizar y explorar campañas</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
