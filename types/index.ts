// Tipos centrales del proyecto. Reflejan el modelo de datos del backend
// y se usan para consumir la API real de campañas y usuarios.

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
  status: CampaignStatus;
  dataTypes: DataType[];
  collectionMode?: CollectionMode;
  /** Solo lectura de campañas viejas: hoy se usa checklistSecciones. */
  checklistOpciones?: string[];
  /** Checklists con título que el participante marca, además de la descripción obligatoria. */
  checklistSecciones?: { titulo: string; opciones: string[] }[];
  goalContributions: number;
  quotaPerUser: number;
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
  organizer?: string;
  xpPerContribution: number;
  isSpecial?: boolean;
  daysRemaining: number | null;
  hasReviewerAssigned: boolean;
  shareToken?: string;
  shareTokenExpiresAt?: string; // ISO datetime
  contributions?: Contribution[];
  /** Si el usuario en sesión la guardó. Ausente cuando no hay sesión. */
  isSaved?: boolean;
  /** El creador baneó de esta campaña a quien consulta (GET /api/campanas). */
  isBanned?: boolean;
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
  caracteristicas?: string[];
  status: ContributionStatus;
  submittedAt: string; // ISO datetime
  rejectionReason?: string;
  firstPassBy?: string; // nombre del revisor que decidió el aporte
  firstPassByUserId?: string;
  inapropiado?: boolean; // aporte anónimo marcado como "Contenido inapropiado"
  archivoBorrado?: boolean; // el creador borró el archivo de MinIO
  // Reporte del revisor al creador ("Reportar al creador"). Lo ven el creador y el revisor.
  reporte?: { motivo: string; revisor: string; en: string } | null;
  dispositivoBloqueadoId?: string | null; // solo al creador: bloqueo en la campaña del dispositivo anónimo
}

export interface ReviewerCandidate {
  id: string;
  name: string;
  email: string;
  currentRole: "Usuario común" | "Supervisor" | "Revisor de aportes";
  inviteStatus?: "pendiente";
}
