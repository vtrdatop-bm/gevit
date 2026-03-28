import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StatusBadge from "@/components/shared/StatusBadge";
import { Calendar, User, MapPin, Clock, Building2, Maximize2, ChevronDown, ChevronRight, AlertTriangle, Filter, AlertCircle, CheckCircle2, Search, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { computeDeadline, deadlineColorClass, deadlineLabel, DeadlineResult, PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";
import {
  DisplayStatus,
  VistoriaStage,
  VistoriaData,
  computeDisplayStatus,
  computeStage,
  displayStatusLabels,
  displayStatusDotColor,
  getDisplayStatusLabel,
  getCurrentVistoriadorId,
} from "@/lib/vistoriaStatus";

const statusColumns: { key: DisplayStatus; label: string; dotColor: string }[] = [
  { key: "regional", label: "Aguardando Vistoria", dotColor: displayStatusDotColor.regional },
  { key: "atribuido", label: "Atribuído", dotColor: displayStatusDotColor.atribuido },
  { key: "pendencias", label: "Vistoria com Pendência", dotColor: displayStatusDotColor.pendencias },
  { key: "certificado_termo", label: "Certificado Provisório", dotColor: displayStatusDotColor.certificado_termo },
  { key: "certificado", label: "Certificado", dotColor: displayStatusDotColor.certificado },
  { key: "expirado", label: "Expirados", dotColor: displayStatusDotColor.expirado },
];

// Predefined colors for regional sections
const regionalColors = [
  "border-l-blue-500", "border-l-emerald-500", "border-l-amber-500", "border-l-violet-500",
  "border-l-rose-500", "border-l-cyan-500", "border-l-orange-500", "border-l-teal-500",
  "border-l-pink-500", "border-l-indigo-500", "border-l-lime-500", "border-l-fuchsia-500",
  "border-l-sky-500", "border-l-red-500",
];
const regionalBgColors = [
  "bg-blue-500/15", "bg-emerald-500/15", "bg-amber-500/15", "bg-violet-500/15",
  "bg-rose-500/15", "bg-cyan-500/15", "bg-orange-500/15", "bg-teal-500/15",
  "bg-pink-500/15", "bg-indigo-500/15", "bg-lime-500/15", "bg-fuchsia-500/15",
  "bg-sky-500/15", "bg-red-500/15",
];
const regionalDotColors = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-teal-500",
  "bg-pink-500", "bg-indigo-500", "bg-lime-500", "bg-fuchsia-500",
  "bg-sky-500", "bg-red-500",
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

  useEffect(() => {
    const fetchData = async () => {
      if (isDev) {
        const mockProcs: ProcessoWithProtocolo[] = [
          {
            id: "proc1",
            protocolo_id: "p1",
            dbStatus: "regional",
            displayStatus: "regional",
            stage: 1,
            data_prevista: "2024-04-05",
            data_solicitacao: "2024-03-20",
            vistoriador_id: "v1",
            regional_id: "r1",
            protocolos: {
              numero: "VT2024.0001.0001-01",
              nome_fantasia: "Mercado Silva",
              razao_social: "Comércio de Alimentos Silva Ltda",
              cnpj: "12345678000190",
              endereco: "Rua das Flores, 123",
              bairro: "Centro",
              municipio: "Rio Branco",
              area: 150,
              data_solicitacao: "2024-03-20",
            },
            regional_nome: "Regional Centro",
            vistoriador_nome: "Administrador (Dev)",
            dias_restantes: 10,
            deadline: { active: true, remaining: 10, type: "expiration", stage: 1 },
            data_1_retorno: null,
            data_2_retorno: null,
          },
          {
            id: "proc2",
            protocolo_id: "p2",
            dbStatus: "certificado",
            displayStatus: "certificado",
            stage: 1,
            data_prevista: "2024-03-25",
            data_solicitacao: "2024-03-21",
            vistoriador_id: "v1",
            regional_id: "r1",
            protocolos: {
              numero: "VT2024.0001.0002-02",
              nome_fantasia: null,
              razao_social: "Posto de Combustíveis Acreano",
              cnpj: "98765432000110",
              endereco: "Av. Brasil, s/n",
              bairro: "Distrito Industrial",
              municipio: "Senador Guiomard",
              area: 1200,
              data_solicitacao: "2024-03-21",
            },
            regional_nome: "Regional Centro",
            vistoriador_nome: "Administrador (Dev)",
            dias_restantes: 0,
            deadline: { active: false, remaining: 0, type: "expiration", stage: 0 },
            data_1_retorno: null,
            data_2_retorno: null,
          }
        ];
        setProcessos(mockProcs);
        setRegionaisMap({ "r1": "Regional Centro" });
        setLoading(false);
        return;
      }
      const [{ data: procs }, { data: regionais }, { data: profiles }, { data: bairrosData }, { data: vistoriasData }, { data: pausasData }, { data: termosData }] = await Promise.all([
        supabase
          .from("processos")
          .select("id, protocolo_id, status, data_prevista, vistoriador_id, regional_id, protocolos(numero, nome_fantasia, razao_social, cnpj, endereco, bairro, municipio, area, data_solicitacao)")
          .neq("status", "expirado"),
        supabase.from("regionais").select("id, nome").order("nome"),
        supabase.from("profiles").select("user_id, patente, nome_guerra"),
        supabase.from("bairros").select("nome, municipio, regional_id"),
        supabase.from("vistorias").select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno, vistoriador_1_id, vistoriador_2_id, vistoriador_3_id"),
        supabase.from("pausas").select("processo_id, data_inicio, data_fim, etapa"),
        supabase.from("termos_compromisso").select("processo_id, data_validade"),
      ]);

      const regMap: Record<string, string> = {};
      (regionais || []).forEach((r) => { regMap[r.id] = r.nome; });

      const profMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profMap[p.user_id] = [p.patente, p.nome_guerra].filter(Boolean).join(" "); });

      const bairroRegionalMap: Record<string, string> = {};
      (bairrosData || []).forEach((b) => {
        if (b.regional_id) {
          bairroRegionalMap[`${b.nome}|${b.municipio}`] = b.regional_id;
        }
      });

      const vistoriaMap: Record<string, VistoriaData> = {};
      (vistoriasData || []).forEach((v: any) => {
        vistoriaMap[v.processo_id] = v;
      });

      const pausasByProcesso: Record<string, DeadlinePausaData[]> = {};
      (pausasData || []).forEach((p: any) => {
        if (!pausasByProcesso[p.processo_id]) pausasByProcesso[p.processo_id] = [];
        pausasByProcesso[p.processo_id].push(p);
      });

      const termosMap: Record<string, string> = {};
      (termosData || []).forEach((t: any) => { termosMap[t.processo_id] = t.data_validade; });

      const mapped: ProcessoWithProtocolo[] = (procs || []).map((p: any) => {
        let resolvedRegionalId = p.regional_id;
        if (!resolvedRegionalId && p.protocolos) {
          resolvedRegionalId = bairroRegionalMap[`${p.protocolos.bairro}|${p.protocolos.municipio}`] || null;
        }
        const vistoria = vistoriaMap[p.id] || null;
        const dStatus = computeDisplayStatus(p.status, vistoria, p.protocolos?.data_solicitacao);
        const activeVistoriadorId = getCurrentVistoriadorId(p.vistoriador_id, vistoria);
        const deadlineResult = computeDeadline(vistoria, pausasByProcesso[p.id] || [], dStatus, termosMap[p.id] || null);
        return {
          id: p.id,
          protocolo_id: p.protocolo_id,
          dbStatus: p.status,
          displayStatus: dStatus,
          stage: computeStage(vistoria),
          data_prevista: p.data_prevista,
          data_solicitacao: p.protocolos?.data_solicitacao || "",
          vistoriador_id: activeVistoriadorId,
          regional_id: resolvedRegionalId,
          protocolos: p.protocolos,
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
      });

      setProcessos(mapped);
      setRegionaisMap(regMap);
      setLoading(false);
    };
    fetchData();

    const channel = supabase
      .channel("kanban-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "processos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "protocolos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "vistorias" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDev]);

  const filteredProcessos = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return processos;
    return processos.filter((p) => 
      p.protocolos?.numero.toLowerCase().includes(q) ||
      p.protocolos?.razao_social.toLowerCase().includes(q) ||
      (p.protocolos?.nome_fantasia || "").toLowerCase().includes(q) ||
      p.protocolos?.cnpj.includes(q) ||
      p.protocolos?.municipio.toLowerCase().includes(q) ||
      p.protocolos?.bairro.toLowerCase().includes(q)
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
      if (status === "regional") {
        // User wants to prioritize return dates in sorting
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
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nº, razão social, CNPJ, município..."
              className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground bg-accent px-3 py-1.5 rounded-full whitespace-nowrap">
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
          const borderColor = regId === "__sem_regional__" ? "border-l-muted-foreground" : regionalColors[regIndex % regionalColors.length];
          const headerBg = regId === "__sem_regional__" ? "bg-muted/30" : regionalBgColors[regIndex % regionalBgColors.length];
          const dotColor = regId === "__sem_regional__" ? "bg-muted-foreground" : regionalDotColors[regIndex % regionalDotColors.length];
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
                <div className="px-4 pb-4 overflow-x-auto">
                  <div className="flex gap-3 min-h-[200px]">
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
                                className="kanban-card cursor-pointer"
                                onClick={() =>
                                  setSelectedProcess(selectedProcess === process.id ? null : process.id)
                                }
                                onDoubleClick={() => navigate(`/protocolo/${process.protocolo_id}`)}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                                    {process.protocolos.numero}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {process.stage}ª Vist.
                                  </span>
                                </div>

                                <h4 className="text-[13px] font-semibold text-foreground mb-1">
                                  {process.protocolos.nome_fantasia || process.protocolos.razao_social}
                                </h4>

                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
                                  <Calendar className="w-3 h-3 shrink-0" />
                                  <span>
                                    {process.data_2_retorno ? (
                                      `2º Retorno: ${new Date(process.data_2_retorno + "T00:00:00").toLocaleDateString("pt-BR")}`
                                    ) : process.data_1_retorno ? (
                                      `1º Retorno: ${new Date(process.data_1_retorno + "T00:00:00").toLocaleDateString("pt-BR")}`
                                    ) : (
                                      `Solicitação: ${new Date(process.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR")}`
                                    )}
                                  </span>
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
                                        <span>CNPJ: {process.protocolos.cnpj}</span>
                                      </div>
                                      
                                      {process.protocolos.area && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                                          <span>Área: {process.protocolos.area}m²</span>
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
    </div>
  );
}
