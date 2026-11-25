"use client";

// Botón "Pendientes" de la barra superior (2026-11-24, a pedido del usuario: sale del menú lateral). Ícono de
// portapapeles con reloj (IconoPendientes) con el número en rojo, junto a la campana de notificaciones; lleva a
// /pendientes (zona de usuario, TopBar) o a /sistema/pendientes (panel del SuperUsuario, sistema/Topbar). Como está en
// la barra, también se ve en el teléfono, donde el recuadro azul del menú no sale. El número lo cuenta el servidor
// (lib/pendientes) y se actualiza con cada router.refresh de ActualizacionEnVivo. Marcado (aria-current) mientras se
// está en esa pantalla.
// La etiqueta al pasar el cursor ("Pendientes" y debajo cuántos) la pone ui/EtiquetasEmergentes con el aria-label,
// como en todo control que solo lleva un ícono.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconoPendientes } from "@/components/sistema/icons";

function cuantos(cantidad: number): string {
  if (cantidad === 0) return "todo al día";
  return `${cantidad} ${cantidad === 1 ? "pendiente" : "pendientes"}`;
}

export default function BotonDePendientes({ href, cantidad }: { href: string; cantidad: number }) {
  const pathname = usePathname();
  const aqui = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-label={`Pendientes: ${cuantos(cantidad)}`}
      aria-current={aqui ? "page" : undefined}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
        aqui ? "bg-brand-50 text-brand-600" : "text-system-600 hover:bg-system-100"
      }`}
    >
      <IconoPendientes className="h-[19px] w-[19px]" />
      {cantidad > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-700 px-1 text-[10px] font-bold text-white"
        >
          {cantidad > 99 ? "99+" : cantidad}
        </span>
      )}
    </Link>
  );
}
