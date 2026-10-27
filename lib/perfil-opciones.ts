/**
 * Opciones de especialidad que ofrecen /bienvenida y la configuración de
 * cuenta. Sin dependencias de servidor: las usan Client Components.
 * Centralizadas para que ambas pantallas no se desalineen. Estado/municipio
 * salen de lib/mexico-geo.ts, no de aquí.
 *
 * Desde el 2026-10-26 (decisiones del usuario) la especialidad sale de un catálogo en la base
 * (tabla `especialidades`, lib/usuarios/especialidades.ts): empieza con ESPECIALIDADES y crece con
 * lo que escriben los usuarios, que se ofrece a todos desde que se guarda. El campo es uno solo:
 * se elige de la lista o se escribe (ui/CampoDeEspecialidad).
 */

import { esInapropiada } from "@/lib/tematicas/filtro";

/** Lista base, en orden alfabético (2026-10-26; antes eran 3). Se siembra en la tabla al arrancar. */
export const ESPECIALIDADES = [
  "Administración",
  "Agronomía",
  "Antropología",
  "Arquitectura",
  "Artes visuales",
  "Biología",
  "Ciencia de datos",
  "Ciencias ambientales",
  "Ciencias políticas",
  "Comercio",
  "Comunicación",
  "Contabilidad",
  "Derecho",
  "Diseño gráfico",
  "Economía",
  "Educación",
  "Enfermería",
  "Estudiante",
  "Farmacia",
  "Física",
  "Gastronomía",
  "Geografía",
  "Historia",
  "Ingeniería civil",
  "Ingeniería de software",
  "Ingeniería eléctrica",
  "Ingeniería industrial",
  "Ingeniería mecánica",
  "Ingeniería química",
  "Matemáticas",
  "Medicina",
  "Medicina veterinaria",
  "Música",
  "Nutrición",
  "Oficios técnicos",
  "Periodismo",
  "Protección civil",
  "Psicología",
  "Química",
  "Salud pública",
  "Sociología",
  "Trabajo social",
  "Turismo",
  "Urbanismo",
];

/** Largo de una especialidad (= columna usuarios.specialty y especialidades.nombre). */
export const LARGO_MAXIMO_DE_ESPECIALIDAD = 150;
const LARGO_MINIMO_DE_ESPECIALIDAD = 3;

/**
 * Clave de un catálogo del perfil (especialidades y organizaciones): "ingeniería AGRÍCOLA" e
 * "Ingenieria agricola" son la misma. Sin acentos, minúsculas, solo letras y números con espacios simples.
 */
export function claveDeCatalogo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** ¿Alguna palabra del texto está en el filtro de inapropiadas (lib/tematicas/filtro.ts)? */
function tienePalabraInapropiada(texto: string): boolean {
  return esInapropiada(texto) || texto.split(/[^\p{L}\p{N}@$]+/u).some((p) => p && esInapropiada(p));
}

/**
 * Especialidad escrita por la persona, limpia (espacios simples, primera letra en mayúscula), o el
 * error que se le muestra. Letras, espacios y . , - / ( ); de 3 a 150 caracteres; sin palabras del
 * filtro de inapropiadas (lib/tematicas/filtro.ts). La usan los formularios y el servidor.
 */
export function validarEspecialidad(entrada: string): { ok: true; nombre: string } | { ok: false; error: string } {
  const limpio = entrada.trim().replace(/\s+/g, " ");
  if (limpio.length < LARGO_MINIMO_DE_ESPECIALIDAD || limpio.length > LARGO_MAXIMO_DE_ESPECIALIDAD) {
    return { ok: false, error: `La especialidad debe tener entre ${LARGO_MINIMO_DE_ESPECIALIDAD} y ${LARGO_MAXIMO_DE_ESPECIALIDAD} caracteres` };
  }
  if (!/^\p{L}[\p{L} .,\-/()]*$/u.test(limpio)) {
    return { ok: false, error: "La especialidad solo puede tener letras, espacios y . , - / ( )" };
  }
  if (tienePalabraInapropiada(limpio)) {
    return { ok: false, error: "La especialidad tiene palabras que no se permiten" };
  }
  return { ok: true, nombre: limpio.charAt(0).toLocaleUpperCase("es-MX") + limpio.slice(1) };
}

/** Largo de una organización (= usuarios.organizacion, organizaciones.nombre y campanas.organizer). */
export const LARGO_MAXIMO_DE_ORGANIZACION = 160;

/**
 * Organización escrita por la persona (2026-10-26), limpia, o el error que se le muestra. Empieza con
 * letra o número; letras, números, espacios y . , & ' " - / ( ) # °; de 2 a 160 caracteres; sin
 * palabras del filtro de inapropiadas. Se respeta como la escribió ("iFixit", "A.C.").
 */
export function validarOrganizacion(entrada: string): { ok: true; nombre: string } | { ok: false; error: string } {
  const limpio = entrada.trim().replace(/\s+/g, " ");
  if (limpio.length < 2 || limpio.length > LARGO_MAXIMO_DE_ORGANIZACION) {
    return { ok: false, error: `La organización debe tener entre 2 y ${LARGO_MAXIMO_DE_ORGANIZACION} caracteres` };
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .,&'"\-/()#°]*$/u.test(limpio)) {
    return { ok: false, error: "La organización solo puede tener letras, números, espacios y . , & ' \" - / ( ) # °" };
  }
  if (tienePalabraInapropiada(limpio)) return { ok: false, error: "La organización tiene palabras que no se permiten" };
  return { ok: true, nombre: limpio };
}

/** Incluye el valor ya guardado aunque no esté en la lista fija, para no forzar un cambio al abrir el formulario. */
export function opcionesCon(valor: string | null | undefined, base: string[]): string[] {
  return valor && !base.includes(valor) ? [valor, ...base] : base;
}
