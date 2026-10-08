// Contenido de /cuenta-bloqueada: tipo de bloqueo, motivo, fecha de fin y contador de sanciones.

import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import Logo from "@/components/layout/Logo";
import { formatearFinDeSuspension, type Bloqueo, type HistorialDeSanciones } from "@/lib/sanciones";

/**
 * Lo único que ve una cuenta suspendida o baneada (página /cuenta-bloqueada,
 * a donde la manda exigirUsuario() desde cualquier pantalla de usuario).
 * Toda la API ya la rechaza: esto solo explica por qué.
 */
export default function CuentaBloqueada({
  nombre,
  bloqueo,
  historial,
}: {
  nombre: string;
  bloqueo: Bloqueo;
  historial: HistorialDeSanciones;
}) {
  const contadores = [
    { etiqueta: "Sanciones en total", valor: historial.total },
    { etiqueta: historial.baneos === 1 ? "Baneo" : "Baneos", valor: historial.baneos },
    { etiqueta: historial.suspensiones === 1 ? "Suspensión" : "Suspensiones", valor: historial.suspensiones },
    { etiqueta: historial.strikes === 1 ? "Strike" : "Strikes", valor: historial.strikes },
  ];

  return (
    <div className="min-h-screen bg-system-50">
      <header className="flex items-center justify-between border-b border-system-200 px-6 py-4">
        <Logo />
        <LogoutButton />
      </header>

      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-system-200 bg-white p-6 sm:p-8" role="alert">
          <p className="mb-2 font-mono text-[10.5px] uppercase tracking-widest text-error-700">
            {bloqueo.permanente ? "Cuenta baneada" : "Cuenta suspendida"}
          </p>
          <h1 className="text-xl font-extrabold text-system-900">
            {nombre ? `${nombre}, tu` : "Tu"} cuenta{" "}
            {bloqueo.permanente
              ? "fue baneada de DataForGood"
              : `está suspendida hasta el ${formatearFinDeSuspension(bloqueo.hasta)}`}
          </h1>

          <p className="mt-4 text-[13.5px] text-system-600">Motivo:</p>
          <blockquote className="mt-1.5 rounded-lg border-l-4 border-error-700 bg-error-50 p-3.5 text-[13.5px] leading-relaxed text-system-900">
            {bloqueo.motivo || "No se registró un motivo."}
          </blockquote>

          <p className="mt-5 text-[13.5px] text-system-600">Tu historial en DataForGood:</p>
          {/* Cuenta todas las sanciones recibidas, también las ya levantadas o vencidas. */}
          <dl className="mt-1.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {contadores.map((c) => (
              // dt antes que dd (orden correcto para lectores de pantalla); el número se ve arriba.
              <div key={c.etiqueta} className="flex flex-col-reverse rounded-lg border border-system-200 bg-system-100 p-3">
                <dt className="mt-0.5 text-[11.5px] text-system-600">{c.etiqueta}</dt>
                <dd className="font-mono text-xl font-extrabold text-system-900">{c.valor}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 text-[13.5px] leading-relaxed text-system-600">
            {bloqueo.permanente
              ? "Mientras tu cuenta esté baneada no puedes aportar, crear ni administrar campañas, ni revisar aportes."
              : "Durante la suspensión no puedes aportar, crear ni administrar campañas, ni revisar aportes. Al terminar, tu cuenta se reactiva sola."}{" "}
            Si crees que se trata de un error, escríbenos desde la página de{" "}
            <Link href="/contacto" className="font-semibold text-brand-600 hover:underline">
              contacto
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
