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
  vistoriador_1_id?: string | null;
  vistoriador_2_id?: string | null;
  vistoriador_3_id?: string | null;
  observacoes?: string | null;
}

export function computeDisplayStatus(
  dbStatus: string,
  vistoria?: VistoriaData | null,
  dataSolicitacao?: string | null
): DisplayStatus {
  // 1. Calculate the "natural" status first
  let status: DisplayStatus = dbStatus as DisplayStatus;

  if (vistoria) {
    // --- STAGE 3 ---
    if (vistoria.status_3_vistoria) {
      if (vistoria.status_3_vistoria === "pendencia") status = "expirado";
      else if (vistoria.status_3_vistoria === "aprovado") status = "certificado_termo";
      else if (vistoria.status_3_vistoria === "reprovado") status = "certificado";
    } else if (vistoria.data_3_atribuicao) {
      status = "atribuido";
    } else if (vistoria.data_2_retorno) {
      status = "regional";
    } 
    // --- STAGE 2 ---
    else if (vistoria.status_2_vistoria) {
      if (vistoria.status_2_vistoria === "pendencia") status = "pendencias";
      else if (vistoria.status_2_vistoria === "aprovado") status = "certificado_termo";
      else if (vistoria.status_2_vistoria === "reprovado") status = "certificado";
    } else if (vistoria.data_2_atribuicao) {
      status = "atribuido";
    } else if (vistoria.data_1_retorno) {
      status = "regional";
    }
    // --- STAGE 1 ---
    else if (vistoria.status_1_vistoria) {
      if (vistoria.status_1_vistoria === "pendencia") status = "pendencias";
      else if (vistoria.status_1_vistoria === "aprovado") status = "certificado_termo";
      else if (vistoria.status_1_vistoria === "reprovado") status = "certificado";
    } else if (vistoria.data_1_atribuicao) {
      status = "atribuido";
    }
  }

  // 2. Apply 1-year override if NOT certificado
  if (status !== "certificado" && dataSolicitacao) {
    const solDate = new Date(dataSolicitacao + "T00:00:00");
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (solDate < oneYearAgo) {
      return "expirado";
    }
  }

  return status;
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
  regional: "Aguardando vistoria",
  atribuido: "Atribuído",
  pendencias: "Vistoria com Pendência",
  certificado_termo: "Certificado Provisório",
  certificado: "Certificado",
  expirado: "Expirados",
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

export const RANK_ORDER = [
  "CEL BM", "TC BM", "MAJ BM", "CAP BM", "1º TEN BM", "2º TEN BM", "CAD BM", "ASP BM",
  "AL OF BM", "ST BM", "1º SGT BM", "2º SGT BM", "3º SGT BM", "AL SGT BM", "CB BM",
  "AL CB BM", "SD BM"
];

export function sortVistoriadores<T extends { patente?: string | null; nome_guerra: string | null }>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => {
    const rankA = RANK_ORDER.indexOf(a.patente || "");
    const rankB = RANK_ORDER.indexOf(b.patente || "");

    if (rankA !== rankB) {
      if (rankA === -1) return 1;
      if (rankB === -1) return -1;
      return rankA - rankB;
    }

    return (a.nome_guerra || "").localeCompare(b.nome_guerra || "");
  });
}
