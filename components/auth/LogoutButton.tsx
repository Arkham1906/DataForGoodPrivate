"use client";

// Botón "Cerrar sesión": POST /api/auth/logout y redirige a /entrar. Antes quita la suscripción push de
// este navegador, para que los avisos de esta cuenta no le lleguen a quien use el teléfono después.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";
import { desactivarPush } from "@/lib/notificaciones/registro-push";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await desactivarPush().catch(() => undefined);
      await fetch(`${BASE_PATH}/api/auth/logout`, { method: "POST" });
    } finally {
      router.push("/entrar");
      router.refresh();
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleLogout} disabled={loading}>
      {loading ? "Cerrando..." : "Cerrar sesión"}
    </Button>
  );
}
