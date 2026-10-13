// Contenido de la pantalla de sanciones de la moderación (2026-10-13): /supervisar/sanciones (SuperUsuario
// en modo supervisor) y /supervision/sanciones (usuario con rol de supervisor); antes era /usuarios/sanciones
// del panel. Todas las sanciones de los usuarios (avisos, suspensiones y baneos de la cuenta, y baneos por
// campaña; vigentes y pasadas), la lista negra de correos (listarListaNegra) y los bloqueos globales de
// dispositivos anónimos.
// Server Component; la página de cada zona comprueba antes la sesión (exigirModerador). Datos:
// listarSanciones() (lib/usuarios/directorio.ts) y listarBloqueosGlobales() (lib/aportes/sanciones-anonimas.ts).
// La lista agrupada por usuario está en ListaDeSanciones (cliente). Acciones: BotonRestaurar y BotonQuitarBloqueo.
// "Sancionar a alguien" (?buscar=): busca a cualquier usuario por nombre, correo o id (buscarUsuarios) y lleva
// a su pantalla de sanción; no muestra correos, solo el nombre y el estado de la cuenta.
// `soloLectura` (2026-10-13): /usuarios/sanciones del panel, donde el SuperUsuario fuera del modo supervisor
// solo consulta: pestañas de Usuarios, sin buscador ni botones, y un aviso que lleva a /supervisar/sanciones.

import Link from "next/link";

