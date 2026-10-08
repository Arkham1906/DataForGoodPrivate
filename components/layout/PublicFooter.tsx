// Pie de página de las pantallas públicas.

import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="border-t border-system-200 px-6 py-8 text-center text-[12.5px] text-system-500">
      <p>© {new Date().getFullYear()} DataForGood — Plataforma de crowdsourcing de datos.</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
        <Link href="/sobre-nosotros" className="hover:text-system-900">
          Sobre nosotros
        </Link>
        <Link href="/privacidad" className="hover:text-system-900">
          Privacidad
        </Link>
        <Link href="/contacto" className="hover:text-system-900">
          Contacto
        </Link>
      </div>
    </footer>
  );
}
