import { useCallback, useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, MapPin, Building2, CheckCircle2, ArrowLeft } from "lucide-react";
import { cn, formatArea } from "@/lib/utils";
import {
  DisplayStatus,
  VistoriaData,
  computeStage,
  displayStatusLabels,
  displayStatusBadgeClass,
} from "@/lib/vistoriaStatus";
import { PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";
import { resolveConsistentDisplayStatus } from "@/lib/processoConsistency";
import { toast } from "sonner";

interface ProcessoComProtocolo {
  id: string;
  protocolo_id: string;
  status: string;
  data_prevista: string | null;
  vistoriador_id: string | null;
  protocolos: {
    id: string;
    numero: string;
    razao_social: string;
    nome_fantasia: string | null;
    bairro: string;
    municipio: string;
    area: number | null;
    data_solicitacao: string;
    evento_unico?: boolean;
    ligar_antes?: boolean;
    telefone_contato?: string | null;
    urgente?: boolean;
    motivo_urgencia?: string | null;
  };
}

type FilterStatus = "all" | "regional" | "aguardando_retorno" | "atribuido" | "pendencias" | "certificado_termo" | "certificado" | "cancelado";

export default function InspectionsPage() {
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();
  const [processos, setProcessos] = useState<ProcessoComProtocolo[]>([]);
  const [vistoriaMap, setVistoriaMap] = useState<Record<string, VistoriaData>>({});
  const [pausasByProcesso, setPausasByProcesso] = useState<Record<string, DeadlinePausaData[]>>({});
  const [termosMap, setTermosMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const effectiveFilterStatus = activeRole === "vistoriador" ? "atribuido" : filterStatus;

  const fetchData = useCallback(async () => {
    if (!user) return;

    if (user.id === "00000000-0000-0000-0000-000000000000") {
      const mockProcs: ProcessoComProtocolo[] = [
        {
          id: "proc1",
          protocolo_id: "p1",
          status: "regional",
          data_prevista: "2024-04-05",
          vistoriador_id: "00000000-0000-0000-0000-000000000000",
          protocolos: {
            id: "p1",
            numero: "VT2024.0001.0001-01",
            razao_social: "Comércio de Alimentos Silva Ltda",
            nome_fantasia: "Mercado Silva",
            bairro: "Centro",
            municipio: "Rio Branco",
            area: 150,
            data_solicitacao: "2024-03-20",
          }
        }
      ];
      setProcessos(mockProcs);
      setVistoriaMap({
        "proc1": { processo_id: "proc1", data_1_atribuicao: "2024-03-22" } as any
      });
      setPausasByProcesso({});
      setTermosMap({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ data: procs }, { data: vist }, { data: pausas }, { data: termos }] = await Promise.all([
      supabase
        .from("processos")
        .select("id, protocolo_id, status, data_prevista, vistoriador_id, protocolos(id, numero, razao_social, nome_fantasia, bairro, municipio, area, data_solicitacao, evento_unico, ligar_antes, telefone_contato, urgente, motivo_urgencia)")
        .eq("vistoriador_id", user.id),
      supabase
        .from("vistorias")
        .select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno"),
      supabase.from("pausas").select("processo_id, data_inicio, data_fim, etapa"),
      supabase.from("termos_compromisso").select("processo_id, data_validade"),
    ]);

    setProcessos((procs as any) || []);
    const vm: Record<string, VistoriaData> = {};
    (vist || []).forEach((v: any) => { vm[v.processo_id] = v; });
    setVistoriaMap(vm);

    const pausasMap: Record<string, DeadlinePausaData[]> = {};
    (pausas || []).forEach((p: any) => {
      if (!pausasMap[p.processo_id]) pausasMap[p.processo_id] = [];
      pausasMap[p.processo_id].push(p);
    });
    setPausasByProcesso(pausasMap);

    const tMap: Record<string, string> = {};
    (termos || []).forEach((t: any) => {
      tMap[t.processo_id] = t.data_validade;
    });
    setTermosMap(tMap);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchData();

    if (user.id === "00000000-0000-0000-0000-000000000000") {
      return;
    }

    const channel = supabase
      .channel("inspections-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "processos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "vistorias" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pausas" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "termos_compromisso" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = processos.filter((p) => {
      const proto = p.protocolos;
      if (!proto) return false;

      // Status filter
      if (effectiveFilterStatus !== "all") {
        const vistoria = vistoriaMap[p.id] || null;
        const displayStatus = resolveConsistentDisplayStatus({
          dbStatus: p.status,
          vistoria,
          dataSolicitacao: proto.data_solicitacao,
          pausas: pausasByProcesso[p.id] || [],
          termoValidade: termosMap[p.id] || null,
        });
        if (displayStatus !== effectiveFilterStatus) return false;
      }

      // Search filter
      if (q) {
        return (
          proto.numero.toLowerCase().includes(q) ||
          proto.razao_social.toLowerCase().includes(q) ||
          (proto.nome_fantasia || "").toLowerCase().includes(q) ||
          proto.bairro.toLowerCase().includes(q) ||
          proto.municipio.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return result.sort((a, b) => {
      const aUrgente = a.protocolos?.urgente ? 1 : 0;
      const bUrgente = b.protocolos?.urgente ? 1 : 0;
      return bUrgente - aUrgente;
    });
  }, [processos, search, effectiveFilterStatus, vistoriaMap, pausasByProcesso, termosMap]);

  const filterOptions: { value: FilterStatus; label: string }[] = activeRole === "vistoriador"
    ? [
        { value: "atribuido", label: "Atribuído" }
      ]
    : [
        { value: "all", label: "Todos" },
        { value: "regional", label: "Aguardando Vistoria" },
        { value: "aguardando_retorno", label: "Aguardando Retorno" },
        { value: "atribuido", label: "Atribuído" },
        { value: "pendencias", label: "Com Pendência" },
        { value: "certificado_termo", label: "Cert. Provisório" },
        { value: "certificado", label: "Certificado" },
        { value: "cancelado", label: "Cancelado" },
      ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-foreground">Minhas Vistorias</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} processo{filtered.length !== 1 ? "s" : ""} atribuído{filtered.length !== 1 ? "s" : ""} a você
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por protocolo ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm rounded-lg border border-input bg-background pl-9 pr-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                effectiveFilterStatus === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={async () => {
              if (selectedIds.size === 0) {
                toast.error("Selecione pelo menos uma vistoria.");
                return;
              }
              
              const today = new Date().toISOString().split("T")[0];
              const updates = Array.from(selectedIds).map(async (processId) => {
                const vist = vistoriaMap[processId];
                const stage = computeStage(vist);
                if (stage) {
                  const field = `data_${stage}_vistoria`;
                  await supabase.from("vistorias").update({ [field]: today }).eq("processo_id", processId);
                }
              });
              
              await Promise.all(updates);
              
              toast.success(`${selectedIds.size} vistoria(s) sinalizada(s) como realizada(s)!`);
              setSelectedIds(new Set());
              fetchData(); // Refresh data
            }}
            className="text-xs px-3 py-1.5 rounded-full border transition-colors bg-green-600 text-white border-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={selectedIds.size === 0}
          >
            Realizado
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((process) => {
            const proto = process.protocolos;
            const vistoria = vistoriaMap[process.id] || null;
            const displayStatus = resolveConsistentDisplayStatus({
              dbStatus: process.status,
              vistoria,
              dataSolicitacao: proto.data_solicitacao,
              pausas: pausasByProcesso[process.id] || [],
              termoValidade: termosMap[process.id] || null,
            });
            const stage = computeStage(vistoria);

            return (
              <div
                key={process.id}
                onClick={() => navigate(`/protocolo/${process.protocolo_id}`)}
                className="bg-card rounded-xl border border-border p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors cursor-pointer"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                <div 
                  className="pt-1 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = new Set(selectedIds);
                    if (next.has(process.id)) next.delete(process.id);
                    else next.add(process.id);
                    setSelectedIds(next);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(process.id)}
                    onChange={() => {}} // handled by div onClick
                    className="w-4 h-4 rounded border-muted-foreground text-primary focus:ring-primary cursor-pointer pointer-events-none"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">
                      {proto.numero}
                    </span>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", displayStatusBadgeClass[displayStatus])}>
                      {displayStatusLabels[displayStatus]}
                    </span>
                    {stage && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium stage-badge">
                        {stage}ª Vist.
                      </span>
                    )}
                    {stage && vistoria && (vistoria as any)[`data_${stage}_vistoria`] && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                        Realizado
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {proto.nome_fantasia || proto.razao_social}
                  </h4>
                  {proto.nome_fantasia && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {proto.razao_social}
                    </p>
                  )}
                  {(proto.evento_unico || proto.ligar_antes || proto.urgente) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {proto.urgente && (
                        <span className="inline-flex py-0.5 px-2 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-300">
                          Urgente{proto.motivo_urgencia ? `: ${proto.motivo_urgencia}` : ""}
                        </span>
                      )}
                      {proto.evento_unico && (
                        <span className="inline-flex py-0.5 px-2 rounded-full text-[10px] font-medium bg-cyan-100 text-cyan-700 border border-cyan-400">
                          Evento Unico
                        </span>
                      )}
                      {proto.ligar_antes && (
                        <span className="inline-flex py-0.5 px-2 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-300">
                          Ligar antes{proto.telefone_contato ? `: ${proto.telefone_contato}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      {proto.bairro}, {proto.municipio}
                    </div>
                    {process.data_prevista && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(process.data_prevista + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                    )}
                    {proto.area && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5" />
                        {formatArea(proto.area)}m²
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhuma vistoria encontrada</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
