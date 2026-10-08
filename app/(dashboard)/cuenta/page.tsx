// Pantalla /cuenta: perfil del usuario. Server Component.
// Datos: exigirUsuario(). PerfilForm.tsx pinta la tarjeta superior ("Editar perfil",
// "Cerrar sesión"), los datos personales y los intereses, y guarda con PATCH /api/usuarios/[id].
// La contraseña se cambia (o, en una cuenta de Google, se crea) en CambiarContrasena.tsx con un
// código enviado al correo de la cuenta; no se pide la actual.
// "Eliminar cuenta" (hasta abajo) lleva a /cuenta/eliminar (baja voluntaria, SCR-WEB-31).
// Experimental (2026-10-07): al llegar con "Ver perfil" de la barra superior, el avatar y el
// nombre vuelan a su lugar y la pantalla se despliega (View Transitions; ver EnlaceAlPerfil.tsx).

import { ViewTransition } from "react";
import ButtonLink from "@/components/ui/ButtonLink";
import { exigirUsuario } from "@/lib/session";
import PerfilForm from "./PerfilForm";
import CambiarContrasena from "./CambiarContrasena";
import PreferenciasDeComunicacion from "./PreferenciasDeComunicacion";

const ROLE_LABELS: Record<string, string> = {
  usuario: "Usuario común",
  revisor: "Revisor de aportes",
  supervisor: "Supervisor",
  admin: "SuperUsuario",
};

export default async function CuentaPage() {
  const currentUser = await exigirUsuario();

  const primaryRole = currentUser.role[0] ?? "usuario";
  const roleLabel = ROLE_LABELS[primaryRole] ?? primaryRole;

  return (
    // Al llegar con "Ver perfil" la pantalla se despliega de arriba abajo mientras el avatar y el
    // nombre llegan a su lugar. La clase se pone siempre; globals.css solo la anima si
    // EnlaceAlPerfil marcó <html data-abrir-perfil> (el tipo de transición a veces se perdía).
    <ViewTransition enter="perfil-desplegar" default="none">
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
            Cuenta
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-ink">
            Configuración de cuenta
          </h1>
          <p className="mt-1 text-[13px] text-ink-2">
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
          intereses: currentUser.intereses,
          interesesTexto: currentUser.intereses_texto,
        }}
        encabezado={
          <div className="flex items-center gap-4">
            {/* Mismo name que el avatar y el nombre de la barra superior (EnlaceAlPerfil): vuelan hasta aquí. */}
            <ViewTransition name="perfil-avatar" share="perfil-viaje" default="none">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-extrabold text-white">
                {(currentUser.nombre ?? "")
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </div>
            </ViewTransition>
            <div>
              <ViewTransition name="perfil-nombre" share="perfil-viaje" default="none">
                <p className="w-fit text-lg font-extrabold text-ink">{`${currentUser.nombre ?? ""} ${currentUser.apellidos ?? ""}`.trim()}</p>
              </ViewTransition>
              <p className="text-[13px] text-ink-2">{currentUser.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-pill border border-line-2 bg-sunken px-3 py-1 text-[11px] font-semibold text-ink-2">
                  {roleLabel}
                </span>
                <span className="rounded-pill border border-ok/30 bg-ok-tint px-3 py-1 text-[11px] font-semibold text-ok">
                  Nivel {currentUser.level}
                </span>
              </div>
            </div>
          </div>
        }
      >
        <section className="rounded-lg border border-line bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Seguridad
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-ink">
                Acceso y privacidad
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded border border-line bg-sunken p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-ink">Contraseña</p>
                  <p className="text-[12.5px] text-ink-2">
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

            <div className="rounded border border-line bg-sunken p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-ink">Verificación</p>
                  <p className="text-[12.5px] text-ink-2">
                    {currentUser.email_verificado ? "Correo confirmado" : "Correo sin confirmar"}
                  </p>
                </div>
                {currentUser.email_verificado ? (
                  <span className="rounded-pill border border-ok/30 bg-ok-tint px-3 py-1 text-[11px] font-bold text-ok">
                    Activa
                  </span>
                ) : (
                  <span className="rounded-pill border border-warn/30 bg-warn-tint px-3 py-1 text-[11px] font-bold text-warn">
                    Pendiente
                  </span>
                )}
              </div>
            </div>

            <div className="rounded border border-line bg-sunken p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-ink">Privacidad</p>
                  <p className="text-[12.5px] text-ink-2">
                    Participación visible en comunidad
                  </p>
                </div>
                <button className="relative h-6 w-11 rounded-pill bg-accent">
                  <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                </button>
              </div>
            </div>

            <PreferenciasDeComunicacion />
          </div>
        </section>
      </PerfilForm>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              Progreso y logros
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[14px] text-ink-2">
              <span className="text-ink font-extrabold text-base">
                Nivel {currentUser.level}
              </span>
              <span className="text-ink-2">
                · {currentUser.xp_total.toLocaleString("es-MX")} XP
              </span>
              <span className="text-ink-2">
                · racha de {currentUser.streak_days} días
              </span>
            </div>
          </div>
          <button className="rounded-pill border border-line-2 bg-surface px-5 py-2 text-[13px] font-bold text-ink transition-colors hover:border-accent hover:text-accent">
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