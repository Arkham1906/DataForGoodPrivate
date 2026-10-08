// Pantalla /baja-solicitada (SCR-WEB-31, confirmación): a donde llega quien acaba de pedir
// la baja desde /cuenta/eliminar. Pública: la sesión ya se cerró. Solo muestra lo que llega
// en la URL (fecha efectiva, campañas finalizadas, aportes, XP y destino de los aportes);
// no lee la base de datos. "Cancelar la baja" lleva a /entrar: iniciar sesión la cancela.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ButtonLink from "@/components/ui/ButtonLink";
import Logo from "@/components/layout/Logo";
import { esDestinoDeAportes, formatearFechaDeBaja, type DestinoDeAportes } from "@/lib/usuarios/baja-opciones";

export const metadata: Metadata = { title: "Baja solicitada" };

const DESTINO_DE_APORTES: Record<DestinoDeAportes, string> = {
  eliminar: "Borrado (salvo los ya utilizados, que se anonimizan)",
  anonimizar: "Anonimización",
  autoria: "Se conservan con tu nombre",
};

/** Días completos que faltan para la fecha (la página es dinámica: se calcula en cada visita). */
function diasHasta(fecha: Date): number {
  return Math.max(0, Math.ceil((fecha.getTime() - Date.now()) / 86_400_000));
}

function entero(valor: string | string[] | undefined): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export default async function BajaSolicitadaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const hasta = new Date(String(params.hasta ?? ""));
  if (Number.isNaN(hasta.getTime())) redirect("/");

  const diasRestantes = diasHasta(hasta);
  const fecha = formatearFechaDeBaja(hasta);
  const finalizadas = entero(params.finalizadas);
  const aportes = entero(params.aportes);
  const xp = entero(params.xp);
  const destino = esDestinoDeAportes(params.destino) ? params.destino : "anonimizar";

  const aplicado = [
    { etiqueta: "Sesiones", valor: "Cerradas" },
    { etiqueta: "Campañas propias", valor: finalizadas === 1 ? "1 finalizada" : `${finalizadas} finalizadas` },
    { etiqueta: "Envío de aportes", valor: "Deshabilitado" },
  ];
  const pendiente = [
    { etiqueta: "Datos personales", valor: "Borrado permanente" },
    { etiqueta: aportes === 1 ? "1 aporte" : `${aportes} aportes`, valor: DESTINO_DE_APORTES[destino] },
    { etiqueta: "Nivel y experiencia", valor: `${xp.toLocaleString("es-MX")} XP se pierden` },
    { etiqueta: "Correo", valor: "Liberado para un registro nuevo" },
  ];

  return (
    <div className="min-h-screen bg-system-50">
      <header className="flex items-center justify-between border-b border-system-200 px-6 py-4">
        <Logo />
      </header>

      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="rounded-lg border border-system-200 bg-white p-6 sm:p-8">
          <p className="mb-2 font-mono text-[10.5px] uppercase tracking-widest text-error-700">Baja solicitada</p>
          <h1 className="text-xl font-extrabold text-system-900">Tu cuenta se eliminará el {fecha}</h1>
          <p className="mt-1 text-[13px] text-system-600">
            Quedan {diasRestantes === 1 ? "1 día" : `${diasRestantes} días`}.
          </p>

          <div className="mt-5 rounded-lg border-l-4 border-brand-600 bg-brand-50 p-4">
            <p className="text-[14px] font-bold text-system-900">Periodo de gracia</p>
            <p className="mt-1 text-[13px] leading-relaxed text-system-600">
              Puedes revertirlo en cualquier momento: basta con volver a iniciar sesión antes del {fecha}. La baja se
              cancela sola.
            </p>
            <ButtonLink href="/entrar" variant="primary" size="sm" className="mt-3">
              Cancelar la baja
            </ButtonLink>
          </div>

          <Resumen titulo="Ya aplicado" filas={aplicado} />
          <Resumen titulo="Pendiente al vencer el plazo" filas={pendiente} />

          <p className="mt-5 text-[12.5px] leading-relaxed text-system-400">
            Pasada esa fecha la operación es irreversible y el correo puede volver a usarse para crear una cuenta
            distinta.
          </p>
        </div>
      </main>
    </div>
  );
}

function Resumen({ titulo, filas }: { titulo: string; filas: { etiqueta: string; valor: string }[] }) {
  return (
    <section className="mt-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-system-400">{titulo}</p>
      <dl className="mt-2 divide-y divide-system-200 rounded-lg border border-system-200">
        {filas.map((fila) => (
          <div key={fila.etiqueta} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <dt className="text-[13px] text-system-600">{fila.etiqueta}</dt>
            <dd className="text-right text-[13px] font-semibold text-system-900">{fila.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
