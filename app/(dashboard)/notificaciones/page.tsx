// Pantalla /notificaciones: historial de notificaciones del usuario. Server Component.
// Acceso: sesión de usuario (exigirUsuario). Datos: listarNotificaciones() de lib/notificaciones/notificaciones.ts,
// 20 por página (?pagina=), todas o solo sin leer (?filtro=no-leidas).
// Acciones (ListaDeNotificaciones.tsx): abrir, marcar leída/no leída, borrar, marcar todas y aceptar invitaciones.
// Arriba, AvisosEnEsteDispositivo activa o desactiva las notificaciones push en este navegador o teléfono.

import Link from "next/link";
import { exigirUsuario } from "@/lib/session";
import { listarNotificaciones, type FiltroDeNotificaciones } from "@/lib/notificaciones/notificaciones";
import ListaDeNotificaciones from "./ListaDeNotificaciones";
import AvisosEnEsteDispositivo from "@/components/notificaciones/AvisosEnEsteDispositivo";

const POR_PAGINA = 20;

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; filtro?: string }>;
}) {
  const usuario = await exigirUsuario();
  const params = await searchParams;
  const filtro: FiltroDeNotificaciones = params.filtro === "no-leidas" ? "no-leidas" : "todas";
  const paginaPedida = Number(params.pagina);
  const pagina = Number.isInteger(paginaPedida) && paginaPedida >= 1 && paginaPedida <= 10_000 ? paginaPedida : 1;

  const resultado = await listarNotificaciones(usuario.id, { pagina, porPagina: POR_PAGINA, filtro });
  const paginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));

  const enlace = (cambios: { pagina?: number; filtro?: FiltroDeNotificaciones }) => {
    const query = new URLSearchParams();
    const f = cambios.filtro ?? filtro;
    const p = cambios.pagina ?? 1;
    if (f !== "todas") query.set("filtro", f);
    if (p > 1) query.set("pagina", String(p));
    const texto = query.toString();
    return texto ? `/notificaciones?${texto}` : "/notificaciones";
  };

  const filtros: { valor: FiltroDeNotificaciones; etiqueta: string }[] = [
    { valor: "todas", etiqueta: "Todas" },
    { valor: "no-leidas", etiqueta: resultado.noLeidas > 0 ? `Sin leer (${resultado.noLeidas})` : "Sin leer" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Notificaciones</h1>
        <p className="mt-1 text-[13px] text-system-600">
          Avisos sobre tus aportes, tus campañas, tus roles y tu cuenta.
        </p>
      </div>

      <AvisosEnEsteDispositivo />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar notificaciones">
        {filtros.map((f) => (
          <Link
            key={f.valor}
            href={enlace({ filtro: f.valor })}
            aria-current={filtro === f.valor ? "page" : undefined}
            className={`rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold ${
              filtro === f.valor ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
            }`}
          >
            {f.etiqueta}
          </Link>
        ))}
      </div>

      <ListaDeNotificaciones
        items={resultado.data}
        noLeidas={resultado.noLeidas}
        vacio={filtro === "no-leidas" ? "No tienes notificaciones sin leer." : "Todavía no tienes notificaciones."}
      />

      {paginas > 1 && (
        <nav className="flex items-center justify-between gap-3 text-[13px]" aria-label="Páginas">
          {pagina > 1 ? (
            <Link href={enlace({ pagina: pagina - 1 })} className="font-semibold text-brand-600 hover:underline">
              ← Más recientes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-system-400">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={enlace({ pagina: pagina + 1 })} className="font-semibold text-brand-600 hover:underline">
              Anteriores →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
