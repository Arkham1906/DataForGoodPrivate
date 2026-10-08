// Pantalla /root: entrada del SuperUsuario (credencial ROOT_USER_ID + ROOT_PASSWORD_HASH).
// El formulario está en RootLoginForm.tsx. Tras entrar va a /sistema.

import type { Metadata } from "next";
import RootLoginForm from "./RootLoginForm";

// La credencial raíz no se cachea ni se prerenderiza.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acceso raíz · DataForGood",
  description: "Panel administrativo del sistema.",
  // La ruta raíz no se indexa ni se enlaza desde el sitio público.
  robots: { index: false, follow: false, nocache: true },
};

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[18px] w-[18px]"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function AccesoRaizPage() {
  return (
    <div className="rounded-lg border border-system-200 bg-white p-8">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <ShieldIcon />
        </span>
        <h1 className="text-xl font-extrabold text-system-900">Acceso raíz</h1>
        <p className="mt-1 text-[13px] text-system-600">
          Panel administrativo del sistema
        </p>
      </div>

      <RootLoginForm />

      <div className="mt-6 rounded-lg bg-system-100 p-4 text-[12.5px] leading-relaxed text-system-600">
        Ruta independiente del login público. No hay registro ni recuperación
        de contraseña: la credencial se almacena cifrada y no es gestionable
        desde la administración de usuarios.
      </div>
    </div>
  );
}
