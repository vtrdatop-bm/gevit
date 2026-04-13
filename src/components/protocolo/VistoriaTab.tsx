import { useState, useEffect } from "react";
import { Vistoriador } from "@/types/user";
import {
  VistoriaData,
  computeProcessStatus,
  getCurrentVistoriadorId,
} from "@/lib/vistoriaStatus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  observacoes: string | null;
  dataRetorno: string | null;
  vistoriadorId: string | null;
  vistoriadores: Vistoriador[];
  processoId: string;
  vistoriaId: string;
  dataAtribuicao?: string | null;
  termo: TermoData | null;
  onUpdate: () => void;
}

const statusOptions = [
  { value: "pendencia", label: "Vistoria com pendência" },
  { value: "aprovado", label: "Certificado Provisório" },
  { value: "reprovado", label: "Certificado" },
];

export default function VistoriaTab({
  numero,
  dataSolicitacao,
  dataVistoria,
  statusVistoria,
  observacoes,
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
  const [obs, setObs] = useState(observacoes || "");
  const [retorno, setRetorno] = useState(dataRetorno || "");
  const [vistoriador, setVistoriador] = useState(vistoriadorId || "");
  const [atribuicao, setAtribuicao] = useState(dataAtribuicao || "");
  const [numeroTermo, setNumeroTermo] = useState(termo?.numero_termo || "");
  const [validadeTermo, setValidadeTermo] = useState(termo?.data_validade || "");
  const [saving, setSaving] = useState(false);

  // Sync Termo data if it loads later
  useEffect(() => {
    if (termo) {
      setNumeroTermo(termo.numero_termo || "");
      setValidadeTermo(termo.data_validade || "");
    }
  }, [termo]);

  useEffect(() => {
    setObs(observacoes || "");
  }, [observacoes]);

  const handleSave = async () => {
    if (!vistoriaId) {
      toast.error("Erro: Registro de vistoria não encontrado.");
      return;
    }

    setSaving(true);
    try {
      const vistoriaUpdate: any = {};
      if (numero === 1) {
        vistoriaUpdate.data_1_atribuicao = atribuicao || null;
        vistoriaUpdate.vistoriador_1_id = vistoriador || null;
        vistoriaUpdate.data_1_vistoria = data || null;
        vistoriaUpdate.status_1_vistoria = status || null;
        vistoriaUpdate.observacoes_1 = obs.trim() || null;
      } else if (numero === 2) {
        vistoriaUpdate.data_2_atribuicao = atribuicao || null;
        vistoriaUpdate.vistoriador_2_id = vistoriador || null;
        vistoriaUpdate.data_2_vistoria = data || null;
        vistoriaUpdate.status_2_vistoria = status || null;
        vistoriaUpdate.data_1_retorno = retorno || null;
        vistoriaUpdate.observacoes_2 = obs.trim() || null;
      } else {
        vistoriaUpdate.data_3_atribuicao = atribuicao || null;
        vistoriaUpdate.vistoriador_3_id = vistoriador || null;
        vistoriaUpdate.data_3_vistoria = data || null;
        vistoriaUpdate.status_3_vistoria = status || null;
        vistoriaUpdate.data_2_retorno = retorno || null;
        vistoriaUpdate.observacoes_3 = obs.trim() || null;
      }

      // Update the vistoria record
      const { error: vistError } = await supabase
        .from("vistorias")
        .update(vistoriaUpdate)
        .eq("id", vistoriaId);

      if (vistError) throw vistError;

      // Compute and update global process status
      const { data: latestVistData } = await supabase
        .from("vistorias")
        .select("*")
        .eq("id", vistoriaId)
        .single();

      if (latestVistData) {
        const newGlobalStatus = computeProcessStatus(latestVistData);
        const currentVistoriadorId = getCurrentVistoriadorId(null, latestVistData);

        const updatePayload: any = {
          status: newGlobalStatus || "regional",
          vistoriador_id: currentVistoriadorId || null
        };

        await supabase
          .from("processos")
          .update(updatePayload)
          .eq("id", processoId);
      }

      // Handle Termo de Compromisso if status is approved
      if (status === "aprovado" && (numeroTermo || validadeTermo)) {
        if (termo?.id) {
          await supabase
            .from("termos_compromisso")
            .update({
              numero_termo: numeroTermo,
              data_validade: validadeTermo || null,
            })
            .eq("id", termo.id);
        } else {
          await supabase.from("termos_compromisso").insert({
            processo_id: processoId,
            numero_termo: numeroTermo,
            data_validade: validadeTermo || null,
            data_assinatura: new Date().toISOString().split("T")[0],
          });
        }
      }

      toast.success("Dados salvos com sucesso!");
      onUpdate();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar dados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Stage specific top date */}
        {numero === 1 ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data de Solicitação</Label>
            <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {dataSolicitacao ? new Date(`${dataSolicitacao}T00:00:00`).toLocaleDateString("pt-BR") : "Não informada"}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`retorno-${numero}`} className="text-sm font-medium">Data do {numero - 1}º Retorno</Label>
            <Input
              id={`retorno-${numero}`}
              type="date"
              value={retorno}
              onChange={(e) => setRetorno(e.target.value)}
              className="h-9 w-full text-sm px-2 py-0 bg-background border-input min-w-0 box-border"
            />
          </div>
        )}

        {/* Attribution Date */}
        <div className="space-y-2 max-w-full">
          <Label htmlFor={`atribuicao-${numero}`} className="text-sm font-medium">Data da {numero}ª Atribuição</Label>
          <Input
            id={`atribuicao-${numero}`}
            type="date"
            value={atribuicao}
            onChange={(e) => setAtribuicao(e.target.value)}
            className="h-9 w-full text-sm px-2 py-0 bg-background border-input min-w-0 box-border"
          />
        </div>

        {/* Inspector Selector */}
        <div className="space-y-2">
          <Label htmlFor={`vistoriador-${numero}`} className="text-sm font-medium">Vistoriador</Label>
          <div className="relative">
            <Select value={vistoriador} onValueChange={setVistoriador}>
              <SelectTrigger
                id={`vistoriador-${numero}`}
                className="relative w-full pr-14 [&>svg]:absolute [&>svg]:right-3 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2"
              >
                <SelectValue placeholder="Selecione o vistoriador" />
              </SelectTrigger>
              <SelectContent>
                {vistoriadores.map((v) => (
                  <SelectItem key={v.user_id} value={v.user_id}>
                    {[v.patente, v.nome_guerra].filter(Boolean).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vistoriador && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setVistoriador("");
                }}
                className="absolute right-9 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Limpar vistoriador"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inspection Date */}
        <div className="space-y-2 max-w-full">
          <Label htmlFor={`data-vistoria-${numero}`} className="text-sm font-medium">Data da {numero}ª Vistoria</Label>
          <Input
            id={`data-vistoria-${numero}`}
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              if (!e.target.value) setStatus("");
            }}
            className="h-9 w-full text-sm px-2 py-0 bg-background border-input min-w-0 box-border"
          />
        </div>

        {/* Status Selector */}
        <div className="space-y-2">
          <Label htmlFor={`status-${numero}`} className="text-sm font-medium">
            Status da {numero}ª Vistoria
            {!data && <span className="text-[10px] text-muted-foreground ml-1">(preencha a data)</span>}
          </Label>
          <div className="relative">
            <Select value={status} onValueChange={setStatus} disabled={!data}>
              <SelectTrigger
                id={`status-${numero}`}
                className="relative w-full pr-14 [&>svg]:absolute [&>svg]:right-3 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2"
              >
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {status && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setStatus("");
                }}
                className="absolute right-9 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                title="Limpar status"
                disabled={!data}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Observacoes por etapa */}
        <div className="space-y-2">
          <Label htmlFor={`observacoes-${numero}`} className="text-sm font-medium">Observações</Label>
          <textarea
            id={`observacoes-${numero}`}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Digite observações desta vistoria"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </div>
      </div>

      {/* Termo de Compromisso (only when approved) */}
      {status === "aprovado" && (
        <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Termo de Compromisso
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`numero-termo-${numero}`}>Nº do Termo</Label>
              <Input
                id={`numero-termo-${numero}`}
                value={numeroTermo}
                onChange={(e) => setNumeroTermo(e.target.value)}
                placeholder="Ex.: 001/2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`validade-termo-${numero}`}>Validade do Certificado Provisório</Label>
              <Input
                id={`validade-termo-${numero}`}
                type="date"
                value={validadeTermo}
                onChange={(e) => setValidadeTermo(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="min-w-[120px]"
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
