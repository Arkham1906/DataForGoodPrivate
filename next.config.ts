import type { NextConfig } from "next";

// Subruta de publicación (p. ej. "/dataforgood"). Se fija en el build: Next
// la incrusta en el bundle del cliente, así que cambiarla exige recompilar.
// Sin BASE_PATH la app queda en la raíz, como en `next dev`.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Genera .next/standalone (server.js mínimo + solo los node_modules que se
  // usan en runtime), lo que usa el Dockerfile para no copiar node_modules
  // completo a la imagen. No hay servidor personalizado en este repo, así
  // que es compatible (ver AGENTS.md).
  output: "standalone",
  // /api/docs/spec lee openapi.yaml con fs; sin esto no llega a la imagen.
  outputFileTracingIncludes: {
    "/api/docs/spec": ["./openapi.yaml"],
  },
  basePath,
  experimental: {
    // Con proxy.ts, Next guarda en memoria el cuerpo de cada petición hasta este tope y
    // CORTA lo que sobra (por defecto 10 MB). Debe dejar pasar el archivo más grande de un
    // aporte (video, 50 MB: TAMANO_MAXIMO de lib/aportes/archivo.ts) más el resto del
    // formulario. Si subes el tope de un tipo, súbelo aquí y en el proxy del servidor.
    proxyClientMaxBodySize: 52_000_000,
  },
  // Sin "X-Powered-By: Next.js": no anunciar la tecnología.
  poweredByHeader: false,
  // Cabeceras de seguridad para todo (páginas y API). Sin CSP global: la ruta del
  // archivo de un aporte manda la suya, y una CSP completa necesita probar Google OAuth.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nadie puede incrustar la app en un iframe (clickjacking sobre /c/[token], paneles...).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Las URLs con token (/c/[token]) no se filtran completas a otros sitios.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La app no usa GPS ni cámara/micrófono del navegador (las fotos van por <input type="file">).
          { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
        ],
      },
      {
        // Service worker de las notificaciones push: siempre la versión más nueva y solo scripts propios.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  // Con basePath, la raíz del dominio queda en 404. Al abrir
  // http://localhost:3000/ se manda a la app. En producción el proxy solo
  // reenvía /dataforgood/..., así que esto no interfiere con otros sitios.
  async redirects() {
    if (!basePath) return [];
    return [{ source: "/", destination: basePath, basePath: false, permanent: false }];
  },
  env: {
    // Lo lee lib/base-path.ts para prefijar fetch, <img>, <a> y redirects.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
