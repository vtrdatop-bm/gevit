import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import StatusBadge from "@/components/shared/StatusBadge";
import { Calendar, User, MapPin, Clock, Building2, Maximize2, ChevronDown, ChevronRight, AlertTriangle, Filter, AlertCircle, CheckCircle2, Search, ArrowLeft } from "lucide-react";
import { cn, formatArea, formatCpfCnpj, getCpfCnpjLabel } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { computeDeadline, deadlineColorClass, deadlineLabel, DeadlineResult, PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";
import {
  DisplayStatus,
  VistoriaStage,
  computeStage,
  getDisplayStatusLabel,
  getCurrentVistoriadorId,
} from "@/lib/vistoriaStatus";
import { 
  REGIONAL_COLORS, 
  REGIONAL_BG_COLORS, 
  REGIONAL_DOT_COLORS,
  STATUS_LABELS
} from "@/lib/constants";
import { KANBAN_MOCK_PROCESSOS } from "@/mocks/mockData";
import { ProcessoData, VistoriaData } from "@/types/database";
import { pickLatestProcessByProtocolo, resolveConsistentDisplayStatus, fetchAllRows } from "@/lib/processoConsistency";

const statusColumns: { key: DisplayStatus; label: string; dotColor: string }[] = [
  { key: "regional", label: STATUS_LABELS.regional, dotColor: "bg-[hsl(var(--status-risk))]" },
  { key: "aguardando_retorno", label: "Aguardando Retorno", dotColor: "bg-[hsl(var(--status-retorno))]" },
  { key: "atribuido", label: STATUS_LABELS.atribuido, dotColor: "bg-[hsl(var(--status-assigned))]" },
  { key: "pendencias", label: STATUS_LABELS.pendencias, dotColor: "bg-[hsl(var(--status-pending))]" },
  { key: "certificado_termo", label: STATUS_LABELS.certificado_termo, dotColor: "bg-[hsl(var(--status-certified-term))]" },
  { key: "certificado", label: STATUS_LABELS.certificado, dotColor: "bg-[hsl(var(--status-certified))]" },
  { key: "expirado", label: STATUS_LABELS.expirado, dotColor: "bg-[hsl(var(--status-expired))]" },
  { key: "cancelado", label: "Cancelado", dotColor: "bg-[hsl(var(--status-cancelado))]" },
];


interface ProcessoWithProtocolo {
  id: string;
  protocolo_id: string;
  dbStatus: string;
  displayStatus: DisplayStatus;
  stage: VistoriaStage;
  data_prevista: string | null;
  data_solicitacao: string;
  vistoriador_id: string | null;
  regional_id: string | null;
  protocolos: {
    numero: string;
    nome_fantasia: string | null;
    razao_social: string;
    cnpj: string;
    endereco: string;
    bairro: string;
    municipio: string;
    area: number | null;
    data_solicitacao: string;
    evento_unico?: boolean;
    ligar_antes?: boolean;
    data_evento?: string | null;
    agendar?: boolean;
    data_agendamento?: string | null;
  };
  regional_nome?: string;
  vistoriador_nome?: string;
  dias_restantes: number;
  deadline: DeadlineResult;
  data_1_retorno: string | null;
  data_2_retorno: string | null;
  vistoria_completa?: VistoriaData | null;
}

export default function KanbanPage() {
  const navigate = useNavigate();
  const { isDev, user } = useAuth();
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const [expandedRegionais, setExpandedRegionais] = useState<Set<string>>(new Set());
  const [processos, setProcessos] = useState<ProcessoWithProtocolo[]>([]);
  const [regionaisMap, setRegionaisMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedProtocolIds, setSelectedProtocolIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");

  const [vistoriadores, setVistoriadores] = useState<{ id: string; name: string }[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedVistoriadorId, setSelectedVistoriadorId] = useState("");

  const fetchData = useCallback(async () => {
    if (isDev) {
      setProcessos(KANBAN_MOCK_PROCESSOS as any);
      setRegionaisMap({ "r1": "Regional Centro" });
      setVistoriadores([
        { id: "v1", name: "Administrador (Dev)" },
        { id: "v2", name: "Sgt. Silva" },
        { id: "v3", name: "Cabo Souza" }
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [
        p,
        regionais,
        profiles,
        bairrosData,
        vRoles
      ] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase
            .from("protocolos")
            .select(`
              id, numero, nome_fantasia, razao_social, cnpj, endereco, bairro, municipio, area, data_solicitacao, evento_unico, ligar_antes, data_evento, agendar, data_agendamento,
              processos(
                id,
                protocolo_id,
                status,
                regional_id,
                data_prevista,
                vistoriador_id,
                created_at,
                updated_at,
                vistorias(
                  processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno, vistoriador_1_id, vistoriador_2_id, vistoriador_3_id
                ),
                pausas(processo_id, data_inicio, data_fim, etapa),
                termos_compromisso(processo_id, data_validade)
              )
            `)
            .order("created_at", { ascending: false })
            .range(from, to)
        ),
        supabase.from("regionais").select("id, nome").order("nome").then(res => res.data),
        supabase.from("profiles").select("user_id, patente, nome_guerra").then(res => res.data),
        supabase.from("bairros").select("nome, municipio, regional_id").then(res => res.data),
        supabase.from("user_roles").select("user_id").eq("role", "vistoriador").then(res => res.data),
      ]);

      const protocolosData = (p || []).map((proto: any) => {
        const { processos, ...rest } = proto;
        return rest;
      });

      const procs: any[] = [];
      const vistoriasData: any[] = [];
      const pausasData: any[] = [];
      const termosData: any[] = [];

      (p || []).forEach((proto: any) => {
        const nestedProcs = proto.processos || [];
        nestedProcs.forEach((procItem: any) => {
          const { vistorias, pausas, termos_compromisso, ...procRest } = procItem;
          const procObj = {
            ...procRest,
            protocolos: {
              ...proto,
              processos: undefined // Break circular ref
            }
          };
          procs.push(procObj);

          if (vistorias) {
            if (Array.isArray(vistorias)) {
              vistoriasData.push(...vistorias);
            } else {
              vistoriasData.push(vistorias);
            }
          }
          if (pausas) {
            if (Array.isArray(pausas)) {
              pausasData.push(...pausas);
            } else {
              pausasData.push(pausas);
            }
          }
          if (termos_compromisso) {
            if (Array.isArray(termos_compromisso)) {
              termosData.push(...termos_compromisso);
            } else {
              termosData.push(termos_compromisso);
            }
          }
        });
      });

      const regMap: Record<string, string> = {};
      (regionais || []).forEach((r) => { regMap[r.id] = r.nome; });

      const profMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profMap[p.user_id] = [p.patente, p.nome_guerra].filter(Boolean).join(" "); });

      const vistoriadorUserIds = new Set((vRoles || []).map((r: any) => r.user_id));
      const listVistoriadores = (profiles || [])
        .filter((p: any) => vistoriadorUserIds.has(p.user_id))
        .map((p: any) => ({
          id: p.user_id,
          name: [p.patente, p.nome_guerra].filter(Boolean).join(" ")
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setVistoriadores(listVistoriadores);

      const bairroRegionalMap: Record<string, string> = {};
      (bairrosData || []).forEach((b) => {
        if (b.regional_id) {
          bairroRegionalMap[`${b.nome.toUpperCase()}|${b.municipio.toUpperCase()}`] = b.regional_id;
        }
      });

      const vistoriaMap: Record<string, VistoriaData> = {};
      (vistoriasData || []).forEach((v: any) => {
        if (!vistoriaMap[v.processo_id]) {
          vistoriaMap[v.processo_id] = v;
        }
      });

      const pausasByProcesso: Record<string, DeadlinePausaData[]> = {};
      (pausasData || []).forEach((p: any) => {
        if (!pausasByProcesso[p.processo_id]) pausasByProcesso[p.processo_id] = [];
        pausasByProcesso[p.processo_id].push(p);
      });

      const termosMap: Record<string, string> = {};
      (termosData || []).forEach((t: any) => { termosMap[t.processo_id] = t.data_validade; });

      const protocoloById: Record<string, any> = {};
      (protocolosData || []).forEach((proto: any) => {
        protocoloById[proto.id] = proto;
      });

      const canonicalProcesses = Object.values(pickLatestProcessByProtocolo((procs || []) as any));

      const mapped: ProcessoWithProtocolo[] = canonicalProcesses
        .map((p: any) => {
          const protocolo = p.protocolos || protocoloById[p.protocolo_id] || null;
          if (!protocolo) {
            return null;
          }

          let resolvedRegionalId = p.regional_id;
          if (!resolvedRegionalId) {
            resolvedRegionalId = bairroRegionalMap[`${(protocolo.bairro || "").toUpperCase()}|${(protocolo.municipio || "").toUpperCase()}`] || null;
          }
          const vistoria = vistoriaMap[p.id] || null;
          const activeVistoriadorId = getCurrentVistoriadorId(p.vistoriador_id, vistoria);
          const finalStatus = resolveConsistentDisplayStatus({
            dbStatus: p.status,
            vistoria,
            dataSolicitacao: protocolo?.data_solicitacao,
            pausas: pausasByProcesso[p.id] || [],
            termoValidade: termosMap[p.id] || null,
          });
          const deadlineResult = computeDeadline(vistoria, pausasByProcesso[p.id] || [], finalStatus, termosMap[p.id] || null);

          return {
            id: p.id,
            protocolo_id: p.protocolo_id,
            dbStatus: p.status,
            displayStatus: finalStatus as DisplayStatus,
            stage: computeStage(vistoria),
            data_prevista: p.data_prevista,
            data_solicitacao: protocolo?.data_solicitacao || "",
            vistoriador_id: activeVistoriadorId,
            regional_id: resolvedRegionalId,
            protocolos: protocolo,
            regional_nome: regMap[resolvedRegionalId || ""] || "",
            vistoriador_nome: profMap[activeVistoriadorId || ""] || "Não atribuído",
            dias_restantes: p.data_prevista
              ? differenceInDays(new Date(p.data_prevista), new Date())
              : 999,
            deadline: deadlineResult,
            data_1_retorno: vistoria?.data_1_retorno || null,
            data_2_retorno: vistoria?.data_2_retorno || null,
            vistoria_completa: vistoria,
          };
        })
        .filter((item): item is ProcessoWithProtocolo => item !== null);

      const protocoloIdsComProcesso = new Set((mapped || []).map((p) => p.protocolo_id));
      const orfaos: ProcessoWithProtocolo[] = (protocolosData || [])
        .filter((proto: any) => !protocoloIdsComProcesso.has(proto.id))
        .map((proto: any) => {
          const resolvedRegionalId = bairroRegionalMap[`${(proto.bairro || "").toUpperCase()}|${(proto.municipio || "").toUpperCase()}`] || null;
          const finalStatus = resolveConsistentDisplayStatus({
            dbStatus: "regional",
            vistoria: null,
            dataSolicitacao: proto.data_solicitacao,
            pausas: [],
            termoValidade: null,
          });
          const deadlineResult = computeDeadline(null, [], finalStatus, null);

          return {
            id: `proto-${proto.id}`,
            protocolo_id: proto.id,
            dbStatus: "regional",
            displayStatus: finalStatus,
            stage: 1,
            data_prevista: null,
            data_solicitacao: proto.data_solicitacao || "",
            vistoriador_id: null,
            regional_id: resolvedRegionalId,
            protocolos: proto,
            regional_nome: regMap[resolvedRegionalId || ""] || "",
            vistoriador_nome: "Não atribuído",
            dias_restantes: 999,
            deadline: deadlineResult,
            data_1_retorno: null,
            data_2_retorno: null,
            vistoria_completa: null,
          };
        });

      setProcessos([...(mapped || []), ...orfaos]);
      setRegionaisMap(regMap);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [isDev]);

  const handleBulkSchedule = async () => {
    if (selectedProtocolIds.length === 0 || !scheduledDate) return;
    try {
      if (isDev) {
        setProcessos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.protocolo_id)) {
              return {
                ...p,
                protocolos: {
                  ...p.protocolos,
                  agendar: true,
                  data_agendamento: scheduledDate,
                }
              };
            }
            return p;
          })
        );
      } else {
        const { error } = await supabase
          .from("protocolos")
          .update({
            agendar: true,
            data_agendamento: scheduledDate
          })
          .in("id", selectedProtocolIds);

        if (error) throw error;
      }
      toast.success(`${selectedProtocolIds.length} protocolo(s) agendado(s) com sucesso!`);
      setSelectedProtocolIds([]);
      setScheduledDate("");
      setIsModalOpen(false);
      if (!isDev) {
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao realizar agendamento: " + err.message);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedProtocolIds.length === 0 || !selectedVistoriadorId) return;
    try {
      if (isDev) {
        setProcessos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.protocolo_id)) {
              return {
                ...p,
                id: p.id.startsWith("proto-") ? `proc-${p.protocolo_id}` : p.id,
                displayStatus: "atribuido" as DisplayStatus,
                vistoriador_id: selectedVistoriadorId,
                vistoriador_nome: vistoriadores.find(v => v.id === selectedVistoriadorId)?.name || "Vistoriador",
              };
            }
            return p;
          })
        );
      } else {
        const todayStr = new Date().toISOString().split("T")[0];
        
        for (const protoId of selectedProtocolIds) {
          const proc = processos.find(p => p.protocolo_id === protoId);
          if (!proc) continue;

          let targetProcessId = proc.id;

          if (proc.id.startsWith("proto-")) {
            const { data: newProc, error: procErr } = await supabase
              .from("processos")
              .insert({
                protocolo_id: proc.protocolo_id,
                status: "regional",
                vistoriador_id: selectedVistoriadorId
              })
              .select("id")
              .single();
            if (procErr) throw procErr;

            targetProcessId = newProc.id;

            const { error: vistErr } = await supabase
              .from("vistorias")
              .insert({
                processo_id: targetProcessId,
                data_1_atribuicao: todayStr,
                vistoriador_1_id: selectedVistoriadorId
              });
            if (vistErr) throw vistErr;
          } else {
            const { error: procErr } = await supabase
              .from("processos")
              .update({
                status: "regional",
                vistoriador_id: selectedVistoriadorId
              })
              .eq("id", proc.id);
            if (procErr) throw procErr;

            const { data: vistData } = await supabase
              .from("vistorias")
              .select("id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao")
              .eq("processo_id", proc.id)
              .maybeSingle();

            if (vistData) {
              const stageNum = proc.stage || 1;
              const vistUpdate: any = {};
              if (stageNum === 2) {
                vistUpdate.data_2_atribuicao = todayStr;
                vistUpdate.vistoriador_2_id = selectedVistoriadorId;
              } else if (stageNum === 3) {
                vistUpdate.data_3_atribuicao = todayStr;
                vistUpdate.vistoriador_3_id = selectedVistoriadorId;
              } else {
                vistUpdate.data_1_atribuicao = todayStr;
                vistUpdate.vistoriador_1_id = selectedVistoriadorId;
              }
              const { error: vistErr } = await supabase
                .from("vistorias")
                .update(vistUpdate)
                .eq("id", vistData.id);
              if (vistErr) throw vistErr;
            } else {
              const { error: vistErr } = await supabase
                .from("vistorias")
                .insert({
                  processo_id: proc.id,
                  data_1_atribuicao: todayStr,
                  vistoriador_1_id: selectedVistoriadorId
                });
              if (vistErr) throw vistErr;
            }
          }
        }
      }
      toast.success(`${selectedProtocolIds.length} protocolo(s) atribuído(s) com sucesso!`);
      setSelectedProtocolIds([]);
      setSelectedVistoriadorId("");
      setIsAssignModalOpen(false);
      if (!isDev) {
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao realizar atribuição: " + err.message);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("kanban-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "processos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "protocolos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "vistorias" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pausas" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "termos_compromisso" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const filteredProcessos = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return processos;
    return processos.filter((p) => 
      (p.protocolos?.numero?.toLowerCase() ?? "").includes(q) ||
      (p.protocolos?.razao_social?.toLowerCase() ?? "").includes(q) ||
      (p.protocolos?.nome_fantasia?.toLowerCase() ?? "").includes(q) ||
      (p.protocolos?.cnpj ?? "").includes(q) ||
      (p.protocolos?.municipio?.toLowerCase() ?? "").includes(q) ||
      (p.protocolos?.bairro?.toLowerCase() ?? "").includes(q)
    );
  }, [processos, search]);

  const groupedByRegional = (() => {
    const groups: Record<string, { nome: string; processos: ProcessoWithProtocolo[] }> = {};
    Object.entries(regionaisMap).forEach(([id, nome]) => {
      groups[id] = { nome, processos: [] };
    });
    groups["__sem_regional__"] = { nome: "Sem Regional", processos: [] };
    filteredProcessos.forEach((p) => {
      const key = p.regional_id || "__sem_regional__";
      if (!groups[key]) {
        groups[key] = { nome: regionaisMap[key] || "Desconhecida", processos: [] };
      }
      groups[key].processos.push(p);
    });
    return Object.entries(groups)
      .filter(([, g]) => g.processos.length > 0)
      .sort((a, b) => {
        if (a[0] === "__sem_regional__") return 1;
        if (b[0] === "__sem_regional__") return -1;
        return a[1].nome.localeCompare(b[1].nome);
      });
  })();

  const toggleExpand = (id: string) => {
    setExpandedRegionais((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getByStatus = (procs: ProcessoWithProtocolo[], status: DisplayStatus) =>
    procs.filter((p) => p.displayStatus === status).sort((a, b) => {
      if (status === "aguardando_retorno") {
        // Sort ascending by the active return date (2º retorno takes precedence, then 1º retorno)
        const dateA = a.data_2_retorno || a.data_1_retorno || a.data_solicitacao;
        const dateB = b.data_2_retorno || b.data_1_retorno || b.data_solicitacao;
        return dateA.localeCompare(dateB);
      }
      if (status === "regional") {
        const dateA = a.data_2_retorno || a.data_1_retorno || a.data_solicitacao;
        const dateB = b.data_2_retorno || b.data_1_retorno || b.data_solicitacao;
        return dateA.localeCompare(dateB);
      }
      return a.data_solicitacao.localeCompare(b.data_solicitacao);
    });

  const totalProcessos = processos.length;

  if (loading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Carregando processos...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-foreground">Gerenciamento</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Fluxo automático de processos — agrupados por regional
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nº, razão social, CNPJ, município..."
              className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground bg-accent px-3 py-2 rounded-md whitespace-nowrap text-center">
            {filteredProcessos.length} {filteredProcessos.length === 1 ? "processo" : "processos"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {groupedByRegional.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Nenhum processo encontrado
          </div>
        )}

        {groupedByRegional.map(([regId, group]) => {
          const isExpanded = expandedRegionais.has(regId);
          const regIndex = groupedByRegional.findIndex(([id]) => id === regId);
          const borderColor = regId === "__sem_regional__" ? "border-l-muted-foreground" : REGIONAL_COLORS[regIndex % REGIONAL_COLORS.length];
          const headerBg = regId === "__sem_regional__" ? "bg-muted/30" : REGIONAL_BG_COLORS[regIndex % REGIONAL_BG_COLORS.length];
          const dotColor = regId === "__sem_regional__" ? "bg-muted-foreground" : REGIONAL_DOT_COLORS[regIndex % REGIONAL_DOT_COLORS.length];
          return (
            <div key={regId} className={cn("rounded-xl border border-border overflow-hidden border-l-4", borderColor)}>
              <button
                onClick={() => toggleExpand(regId)}
                className={cn("w-full flex items-center gap-3 px-5 py-3.5 transition-colors", headerBg)}
              >
                {!isExpanded ? (
                  <ChevronRight className="w-4 h-4 text-foreground/60" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-foreground/60" />
                )}
                <span className={cn("w-3 h-3 rounded-full shrink-0", dotColor)} />
                <h3 className="text-sm font-semibold text-foreground">{group.nome}</h3>
                <span className="text-xs text-muted-foreground bg-accent rounded-full px-2 py-0.5">
                  {group.processos.length}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {statusColumns.map((col) => {
                    const count = getByStatus(group.processos, col.key).length;
                    if (count === 0) return null;
                    return (
                      <span key={col.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("w-2 h-2 rounded-full", col.dotColor)} />
                        {count}
                      </span>
                    );
                  })}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 overflow-x-auto [transform:rotateX(180deg)]">
                  <div className="flex gap-3 min-h-[200px] [transform:rotateX(180deg)]">
                    {statusColumns.map((col) => {
                      const procs = getByStatus(group.processos, col.key);
                      return (
                        <div key={col.key} className="flex flex-col min-w-[280px] max-w-[320px] flex-shrink-0">
                          <div className="flex items-center gap-2 mb-3 px-1">
                            <div className={cn("w-2.5 h-2.5 rounded-full", col.dotColor)} />
                            <span className="text-xs font-semibold text-foreground">{col.label}</span>
                            <span className="ml-auto text-xs text-muted-foreground bg-accent rounded-full px-2 py-0.5">
                              {procs.length}
                            </span>
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-0">
                            {procs.map((process) => (
                                <div
                                  key={process.id}
                                  className={cn(
                                    "kanban-card cursor-pointer",
                                    process.protocolos?.evento_unico && "!bg-cyan-100 !border-cyan-400",
                                    process.stage === 2 && "!bg-amber-100/50 !border-amber-200",
                                    process.stage === 3 && "!bg-rose-100/60 !border-rose-300",
                                    selectedProcess === process.id && "ring-2 ring-primary ring-offset-1"
                                  )}
                                  onClick={() =>
                                    setSelectedProcess(selectedProcess === process.id ? null : process.id)
                                  }
                                  onDoubleClick={(e) => {
                                    e.preventDefault();
                                    navigate(`/protocolo/${process.protocolo_id}`);
                                  }}
                                  title="Clique duplo para abrir detalhes do protocolo"
                                >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={selectedProtocolIds.includes(process.protocolo_id)}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSelectedProtocolIds(prev => {
                                          if (checked) {
                                            return [...prev, process.protocolo_id];
                                          } else {
                                            return prev.filter(id => id !== process.protocolo_id);
                                          }
                                        });
                                      }}
                                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <span className="text-xs font-mono text-muted-foreground">
                                      {process.protocolos.numero}
                                    </span>
                                  </div>
                                  <div className="ml-2 flex flex-wrap justify-end gap-1">
                                    {process.protocolos.evento_unico && (
                                      <span className="font-bold text-xs bg-cyan-100 text-cyan-700 border border-cyan-400 px-2 py-0.5 rounded">
                                        Evento Único
                                      </span>
                                    )}
                                    {process.protocolos.agendar && (
                                      <span className="font-bold text-xs bg-green-100 text-green-700 border border-green-400 px-2 py-0.5 rounded" title={process.protocolos.data_agendamento ? `Agendado para ${new Date(process.protocolos.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")}` : undefined}>
                                        Agendado{process.protocolos.data_agendamento && ` (${new Date(process.protocolos.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")})`}
                                      </span>
                                    )}
                                    {process.protocolos.ligar_antes && (
                                      <span className="font-bold text-xs bg-violet-100 text-violet-700 border border-violet-300 px-2 py-0.5 rounded">
                                        Ligar antes
                                      </span>
                                    )}
                                  </div>
                                  {/* Data do evento NÃO é etiqueta, exibir como texto abaixo do título */}
                                  {!process.protocolos.evento_unico && process.stage >= 1 && (
                                    <span className="ml-auto font-medium text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                      {process.stage}ª Vist.
                                    </span>
                                  )}
                                </div>

                                {process.deadline.active && process.deadline.remaining <= 10 && (
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-destructive mb-2">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>
                                      {process.deadline.remaining <= 0 
                                        ? (process.deadline.type === "validity" ? "Certificado vencido!" : "Prazo expirado!")
                                        : (process.deadline.type === "validity" 
                                            ? `Vence em ${process.deadline.remaining} ${process.deadline.remaining === 1 ? 'dia' : 'dias'}` 
                                            : `Expira em ${process.deadline.remaining} ${process.deadline.remaining === 1 ? 'dia' : 'dias'}`)}
                                    </span>
                                  </div>
                                )}

                                <h4 className="text-[13px] font-semibold text-foreground mb-1">
                                  {process.protocolos.nome_fantasia || process.protocolos.razao_social}
                                </h4>


                                <div className="flex items-center gap-1.5 text-[11px] mb-2">
                                  <Calendar className="w-3 h-3 shrink-0" />
                                  {process.data_2_retorno ? (
                                    <span className="text-muted-foreground">
                                      {`2º Retorno: ${new Date(process.data_2_retorno + "T00:00:00").toLocaleDateString("pt-BR")}`}
                                    </span>
                                  ) : process.data_1_retorno ? (
                                    <span className="text-muted-foreground">
                                      {`1º Retorno: ${new Date(process.data_1_retorno + "T00:00:00").toLocaleDateString("pt-BR")}`}
                                    </span>
                                  ) : process.protocolos.evento_unico && process.protocolos.data_evento ? (
                                    <>
                                      <span className="text-muted-foreground">
                                        {`Solicitação: ${new Date(process.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR")}`}
                                      </span>
                                      <span className="font-bold text-cyan-700 ml-2">
                                        Evento: {new Date(process.protocolos.data_evento + "T00:00:00").toLocaleDateString("pt-BR")}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {`Solicitação: ${new Date(process.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR")}`}
                                    </span>
                                  )}
                                </div>

                                {selectedProcess === process.id && (
                                  <div className="mt-3 pt-3 border-t border-border space-y-3 animate-fade-in">
                                    <p className="text-xs text-muted-foreground font-medium">
                                      {process.protocolos.razao_social}
                                    </p>

                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">
                                          {process.protocolos.endereco}, {process.protocolos.bairro}, {process.protocolos.municipio}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                                        <span>Solicitação: {new Date(process.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                                      </div>

                                      {process.data_1_retorno && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                                          <span>1º Retorno: {new Date(process.data_1_retorno + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                                        </div>
                                      )}

                                      {process.data_2_retorno && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                                          <span>2º Retorno: {new Date(process.data_2_retorno + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                                        </div>
                                      )}

                                      {process.data_prevista && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Clock className="w-3.5 h-3.5 shrink-0" />
                                          <span>Previsto: {process.data_prevista}</span>
                                        </div>
                                      )}

                                      {process.vistoriador_id && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <User className="w-3.5 h-3.5 shrink-0" />
                                          <span>{process.vistoriador_nome || "Carregando..."}</span>
                                        </div>
                                      )}

                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                                        <span>{getCpfCnpjLabel(process.protocolos.cnpj)}: {formatCpfCnpj(process.protocolos.cnpj)}</span>
                                      </div>
                                      
                                      {process.protocolos.area && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                                          <span>Área: {formatArea(process.protocolos.area)}m²</span>
                                        </div>
                                      )}
                                    </div>

                                    {process.deadline.active && (
                                      <div className={cn("mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50", deadlineColorClass(process.deadline.remaining))}>
                                        {process.deadline.remaining <= 15 ? (
                                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        ) : (
                                          <Clock className="w-3.5 h-3.5 shrink-0" />
                                        )}
                                        <span className="text-xs font-semibold">
                                          {process.deadline.remaining <= 0
                                            ? (process.deadline.type === "validity" ? "Certificado vencido!" : "Prazo expirado!")
                                            : `${process.deadline.remaining} dias ${process.deadline.type === "validity" ? "p/ vencer" : "p/ expirar"}`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                            {procs.length === 0 && (
                              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                                Nenhum processo
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedProtocolIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur border border-border shadow-lg rounded-full px-6 py-3.5 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-sm font-medium text-foreground">
            {selectedProtocolIds.length} {selectedProtocolIds.length === 1 ? "protocolo selecionado" : "protocolos selecionados"}
          </span>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/95 px-4 py-2 rounded-full transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            Agendar
          </button>
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/95 px-4 py-2 rounded-full transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            Atribuir
          </button>
          <button
            onClick={() => setSelectedProtocolIds([])}
            className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1.5"
          >
            Limpar
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-foreground mb-1">Agendar em Lote</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Escolha a data de agendamento para os {selectedProtocolIds.length} protocolos selecionados.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="bulk-schedule-date" className="text-xs font-medium text-muted-foreground">
                  Data do Agendamento
                </label>
                <input
                  id="bulk-schedule-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setScheduledDate("");
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkSchedule}
                  disabled={!scheduledDate}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold text-foreground mb-1">Atribuir em Lote</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Selecione o vistoriador para os {selectedProtocolIds.length} protocolos selecionados.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="bulk-assign-vistoriador" className="text-xs font-medium text-muted-foreground">
                  Vistoriador
                </label>
                <select
                  id="bulk-assign-vistoriador"
                  value={selectedVistoriadorId}
                  onChange={(e) => setSelectedVistoriadorId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecione um vistoriador...</option>
                  {vistoriadores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsAssignModalOpen(false);
                    setSelectedVistoriadorId("");
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkAssign}
                  disabled={!selectedVistoriadorId}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
