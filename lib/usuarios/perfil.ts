// Reglas de los campos del perfil, compartidas por el registro (POST /api/usuarios) y la
// edición (PATCH /api/usuarios/[id]). Sin dependencias de servidor.
//   - Largos máximos = tamaño de la columna en usuarios (lib/db-schema.ts): pasarse daba 500.
//   - Los intereses ya no se validan aquí: salen del catálogo de temáticas (lib/tematicas/catalogo.ts).

export const LARGO_MAXIMO = { nombre: 120, apellidos: 120, state: 100, city: 100, specialty: 150 } as const;

const ETIQUETA: Record<keyof typeof LARGO_MAXIMO, string> = {
  nombre: "El nombre",
  apellidos: "Los apellidos",
  state: "El estado",
  city: "El municipio",
  specialty: "La especialidad",
};

/** Mensaje para la persona si algún campo (de los que llegaron) es demasiado largo; si no, null. */
export function errorDeLargo(campos: Partial<Record<keyof typeof LARGO_MAXIMO, string | null | undefined>>): string | null {
  for (const [campo, maximo] of Object.entries(LARGO_MAXIMO) as [keyof typeof LARGO_MAXIMO, number][]) {
    const valor = campos[campo];
    if (typeof valor === "string" && valor.length > maximo) return `${ETIQUETA[campo]} no puede pasar de ${maximo} caracteres`;
  }
  return null;
}

