// Layout del grupo (auth): marco visual de entrar, registro, verificar, bienvenida, recuperar y root.
// No pide sesión. El grupo no aparece en la URL (/entrar, no /auth/entrar).

import Link from "next/link";
import Logo from "@/components/layout/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center"
        >
          <Logo />
        </Link>
        {children}
      </div>
    </div>
  );
}
