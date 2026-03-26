import { useState } from "react";
import { Vistoriador } from "@/types/user";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// interface Vistoriador mapping moved to @/types/user;

interface TermoData {
  id: string;
  processo_id: string;
  numero_termo: string;
  data_assinatura: string;
  data_validade: string;
}

interface VistoriaTabProps {
  numero: 1 | 2 | 3;
  dataSolicitacao: string;
  dataVistoria: string | null;
  statusVistoria: string | null;
  dataRetorno: string | null;
  vistoriadorId: string | null;
  vistoriadores: Vistoriador[];
  processoId: string;
  vistoriaId: string;
  dataAtribuicao: string | null;
  termo: TermoData | null;
  onUpdate: () => void;
}

const statusOptions = [
  { value: "pendencia", label: "Vistoria com Pendência" },
  { value: "aprovado", label: "Certificado Provisório" },
  { value: "reprovado", label: "Certificado" },
];

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelClass = "text-sm font-medium text-foreground";
const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function VistoriaTab({
  numero,
  dataSolicitacao,
  dataVistoria,
  statusVistoria,
  dataRetorno,
  vistoriadorId,
  vistoriadores,
  processoId,
  vistoriaId,
  dataAtribuicao,
  termo,
  onUpdate,
}: VistoriaTabProps) {
  const [data, setData] = useState(dataVistoria || "");
  const [status, setStatus] = useState(statusVistoria || "");
  const [retorno, setRetorno] = useState(dataRetorno || "");
  const [vistoriador, setVistoriador] = useState(vistoriadorId || "");
  const [atribuicao, setAtribuicao] = useState(dataAtribuicao || "");
  const [numeroTermo, setNumeroTermo] = useState(termo?.numero_termo || "");
  const [validadeTermo, setValidadeTermo] = useState(termo?.data_validade || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update vistoria fields
      const vistoriaUpdate: Record<string, string | null> = {};
      if (numero === 1) {
        vistoriaUpdate.data_1_atribuicao = atribuicao || null;
        vistoriaUpdate.data_1_vistoria = data || null;
        vistoriaUpdate.status_1_vistoria = status || null;
        if (status === "pendencia") {
          vistoriaUpdate.data_1_retorno = retorno || null;
        }
      } else if (numero === 2) {
        vistoriaUpdate.data_2_atribuicao = atribuicao || null;
        vistoriaUpdate.data_2_vistoria = data || null;
        vistoriaUpdate.status_2_vistoria = status || null;
        vistoriaUpdate.data_1_retorno = retorno || null;
        if (status === "pendencia") {
          vistoriaUpdate.data_2_retorno = retorno || null;
        }
      } else {
        vistoriaUpdate.data_3_atribuicao = atribuicao || null;
        vistoriaUpdate.data_3_vistoria = data || null;
        vistoriaUpdate.status_3_vistoria = status || null;
        vistoriaUpdate.data_2_retorno = retorno || null;
      }

      const vistColumn = `vistoriador_${numero}_id`;
      (vistoriaUpdate as any)[vistColumn] = vistoriador || null;

      const { error: vErr } = await supabase
        .from("vistorias")
        .update(vistoriaUpdate)
        .eq("id", vistoriaId);
      if (vErr) throw vErr;

      // Update global process inspector (fallback for UI that hasn't changed yet)
      const { error: pErr } = await supabase
        .from("processos")
        .update({ vistoriador_id: vistoriador || null })
        .eq("id", processoId);
      if (pErr) throw pErr;

      // Handle termo for "aprovado" (Certificado Provisório) on any tab
      if (status === "aprovado") {
        if (termo) {
          await supabase
            .from("termos_compromisso")
            .update({
              numero_termo: numeroTermo,
              data_validade: validadeTermo,
              data_assinatura: data || dataSolicitacao,
            })
            .eq("id", termo.id);
        } else if (numeroTermo) {
          await supabase.from("termos_compromisso").insert({
            processo_id: processoId,
            numero_termo: numeroTermo,
            data_validade: validadeTermo || dataSolicitacao,
            data_assinatura: data || dataSolicitacao,
          });
        }
      }

      // Calculate the global process status correctly by looking at ALL stages
      // We need the full vistoria data to do this accurately
      const { data: fullVistoria } = await supabase
        .from("vistorias")
        .select("*")
        .eq("id", vistoriaId)
        .single();

      if (fullVistoria) {
        const globalStatus = computeProcessStatus(fullVistoria);
        if (globalStatus) {
          await supabase.from("processos").update({ status: globalStatus as any }).eq("id", processoId);
        }
      }

      toast.success("Dados salvos com sucesso");
      onUpdate();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Data de Solicitação - only on 1st tab */}
        {numero === 1 && (
          <div className="space-y-1.5">
            <label className={labelClass}>Data de Solicitação</label>
            <input
              type="date"
              value={dataSolicitacao}
              disabled
              className={`${inputClass} bg-muted cursor-not-allowed`}
            />
          </div>
        )}

        {/* Data do 1º Retorno - only on 2nd tab */}
        {numero === 2 && (
          <div className="space-y-1.5">
            <label className={labelClass}>Data do 1º Retorno</label>
            <input
              type="date"
              value={retorno}
              onChange={(e) => setRetorno(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {/* Data do 2º Retorno - only on 3rd tab */}
        {numero === 3 && (
          <div className="space-y-1.5">
            <label className={labelClass}>Data do 2º Retorno</label>
            <input
              type="date"
              value={retorno}
              onChange={(e) => setRetorno(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {/* Data da atribuição */}
        <div className="space-y-1.5">
          <label className={labelClass}>Data da {numero}ª Atribuição</label>
          <input
            type="date"
            value={atribuicao}
            onChange={(e) => setAtribuicao(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Vistoriador */}
        <div className="space-y-1.5">
          <label className={labelClass}>Vistoriador</label>
          <select
            value={vistoriadorId || ""}
            onChange={(e) => setVistoriador(e.target.value)}
            title="Selecionar Vistoriador"
            className={selectClass}
          >
            <option value="">Selecione...</option>
            {vistoriadores.map((v) => (
              <option key={v.user_id} value={v.user_id}>
                {[v.patente, v.nome_guerra].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </div>

        {/* Data da vistoria */}
        <div className="space-y-1.5">
          <label className={labelClass}>Data da {numero}ª Vistoria</label>
          <input
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              if (!e.target.value) setStatus("");
            }}
            className={inputClass}
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            Status
            {!data && <span className="text-xs text-muted-foreground ml-1">(preencha a data da vistoria)</span>}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={!data}
            className={`${selectClass} ${!data ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <option value="">Selecione...</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Termo fields for Certificado Provisório */}
      {status === "aprovado" && (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-4">
          <p className="text-sm font-semibold text-foreground">Termo de Compromisso</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Nº do Termo de Compromisso</label>
              <input
                value={numeroTermo}
                onChange={(e) => setNumeroTermo(e.target.value)}
                placeholder="Ex: TC-001/2026"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Validade do Certificado Provisório</label>
              <input
                type="date"
                value={validadeTermo}
                onChange={(e) => setValidadeTermo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
