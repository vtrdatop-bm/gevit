export type ProcessStatus = "regional" | "pendencias" | "certificado_termo" | "certificado" | "expirado";

export interface Protocolo {
  id: string;
  numero: string;
  data_solicitacao: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  endereco: string;
  bairro: string;
  municipio: string;
  area: number;
  latitude: number;
  longitude: number;
}

export interface Processo {
  id: string;
  protocolo_id: string;
  protocolo: Protocolo;
  regional: string;
  vistoriador: string | null;
  vistoriador_id: string | null;
  status: ProcessStatus;
  data_prevista: string;
  dias_restantes: number;
}

export interface Vistoriador {
  id: string;
  nome: string;
  regional: string;
}

export const statusLabels: Record<ProcessStatus, string> = {
  regional: "Aguardando Vistoria",
  pendencias: "Vistoria com Pendência",
  certificado_termo: "Certificado Provisório",
  certificado: "Certificado",
  expirado: "Expirado",
};

export const statusColors: Record<ProcessStatus, string> = {
  regional: "status-risk",
  pendencias: "status-pending",
  certificado_termo: "status-term",
  certificado: "status-certified",
  expirado: "status-expired",
};
