// Contenido de la pantalla de dar un aviso (escala de lib/usuarios/escala-de-avisos.ts) o banear (2026-10-13):
// /supervisar/sanciones/[usuarioId] y /supervision/sanciones/[usuarioId]; antes /usuarios/[id]/sancion del panel.
// Server Component; la página de cada zona comprueba antes la sesión (exigirModerador). Datos: obtenerUsuario().
// Formulario en FormularioDeSancion. Con ?reportes=<clave> ("campana-116" o "aporte-55", desde la bandeja de
// reportes) la sanción confirma los reportes pendientes de esa campaña o aporte contra la persona
// (reportesPendientesContra). Un supervisor no se sanciona a sí mismo ni ve el correo de la persona.

import { notFound } from "next/navigation";

import { Aviso, Identidad, Tarjeta, Volver } from "@/components/sistema/ui";
import { obtenerUsuario } from "@/lib/usuarios/directorio";
import { reportesPendientesContra } from "@/lib/reportes/reportes";
import { leerClaveDeReportes } from "@/lib/reportes/motivos";
import type { Moderador } from "@/lib/moderacion/moderador";
import { rutasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";
import { AVISOS_PARA_BANEO } from "@/lib/usuarios/escala-de-avisos";
import FormularioDeSancion from "./FormularioDeSancion";

/** Título de la pestaña: "Sancionar a <nombre>". */
export async function tituloDeSancionar(usuarioId: string): Promise<string> {
  const u = await obtenerUsuario(usuarioId);
  return u ? `Sancionar a ${u.nombre}` : "Sancionar";
}

export default async function PantallaDeSancionar({
  zona,
  moderador,
  usuarioId,
  reportes: reportesDe,
}: {
  zona: ZonaDeModeracion;
  moderador: Moderador;
  usuarioId: string;
  reportes?: string;
}) {
  const rutas = rutasDeModeracion(zona);
  const u = await obtenerUsuario(usuarioId);
  if (!u) notFound();
  const esSuCuenta = moderador.tipo === "usuario" && moderador.usuarioId === Number(u.id);

  const clave = leerClaveDeReportes(reportesDe);
  const reportes = clave ? await reportesPendientesContra(clave, Number(u.id)) : null;

  return (
    <div>
      {clave ? (
        <Volver href={rutas.reportes}>Volver a reportes</Volver>
      ) : (
        <Volver href={rutas.sanciones}>Volver a sanciones</Volver>
      )}

      <header className="mb-6">
        {/* El correo solo lo ve el SuperUsuario; un supervisor ve el rol. */}
        <Identidad nombre={u.nombre} detalle={moderador.tipo === "root" ? u.correo : u.rol} riesgo={u.estado !== "ACTIVA"} />
        <p className="mt-2 text-[12.5px] text-system-600">
          Lleva {u.strikes} de {AVISOS_PARA_BANEO} avisos.
        </p>
      </header>

      {clave && reportes ? (
        <Aviso
          tono="aviso"
          titulo={`Por ${reportes.reportes} ${reportes.reportes === 1 ? "reporte" : "reportes"} ${reportes.titulo}`}
          className="mb-4 max-w-xl"
        >
          {reportes.motivos.length > 0 ? `Motivos: ${reportes.motivos.join(" · ")}. ` : ""}
          Al aplicar la sanción, esos reportes quedan resueltos con ella. {u.nombre} no sabrá quién lo reportó.
        </Aviso>
      ) : clave ? (
        <Aviso tono="neutro" className="mb-4 max-w-xl">
          Ya no quedan reportes pendientes de ese caso contra {u.nombre}. Si aplicas una sanción, no quedará ligada a ellos.
        </Aviso>
      ) : null}

      {esSuCuenta ? (
        <Aviso tono="neutro" className="max-w-xl">
          Es tu cuenta: no puedes darte un aviso ni banearte. Si hay reportes contra ti, los resuelve otro supervisor.
        </Aviso>
      ) : (
      <Tarjeta className="max-w-xl">
        <FormularioDeSancion
          zona={zona}
          usuarioId={u.id}
          usuario={u.nombre}
          avisos={u.strikes}
          baneada={u.estado === "BANEADA"}
          reportes={clave && reportes ? reportesDe : undefined}
        />
      </Tarjeta>
      )}
    </div>
  );
}
