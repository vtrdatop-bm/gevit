/**
 * Computes the effective display status and current stage (1ª/2ª/3ª Vistoria)
 * from vistoria data. "Atribuído" is a virtual status shown when an attribution
 * date exists but no inspection result has been recorded yet.
 */

export type DisplayStatus =
  | "regional"
  | "atribuido"
  | "pendencias"
  | "certificado_termo"
  | "certificado"
  | "expirado"
  | "expirado_3_vist";

export type VistoriaStage = 1 | 2 | 3 | null;

export interface VistoriaData {
  data_1_atribuicao?: string | null;
  data_2_atribuicao?: string | null;
  data_3_atribuicao?: string | null;
  data_1_vistoria?: string | null;
  data_2_vistoria?: string | null;
  data_3_vistoria?: string | null;
  status_1_vistoria?: string | null;
  status_2_vistoria?: string | null;
  status_3_vistoria?: string | null;
  data_1_retorno?: string | null;
  data_2_retorno?: string | null;
  vistoriador_1_id?: string | null;
  vistoriador_2_id?: string | null;
  vistoriador_3_id?: string | null;
  observacoes?: string | null;
}

export function computeDisplayStatus(
  dbStatus: string,
  vistoria?: VistoriaData | null
): DisplayStatus {
  // If no vistoria data, fall back to DB status
  if (!vistoria) return dbStatus as DisplayStatus;

  // We determine the status by looking from the latest stage backwards.
  // The goal is to show the *current* activity.

  // --- STAGE 3 ---
  // If 3ª vistoria has a result, that's the final word
  if (vistoria.status_3_vistoria) {
    if (vistoria.status_3_vistoria === "pendencia") return "expirado_3_vist";
    if (vistoria.status_3_vistoria === "aprovado") return "certificado_termo";
    if (vistoria.status_3_vistoria === "reprovado") return "certificado";
  }
  // If 3ª attribution is set but no result yet -> "atribuido"
  if (vistoria.data_3_atribuicao) return "atribuido";
  // If 2º retorno is set -> "regional" (waiting for 3rd visit)
  if (vistoria.data_2_retorno) return "regional";

  // --- STAGE 2 ---
  // If 2ª vistoria has a result
  if (vistoria.status_2_vistoria) {
    if (vistoria.status_2_vistoria === "pendencia") return "pendencias";
    if (vistoria.status_2_vistoria === "aprovado") return "certificado_termo";
    if (vistoria.status_2_vistoria === "reprovado") return "certificado";
  }
  // If 2ª attribution is set
  if (vistoria.data_2_atribuicao) return "atribuido";
  // If 1º retorno is set
  if (vistoria.data_1_retorno) return "regional";

  // --- STAGE 1 ---
  // If 1ª vistoria has a result
  if (vistoria.status_1_vistoria) {
    if (vistoria.status_1_vistoria === "pendencia") return "pendencias";
    if (vistoria.status_1_vistoria === "aprovado") return "certificado_termo";
    if (vistoria.status_1_vistoria === "reprovado") return "certificado";
  }
  // If 1ª attribution is set
  if (vistoria.data_1_atribuicao) return "atribuido";

  // Fallback to base DB status (e.g. regional or expired)
  return dbStatus as DisplayStatus;
}

export function getDisplayStatusLabel(
  status: DisplayStatus,
  vistoria?: VistoriaData | null
): string {
  return displayStatusLabels[status] || status;
}

export function computeStage(vistoria?: VistoriaData | null): VistoriaStage {
  if (!vistoria) return 1;

  // The stage reflects the latest inspection that has ANY activity.
  // We check from the most advanced stage downwards.
  
  // STAGE 3: Result, Visit Date, Attribution, or coming from 2nd Return
  if (
    vistoria.status_3_vistoria || 
    vistoria.data_3_vistoria || 
    vistoria.data_3_atribuicao || 
    vistoria.data_2_retorno
  ) return 3;

  // STAGE 2: Result, Visit Date, Attribution, or coming from 1st Return
  if (
    vistoria.status_2_vistoria || 
    vistoria.data_2_vistoria || 
    vistoria.data_2_atribuicao || 
    vistoria.data_1_retorno
  ) return 2;

  // Default to stage 1
  return 1;
}

/**
 * Determines the "current" inspector ID based on the latest filled stage.
 */
export function getCurrentVistoriadorId(
  dbVistoriadorId: string | null,
  vistoria?: VistoriaData | null
): string | null {
  if (!vistoria) return dbVistoriadorId;

  // Check from latest stage downwards
  if (vistoria.data_3_atribuicao || vistoria.vistoriador_3_id) return vistoria.vistoriador_3_id;
  if (vistoria.data_2_atribuicao || vistoria.vistoriador_2_id) return vistoria.vistoriador_2_id;
  if (vistoria.data_1_atribuicao || vistoria.vistoriador_1_id) return vistoria.vistoriador_1_id || dbVistoriadorId;

  return dbVistoriadorId;
}

export const displayStatusLabels: Record<DisplayStatus, string> = {
  regional: "Aguardando Vistoria",
  atribuido: "Atribuído",
  pendencias: "Vistoria com Pendência",
  certificado_termo: "Certificado Provisório",
  certificado: "Certificado",
  expirado: "Expirado",
  expirado_3_vist: "Expirado - 3 Vist.",
};

export const displayStatusBadgeClass: Record<DisplayStatus, string> = {
  regional: "status-badge-risk",
  atribuido: "status-badge-assigned",
  pendencias: "status-badge-pending",
  certificado_termo: "status-badge-term",
  certificado: "status-badge-certified",
  expirado: "status-badge-expired",
  expirado_3_vist: "status-badge-expired",
};

export const displayStatusDotColor: Record<DisplayStatus, string> = {
  regional: "bg-[hsl(var(--status-risk))]",
  atribuido: "bg-[hsl(var(--status-assigned))]",
  pendencias: "bg-[hsl(var(--status-pending))]",
  certificado_termo: "bg-[hsl(var(--status-certified-term))]",
  certificado: "bg-[hsl(var(--status-certified))]",
  expirado: "bg-[hsl(var(--status-expired))]",
  expirado_3_vist: "bg-[hsl(var(--status-expired))]",
};

/**
 * Computes the overall process_status enum for the database based on the latest result.
 */
export function computeProcessStatus(vistoria: VistoriaData): string | null {
  // Check from stage 3 down to 1
  for (let i = 3; i >= 1; i--) {
    const s = (vistoria as any)[`status_${i}_vistoria`];
    if (s === "pendencia") return "pendencias";
    if (s === "aprovado") return "certificado_termo";
    if (s === "reprovado") return "certificado";
  }
  return null;
}
