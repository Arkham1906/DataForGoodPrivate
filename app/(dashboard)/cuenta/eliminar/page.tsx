// Pantalla /cuenta/eliminar (SCR-WEB-31): baja voluntaria de la cuenta. Server Component.
// Acceso: sesión de usuario (exigirUsuario). Datos: obtenerResumenDeBaja() de lib/usuarios/baja.ts
// (aportes por estado, campañas propias que se finalizan o se borran, XP y nivel).
// Acción: EliminarCuentaForm.tsx manda DELETE /api/usuarios/[id] y lleva a /baja-solicitada.

import Link from "next/link";
import Tag from "@/components/ui/Tag";
import { exigirUsuario } from "@/lib/session";
import { obtenerResumenDeBaja } from "@/lib/usuarios/baja";
import { DIAS_DE_GRACIA } from "@/lib/usuarios/baja-opciones";
import EliminarCuentaForm from "./EliminarCuentaForm";

function plural(n: number, singular: string, varios: string) {
  return `${n.toLocaleString("es-MX")} ${n === 1 ? singular : varios}`;
}

export default async function EliminarCuentaPage() {
  const usuario = await exigirUsuario();
  const resumen = await obtenerResumenDeBaja(Number(usuario.id));
  const { aportes, campanasPropias } = resumen;
  const eliminables = aportes.total - aportes.utilizados;

  const campanasTexto =
    campanasPropias.aFinalizar === 0 && campanasPropias.aBorrar === 0
      ? "No tienes campañas activas ni borradores que se vean afectados."
      : [
          campanasPropias.aFinalizar > 0 &&
            `${plural(campanasPropias.aFinalizar, "campaña activa o pausada se finaliza", "campañas activas o pausadas se finalizan")} de inmediato.`,
          campanasPropias.aBorrar > 0 &&
            `${plural(campanasPropias.aBorrar, "campaña sin aportes (borrador o en revisión) se borra", "campañas sin aportes (borradores o en revisión) se borran")}.`,
        ]
          .filter(Boolean)
          .join(" ");

  const efectos = [
    { titulo: "Periodo de gracia", texto: `${DIAS_DE_GRACIA} días antes del borrado definitivo.` },
    { titulo: "Cancelación", texto: "Basta con volver a iniciar sesión dentro de ese plazo." },
    { titulo: "Acceso", texto: "Se cierran todas tus sesiones en cuanto confirmes." },
    { titulo: "Campañas propias", texto: campanasTexto },
  ];

  const desglose = [
    { etiqueta: "Aprobados en campañas finalizadas", valor: aportes.utilizados, eliminable: false },
    { etiqueta: "Aprobados en campañas en curso", valor: aportes.aceptadosSinUso, eliminable: true },
    { etiqueta: "Pendientes de revisión", valor: aportes.pendientes, eliminable: true },
    { etiqueta: "Rechazados", valor: aportes.rechazados, eliminable: true },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/cuenta" className="text-[13px] font-semibold text-brand-600 hover:underline">
        ← Volver a mi cuenta
      </Link>

      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-error-700">Cuenta</p>
        <h1 className="mt-2 text-2xl font-extrabold text-system-900">Eliminar tu cuenta</h1>
        <p className="mt-1 text-[13px] text-system-600">
          {`${usuario.nombre ?? ""} ${usuario.apellidos ?? ""}`.trim()} · {usuario.email} ·{" "}
          {plural(aportes.total, "aporte", "aportes")} en {plural(aportes.campanas, "campaña", "campañas")}
        </p>
      </div>

      {aportes.utilizados > 0 && (
        <section className="rounded-lg border border-warning-500 bg-warning-50 p-5" role="note">
          <p className="text-[14px] font-bold text-system-900">
            {plural(aportes.utilizados, "de tus aportes ya no puede eliminarse", "de tus aportes ya no pueden eliminarse")}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-system-600">
            Fueron aprobados en campañas finalizadas y forman parte de sus datos abiertos publicados. Se conservarán de
            forma anónima aunque elijas borrarlos.
            {eliminables === 1 && " El restante sí puede eliminarse por completo."}
            {eliminables > 1 && ` Los ${eliminables} restantes sí pueden eliminarse por completo.`}
          </p>
          <dl className="mt-4 divide-y divide-system-200 rounded-lg border border-system-200 bg-white">
            {desglose.map((fila) => (
              <div key={fila.etiqueta} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <dt className="text-[13px] text-system-600">{fila.etiqueta}</dt>
                <dd className="flex items-center gap-2.5">
                  <span className="font-mono text-[13px] font-bold text-system-900">{fila.valor}</span>
                  <Tag tone={fila.eliminable ? "default" : "warn"}>{fila.eliminable ? "Eliminables" : "No eliminables"}</Tag>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="rounded-lg border border-system-200 bg-white p-5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-system-400">Qué va a pasar</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {efectos.map((efecto) => (
            <div key={efecto.titulo} className="rounded-lg bg-system-100 p-3.5">
              <dt className="text-[13px] font-bold text-system-900">{efecto.titulo}</dt>
              <dd className="mt-0.5 text-[12.5px] leading-relaxed text-system-600">{efecto.texto}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12.5px] text-system-600">
          Al borrarse la cuenta se pierden tus {resumen.xp.toLocaleString("es-MX")} XP y el nivel {resumen.nivel}; no se
          pueden recuperar.
        </p>
      </section>

      <EliminarCuentaForm
        usuarioId={Number(usuario.id)}
        tieneContrasena={Boolean(usuario.tiene_contrasena)}
        aportes={{ total: aportes.total, utilizados: aportes.utilizados, campanas: aportes.campanas }}
        xp={resumen.xp}
      />
    </div>
  );
}
