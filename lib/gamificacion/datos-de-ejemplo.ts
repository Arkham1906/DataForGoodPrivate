// Datos de ejemplo de la tabla de líderes (2026-10-13): personas inventadas para ver las pantallas
// mientras no hay lógica real. Solo los devuelve obtenerTablaDeLideres() (lib/gamificacion/clasificacion.ts)
// y la sección no se muestra en la landing salvo con MOSTRAR_TABLA_DE_LIDERES=si. Borrar este archivo
// cuando la clasificación lea de la base.

import type { Lider, TablaDeLideres } from "./tipos";

const personas: Omit<Lider, "valor" | "detalle">[] = [
  { usuarioId: -1, nombre: "Ana L.", avatar: "femenino" },
  { usuarioId: -2, nombre: "Diego M.", avatar: "masculino" },
  { usuarioId: -3, nombre: "Sofía R.", avatar: null },
  { usuarioId: -4, nombre: "Alex T.", avatar: "otro" },
  { usuarioId: -5, nombre: "Lucía G.", avatar: "femenino" },
  { usuarioId: -6, nombre: "Mateo C.", avatar: null },
];

function con(valores: number[], detalle?: (v: number) => string): Lider[] {
  return valores.map((valor, i) => ({ ...personas[i], valor, ...(detalle ? { detalle: detalle(valor) } : {}) }));
}

export const TABLA_DE_EJEMPLO: TablaDeLideres = {
  aportes: con([48, 41, 37, 29, 22, 18]),
  nivel: con([12, 10, 9, 9, 7, 6], (nivel) => `${new Intl.NumberFormat("es-MX").format(nivel * 250)} XP`),
  tematicas: [
    { tematica: "Medio ambiente", lideres: con([21, 17, 12, 9, 6, 4]) },
    { tematica: "Movilidad", lideres: con([15, 11, 8, 5, 3, 2]) },
    { tematica: "Educación", lideres: con([9, 7, 5]) },
  ],
};
