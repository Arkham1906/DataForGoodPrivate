// Tabla aportes.csv que va dentro del ZIP de un conjunto de datos abierto (GET
// /api/datos/[id]/descarga), desde el 2026-10-07. Una fila por aporte aceptado, también los de
// solo texto. Sin nombre ni correo de quien participó (dominio.md § 9): quien tiene cuenta sale
// como "Participante N" (el mismo N para la misma persona dentro del conjunto) y quien aportó sin
// cuenta, como "Anónimo". Solo lo usa el route handler de la descarga.

import { DATA_TYPE_LABELS } from "@/lib/open-data";
import type { DataType } from "@/types";

export type FilaDeAporteAbierto = {
  /** Número del aporte dentro del conjunto (1, 2, 3...), el mismo del nombre de su archivo. */
  numero: number;
  /** Nombre del archivo dentro del ZIP, o "" si el aporte no tiene archivo (texto) o no se pudo leer. */
  archivo: string;
  usuarioId: number | null;
  /** El aporte llegó sin cuenta (por el enlace público). */
  sinCuenta: boolean;
  campana: string;
  ubicacion: string;
  descripcion: string;
  tipo: string;
};

const ENCABEZADOS = ["aporte", "archivo", "usuario", "campaña", "ubicación", "descripción", "tipo de aporte"];

/** "Centro, Tepic, Nayarit"; sin municipio, "Todo el estado, Nayarit" (dominio.md § 3). */
export function ubicacionDeCampana(estado: string | null, municipio: string | null, colonia: string | null): string {
  const partes = [colonia?.trim(), municipio?.trim() || (estado?.trim() ? "Todo el estado" : ""), estado?.trim()];
  return partes.filter(Boolean).join(", ");
}

/**
 * Una celda de CSV: entre comillas si lleva coma, comillas o saltos de línea. Un texto que empieza
 * con = + - @ (o tabulador/retorno) se antepone con ' para que Excel no lo ejecute como fórmula:
 * las descripciones las escribe cualquiera.
 */
function celda(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/**
 * El CSV completo, en UTF-8 con BOM y saltos de línea CRLF: así Excel lo abre con los acentos bien.
 * Las filas deben venir en orden de aporte; los seudónimos se asignan en ese orden.
 */
export function tablaDeAportesCsv(filas: FilaDeAporteAbierto[]): string {
  const seudonimos = new Map<number, number>();
  const lineas = [ENCABEZADOS.join(",")];
  for (const fila of filas) {
    let usuario: string;
    if (fila.usuarioId !== null) {
      if (!seudonimos.has(fila.usuarioId)) seudonimos.set(fila.usuarioId, seudonimos.size + 1);
      usuario = `Participante ${seudonimos.get(fila.usuarioId)}`;
    } else {
      // Sin user_id: aportó sin cuenta, o su cuenta se borró de la base (la llave queda en NULL).
      usuario = fila.sinCuenta ? "Anónimo" : "Cuenta eliminada";
    }
    const tipo = DATA_TYPE_LABELS[fila.tipo as DataType] ?? fila.tipo;
    lineas.push(
      [String(fila.numero), fila.archivo, usuario, fila.campana, fila.ubicacion, fila.descripcion, tipo].map(celda).join(","),
    );
  }
  return `﻿${lineas.join("\r\n")}\r\n`;
}
