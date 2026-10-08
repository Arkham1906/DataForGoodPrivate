// Contenido de la página 404 (2026-10-07). Lo usan app/not-found.tsx (ruta que no existe: pantalla
// completa y su propio <main>) y los not-found.tsx de (dashboard) y (panel), que salen dentro de su
// layout cuando una página llama a notFound(): ahí el layout ya tiene el <main>, y uno dentro de otro
// es un error de accesibilidad (dos regiones principales).

import ButtonLink from "@/components/ui/ButtonLink";
import Logo from "@/components/layout/Logo";

function Contenido({ volverA, textoVolver }: { volverA: string; textoVolver: string }) {
  return (
    <>
      <p className="font-mono text-[12px] uppercase tracking-wide text-brand-600">Error 404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-system-900">No encontramos esta página</h1>
      <p className="mt-2 text-[13.5px] text-system-600">
        Puede que el enlace esté mal escrito, que la página ya no exista o que no tengas acceso a ella.
      </p>
      <ButtonLink href={volverA} variant="primary" className="mt-6 inline-flex">
        {textoVolver}
      </ButtonLink>
    </>
  );
}

/** Pantalla completa, con logo y su propio <main id="contenido">: solo para app/not-found.tsx. */
export function PantallaNoEncontrada() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-system-50 px-4 py-10">
      <main id="contenido" className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Contenido volverA="/" textoVolver="Ir al inicio" />
      </main>
    </div>
  );
}

/** Dentro de un layout que ya tiene <main>: solo el aviso. */
export function AvisoNoEncontrado({ volverA, textoVolver }: { volverA: string; textoVolver: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Contenido volverA={volverA} textoVolver={textoVolver} />
    </div>
  );
}
