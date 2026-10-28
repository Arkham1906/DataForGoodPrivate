/**
 * Temas de interés y temáticas de campaña: la misma lista, para que un
 * interés del perfil siempre corresponda a una temática que puede tener una
 * campaña. Se elige en /bienvenida y /cuenta (guardado en `usuarios.intereses`,
 * JSONB) y en el formulario de campaña (`campanas.tematica`). Sin
 * dependencias de servidor: lo importan Client Components y el dashboard de
 * usuarios del SuperUsuario.
 *
 * Desde el 2026-10-27 (a pedido del usuario) los nombres siguen un criterio: el de una causa
 * (específico) cuando la campaña busca cuidar o resolver algo, y uno general cuando es un gusto o
 * algo cotidiano. Por eso cinco se dividieron en causa + tema general (Protección animal / Animales,
 * Biodiversidad / Plantas y jardinería, Agricultura / Cocina y alimentación, Arte y cultura /
 * Entretenimiento, Deporte / Aire libre) y seis se renombraron (RENOMBRES_DE_TEMATICAS_BASE).
 * Cada tema general va junto a su causa. El orden de esta lista es el orden en que se ofrecen.
 */
export const TEMAS_DE_INTERES = [
  "Medio ambiente",
  "Salud",
  "Educación",
  "Infraestructura",
  "Protección animal",
  "Animales",
  "Movilidad",
  "Arte y cultura",
  "Entretenimiento",
  "Agua y saneamiento",
  "Calidad del aire",
  "Residuos y reciclaje",
  "Biodiversidad",
  "Plantas y jardinería",
  "Espacios públicos",
  "Seguridad",
  "Protección civil",
  "Accesibilidad e inclusión",
  "Igualdad de género",
  "Derechos humanos",
  "Gobierno y participación ciudadana",
  "Vivienda",
  "Agricultura",
  "Cocina y alimentación",
  "Trabajo y economía",
  "Tecnología",
  "Deporte",
  "Aire libre",
];

/**
 * Temáticas base que cambiaron de nombre el 2026-10-27: [antes, ahora]. Al arrancar
 * (lib/db-schema.ts, ensureTematicasTable) se renombran en el catálogo, en los intereses de los
 * perfiles y en las campañas; sus etiquetas las siguen por id. En las que se dividieron, lo que ya
 * existía se queda en la causa (la que conserva o hereda el nombre de antes).
 */
export const RENOMBRES_DE_TEMATICAS_BASE: [string, string][] = [
  ["Salud urbana", "Salud"],
  ["Seguridad ciudadana", "Seguridad"],
  ["Tecnología y conectividad", "Tecnología"],
  ["Transparencia y gobierno", "Gobierno y participación ciudadana"],
  ["Empleo y economía local", "Trabajo y economía"],
  ["Accesibilidad", "Accesibilidad e inclusión"],
  ["Cultura", "Arte y cultura"],
  ["Deporte y recreación", "Deporte"],
  ["Alimentación y agricultura", "Agricultura"],
];
