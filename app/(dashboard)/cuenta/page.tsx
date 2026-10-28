// Pantalla /cuenta: perfil del usuario. Server Component.
// Datos: exigirUsuario(). PerfilForm.tsx pinta la tarjeta superior ("Cerrar sesión"), los datos
// personales y los intereses, que se editan directamente (2026-10-20), y guarda con PATCH /api/usuarios/[id].
// La contraseña se cambia (o, en una cuenta de Google, se crea) en CambiarContrasena.tsx con un
// código enviado al correo de la cuenta; no se pide la actual.
// "Eliminar cuenta" (hasta abajo) lleva a /cuenta/eliminar (baja voluntaria, SCR-WEB-31).
// El lápiz sobre el avatar (EditarAvatar.tsx, 2026-10-13; siempre visible desde el 2026-10-20): iniciales,
// ícono predefinido o foto propia (PUT /api/usuarios/[id]/avatar); el ícono se pinta con components/ui/Avatar.
// Experimental (2026-10-07): al llegar con "Ver perfil" de la barra superior, el avatar y el
// nombre vuelan a su lugar y la pantalla se despliega (View Transitions; ver EnlaceAlPerfil.tsx).
// Sin loading.tsx a propósito: si la pantalla mostrara un esqueleto antes, el avatar y el nombre
// ya no volarían (no hay con qué emparejarlos). Probado el 2026-10-07: 0 de 4 con esqueleto.

import { ViewTransition } from "react";
import ButtonLink from "@/components/ui/ButtonLink";
import { exigirUsuario } from "@/lib/session";
import { etiquetasDelUsuario } from "@/lib/etiquetas/catalogo";
import PerfilForm from "./PerfilForm";
import CambiarContrasena from "./CambiarContrasena";
import PreferenciasDeComunicacion from "./PreferenciasDeComunicacion";
import EditarAvatar from "./EditarAvatar";
import Avatar from "@/components/ui/Avatar";
import { datosDeAvatar } from "@/lib/usuarios/avatar-opciones";
import { nombresDeRoles } from "@/lib/usuarios/rol-asignable";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function CuentaPage() {
  const currentUser = await exigirUsuario();

  // El rol más alto (SuperUsuario > Supervisor > Revisor de aportes > Usuario común). No usar role[0]:
  // normalizeRoles() siempre pone "usuario" primero.
  const roleLabel = nombresDeRoles(currentUser.role)[0];
  const avatar = datosDeAvatar({ ...currentUser, nombre: currentUser.nombre ?? "" });

  return (
    // Al llegar con "Ver perfil" la pantalla se despliega de arriba abajo mientras el avatar y el
    // nombre llegan a su lugar. La clase se pone siempre; globals.css solo la anima si
    // EnlaceAlPerfil marcó <html data-abrir-perfil> (el tipo de transición a veces se perdía).
    <ViewTransition enter="perfil-desplegar" default="none">
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">
            Cuenta
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-system-900">
            Configuración de cuenta
          </h1>
          <p className="mt-1 text-[13px] text-system-600">
            Gestiona tus datos, preferencias y acceso a la plataforma.
          </p>
        </div>
      </div>

      <PerfilForm
        usuario={{
          id: currentUser.id,
          nombre: currentUser.nombre ?? "",
          apellidos: currentUser.apellidos ?? "",
          email: currentUser.email,
          state: currentUser.state,
          city: currentUser.city,
          specialty: currentUser.specialty,
          organizacion: currentUser.organizacion,
          intereses: currentUser.intereses,
          interesesTexto: currentUser.intereses_texto,
          etiquetas: await etiquetasDelUsuario(currentUser.id),
        }}
        encabezado={
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {/* Mismo name que el avatar y el nombre de la barra superior (EnlaceAlPerfil): vuelan hasta aquí. */}
              <ViewTransition name="perfil-avatar" share="perfil-viaje" default="none">
                <Avatar datos={avatar} tamano="lg" />
              </ViewTransition>
              <div className="absolute -bottom-1 -right-1">
                <EditarAvatar actual={avatar} />
              </div>
            </div>
            <div>
              <ViewTransition name="perfil-nombre" share="perfil-viaje" default="none">
                <p className="w-fit text-lg font-extrabold text-system-900">{`${currentUser.nombre ?? ""} ${currentUser.apellidos ?? ""}`.trim()}</p>
              </ViewTransition>
              <p className="text-[13px] text-system-600">{currentUser.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-pill border border-system-300 bg-system-100 px-3 py-1 text-[11px] font-semibold text-system-600">
                  {roleLabel}
                </span>
                <span className="rounded-pill border border-success-700/30 bg-success-50 px-3 py-1 text-[11px] font-semibold text-success-700">
                  Nivel {currentUser.level}
                </span>
              </div>
            </div>
          </div>
        }
      >
        <section className="rounded-lg border border-system-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-system-500">
                Seguridad
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-system-900">
                Acceso y privacidad
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded border border-system-200 bg-system-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-system-900">Contraseña</p>
                  <p className="text-[12.5px] text-system-600">
                    {currentUser.tiene_contrasena
                      ? "Inicia sesión con tu correo y contraseña"
                      : "Esta cuenta inicia sesión con Google. Crea una contraseña para entrar también con tu correo"}
                  </p>
                </div>
                <CambiarContrasena
                  usuarioId={Number(currentUser.id)}
                  email={currentUser.email}
                  tieneContrasena={Boolean(currentUser.tiene_contrasena)}
                />
              </div>
            </div>

            <div className="rounded border border-system-200 bg-system-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-system-900">Verificación</p>
                  <p className="text-[12.5px] text-system-600">
                    {currentUser.email_verificado ? "Correo confirmado" : "Correo sin confirmar"}
                  </p>
                </div>
                {currentUser.email_verificado ? (
                  <span className="rounded-pill border border-success-700/30 bg-success-50 px-3 py-1 text-[11px] font-bold text-success-700">
                    Activa
                  </span>
                ) : (
                  <span className="rounded-pill border border-warning-500/30 bg-warning-50 px-3 py-1 text-[11px] font-bold text-warning-800">
                    Pendiente
                  </span>
                )}
              </div>
            </div>

            <PreferenciasDeComunicacion
              usuarioId={currentUser.id}
              iniciales={{
                avisosCampanasNuevas: currentUser.avisos_campanas_nuevas,
                avisosAportes: currentUser.avisos_aportes,
                recordatorioSemanal: currentUser.recordatorio_semanal,
                resumenMensual: currentUser.resumen_mensual,
                notificaciones: currentUser.notificaciones_activas,
              }}
            />
          </div>
        </section>
      </PerfilForm>

      <section className="rounded-lg border border-system-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-system-500">
              Progreso y logros
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[14px] text-system-600">
              <span className="text-system-900 font-extrabold text-base">
                Nivel {currentUser.level}
              </span>
              <span className="text-system-600">
                · {currentUser.xp_total.toLocaleString("es-MX")} XP
              </span>
              <span className="text-system-600">
                · racha de {currentUser.streak_days} días
              </span>
            </div>
          </div>
          <button className="rounded-pill border border-system-300 bg-white px-5 py-2 text-[13px] font-bold text-system-900 transition-colors hover:border-brand-600 hover:text-brand-600">
            Ver
          </button>
        </div>
      </section>

      <div className="flex justify-end">
        <ButtonLink href="/cuenta/eliminar" variant="danger" size="sm">
          Eliminar cuenta
        </ButtonLink>
      </div>
    </div>
    </ViewTransition>
  );
}