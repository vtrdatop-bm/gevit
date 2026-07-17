import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  type DisplayStatus,
  type VistoriaData,
  displayStatusBadgeClass,
  displayStatusLabels,
  sortVistoriadores,
} from "@/lib/vistoriaStatus";
import { type PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";
import { resolveConsistentDisplayStatus } from "@/lib/processoConsistency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


interface ProcessoComProtocolo {
  id: string;
  protocolo_id: string;
  status: string;
  data_prevista: string | null;
  vistoriador_id: string | null;
  protocolos: {
    numero: string;
    razao_social: string;
    nome_fantasia: string | null;
    bairro: string;
    municipio: string;
    data_solicitacao: string;
    evento_unico?: boolean;
    ligar_antes?: boolean;
    telefone_contato?: string | null;
    urgente?: boolean;
    motivo_urgencia?: string | null;
  } | null;
}

interface RawVistoria extends VistoriaData {
  processo_id: string;
}

interface Profile {
  user_id: string;
  patente: string | null;
  nome_guerra: string | null;
}

type ProcessStatusFilter = "all" | DisplayStatus;

interface StageStatus {
  etapa: 1 | 2 | 3;
  vistoriadorId: string | null;
  vistoriadorNome: string | null;
  status: DisplayStatus | null;
  dataAtribuicao: string | null;
  dataVistoria: string | null;
}

interface InspectionRow {
  id: string;
  processoId: string;
  protocoloId: string;
  protocoloNumero: string;
  empresa: string;
  razaoSocial: string;
  municipio: string;
  bairro: string;
  dataSolicitacao: string;
  vistoriadores: string[];
  stageStatuses: StageStatus[];
  effectiveDate: string;
  currentProcessStatus: DisplayStatus;
  eventoUnico?: boolean;
  ligarAntes?: boolean;
  telefoneContato?: string | null;
  urgente?: boolean;
  motivoUrgencia?: string | null;
}

const STATUS_OPTIONS: { value: ProcessStatusFilter; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "regional", label: "Aguardando vistoria" },
  { value: "aguardando_retorno", label: "Aguardando retorno" },
  { value: "atribuido", label: "Atribuído" },
  { value: "pendencias", label: "Com pendência" },
  { value: "certificado_termo", label: "Certificado provisório" },
  { value: "certificado", label: "Certificado" },
  { value: "expirado", label: "Expirados" },
  { value: "cancelado", label: "Cancelado" },
];

function formatProfileName(profile: Profile) {
  return [profile.patente, profile.nome_guerra].filter(Boolean).join(" ") || "Sem nome";
}

function getStageProcessStatus(
  dataAtribuicao: string | null,
  resultado: string | null,
  hasVistoriador: boolean
): DisplayStatus | null {
  if (resultado === "pendencia") return "pendencias";
  if (resultado === "aprovado") return "certificado_termo";
  if (resultado === "reprovado") return "certificado";
  if (dataAtribuicao || hasVistoriador) return "atribuido";
  return null;
}

function formatDate(date: string | null) {
  return date ? new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR") : "-";
}

function getLatestDate(values: Array<string | null>) {
  const dates = values.filter((value): value is string => Boolean(value));
  if (dates.length === 0) return "";
  return dates.sort((a, b) => b.localeCompare(a))[0];
}

