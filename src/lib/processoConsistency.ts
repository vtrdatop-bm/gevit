import { computeDeadline, type PausaData } from "@/lib/deadlineUtils";
import { computeDisplayStatus, type DisplayStatus, type VistoriaData } from "@/lib/vistoriaStatus";

interface ProcessoWithProtocolRef {
  protocolo_id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

function parseTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pickLatestProcessByProtocolo<T extends ProcessoWithProtocolRef>(processos: T[]): Record<string, T> {
  const map: Record<string, T> = {};

  processos.forEach((processo) => {
    const current = map[processo.protocolo_id];
    if (!current) {
      map[processo.protocolo_id] = processo;
      return;
    }

    const currentTs = Math.max(parseTimestamp(current.updated_at), parseTimestamp(current.created_at));
    const candidateTs = Math.max(parseTimestamp(processo.updated_at), parseTimestamp(processo.created_at));

    if (candidateTs >= currentTs) {
      map[processo.protocolo_id] = processo;
    }
  });

  return map;
}

interface ResolveDisplayStatusParams {
  dbStatus: string;
  vistoria?: VistoriaData | null;
  dataSolicitacao?: string | null;
  pausas?: PausaData[];
  termoValidade?: string | null;
}

export function resolveConsistentDisplayStatus({
  dbStatus,
  vistoria,
  dataSolicitacao,
  pausas = [],
  termoValidade = null,
}: ResolveDisplayStatusParams): DisplayStatus {
  const baseStatus = computeDisplayStatus(dbStatus, vistoria, dataSolicitacao);
  const deadline = computeDeadline(vistoria, pausas, baseStatus, termoValidade);

  if (deadline.active && deadline.remaining <= 0 && deadline.type === "expiration") {
    return "expirado";
  }

  return baseStatus;
}
