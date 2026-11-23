// Pantalla /mis-apelaciones (2026-11-22, a pedido del usuario): las sanciones de la cuenta y los baneos en una
// campaña que la persona puede apelar, y sus apelaciones con la respuesta del SuperUsuario.
// Server Component. Acceso: sesión de usuario (exigirUsuario; una cuenta bloqueada va a /cuenta-bloqueada, que
// muestra lo mismo). Datos: apelacionesParaLaPantalla() de lib/apelaciones/apelaciones.ts.
// Llegan aquí las notificaciones de sanción, de baneo en una campaña y de respuesta a una apelación, y "Apelaciones"
// de /cuenta.

import type { Metadata } from "next";

import ApelacionesDeLaPersona from "@/components/apelaciones/ApelacionesDeLaPersona";
import { apelacionesParaLaPantalla } from "@/lib/apelaciones/apelaciones";
import { DIAS_PARA_APELAR } from "@/lib/apelaciones/reglas";
import { exigirUsuario } from "@/lib/session";

export const metadata: Metadata = { title: "Mis apelaciones" };
export const dynamic = "force-dynamic";

export default async function MisApelacionesPage() {
  const usuario = await exigirUsuario();
  const datos = await apelacionesParaLaPantalla(Number(usuario.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mis apelaciones</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-system-600">
          Si crees que una sanción de tu cuenta o un baneo en una campaña no es correcto, explica por qué. Tienes{" "}
          {DIAS_PARA_APELAR} días desde la decisión y una sola oportunidad por cada una. La revisa la administración de
          DataForGood y su respuesta es final.
        </p>
      </div>
      <ApelacionesDeLaPersona {...datos} />
    </div>
  );
}
