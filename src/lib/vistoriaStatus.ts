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
  | "expirado";

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
}

export function computeDisplayStatus(
  dbStatus: string,
  vistoria?: VistoriaData | null
): DisplayStatus {
  // If DB status already reflects a result, use it
  if (
    dbStatus === "pendencias" ||
    dbStatus === "certificado_termo" ||
    dbStatus === "certificado" ||
    dbStatus === "expirado"
  ) {
    return dbStatus as DisplayStatus;
  }

  // Return date filled but next inspection not done → back to "aguardando vistoria"
  // Note: We check this before database "atribuido" to give priority to the return flow
  if (vistoria) {
    if (vistoria.data_2_retorno && !vistoria.data_3_vistoria && !vistoria.status_3_vistoria) return "regional";
    if (vistoria.data_1_retorno && !vistoria.data_2_vistoria && !vistoria.status_2_vistoria) return "regional";
  }

  // For "regional" or "pendencias" status, check vistoria data for virtual statuses
  if (dbStatus === "regional" && vistoria) {
    // Attribution without a result → "atribuído"
    if (vistoria.data_3_atribuicao && !vistoria.status_3_vistoria) return "atribuido";
    if (vistoria.data_2_atribuicao && !vistoria.status_2_vistoria) return "atribuido";
    if (vistoria.data_1_atribuicao && !vistoria.status_1_vistoria) return "atribuido";
  }

  return dbStatus as DisplayStatus;
}

export function getDisplayStatusLabel(
  status: DisplayStatus,
  vistoria?: VistoriaData | null
): string {
  if (status === "regional" && vistoria) {
    if (vistoria.data_2_retorno && !vistoria.data_3_vistoria && !vistoria.status_3_vistoria) {
      return "Aguardando Vistoria 3ª vist.";
    }
    if (vistoria.data_1_retorno && !vistoria.data_2_vistoria && !vistoria.status_2_vistoria) {
      return "Aguardando Vistoria 2ª vist.";
    }
  }
  return displayStatusLabels[status] || status;
}

export function computeStage(vistoria?: VistoriaData | null): VistoriaStage {
  if (!vistoria) return null;

  // The stage reflects the latest inspection that has a result or is in progress
  if (vistoria.status_3_vistoria || vistoria.data_3_vistoria) return 3;
  if (vistoria.status_2_vistoria || vistoria.data_2_vistoria) return 2;
  if (vistoria.status_1_vistoria || vistoria.data_1_vistoria) return 1;

  // If no result yet, stage is based on attribution/return dates
  if (vistoria.data_2_retorno || vistoria.data_3_atribuicao) return 3;
  if (vistoria.data_1_retorno || vistoria.data_2_atribuicao) return 2;
  return 1;
}

export const displayStatusLabels: Record<DisplayStatus, string> = {
  regional: "Aguardando Vistoria",
  atribuido: "Atribuído",
  pendencias: "Vistoria com Pendência",
  certificado_termo: "Certificado Provisório",
  certificado: "Certificado",
  expirado: "Expirado",
};

export const displayStatusBadgeClass: Record<DisplayStatus, string> = {
  regional: "status-badge-risk",
  atribuido: "status-badge-assigned",
  pendencias: "status-badge-pending",
  certificado_termo: "status-badge-term",
  certificado: "status-badge-certified",
  expirado: "status-badge-expired",
};

export const displayStatusDotColor: Record<DisplayStatus, string> = {
  regional: "bg-[hsl(var(--status-risk))]",
  atribuido: "bg-[hsl(var(--status-assigned))]",
  pendencias: "bg-[hsl(var(--status-pending))]",
  certificado_termo: "bg-[hsl(var(--status-certified-term))]",
  certificado: "bg-[hsl(var(--status-certified))]",
  expirado: "bg-[hsl(var(--status-expired))]",
};
