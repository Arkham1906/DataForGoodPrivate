// Aceptación explícita durante la navegación, limitada a esta pestaña y campaña.
type Modo = "cuenta" | "anonimo";
const clave = (id: string, modo: Modo) => `acuerdos-aporte:${modo}:${id}`;
export function guardarAcuerdosPrevios(id: string, modo: Modo, proposito: string | null | undefined) {
  sessionStorage.setItem(clave(id, modo), JSON.stringify({ proposito: proposito ?? "", hasta: Date.now() + 3600000 }));
}
export function hayAcuerdosPrevios(id: string, modo: Modo, proposito: string | null | undefined): boolean {
  try {
    const dato = JSON.parse(sessionStorage.getItem(clave(id, modo)) ?? "null");
    return dato?.hasta > Date.now() && dato.proposito === (proposito ?? "");
  } catch { return false; }
}
export function borrarAcuerdosPrevios(id: string, modo: Modo) {
  try { sessionStorage.removeItem(clave(id, modo)); } catch { /* Sin almacenamiento disponible. */ }
}
