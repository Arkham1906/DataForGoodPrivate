// Layout raíz de toda la app: <html>, fuentes (next/font/local) y globals.css.
// Todas las rutas pasan por aquí; cada route group agrega su propio layout encima.

import type { Metadata } from "next";
import { PLANTILLA_DE_TITULO } from "@/lib/titulo";
import localFont from "next/font/local";
import "./globals.css";
import { BASE_PATH } from "@/lib/base-path";

// Fuentes en el repo (app/fuentes, 2026-10-28): con next/font/google el build fallaba sin
// acceso a Google Fonts. Variables, subconjunto latino (cubre el español), licencia OFL al lado.
const jakarta = localFont({
  src: "./fuentes/PlusJakartaSans-latin.woff2",
  weight: "200 800",
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fuentes/JetBrainsMono-latin.woff2",
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  // Cada pantalla declara el suyo y queda "Título · DataForGood" (WCAG 2.4.2: títulos que dicen dónde estás).
  title: { default: "DataForGood — Plataforma de crowdsourcing de datos", template: PLANTILLA_DE_TITULO },
  description:
    "DataForGood conecta organizaciones con personas dispuestas a aportar información en campo para causas sociales, ambientales y comunitarias.",
  // Favicon (public/icono.svg: el logo sin metadatos; el PNG para navegadores sin SVG) e ícono y modo
  // "app" al agregarla a la pantalla de inicio del iPhone (requisito para el push en iOS).
  // Las rutas de metadata no llevan el basePath solas.
  icons: {
    icon: [
      { url: `${BASE_PATH}/icono.svg`, type: "image/svg+xml" },
      { url: `${BASE_PATH}/icono-192.png`, type: "image/png", sizes: "192x192" },
    ],
    apple: `${BASE_PATH}/icono-192.png`,
  },
  appleWebApp: { capable: true, title: "DataForGood", statusBarStyle: "default" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${jakarta.variable} ${jetbrainsMono.variable} font-sans`}>
        {/* Primer elemento con Tab: salta menús y encabezado (WCAG 2.4.1). Invisible hasta recibir el foco.
            Cada <main> de la app lleva id="contenido". */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-white"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
