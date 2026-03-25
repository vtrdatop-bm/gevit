export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bairros: {
        Row: {
          created_at: string
          id: string
          municipio: string
          nome: string
          regional_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          municipio: string
          nome: string
          regional_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          municipio?: string
          nome?: string
          regional_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bairros_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
        ]
      }
      municipios: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          lida: boolean
          processo_id: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          processo_id?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          processo_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      pausas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          etapa: string
          id: string
          motivo: string | null
          processo_id: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          etapa: string
          id?: string
          motivo?: string | null
          processo_id: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          etapa?: string
          id?: string
          motivo?: string | null
          processo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pausas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          created_at: string
          data_prevista: string | null
          id: string
          prazo_pausado: boolean
          protocolo_id: string
          regional_id: string | null
          status: Database["public"]["Enums"]["process_status"]
          updated_at: string
          vistoriador_id: string | null
        }
        Insert: {
          created_at?: string
          data_prevista?: string | null
          id?: string
          prazo_pausado?: boolean
          protocolo_id: string
          regional_id?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          updated_at?: string
          vistoriador_id?: string | null
        }
        Update: {
          created_at?: string
          data_prevista?: string | null
          id?: string
          prazo_pausado?: boolean
          protocolo_id?: string
          regional_id?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          updated_at?: string
          vistoriador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          login: string | null
          nome_completo: string
          patente: string | null
          regional_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          login?: string | null
          nome_completo: string
          patente?: string | null
          regional_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          login?: string | null
          nome_completo?: string
          patente?: string | null
          regional_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolos: {
        Row: {
          area: number | null
          bairro: string
          cep: string | null
          cnpj: string
          created_at: string
          data_solicitacao: string
          endereco: string
          id: string
          latitude: number | null
          longitude: number | null
          municipio: string
          nome_fantasia: string | null
          numero: string
          razao_social: string
          solicitante: string | null
          tipo_empresa: string | null
          tipo_servico: string | null
          updated_at: string
        }
        Insert: {
          area?: number | null
          bairro: string
          cep?: string | null
          cnpj: string
          created_at?: string
          data_solicitacao: string
          endereco: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipio: string
          nome_fantasia?: string | null
          numero: string
          razao_social: string
          solicitante?: string | null
          tipo_empresa?: string | null
          tipo_servico?: string | null
          updated_at?: string
        }
        Update: {
          area?: number | null
          bairro?: string
          cep?: string | null
          cnpj?: string
          created_at?: string
          data_solicitacao?: string
          endereco?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipio?: string
          nome_fantasia?: string | null
          numero?: string
          razao_social?: string
          solicitante?: string | null
          tipo_empresa?: string | null
          tipo_servico?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      regionais: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      regionais_municipios: {
        Row: {
          id: string
          municipio_id: string
          regional_id: string
        }
        Insert: {
          id?: string
          municipio_id: string
          regional_id: string
        }
        Update: {
          id?: string
          municipio_id?: string
          regional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regionais_municipios_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regionais_municipios_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_compromisso: {
        Row: {
          created_at: string
          data_assinatura: string
          data_validade: string
          id: string
          numero_termo: string
          processo_id: string
        }
        Insert: {
          created_at?: string
          data_assinatura: string
          data_validade: string
          id?: string
          numero_termo: string
          processo_id: string
        }
        Update: {
          created_at?: string
          data_assinatura?: string
          data_validade?: string
          id?: string
          numero_termo?: string
          processo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "termos_compromisso_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: true
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vistorias: {
        Row: {
          created_at: string
          data_1_atribuicao: string | null
          data_1_retorno: string | null
          data_1_vistoria: string | null
          data_2_atribuicao: string | null
          data_2_retorno: string | null
          data_2_vistoria: string | null
          data_3_atribuicao: string | null
          data_3_vistoria: string | null
          id: string
          observacoes: string | null
          processo_id: string
          status_1_vistoria:
            | Database["public"]["Enums"]["inspection_result"]
            | null
          status_2_vistoria:
            | Database["public"]["Enums"]["inspection_result"]
            | null
          status_3_vistoria:
            | Database["public"]["Enums"]["inspection_result"]
            | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_1_atribuicao?: string | null
          data_1_retorno?: string | null
          data_1_vistoria?: string | null
          data_2_atribuicao?: string | null
          data_2_retorno?: string | null
          data_2_vistoria?: string | null
          data_3_atribuicao?: string | null
          data_3_vistoria?: string | null
          id?: string
          observacoes?: string | null
          processo_id: string
          status_1_vistoria?:
            | Database["public"]["Enums"]["inspection_result"]
            | null
          status_2_vistoria?:
            | Database["public"]["Enums"]["inspection_result"]
            | null
          status_3_vistoria?:
            | Database["public"]["Enums"]["inspection_result"]
            | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_1_atribuicao?: string | null
          data_1_retorno?: string | null
          data_1_vistoria?: string | null
          data_2_atribuicao?: string | null
          data_2_retorno?: string | null
          data_2_vistoria?: string | null
          data_3_atribuicao?: string | null
          data_3_vistoria?: string | null
          id?: string
          observacoes?: string | null
          processo_id?: string
          status_1_vistoria?:
            | Database["public"]["Enums"]["inspection_result"]
            | null
          status_2_vistoria?:
            | Database["public"]["Enums"]["inspection_result"]
            | null
          status_3_vistoria?:
            | Database["public"]["Enums"]["inspection_result"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistorias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "distribuidor" | "vistoriador"
      inspection_result: "aprovado" | "pendencia" | "reprovado"
      process_status:
        | "regional"
        | "pendencias"
        | "certificado_termo"
        | "certificado"
        | "expirado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "distribuidor", "vistoriador"],
      inspection_result: ["aprovado", "pendencia", "reprovado"],
      process_status: [
        "regional",
        "pendencias",
        "certificado_termo",
        "certificado",
        "expirado",
      ],
    },
  },
} as const
