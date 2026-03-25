/**
 * Computes the remaining days before a process expires (120-day rule)
 * or until a Certificado Provisório validity expires.
 *
 * Logic:
 * - "certificado" status → no deadline
 * - "certificado_termo" status → days until termo validity date
 * - After 1ª vistoria → 120 calendar days until 1º retorno
 * - After 1º retorno → timer resets
 * - After 2ª vistoria → 120 calendar days until 2º retorno
 * - After 2º retorno → timer resets
 * - Pause periods (from `pausas` table) are subtracted from elapsed days
 */

export interface DeadlineVistoriaData {
  data_1_vistoria?: string | null;
  data_1_retorno?: string | null;
  data_2_vistoria?: string | null;
  data_2_retorno?: string | null;
}

export interface PausaData {
  data_inicio: string;
  data_fim: string | null;
  etapa: string;
}

export type DeadlineType = "expiration" | "validity";

export interface DeadlineResult {
  active: boolean;
  stage: number;
  remaining: number;
  type: DeadlineType;
}

const LIMIT = 120;

function countPauseDays(pausas: PausaData[], etapa: string, from: Date, to: Date): number {
  let total = 0;
  for (const p of pausas) {
    if (p.etapa !== etapa) continue;
    const pStart = new Date(p.data_inicio + "T00:00:00");
    const pEnd = p.data_fim ? new Date(p.data_fim + "T00:00:00") : new Date();
    const effectiveStart = pStart < from ? from : pStart;
    const effectiveEnd = pEnd > to ? to : pEnd;
    if (effectiveStart < effectiveEnd) {
      total += Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  return total;
}

export function computeDeadline(
  vistoria: DeadlineVistoriaData | null | undefined,
  pausas: PausaData[] = [],
  displayStatus?: string,
  termoValidade?: string | null
): DeadlineResult {
  // Certificado → no deadline at all
  if (displayStatus === "certificado") {
    return { active: false, stage: 0, remaining: 0, type: "expiration" };
  }

  // Certificado Provisório → days until termo validity
  if (displayStatus === "certificado_termo" && termoValidade) {
    const valDate = new Date(termoValidade + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const remaining = Math.ceil((valDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { active: true, stage: 0, remaining, type: "validity" };
  }

  if (!vistoria) return { active: false, stage: 0, remaining: LIMIT, type: "expiration" };

  // Stage 2: 2ª vistoria done, waiting for 2º retorno
  if (vistoria.data_2_vistoria && !vistoria.data_2_retorno) {
    const from = new Date(vistoria.data_2_vistoria + "T00:00:00");
    const now = new Date();
    const elapsed = Math.ceil((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const pauseDays = countPauseDays(pausas, "2", from, now);
    return { active: true, stage: 2, remaining: LIMIT - (elapsed - pauseDays), type: "expiration" };
  }

  // Stage 1: 1ª vistoria done, waiting for 1º retorno
  if (vistoria.data_1_vistoria && !vistoria.data_1_retorno) {
    const from = new Date(vistoria.data_1_vistoria + "T00:00:00");
    const now = new Date();
    const elapsed = Math.ceil((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const pauseDays = countPauseDays(pausas, "1", from, now);
    return { active: true, stage: 1, remaining: LIMIT - (elapsed - pauseDays), type: "expiration" };
  }

  return { active: false, stage: 0, remaining: LIMIT, type: "expiration" };
}

/** Returns a semantic color class based on remaining days */
export function deadlineColorClass(remaining: number): string {
  if (remaining <= 0) return "text-destructive";
  if (remaining <= 15) return "text-status-pending";
  if (remaining <= 30) return "text-status-term";
  return "text-muted-foreground";
}

/** Returns a background tint class for table rows or card borders */
export function deadlineBgClass(remaining: number): string {
  if (remaining <= 0) return "bg-destructive/10";
  if (remaining <= 15) return "bg-status-pending/10";
  if (remaining <= 30) return "bg-status-term/10";
  return "";
}

export function deadlineLabel(result: DeadlineResult): string | null {
  if (!result.active) return null;
  if (result.remaining <= 0) {
    return result.type === "validity" ? "Vencido" : "Expirado";
  }
  return `${result.remaining}d`;
}
