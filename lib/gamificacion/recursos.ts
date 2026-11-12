// Rutas de los recursos gráficos de gamificación (tabla 4.5). Los archivos están en public/gamificacion/v1.
import { BASE_PATH } from "@/lib/base-path";

const BASE = `${BASE_PATH}/gamificacion/v1`;

/** «Árbol» → «arbol», «Rosa de los Vientos» → «rosa-de-los-vientos». */
function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export type LadoDeMedalla = 128 | 256 | 640;
export type LadoDeMision = 96 | 192 | 640;

/** Ilustración de un nivel: /gamificacion/v1/medallas/bosque_de_datos/3-arbusto@128.webp */
export function imagenDeMedalla(clave: string, nivel: number, nombreDelNivel: string, lado: LadoDeMedalla = 128): string {
  return `${BASE}/medallas/${clave}/${nivel}-${slug(nombreDelNivel)}@${lado}.webp`;
}

/** /gamificacion/v1/misiones/d_foto@96.webp, o null si la misión aún no tiene icono. */
export function iconoDeMision(clave: string, lado: LadoDeMision = 96): string | null {
  return MISIONES_CON_ICONO.has(clave) ? `${BASE}/misiones/${clave}@${lado}.webp` : null;
}

const MISIONES_CON_ICONO = new Set([
  "d_texto", "d_foto", "d_video", "d_audio", "d_documento", "aporte_multimedia",
  "d_un_aporte", "d_dos_aportes", "d_tres_aportes", "d_dos_tipos", "d_dos_campanas",
  "d_campana_nueva", "d_inscripcion", "tematica_nueva", "d_detalle_corto", "d_detalle_largo",
  "d_guardar", "d_interes", "d_especial", "d_un_aceptado", "dos_aceptados", "d_sobresaliente",
  "s_tres_dias", "s_cinco_dias", "s_tres_seguidos", "s_cinco_seguidos", "s_siete_seguidos",
  "s_cinco_aportes", "s_diez_aportes", "s_quince_aportes", "tres_tipos", "s_cuatro_tipos",
  "s_cinco_tipos", "s_tres_textos", "s_tres_fotos", "s_dos_videos", "s_dos_audios",
  "s_dos_documentos", "s_tres_campanas", "s_dos_campanas_nuevas", "s_dos_tematicas",
  "s_tres_tematicas", "s_dos_tematicas_nuevas", "cuota_de_campana", "s_dos_cuotas",
  "s_dos_inscripciones", "s_cinco_aceptados", "s_diez_aceptados", "s_dos_sobresalientes",
  "s_cuatro_sobresalientes", "s_excepcional", "guarda_campana", "s_tres_guardadas",
  "s_tres_interes", "s_tres_especial", "s_tres_detallados",
]);