"use client";

// Botón de creación que verifica, antes de abrir el formulario, el rol de creador de campaña (2026-11-22: si
// el SuperUsuario se lo quitó, avisa en una ventana) y la organización del perfil. El servidor lo vuelve a
// exigir en POST /api/campanas.

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import VentanaDeOrganizacionRequerida from "@/components/campanas/VentanaDeOrganizacionRequerida";
import { BASE_PATH } from "@/lib/base-path";
import { SIN_ROL_DE_CREADOR, puedeCrearCampanas } from "@/lib/usuarios/rol-asignable";

export default function BotonCrearCampana({
  children,
  variant = "primary",
  size = "sm",
  className,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [verificando, setVerificando] = useState(false);
  const [ventanaAbierta, setVentanaAbierta] = useState(false);
  const [sinRol, setSinRol] = useState(false);
  const [error, setError] = useState("");

  async function crearCampana() {
    setVerificando(true);
    setError("");

    try {
      const response = await fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No se pudo verificar tu organización. Inténtalo de nuevo.");
      }

      const body = await response.json();
      const roles: string[] = Array.isArray(body.data?.role) ? body.data.role.map(String) : [];
      const organizacion = typeof body.data?.organizacion === "string"
        ? body.data.organizacion.trim()
        : "";

      if (!puedeCrearCampanas(roles)) {
        setSinRol(true);
      } else if (organizacion) {
        router.push("/mis-campanas/nueva");
      } else {
        setVentanaAbierta(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo verificar tu organización.");
    } finally {
      setVerificando(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={crearCampana}
        disabled={verificando}
      >
        {children}
      </Button>
      {error && <p role="alert" className="mt-2 text-[12px] text-error-700">{error}</p>}
      <VentanaDeOrganizacionRequerida
        abierto={ventanaAbierta}
        onCancelar={() => setVentanaAbierta(false)}
        onAgregar={() => router.push("/cuenta?resaltarOrganizacion=1#organizacion")}
      />
      <VentanaDeConfirmacion
        abierto={sinRol}
        titulo="No puedes crear campañas"
        ocultarCancelar
        textoConfirmar="Entendido"
        textoOcupado="Cerrando…"
        onCancelar={() => setSinRol(false)}
        onConfirmar={() => setSinRol(false)}
      >
        <p className="text-[13px] leading-5 text-system-700">{SIN_ROL_DE_CREADOR}</p>
      </VentanaDeConfirmacion>
    </>
  );
}