import Button from "@/components/sistema/Button";
import { Input } from "@/components/sistema/Input";
import Tag from "@/components/sistema/Tag";
import { Aviso, Encabezado } from "@/components/sistema/ui";
import type { Moderador } from "@/lib/moderacion/moderador";
import { rutasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";
import { ETIQUETA_DE_ESTADO, buscarUsuarios, formatearFecha, formatearFechaYHora, listarSanciones } from "@/lib/usuarios/directorio";
import ListaDeSanciones from "./ListaDeSanciones";
import BotonQuitarBloqueo from "./BotonQuitarBloqueo";
import PestanasDeModeracion from "./PestanasDeModeracion";
import Subtabs from "@/components/sistema/subtabs";
import { PESTANAS_USUARIOS } from "@/lib/usuarios/dashboard";
import { DIAS_DE_BLOQUEO, INAPROPIADOS_PARA_BLOQUEO, VENTANA_DE_DIAS, listarBloqueosGlobales } from "@/lib/aportes/sanciones-anonimas";
import { listarListaNegra } from "@/lib/usuarios/lista-negra";
import { AVISOS_PARA_BANEO } from "@/lib/usuarios/escala-de-avisos";
import { BASE_PATH } from "@/lib/base-path";

export default async function PantallaDeSanciones({
  zona,
  moderador,
  buscar = "",
  soloLectura = false,
}: {
  zona: ZonaDeModeracion;
  moderador: Moderador;
  /** Texto del buscador "Sancionar a alguien" (?buscar=). */
  buscar?: string;
  /** El SuperUsuario fuera del modo supervisor: solo consulta. */
  soloLectura?: boolean;
}) {
  const cuentaPropia = moderador.tipo === "usuario" ? String(moderador.usuarioId) : null;
  const rutas = rutasDeModeracion(zona);
  const texto = buscar.trim().slice(0, 100);
  const encontrados = texto && !soloLectura
    ? (await buscarUsuarios({ q: texto })).filas.filter((u) => u.id !== cuentaPropia)
    : null;
  const [sanciones, bloqueos, listaNegra] = await Promise.all([listarSanciones(), listarBloqueosGlobales(), listarListaNegra()]);
  const vigentes = sanciones.filter((s) => s.vigente).length;

  return (
    <div>
      {soloLectura ? (
        <Subtabs pestanas={PESTANAS_USUARIOS} etiquetaAria="Secciones de usuarios" volverAlMenuEnMovil />
      ) : (
        <PestanasDeModeracion zona={zona} />
      )}

      <Encabezado
        titulo="Sanciones"
        subtitulo={`${sanciones.length} ${sanciones.length === 1 ? "sanción" : "sanciones"} · ${vigentes} ${vigentes === 1 ? "vigente" : "vigentes"}`}
      />

      {soloLectura ? (
        <Aviso tono="info" className="mb-6 max-w-xl">
          Aquí solo se consultan. Para dar un aviso, banear, restaurar o quitar un bloqueo, entra a{" "}
          <Link href={rutas.sanciones} className="font-semibold underline">Modo supervisor → Sanciones</Link>.
        </Aviso>
      ) : (
      <section aria-labelledby="sancionar-a-alguien" className="mb-8 max-w-xl">
        <h2 id="sancionar-a-alguien" className="mb-1 text-[15px] font-bold text-system-900">Sancionar a alguien</h2>
        <p className="mb-3 text-[12.5px] text-system-600">Busca a la persona por su nombre, su correo o su número de usuario.</p>
        <form method="get" action={`${BASE_PATH}${rutas.sanciones}`} className="flex gap-2">
          <label htmlFor="buscar-usuario" className="sr-only">Nombre, correo o número de usuario</label>
          <Input id="buscar-usuario" name="buscar" defaultValue={texto} maxLength={100} placeholder="Nombre, correo o número" />
          <Button type="submit" variant="secondary" size="sm" className="shrink-0">Buscar</Button>
        </form>
        {encontrados && (
          encontrados.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-system-600">Nadie coincide con «{texto}».</p>
          ) : (
            <ul className="mt-3 divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
              {encontrados.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block break-words text-[13.5px] font-semibold text-system-900">{u.nombre}</span>
                    <span className="block text-[11.5px] text-system-500">
                      {u.rol} · {u.strikes} {u.strikes === 1 ? "aviso" : "avisos"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Tag tone={ETIQUETA_DE_ESTADO[u.estado].tono}>{ETIQUETA_DE_ESTADO[u.estado].texto}</Tag>
                    <Link href={rutas.sancionar(u.id)} className="whitespace-nowrap text-[12.5px] font-semibold text-brand-600 hover:underline">
                      Sancionar<span className="sr-only"> a {u.nombre}</span>
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
      )}

      {sanciones.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">Ningún usuario tiene sanciones.</p>
      ) : (
        <ListaDeSanciones
          zona={zona}
          cuentaPropia={cuentaPropia}
          soloLectura={soloLectura}
          sanciones={sanciones.map(({ fecha, ...s }) => ({ ...s, fechaTexto: formatearFechaYHora(fecha) }))}
        />
      )}

      <Aviso tono="neutro" className="mt-5">
        Escala de avisos: el 1.º es solo un mensaje, el 2.º suspende la cuenta 2 días, el 3.º 7 días y el
        {" "}{AVISOS_PARA_BANEO}.º la banea y pone su correo en la lista negra. Los avisos no caducan ni se
        restauran (los strikes de antes cuentan como avisos). Restaurar un baneo saca el correo de la lista
        negra. El baneo en una campaña lo quita quien la creó, desde la lista de aportes de su campaña.
        {soloLectura ? "" : " Para dar un aviso o banear a alguien, búscalo arriba o entra desde un reporte."}
      </Aviso>

      <h2 className="mb-1 mt-10 text-[17px] font-extrabold text-system-900">Lista negra de correos</h2>
      <p className="mb-4 text-[13px] text-system-600">
        Correos de cuentas baneadas: no pueden registrarse otra vez ni entrar con Google como cuenta nueva.
        Para sacar uno, restaura el baneo de la cuenta.
      </p>
      {listaNegra.length === 0 ? (
        <p className="py-4 text-[13px] text-system-600">No hay correos en la lista negra.</p>
      ) : (
        <ul className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
          {listaNegra.map((c) => (
            <li key={c.email} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3.5">
              <span className="min-w-0">
                <span className="block break-all font-mono text-[12.5px] text-system-900">{c.email}</span>
                <span className="block text-[12px] text-system-600">
                  {c.usuarioId && c.usuario ? c.usuario : "Cuenta eliminada"}
                  {c.motivo ? ` · ${c.motivo}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-system-500">desde {formatearFecha(c.desde)}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-1 mt-10 text-[17px] font-extrabold text-system-900">Dispositivos anónimos bloqueados</h2>
      <p className="mb-4 text-[13px] text-system-600">
        Personas sin cuenta con {INAPROPIADOS_PARA_BLOQUEO} aportes marcados como inapropiados en{" "}
        {VENTANA_DE_DIAS} días. No pueden aportar sin cuenta desde ese dispositivo en ninguna
        campaña durante {DIAS_DE_BLOQUEO} días.
      </p>
      {bloqueos.length === 0 ? (
        <p className="py-4 text-[13px] text-system-600">No hay dispositivos bloqueados.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {bloqueos.map((b) => (
              <article key={b.id} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-[14px] font-bold text-system-900">Anónimo #{b.id}</p>
                  <p className="mt-1 break-words text-[11px] text-system-500">
                    Desde {formatearFecha(b.desde)}
                    {b.campana ? ` · ${b.campana}` : ""}
                  </p>
                </div>

                <dl className="mt-3 space-y-3 border-t border-system-200 pt-3">
                  <div>
                    <dt className="text-[11px] text-system-600">Motivo</dt>
                    <dd className="mt-1 break-words text-[13px] leading-relaxed text-system-900">{b.motivo}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[11px] text-system-600">Vence</dt>
                    <dd className="text-right font-mono text-[12px] text-system-900">
                      {b.hasta ? formatearFecha(b.hasta) : "Sin fecha"}
                    </dd>
                  </div>
                </dl>

                {!soloLectura && (
                  <div className="mt-3 grid">
                    <BotonQuitarBloqueo zona={zona} bloqueoId={b.id} anchoCompleto />
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm md:block">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
                <tr>
                  <th className="pb-3 font-medium">Dispositivo</th>
                  <th className="pb-3 font-medium">Motivo</th>
                  <th className="pb-3 font-medium">Vence</th>
                  {!soloLectura && <th className="pb-3 text-right font-medium">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {bloqueos.map((b) => (
                  <tr key={b.id} className="border-b border-system-200 last:border-0">
                    <td className="py-4">
                      <p className="font-bold text-system-900">Anónimo #{b.id}</p>
                      <p className="font-mono text-[11px] text-system-500">
                        desde {formatearFecha(b.desde)}
                        {b.campana ? ` · ${b.campana}` : ""}
                      </p>
                    </td>
                    <td className="text-system-600">{b.motivo}</td>
                    <td className="font-mono text-[12px] text-system-600">
                      {b.hasta ? formatearFecha(b.hasta) : "Sin fecha"}
                    </td>
                    {!soloLectura && (
                      <td className="text-right">
                        <BotonQuitarBloqueo zona={zona} bloqueoId={b.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
