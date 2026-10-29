// Tipos centrales del proyecto. Reflejan el modelo de datos del backend
// y se usan para consumir la API real de campañas y usuarios.

import type { CampanaEspecial } from "@/lib/campanas/especial-reglas";
import type { PausaDeCampana } from "@/lib/campanas/pausa";
import type { RechazoDeCampana } from "@/lib/campanas/rechazo";
import type { EtiquetaDeCampana } from "@/lib/etiquetas/reglas";

export type CampaignStatus =
  | "borrador"
  | "en_revision"
  | "aceptada" // supervisor ya la aprobó, esperando a que llegue su fecha de inicio
  | "activa"
  | "pausada"
  | "finalizada"
  | "rechazada";

export type DataType = "texto" | "foto" | "video" | "audio" | "documento";

export type CollectionMode = "checklist" | "texto_libre";

export type ContributionStatus =
  | "pendiente"
  | "espera_final"
  | "aceptado"
  | "rechazado";

export type UserRole = "usuario" | "supervisor" | "revisor" | "admin";

export interface User {
  id: string;
  nombre?: string;
  apellidos?: string;
  alias?: string;
  email: string;
  avatarUrl?: string;
  state?: string;
  city?: string;
  specialty?: string;
  intereses?: string[];
  role?: UserRole;
  xpTotal: number;
  level: number;
  streakDays: number;
}

export interface Campaign {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  description: string;
  tag: string;
  tematica?: string;
  /** Subtemáticas de su temática (2026-10-27), hasta 5. Las pendientes solo le llegan al creador y a la supervisión. */
  etiquetas?: EtiquetaDeCampana[];
  /** ¿Para qué se usarán los datos? Valor de PROPOSITOS (lib/campanas/proposito.ts) y la frase de "Otro" (2026-10-27). */
  proposito?: string | null;
  propositoOtro?: string | null;
  status: CampaignStatus;
  dataTypes: DataType[];
  collectionMode?: CollectionMode;
  /** Solo lectura de campañas viejas: hoy se usa checklistSecciones. */
  checklistOpciones?: string[];
  /** Checklists con título que el participante marca, además de la descripción obligatoria. */
  /** Desde el 2026-10-28 cada uno lleva el tipo de dato al que pertenece; sin tipo, vale para todos. */
  checklistSecciones?: { titulo: string; opciones: string[]; tipo?: DataType }[];
  goalContributions: number;
  quotaPerUser: number;
  /** Límite TOTAL de aportes por tipo de dato (2026-10-28, opcional; lib/campanas/limite-por-tipo.ts). */
  limitePorTipo?: Partial<Record<DataType, number>>;
  /** Aportes no rechazados de cada tipo (lo que llena el límite). */
  enviadosPorTipo?: Partial<Record<DataType, number>>;
  currentContributions: number;
  approvedContributions: number;
  pendingContributions: number;
  rejectedContributions: number;
  participants: number;
  startDate: string | null; // ISO date
  startTime?: string | null; // "HH:MM", opcional
  endDate: string | null; // ISO date
  endTime?: string | null; // "HH:MM", opcional
  locationCity: string;
  locationState: string;
  locationColonia?: string;
  /** Para todo el país: sin estado, municipio ni colonia (lib/campanas/ubicacion.ts). */
  todoElPais?: boolean;
  organizer?: string;
  xpPerContribution: number;
  isSpecial?: boolean;
  /** Incentivos de campaña especial (lib/campanas/especial.ts), o null si no es especial. */
  especial?: CampanaEspecial | null;
  /** Quién la pausó y por qué (lib/campanas/pausa.ts), o null si no está pausada. */
  pausa?: PausaDeCampana | null;
  /** Por qué la rechazó la supervisión (lib/campanas/rechazo.ts); solo en ?mine=true y si sigue rechazada. */
  rechazo?: RechazoDeCampana | null;
  daysRemaining: number | null;
  hasReviewerAssigned: boolean;
  shareToken?: string;
  shareTokenExpiresAt?: string; // ISO datetime
  contributions?: Contribution[];
  /** Si el usuario en sesión la guardó. Ausente cuando no hay sesión. */
  isSaved?: boolean;
  /** El creador baneó de esta campaña a quien consulta (GET /api/campanas). */
  isBanned?: boolean;
  /** La creó quien consulta (GET /api/campanas). En /mis-aportes solo llega si la guardó. */
  isMine?: boolean;
  /** Aportes del usuario en sesión a esta campaña. Solo viene en /api/campanas?misAportes=true. */
  myContributionsCount?: number;
}

export interface Contribution {
  id: string;
  campaignId: string;
  campaignName: string;
  userId: string | null; // null = aporte anónimo
  participantName: string; // "Anónimo" cuando userId es null
  participantEmail?: string;
  description: string;
  fileType: DataType;
  fileSizeBytes?: number;
  sinArchivo?: boolean; // aporte de solo texto: la descripción es el dato (2026-10-14)
  caracteristicas?: string[];
  calificacion?: "bien" | "muy_bueno" | "excelente";
  status: ContributionStatus;
  /** Indica si la sesión actual puede revisar este aporte (no es quien lo envió). */
  canReview?: boolean;
  submittedAt: string; // ISO datetime
  rejectionReason?: string;
  firstPassBy?: string; // nombre del revisor que decidió el aporte
  firstPassByUserId?: string;
  inapropiado?: boolean; // aporte anónimo marcado como "Contenido inapropiado"
  archivoBorrado?: boolean; // el creador borró el archivo de MinIO
  // Reporte del revisor a supervisión ("Reportar a supervisión"). Solo lo ven los revisores.
  reporte?: { motivo: string; revisor: string; en: string } | null;
  /** Solo para el creador y los revisores: ya reportaste a quien aportó a la plataforma (2026-10-12). */
  participanteReportado?: boolean;
  dispositivoBloqueadoId?: string | null; // solo al creador: bloqueo en la campaña del dispositivo anónimo
}

export interface ReviewerCandidate {
  id: string;
  name: string;
  email: string;
  currentRole: "Usuario común" | "Supervisor" | "Revisor de aportes";
  inviteStatus?: "pendiente";
}
