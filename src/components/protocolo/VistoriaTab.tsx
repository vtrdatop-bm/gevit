import { useState, useEffect } from "react";
import { Vistoriador } from "@/types/user";
import {
  VistoriaData,
  computeProcessStatus,
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
import { Calendar } from "lucide-react";
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
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
  { value: "pendencia", label: "Vistoria com Pendência" },
];

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

  // Sync Termo data if it loads later
  useEffect(() => {
    if (termo) {
      setNumeroTermo(termo.numero_termo || "");
      setValidadeTermo(termo.data_validade || "");
    }
  }, [termo]);

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
        vistoriaUpdate.data_1_retorno = retorno || null;
      } else if (numero === 2) {
        vistoriaUpdate.data_2_atribuicao = atribuicao || null;
        vistoriaUpdate.vistoriador_2_id = vistoriador || null;
        vistoriaUpdate.data_2_vistoria = data || null;
        vistoriaUpdate.status_2_vistoria = status || null;
        vistoriaUpdate.data_2_retorno = retorno || null;
      } else {
        vistoriaUpdate.data_3_atribuicao = atribuicao || null;
        vistoriaUpdate.vistoriador_3_id = vistoriador || null;
        vistoriaUpdate.data_3_vistoria = data || null;
        vistoriaUpdate.status_3_vistoria = status || null;
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
        if (newGlobalStatus) {
          await supabase
            .from("processos")
            .update({ status: newGlobalStatus as any })
            .eq("id", processoId);
        }
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stage specific top date */}
        {numero === 1 ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data de Solicitação</Label>
            <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {dataSolicitacao ? new Date(dataSolicitacao).toLocaleDateString("pt-BR") : "Não informada"}
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
            />
          </div>
        )}

        {/* Attribution Date */}
        <div className="space-y-2">
          <Label htmlFor={`atribuicao-${numero}`} className="text-sm font-medium">Data da {numero}ª Atribuição</Label>
          <Input
            id={`atribuicao-${numero}`}
            type="date"
            value={atribuicao}
            onChange={(e) => setAtribuicao(e.target.value)}
          />
        </div>

        {/* Inspector Selector */}
        <div className="space-y-2">
          <Label htmlFor={`vistoriador-${numero}`} className="text-sm font-medium">Vistoriador</Label>
          <Select value={vistoriador} onValueChange={setVistoriador}>
            <SelectTrigger id={`vistoriador-${numero}`} className="w-full">
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
        </div>

        {/* Inspection Date */}
        <div className="space-y-2">
          <Label htmlFor={`data-vistoria-${numero}`} className="text-sm font-medium">Data da {numero}ª Vistoria</Label>
          <Input
            id={`data-vistoria-${numero}`}
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              if (!e.target.value) setStatus("");
            }}
          />
        </div>

        {/* Status Selector */}
        <div className="space-y-2">
          <Label htmlFor={`status-${numero}`} className="text-sm font-medium">
            Status da {numero}ª Vistoria
            {!data && <span className="text-[10px] text-muted-foreground ml-1">(preencha a data)</span>}
          </Label>
          <Select value={status} onValueChange={setStatus} disabled={!data}>
            <SelectTrigger id={`status-${numero}`} className="w-full">
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
                placeholder="Ex: TC-001/2026"
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
