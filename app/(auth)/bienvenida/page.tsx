"use client";

// Pantalla /bienvenida: perfil inicial tras verificar, en dos pasos del registro: paso 3 (estado y
// municipio) y paso 4 (especialidad e intereses). Se puede omitir.
// Datos: GET /api/auth/sesion. Guarda con PATCH /api/usuarios/[id] al pasar al paso 4 y al finalizar.
// Intereses: la persona escribe qué le gusta y de ahí salen sus temáticas (ui/InteresesDesdeTexto).
// Catálogos: lib/mexico-geo.ts, lib/perfil-opciones.ts; temáticas en GET /api/tematicas.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import InteresesDesdeTexto from "@/components/ui/InteresesDesdeTexto";
import Skeleton from "@/components/ui/Skeleton";
import { ESPECIALIDADES, OTRA_ESPECIALIDAD, opcionesCon } from "@/lib/perfil-opciones";
import { municipiosDe, NOMBRES_DE_ESTADOS } from "@/lib/mexico-geo";
import { BASE_PATH } from "@/lib/base-path";
import { conDestino, destinoSeguro } from "@/lib/redireccion";

type SessionUser = {
  id: number;
  nombre: string;
  apellidos: string;
  state?: string | null;
  city?: string | null;
  specialty?: string | null;
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
  const [textoDeIntereses, setTextoDeIntereses] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [especialidadPersonalizada, setEspecialidadPersonalizada] = useState(false);
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

      const especialidad = currentUser.specialty ?? "";
      setUser(currentUser);
      setSelected(currentUser.intereses ?? ["Medio ambiente", "Educación"]);
      setTextoDeIntereses(currentUser.intereses_texto ?? "");
      setState(currentUser.state ?? "");
      setCity(currentUser.city ?? "");
      setSpecialty(especialidad);
      setEspecialidadPersonalizada(especialidad !== "" && !ESPECIALIDADES.includes(especialidad));
    }

    loadUser();
  }, [router, next]);

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

  async function guardar(campos: Record<string, unknown>) {
    if (!user?.id) return;
    try {
      await fetch(`${BASE_PATH}/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      });
    } catch (error) {
      console.error("No se pudo guardar el perfil del usuario", error);
    }
  }

  // La ubicación se guarda ya al avanzar: si la persona cierra en el paso 4, no la pierde.
  async function siguiente() {
    await guardar({ state, city });
    setPaso(4);
  }

  async function finish() {
    await guardar({ state, city, specialty, intereses: selected, interesesTexto: textoDeIntereses });
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
    <div className="rounded-lg border border-system-200 bg-white p-8">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">Cuéntanos de ti</h1>
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
          <Field
            label="Especialidad (opcional)"
            hint="Si más adelante te asignan el rol de supervisor, se usará para repartirte campañas de tu área."
          >
            <select
              value={especialidadPersonalizada ? OTRA_ESPECIALIDAD : specialty}
              onChange={(e) => elegirEspecialidad(e.target.value)}
              className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none focus:border-brand-600"
            >
              <option value="">Selecciona una especialidad</option>
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
                className="mt-2"
              />
            )}
          </Field>

          <div className="mb-3">
            <InteresesDesdeTexto
              texto={textoDeIntereses}
              onTexto={setTextoDeIntereses}
              seleccionados={selected}
              onCambiar={setSelected}
            />
          </div>
          <p className="mb-5 text-[11.5px] text-system-500">
            Podrás cambiar tu texto y tus temáticas en cualquier momento desde tu perfil.
          </p>

          <div className="mb-5 rounded-lg bg-system-100 p-4 text-[12.5px] text-system-600">
            Si omites este paso te asignamos etiquetas por defecto según las
            campañas más populares de tu zona.
          </div>

          <div className="flex flex-wrap justify-between gap-2.5">
            <Button variant="ghost" onClick={() => setPaso(3)}>
              ← Atrás
            </Button>
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={finish}>
                Omitir por ahora
              </Button>
              <Button variant="primary" onClick={finish}>
                Finalizar y explorar campañas
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
