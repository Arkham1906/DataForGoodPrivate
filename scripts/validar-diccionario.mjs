// Valida el diccionario de subtemáticas (lib/etiquetas/sinonimos.ts) con las reglas de
// lib/etiquetas/validar-diccionario.ts. Uso: `npm run validar:diccionario` (desde la raíz).
// Termina con código 1 si hay problemas. Carga el TypeScript con jiti (viene con Tailwind y ESLint)
// y el alias "@/" del proyecto.

import { createJiti } from "jiti";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(pathToFileURL(path.join(raiz, "scripts", "validar-diccionario.mjs")).href, {
  alias: { "@": raiz },
});

const { problemasDelDiccionario } = await jiti.import(path.join(raiz, "lib", "etiquetas", "validar-diccionario.ts"));
const { DICCIONARIO_DE_SUBTEMATICAS } = await jiti.import(path.join(raiz, "lib", "etiquetas", "sinonimos.ts"));

const tematicas = Object.keys(DICCIONARIO_DE_SUBTEMATICAS).length;
const subtematicas = Object.values(DICCIONARIO_DE_SUBTEMATICAS).reduce((n, s) => n + Object.keys(s).length, 0);
const variantes = Object.values(DICCIONARIO_DE_SUBTEMATICAS).reduce(
  (n, s) => n + Object.values(s).reduce((m, v) => m + v.length, 0),
  0,
);

const problemas = problemasDelDiccionario();
if (problemas.length === 0) {
  console.log(`Diccionario válido: ${tematicas} temáticas, ${subtematicas} subtemáticas y ${variantes} variantes.`);
} else {
  console.error(`El diccionario tiene ${problemas.length} problema(s):`);
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}
