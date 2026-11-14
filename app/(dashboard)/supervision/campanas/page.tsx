// Pantalla /supervision/campanas (2026-11-13, a pedido del usuario): la pestaña "Campañas" del supervisor, con las
// listas para trabajar (Por supervisar, supervisadas, reportadas o rechazadas y finalizadas; ListaDeSupervision.tsx,
// cliente). Hasta ese día estaban en /supervision, que ahora es el dashboard, y esta ruta era una lista aparte de
// las campañas supervisadas (la misma información que la categoría "Campañas supervisadas"), que se quitó.
// Acceso: el layout de /supervision exige sesión y rol "supervisor"; las APIs que lee lo vuelven a comprobar.

import type { Metadata } from "next";
import ListaDeSupervision from "../ListaDeSupervision";

export const metadata: Metadata = { title: "Campañas · Supervisión" };

export default function CampanasDeSupervisionPage() {
  return <ListaDeSupervision />;
}