export default function VistoriantesPage() {
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const syncingScrollRef = useRef<"top" | "bottom" | null>(null);
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<ProcessoComProtocolo[]>([]);
  const [vistoriaMap, setVistoriaMap] = useState<Record<string, RawVistoria>>({});
  const [pausasByProcesso, setPausasByProcesso] = useState<Record<string, DeadlinePausaData[]>>({});
  const [termosMap, setTermosMap] = useState<Record<string, string>>({});
  const [vistoriadores, setVistoriadores] = useState<Profile[]>([]);
  const [selectedVistoriador, setSelectedVistoriador] = useState<string>("all");
  const [selectedStatuses, setSelectedStatuses] = useState<DisplayStatus[]>([]);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [topScrollbarWidth, setTopScrollbarWidth] = useState(0);

  const handleStatusClick = (statusValue: ProcessStatusFilter) => {
    if (statusValue === "all") {
      setSelectedStatuses([]);
    } else {
      setSelectedStatuses((prev) =>
        prev.includes(statusValue as DisplayStatus)
          ? prev.filter((s) => s !== statusValue)
          : [...prev, statusValue as DisplayStatus]
      );
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const [{ data: procs }, { data: vists }, { data: profs }, { data: roleRows }, { data: pausas }, { data: termos }] = await Promise.all([
        supabase
          .from("processos")
          .select("id, protocolo_id, status, data_prevista, vistoriador_id, protocolos(numero, razao_social, nome_fantasia, bairro, municipio, data_solicitacao, evento_unico, ligar_antes, telefone_contato, urgente, motivo_urgencia)"),
        supabase
          .from("vistorias")
          .select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno, vistoriador_1_id, vistoriador_2_id, vistoriador_3_id"),
        supabase.from("profiles").select("user_id, patente, nome_guerra"),
        supabase.from("user_roles").select("user_id").eq("role", "vistoriador"),
        supabase.from("pausas").select("processo_id, data_inicio, data_fim, etapa"),
        supabase.from("termos_compromisso").select("processo_id, data_validade"),
      ]);

      setProcessos(((procs as unknown as ProcessoComProtocolo[]) || []).filter((processo) => !!processo.protocolos));

      const nextVistoriaMap: Record<string, RawVistoria> = {};
      ((vists as RawVistoria[]) || []).forEach((vistoria) => {
        nextVistoriaMap[vistoria.processo_id] = vistoria;
      });
      setVistoriaMap(nextVistoriaMap);

      const nextPausasByProcesso: Record<string, DeadlinePausaData[]> = {};
      ((pausas as Array<any>) || []).forEach((pausa) => {
        if (!nextPausasByProcesso[pausa.processo_id]) nextPausasByProcesso[pausa.processo_id] = [];
        nextPausasByProcesso[pausa.processo_id].push(pausa);
      });
      setPausasByProcesso(nextPausasByProcesso);

      const nextTermosMap: Record<string, string> = {};
      ((termos as Array<any>) || []).forEach((termo) => {
        nextTermosMap[termo.processo_id] = termo.data_validade;
      });
      setTermosMap(nextTermosMap);

      const vistoriadorIds = new Set(((roleRows as { user_id: string }[]) || []).map((row) => row.user_id));
      const nextProfiles = sortVistoriadores(
        (((profs as Profile[]) || []).filter((profile) => vistoriadorIds.has(profile.user_id)))
      );
      setVistoriadores(nextProfiles);
      setLoading(false);
    };

    void loadData();

    const channel = supabase
      .channel("vistoriantes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "processos" }, () => { void loadData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "vistorias" }, () => { void loadData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "pausas" }, () => { void loadData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "termos_compromisso" }, () => { void loadData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { void loadData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => { void loadData(); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const vistoriadorNameMap = useMemo(() => {
    const nextMap: Record<string, string> = {};
    vistoriadores.forEach((profile) => {
      nextMap[profile.user_id] = formatProfileName(profile);
    });
    return nextMap;
  }, [vistoriadores]);

  const inspectionRows = useMemo(() => {
    const rows: InspectionRow[] = [];

    processos.forEach((processo) => {
      const protocolo = processo.protocolos;
      if (!protocolo) return;

      const vistoria = vistoriaMap[processo.id] || null;

      const stageStatuses: StageStatus[] = ([1, 2, 3] as const).map((etapa) => {
        const vistoriadorId = etapa === 1
          ? vistoria?.vistoriador_1_id || processo.vistoriador_id
          : etapa === 2
            ? vistoria?.vistoriador_2_id || null
            : vistoria?.vistoriador_3_id || null;

        const dataAtribuicao = etapa === 1
          ? vistoria?.data_1_atribuicao || null
          : etapa === 2
            ? vistoria?.data_2_atribuicao || null
            : vistoria?.data_3_atribuicao || null;

        const dataVistoria = etapa === 1
          ? vistoria?.data_1_vistoria || null
          : etapa === 2
            ? vistoria?.data_2_vistoria || null
            : vistoria?.data_3_vistoria || null;

        const resultado = etapa === 1
          ? vistoria?.status_1_vistoria || null
          : etapa === 2
            ? vistoria?.status_2_vistoria || null
            : vistoria?.status_3_vistoria || null;

        return {
          etapa,
          vistoriadorId,
          vistoriadorNome: vistoriadorId ? (vistoriadorNameMap[vistoriadorId] || "Vistoriador não identificado") : null,
          status: getStageProcessStatus(dataAtribuicao, resultado, Boolean(vistoriadorId)),
          dataAtribuicao,
          dataVistoria,
        };
      });

      const involvedStages = stageStatuses.filter((stage) => stage.vistoriadorId || stage.status);
      if (involvedStages.length === 0) return;

      const currentProcessStatus = resolveConsistentDisplayStatus({
        dbStatus: processo.status,
        vistoria,
        dataSolicitacao: protocolo.data_solicitacao,
        pausas: pausasByProcesso[processo.id] || [],
        termoValidade: termosMap[processo.id] || null,
      });

      const effectiveDate = getLatestDate([
        ...stageStatuses.flatMap((stage) => [stage.dataVistoria, stage.dataAtribuicao]),
        protocolo.data_solicitacao,
      ]);

      const vistoriadoresDaLinha = Array.from(new Set(
        involvedStages
          .map((stage) => stage.vistoriadorNome)
          .filter((name): name is string => Boolean(name))
      ));

      rows.push({
        id: processo.id,
        processoId: processo.id,
        protocoloId: processo.protocolo_id,
        protocoloNumero: protocolo.numero,
        empresa: protocolo.nome_fantasia || protocolo.razao_social,
        razaoSocial: protocolo.razao_social,
        municipio: protocolo.municipio,
        bairro: protocolo.bairro,
        dataSolicitacao: protocolo.data_solicitacao,
        vistoriadores: vistoriadoresDaLinha,
        stageStatuses,
        effectiveDate,
        currentProcessStatus,
        eventoUnico: protocolo.evento_unico,
        ligarAntes: protocolo.ligar_antes,
        telefoneContato: protocolo.telefone_contato,
        urgente: protocolo.urgente,
        motivoUrgencia: protocolo.motivo_urgencia,
      });
    });

    return rows.sort((a, b) => {
      return b.effectiveDate.localeCompare(a.effectiveDate);
    });
  }, [processos, vistoriaMap, vistoriadorNameMap, pausasByProcesso, termosMap]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inspectionRows.filter((row) => {
      if (
        selectedVistoriador !== "all" &&
        !row.stageStatuses.some((stage) => stage.vistoriadorId === selectedVistoriador)
      ) {
        return false;
      }

      if (selectedStatuses.length > 0 && !selectedStatuses.includes(row.currentProcessStatus)) {
        return false;
      }

      if (startDate && row.effectiveDate < startDate) {
        return false;
      }

      if (endDate && row.effectiveDate > endDate) {
        return false;
      }

      if (query) {
        const haystack = [
          row.protocoloNumero,
          row.empresa,
          row.razaoSocial,
          row.vistoriadores.join(" "),
          row.municipio,
          row.bairro,
        ].join(" ").toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [endDate, inspectionRows, search, selectedStatuses, selectedVistoriador, startDate]);

  const statusCounts = useMemo(() => {
    const counts: Record<ProcessStatusFilter, number> = {
      all: 0,
      regional: 0,
      aguardando_retorno: 0,
      atribuido: 0,
      pendencias: 0,
      certificado_termo: 0,
      certificado: 0,
      expirado: 0,
      cancelado: 0,
    };

    inspectionRows.forEach((row) => {
      if (
        selectedVistoriador !== "all" &&
        !row.stageStatuses.some((stage) => stage.vistoriadorId === selectedVistoriador)
      ) {
        return;
      }

      if (startDate && row.effectiveDate < startDate) {
        return;
      }

      if (endDate && row.effectiveDate > endDate) {
        return;
      }

      const query = search.trim().toLowerCase();
      if (query) {
        const haystack = [
          row.protocoloNumero,
          row.empresa,
          row.razaoSocial,
          row.vistoriadores.join(" "),
          row.municipio,
          row.bairro,
        ].join(" ").toLowerCase();

        if (!haystack.includes(query)) {
          return;
        }
      }

      counts.all += 1;
      counts[row.currentProcessStatus] += 1;
    });

    return counts;
  }, [endDate, inspectionRows, search, selectedVistoriador, startDate]);

  useEffect(() => {
    const updateScrollbarWidth = () => {
      setTopScrollbarWidth(tableRef.current?.scrollWidth || 0);
    };

    updateScrollbarWidth();

    if (!tableRef.current) return;

    const observer = new ResizeObserver(() => {
      updateScrollbarWidth();
    });

    observer.observe(tableRef.current);
    window.addEventListener("resize", updateScrollbarWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScrollbarWidth);
    };
  }, [filteredRows, selectedStatuses]);

  const handleTopScroll = () => {
    if (!topScrollRef.current) return;
    if (syncingScrollRef.current === "bottom") {
      syncingScrollRef.current = null;
      return;
    }

    syncingScrollRef.current = "top";
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (!tableScrollRef.current) return;
    if (syncingScrollRef.current === "top") {
      syncingScrollRef.current = null;
      return;
    }

    syncingScrollRef.current = "bottom";
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  if (activeRole === "vistoriador") {
    return <Navigate to="/vistorias" replace />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-foreground">Vistoriantes</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Consulte as vistorias realizadas ou previstas por vistoriador.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(220px,1fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)] gap-3 items-end">
        <div className="space-y-1.5 min-w-0">
          <label className="text-sm font-medium text-foreground">Busca</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por protocolo, empresa, vistoriador ou local..."
              className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Vistoriador</label>
          <Select value={selectedVistoriador} onValueChange={setSelectedVistoriador}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um vistoriador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vistoriadores</SelectItem>
              {vistoriadores.map((vistoriador) => (
                <SelectItem key={vistoriador.user_id} value={vistoriador.user_id}>
                  {formatProfileName(vistoriador)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Data inicial</label>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Data final</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap justify-start gap-2">
          {STATUS_OPTIONS.map((status) => {
            const isActive = status.value === "all"
              ? selectedStatuses.length === 0
              : selectedStatuses.includes(status.value as DisplayStatus);
            return (
              <button
                key={status.value}
                onClick={() => handleStatusClick(status.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {status.label} ({statusCounts[status.value]})
              </button>
            );
          })}
        </div>

        <div className="mt-0">
          <div className="text-sm text-muted-foreground mb-3">
            {filteredRows.length} vistoria{filteredRows.length !== 1 ? "s" : ""} encontrada{filteredRows.length !== 1 ? "s" : ""}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Nenhuma vistoria encontrada com os filtros selecionados</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="overflow-x-auto overflow-y-hidden border-b border-border"
              >
                <div style={{ width: `${topScrollbarWidth}px`, height: "1px" }} />
              </div>
              <div ref={tableScrollRef} onScroll={handleBottomScroll} className="overflow-x-auto">
                <table ref={tableRef} className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Nº Protocolo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Empresa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Vistoriador(es)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">1ª vistoria</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">2ª vistoria</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">3ª vistoria</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Status atual</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Última data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Local</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => navigate(`/protocolo/${row.protocoloId}`)}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {row.protocoloNumero}
                        </td>
                        <td className="px-4 py-3 min-w-[240px]">
                          <div className="font-medium text-foreground">{row.empresa}</div>
                          {row.empresa !== row.razaoSocial && (
                            <div className="text-xs text-muted-foreground truncate">{row.razaoSocial}</div>
                          )}
                          {(row.eventoUnico || row.ligarAntes || row.urgente) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {row.urgente && (
                                <span className="inline-flex py-0.5 px-2 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-300">
                                  Urgente{row.motivoUrgencia ? `: ${row.motivoUrgencia}` : ""}
                                </span>
                              )}
                              {row.eventoUnico && (
                                <span className="inline-flex py-0.5 px-2 rounded-full text-[10px] font-medium bg-cyan-100 text-cyan-700 border border-cyan-400">
                                  Evento Unico
                                </span>
                              )}
                              {row.ligarAntes && (
                                <span className="inline-flex py-0.5 px-2 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-300">
                                  Ligar antes{row.telefoneContato ? `: ${row.telefoneContato}` : ""}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 min-w-[220px] text-muted-foreground">
                          <div className="space-y-1">
                            {row.vistoriadores.map((vistoriador) => (
                              <div key={vistoriador} className="truncate">{vistoriador}</div>
                            ))}
                          </div>
                        </td>
                        {row.stageStatuses.map((stage) => (
                          <td key={stage.etapa} className="px-4 py-3 whitespace-nowrap">
                            {stage.status ? (
                              <div className="flex flex-col items-start gap-1.5">
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", displayStatusBadgeClass[stage.status])}>
                                  {stage.status === "pendencias" ? "Com pendência" : displayStatusLabels[stage.status]}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {stage.dataVistoria ? `Vist.: ${formatDate(stage.dataVistoria)}` : `Atrib.: ${formatDate(stage.dataAtribuicao)}`}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", displayStatusBadgeClass[row.currentProcessStatus])}>
                            {row.currentProcessStatus === "pendencias" ? "Com pendência" : displayStatusLabels[row.currentProcessStatus]}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(row.effectiveDate || null)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          <div className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            {row.bairro}, {row.municipio}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}