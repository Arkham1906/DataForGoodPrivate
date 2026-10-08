// Manifiesto de la app web (/dataforgood/manifest.webmanifest). Permite agregar DataForGood a la pantalla
// de inicio del teléfono; en iPhone es requisito para recibir notificaciones push (iOS 16.4+).
// Íconos en public/icono-{192,512}.png, generados desde public/logo.svg.

import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/base-path";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DataForGood",
    short_name: "DataForGood",
    description: "Aporta datos en campo a campañas sociales, ambientales y comunitarias.",
    id: `${BASE_PATH}/`,
    start_url: `${BASE_PATH}/campanas`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#fbfaf8", // system-50 (app/globals.css)
    theme_color: "#2e5aac", // brand-600
    lang: "es-MX",
    icons: [
      { src: `${BASE_PATH}/icono-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icono-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icono-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
