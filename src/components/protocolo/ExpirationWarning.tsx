import { useState, useMemo } from "react";
import { AlertTriangle, Clock, Pause, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeDeadline, deadlineColorClass } from "@/lib/deadlineUtils";

interface PausaData {
  id: string;
  data_inicio: string;
  data_fim: string | null;
  etapa: string;
  motivo: string | null;
}

interface ExpirationWarningProps {
  vistoria: {
    data_1_vistoria: string | null;
    data_1_retorno: string | null;
    data_2_vistoria: string | null;
    data_2_retorno: string | null;
  };
  pausas: PausaData[];
  processoId: string;
  displayStatus?: string;
  termoValidade?: string | null;
  onUpdate: () => void;
}

export default function ExpirationWarning({ vistoria, pausas, processoId, displayStatus, termoValidade, onUpdate }: ExpirationWarningProps) {
  const [showPausas, setShowPausas] = useState(false);
  const [addingPausa, setAddingPausa] = useState(false);
  const [pausaInicio, setPausaInicio] = useState("");
  const [pausaFim, setPausaFim] = useState("");
  const [pausaMotivo, setPausaMotivo] = useState("");
  const [pausaEtapa, setPausaEtapa] = useState("1");
  const [saving, setSaving] = useState(false);

  const deadline = useMemo(() => computeDeadline(vistoria, pausas, displayStatus, termoValidade), [vistoria, pausas, displayStatus, termoValidade]);

  const handleAddPausa = async () => {
    if (!pausaInicio) return;
    setSaving(true);
    const { error } = await supabase.from("pausas").insert({
      processo_id: processoId,
      data_inicio: pausaInicio,
      data_fim: pausaFim || null,
      etapa: pausaEtapa,
      motivo: pausaMotivo || null,
    });
    if (error) {
      toast.error("Erro ao salvar pausa: " + error.message);
    } else {
      toast.success("Pausa registrada!");
      setPausaInicio("");
      setPausaFim("");
      setPausaMotivo("");
      setAddingPausa(false);
      onUpdate();
    }
    setSaving(false);
  };

  const handleDeletePausa = async (id: string) => {
    const { error } = await supabase.from("pausas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir pausa: " + error.message);
    } else {
      toast.success("Pausa removida!");
      onUpdate();
    }
  };

  if (!deadline.active) return null;

  const isExpired = deadline.remaining <= 0;
  const isUrgent = deadline.remaining > 0 && deadline.remaining <= 15;
  const isWarning = deadline.remaining > 15 && deadline.remaining <= 30;

  const inputClass =
    "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const activePausas = pausas.filter((p) => p.etapa === String(deadline.stage));

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        isExpired && "bg-destructive/10 border-destructive/40",
        isUrgent && "bg-status-pending/10 border-status-pending/40",
        isWarning && "bg-status-term/10 border-status-term/40",
        !isExpired && !isUrgent && !isWarning && "bg-muted/50 border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isExpired ? (
            <AlertTriangle className="w-5 h-5 text-destructive" />
          ) : isUrgent ? (
            <AlertTriangle className="w-5 h-5 text-status-pending" />
          ) : (
            <Clock className="w-5 h-5 text-muted-foreground" />
          )}
          <div>
            <p className={cn(
              "text-sm font-semibold",
              isExpired && "text-destructive",
              isUrgent && "text-status-pending"
            )}>
              {isExpired
                ? (deadline.type === "validity" ? "Certificado vencido!" : "Prazo expirado!")
                : `${deadline.remaining} dias restantes`}
            </p>
            <p className="text-xs text-muted-foreground">
              {deadline.type === "validity"
                ? "Validade do Certificado Provisório"
                : `Prazo de 120 dias — ${deadline.stage}ª Vistoria → ${deadline.stage}º Retorno`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowPausas(!showPausas)}
          className="flex items-center gap-1 px-2 h-7 rounded-md border border-input text-xs font-medium hover:bg-accent transition-colors"
        >
          <Pause className="w-3 h-3" />
          Pausas ({activePausas.length})
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isExpired && "bg-destructive",
            isUrgent && "bg-status-pending",
            isWarning && "bg-status-term",
            !isExpired && !isUrgent && !isWarning && "bg-primary"
          )}
          style={{ width: `${Math.max(0, Math.min(100, ((120 - deadline.remaining) / 120) * 100))}%` }}
        />
      </div>

      {/* Pausas section */}
      {showPausas && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Pausas da {deadline.stage}ª etapa</p>
            <button
              onClick={() => {
                setPausaEtapa(String(deadline.stage));
                setAddingPausa(!addingPausa);
              }}
              className="flex items-center gap-1 px-2 h-6 rounded text-xs font-medium text-primary hover:bg-accent transition-colors"
            >
              <Plus className="w-3 h-3" />
              Adicionar
            </button>
          </div>

          {activePausas.length === 0 && !addingPausa && (
            <p className="text-xs text-muted-foreground">Nenhuma pausa registrada nesta etapa.</p>
          )}

          {activePausas.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-background rounded-md border border-border px-3 py-2">
              <div className="text-xs">
                <span className="font-medium">
                  {new Date(p.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}
                  {" → "}
                  {p.data_fim ? new Date(p.data_fim + "T00:00:00").toLocaleDateString("pt-BR") : "Em andamento"}
                </span>
                {p.motivo && <span className="text-muted-foreground ml-2">({p.motivo})</span>}
              </div>
              <button
                onClick={() => handleDeletePausa(p.id)}
                className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {addingPausa && (
            <div className="bg-background rounded-md border border-border p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Início</label>
                  <input type="date" value={pausaInicio} onChange={(e) => setPausaInicio(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Fim (vazio = em andamento)</label>
                  <input type="date" value={pausaFim} onChange={(e) => setPausaFim(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Motivo (opcional)</label>
                <input value={pausaMotivo} onChange={(e) => setPausaMotivo(e.target.value)} placeholder="Ex: Aguardando documentação" className={inputClass} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setAddingPausa(false)} className="px-3 h-7 rounded text-xs border border-input hover:bg-accent transition-colors">
                  Cancelar
                </button>
                <button onClick={handleAddPausa} disabled={saving || !pausaInicio} className="px-3 h-7 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
