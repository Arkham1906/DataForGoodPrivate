"use client";

// Botón de la tarjeta Contraseña en /cuenta y su ventana (<dialog> nativo). Con contraseña dice
// "Cambiar"; en una cuenta de Google sin contraseña, "Crear contraseña" (desde entonces entra de
// las dos formas). En los dos casos no se pide la contraseña actual: se manda un código al
// correo de la cuenta y con él se elige la nueva (ContrasenaConCodigo.tsx; decisión del usuario,
// 2026-10-07). La sesión sigue abierta.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ContrasenaConCodigo from "./ContrasenaConCodigo";

export default function CambiarContrasena({
  usuarioId,
  email,
  tieneContrasena,
}: {
  usuarioId: number;
  email: string;
  tieneContrasena: boolean;
}) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  // Cambia en cada apertura para que la ventana empiece de cero.
  const [apertura, setApertura] = useState(0);
  const creada = useRef(false);

  function abrir() {
    setApertura((n) => n + 1);
    dialogo.current?.showModal();
  }

  function cerrar() {
    dialogo.current?.close();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={abrir} className="shrink-0">
        {tieneContrasena ? "Cambiar" : "Crear contraseña"}
      </Button>

      <dialog
        ref={dialogo}
        aria-labelledby="contrasena-titulo"
        // Clic en el fondo (fuera de la caja): se cierra sin cambiar nada.
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        // Al cerrar después de crearla, la tarjeta se vuelve a pintar con "Cambiar".
        onClose={() => {
          if (creada.current) {
            creada.current = false;
            router.refresh();
          }
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
      >
        <ContrasenaConCodigo
          key={apertura}
          usuarioId={usuarioId}
          email={email}
          modo={tieneContrasena ? "cambiar" : "crear"}
          idTitulo="contrasena-titulo"
          onCerrar={cerrar}
          onGuardada={() => {
            if (!tieneContrasena) creada.current = true;
          }}
        />
      </dialog>
    </>
  );
}
