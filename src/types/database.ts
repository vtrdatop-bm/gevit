/**
 * Centralized types for data objects used across the GEVIT application.
 */

export type ProcessStatus = "regional" | "pendencias" | "certificado_termo" | "certificado" | "expirado";

export interface ProtocoloData {
  id: string;
  numero: string;
  data_solicitacao: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  endereco: string;
  bairro: string;
  municipio: string;
  area: number | null;
  latitude: number | null;
  longitude: number | null;
  cep: string | null;
}

export interface VistoriaData {
  id: string;
  processo_id: string;
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

export interface ProcessoData {
  id: string;
  protocolo_id: string;
  status: string;
  regional_id: string | null;
  vistoriador_id: string | null;
  data_prevista: string | null;
  created_at?: string;
  protocolos?: Partial<ProtocoloData>;
}


export interface TermoData {
  id: string;
  processo_id: string;
  numero_termo: string;
  data_assinatura: string;
  data_validade: string;
}

export interface PausaData {
  id: string;
  processo_id: string;
  data_inicio: string;
  data_fim: string | null;
  etapa: string;
  motivo?: string | null;
}

export interface RegionalData {
  id: string;
  nome: string;
  municipios: string[];
}

export interface MunicipioData {
  id: string;
  nome: string;
}

export interface RegionalMunicipioData {
  regional_id: string;
  municipio_id: string;
}

