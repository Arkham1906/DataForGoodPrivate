"use client";

// Botón de creación que verifica la organización del perfil antes de abrir el formulario.

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import VentanaDeOrganizacionRequerida from "@/components/campanas/VentanaDeOrganizacionRequerida";
import { BASE_PATH } from "@/lib/base-path";

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
      const organizacion = typeof body.data?.organizacion === "string"
        ? body.data.organizacion.trim()
        : "";

      if (organizacion) {
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
    </>
  );
}
