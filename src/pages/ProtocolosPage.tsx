import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, FileText, ChevronDown, ChevronUp, Plus, AlertTriangle, Clock, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DisplayStatus,
  VistoriaStage,
  VistoriaData,
  computeDisplayStatus,
  computeStage,
  displayStatusLabels,
  displayStatusBadgeClass,
  getCurrentVistoriadorId,
} from "@/lib/vistoriaStatus";
import { computeDeadline, deadlineColorClass, DeadlineResult, PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";

interface Protocolo {
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
  created_at: string;
}

interface Processo {
  id: string;
  protocolo_id: string;
  status: string;
  regional_id: string | null;
  data_prevista: string | null;
  vistoriador_id: string | null;
}

interface TimelineSnapshot {
  status: DisplayStatus;
  stage: VistoriaStage;
  date: Date;
}

type SortKey = "numero" | "data_solicitacao" | "razao_social" | "municipio" | "bairro" | "status";
type StatusFilterValue = DisplayStatus | "termo_vencido";

export default function ProtocolosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredFilters = (location.state as {
    protocolosBackFilters?: {
      search?: string;
      statusFilter?: StatusFilterValue[];
      municipioFilter?: string;
      vistoriadorFilter?: string;
      startDateFilter?: string;
      endDateFilter?: string;
      sortKey?: SortKey;
      sortAsc?: boolean;
    };
  } | null)?.protocolosBackFilters;

  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [vistoriaMap, setVistoriaMap] = useState<Record<string, VistoriaData>>({});
  const [pausasByProcesso, setPausasByProcesso] = useState<Record<string, DeadlinePausaData[]>>({});
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [termosMap, setTermosMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(restoredFilters?.search || "");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue[]>(restoredFilters?.statusFilter || []);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [municipioFilter, setMunicipioFilter] = useState(restoredFilters?.municipioFilter || "");
  const [vistoriadorFilter, setVistoriadorFilter] = useState(restoredFilters?.vistoriadorFilter || "");
  const [startDateFilter, setStartDateFilter] = useState(restoredFilters?.startDateFilter || "");
  const [endDateFilter, setEndDateFilter] = useState(restoredFilters?.endDateFilter || "");
  const [sortKey, setSortKey] = useState<SortKey>(restoredFilters?.sortKey || "data_solicitacao");
  const [sortAsc, setSortAsc] = useState(restoredFilters?.sortAsc ?? true);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);

  const { isDev } = useAuth();

  useEffect(() => {
    if (isDev) {
      const mockProt: Protocolo[] = [
        {
          id: "p1",
          numero: "VT2024.0001.0001-01",
          data_solicitacao: "2024-03-20",
          cnpj: "12345678000190",
          razao_social: "Comércio de Alimentos Silva Ltda",
          nome_fantasia: "Mercado Silva",
          endereco: "Rua das Flores, 123",
          bairro: "Centro",
          municipio: "Rio Branco",
          area: 150,
          created_at: new Date().toISOString(),
        },
        {
          id: "p2",
          numero: "VT2024.0001.0002-02",
          data_solicitacao: "2024-03-21",
          cnpj: "98765432000110",
          razao_social: "Posto de Combustíveis Acreano",
          nome_fantasia: null,
          endereco: "Av. Brasil, s/n",
          bairro: "Distrito Industrial",
          municipio: "Senador Guiomard",
          area: 1200,
          created_at: new Date().toISOString(),
        }
      ];
      const mockProc: Processo[] = [
        { id: "proc1", protocolo_id: "p1", status: "regional", regional_id: "r1", data_prevista: "2024-04-05", vistoriador_id: "v1" },
        { id: "proc2", protocolo_id: "p2", status: "certificado", regional_id: "r2", data_prevista: "2024-03-25", vistoriador_id: "v1" }
      ];
      setProtocolos(mockProt);
      setProcessos(mockProc);
      setVistoriaMap({
        "proc1": { processo_id: "proc1", data_1_atribuicao: "2024-03-22" } as any,
        "proc2": { processo_id: "proc2", data_1_atribuicao: "2024-03-22", data_1_vistoria: "2024-03-24", status_1_vistoria: "aprovado" } as any
      });
      setProfileMap({ "v1": "Administrador (Dev)" });
      setLoading(false);
      return;
    }

    Promise.all([
      supabase.from("protocolos").select("*").order("created_at", { ascending: false }),
      supabase.from("processos").select("id, protocolo_id, status, regional_id, data_prevista, vistoriador_id"),
      supabase.from("vistorias").select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno, vistoriador_1_id, vistoriador_2_id, vistoriador_3_id"),
      supabase.from("profiles").select("user_id, patente, nome_guerra"),
      supabase.from("pausas").select("processo_id, data_inicio, data_fim, etapa"),
      supabase.from("termos_compromisso").select("processo_id, data_validade"),
    ]).then(([{ data: p }, { data: proc }, { data: vist }, { data: profiles }, { data: pausas }, { data: termos }]) => {
      setProtocolos(p || []);
      setProcessos(proc || []);
      const vm: Record<string, VistoriaData> = {};
      (vist || []).forEach((v: any) => { vm[v.processo_id] = v; });
      setVistoriaMap(vm);
      const pm: Record<string, string> = {};
      (profiles || []).forEach((pr: any) => { pm[pr.user_id] = [pr.patente, pr.nome_guerra].filter(Boolean).join(" "); });
      setProfileMap(pm);
      const pMap: Record<string, DeadlinePausaData[]> = {};
      (pausas || []).forEach((pa: any) => {
        if (!pMap[pa.processo_id]) pMap[pa.processo_id] = [];
        pMap[pa.processo_id].push(pa);
      });
      setPausasByProcesso(pMap);
      const tMap: Record<string, string> = {};
      (termos || []).forEach((t: any) => { tMap[t.processo_id] = t.data_validade; });
      setTermosMap(tMap);
      
      // Update the processes with the correct vistoriador_id from vistorias if available
      const updatedProcessos = (proc || []).map(p => {
        const v = vm[p.id];
        if (v) {
          return { ...p, vistoriador_id: getCurrentVistoriadorId(p.vistoriador_id, v) };
        }
        return p;
      });
      setProcessos(updatedProcessos as Processo[]);
      
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!statusDropdownRef.current) return;
      if (!statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const processoByProtocolo = useMemo(() => {
    const map: Record<string, Processo> = {};
    processos.forEach((p) => { map[p.protocolo_id] = p; });
    return map;
  }, [processos]);

  const protocolosComProcesso = useMemo(() => {
    return protocolos;
  }, [protocolos]);

  const protocoloById = useMemo(() => {
    const map: Record<string, Protocolo> = {};
    protocolos.forEach((p) => { map[p.id] = p; });
    return map;
  }, [protocolos]);

  const getDisplayInfo = (protocoloId: string): { status: DisplayStatus; stage: VistoriaStage } | null => {
    const proc = processoByProtocolo[protocoloId];
    if (!proc) {
      return { status: "regional", stage: 1 };
    }
    const vistoria = vistoriaMap[proc.id] || null;
    const proto = protocoloById[protocoloId];
    
    const baseStatus = computeDisplayStatus(proc.status, vistoria, proto?.data_solicitacao);
    const stage = computeStage(vistoria);
    
    // Check if it should be "expirado" based on deadline
    const deadline = computeDeadline(vistoria, pausasByProcesso[proc.id] || [], baseStatus, termosMap[proc.id] || null);
    
    let finalStatus = baseStatus;
    if (deadline.active && deadline.remaining <= 0 && deadline.type === "expiration") {
      finalStatus = "expirado";
    }

    return {
      status: finalStatus,
      stage,
    };
  };

  const getDeadline = (protocoloId: string): DeadlineResult | null => {
    const proc = processoByProtocolo[protocoloId];
    if (!proc) return null;
    const vistoria = vistoriaMap[proc.id] || null;
    const info = getDisplayInfo(protocoloId);
    // Note: getDisplayInfo already returns the final (override) status,
    // which is fine for computeDeadline as it primarily needs to know if it's "certificado_termo" or not.
    return computeDeadline(vistoria, pausasByProcesso[proc.id] || [], info?.status, termosMap[proc.id] || null);
  };

  const uniqueMunicipios = useMemo(() => {
    const set = new Set(protocolosComProcesso.map(p => p.municipio).filter(Boolean));
    return Array.from(set).sort();
  }, [protocolosComProcesso]);

  const uniqueVistoriadores = useMemo(() => {
    const set = new Set<string>();
    processos.forEach((proc) => {
      if (proc.vistoriador_id) {
        set.add(proc.vistoriador_id);
      }
    });

    return Array.from(set)
      .map((id) => ({
        id,
        label: profileMap[id] || "Vistoriador sem nome",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [processos, profileMap]);

  const statusOptions = useMemo<{ value: StatusFilterValue; label: string }[]>(() => {
    return [
      ...(Object.entries(displayStatusLabels) as [DisplayStatus, string][]).map(([value, label]) => ({ value, label })),
      { value: "termo_vencido", label: "Cert. Provisorio Vencido" },
    ];
  }, []);

  const hasPeriodFilter = Boolean(startDateFilter || endDateFilter);

  const mapInspectionStatusToDisplay = (status: string | null | undefined, stage: 1 | 2 | 3): DisplayStatus | null => {
    if (!status) return null;
    if (status === "pendencia") return stage === 3 ? "expirado" : "pendencias";
    if (status === "aprovado") return "certificado_termo";
    if (status === "reprovado") return "certificado";
    return null;
  };

  const periodSnapshotByProtocolo = useMemo(() => {
    if (!hasPeriodFilter) return {} as Record<string, TimelineSnapshot>;

    const start = startDateFilter ? new Date(`${startDateFilter}T00:00:00`) : null;
    const effectiveEndDate = endDateFilter || startDateFilter;
    const end = effectiveEndDate ? new Date(`${effectiveEndDate}T23:59:59.999`) : null;

    const snapshots: Record<string, TimelineSnapshot> = {};

    protocolosComProcesso.forEach((protocolo) => {
      const proc = processoByProtocolo[protocolo.id];
      const vistoria = proc ? vistoriaMap[proc.id] : null;

      const timeline: TimelineSnapshot[] = [];

      if (protocolo.data_solicitacao) {
        timeline.push({
          date: new Date(`${protocolo.data_solicitacao}T00:00:00`),
          status: "regional",
          stage: 1,
        });
      }

      if (vistoria?.data_1_atribuicao) {
        timeline.push({ date: new Date(`${vistoria.data_1_atribuicao}T00:00:00`), status: "atribuido", stage: 1 });
      }
      if (vistoria?.data_1_vistoria) {
        const status = mapInspectionStatusToDisplay(vistoria.status_1_vistoria, 1);
        if (status) timeline.push({ date: new Date(`${vistoria.data_1_vistoria}T00:00:00`), status, stage: 1 });
      }
      if (vistoria?.data_1_retorno) {
        timeline.push({ date: new Date(`${vistoria.data_1_retorno}T00:00:00`), status: "regional", stage: 2 });
      }

      if (vistoria?.data_2_atribuicao) {
        timeline.push({ date: new Date(`${vistoria.data_2_atribuicao}T00:00:00`), status: "atribuido", stage: 2 });
      }
      if (vistoria?.data_2_vistoria) {
        const status = mapInspectionStatusToDisplay(vistoria.status_2_vistoria, 2);
        if (status) timeline.push({ date: new Date(`${vistoria.data_2_vistoria}T00:00:00`), status, stage: 2 });
      }
      if (vistoria?.data_2_retorno) {
        timeline.push({ date: new Date(`${vistoria.data_2_retorno}T00:00:00`), status: "regional", stage: 3 });
      }

      if (vistoria?.data_3_atribuicao) {
        timeline.push({ date: new Date(`${vistoria.data_3_atribuicao}T00:00:00`), status: "atribuido", stage: 3 });
      }
      if (vistoria?.data_3_vistoria) {
        const status = mapInspectionStatusToDisplay(vistoria.status_3_vistoria, 3);
        if (status) timeline.push({ date: new Date(`${vistoria.data_3_vistoria}T00:00:00`), status, stage: 3 });
      }

      const inRange = timeline.filter((item) => {
        if (start && item.date < start) return false;
        if (end && item.date > end) return false;
        return true;
      });

      if (inRange.length === 0) return;

      inRange.sort((a, b) => a.date.getTime() - b.date.getTime());
      snapshots[protocolo.id] = inRange[inRange.length - 1];
    });

    return snapshots;
  }, [hasPeriodFilter, startDateFilter, endDateFilter, protocolosComProcesso, processoByProtocolo, vistoriaMap]);

  const getEffectiveDisplayInfo = (protocoloId: string): { status: DisplayStatus; stage: VistoriaStage } | null => {
    if (hasPeriodFilter) {
      const snapshot = periodSnapshotByProtocolo[protocoloId];
      if (!snapshot) return null;
      return { status: snapshot.status, stage: snapshot.stage };
    }

    return getDisplayInfo(protocoloId);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = protocolosComProcesso;
    if (q) {
      list = list.filter((p) =>
        p.numero.toLowerCase().includes(q) ||
        p.razao_social.toLowerCase().includes(q) ||
        (p.nome_fantasia || "").toLowerCase().includes(q) ||
        p.cnpj.includes(q) ||
        p.municipio.toLowerCase().includes(q) ||
        p.bairro.toLowerCase().includes(q)
      );
    }
    if (statusFilter.length > 0) {
      list = list.filter((p) => {
        const info = getEffectiveDisplayInfo(p.id);
        return statusFilter.some((selectedStatus) => {
          if (selectedStatus === "termo_vencido") {
            if (info?.status !== "certificado_termo") return false;
            const dl = getDeadline(p.id);
            return Boolean(dl && dl.active && dl.remaining <= 0);
          }

          return info?.status === selectedStatus;
        });
      });
    }
    if (municipioFilter) {
      list = list.filter((p) => p.municipio === municipioFilter);
    }

    if (vistoriadorFilter) {
      list = list.filter((p) => {
        const proc = processoByProtocolo[p.id];
        return proc?.vistoriador_id === vistoriadorFilter;
      });
    }

    if (hasPeriodFilter) {
      list = list.filter((p) => Boolean(periodSnapshotByProtocolo[p.id]));
    }

    return [...list].sort((a, b) => {
      let va: string, vb: string;
      if (sortKey === "status") {
        va = getEffectiveDisplayInfo(a.id)?.status || "zzz";
        vb = getEffectiveDisplayInfo(b.id)?.status || "zzz";
      } else {
        va = (a[sortKey] || "") as string;
        vb = (b[sortKey] || "") as string;
      }
      const cmp = va.localeCompare(vb);
      
      // Se as datas de solicitação forem iguais, desempatar pela data de criação (primeiros inseridos em cima)
      if (cmp === 0 && sortKey === "data_solicitacao") {
        return a.created_at.localeCompare(b.created_at);
      }

      return sortAsc ? cmp : -cmp;
    });
  }, [protocolosComProcesso, search, statusFilter, municipioFilter, vistoriadorFilter, hasPeriodFilter, periodSnapshotByProtocolo, sortKey, sortAsc, processoByProtocolo, pausasByProcesso, termosMap]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleStatusFilter = (value: StatusFilterValue) => {
    setStatusFilter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const openProtocoloDetail = (protocoloId: string) => {
    navigate(location.pathname + location.search, {
      replace: true,
      state: {
        ...(location.state && typeof location.state === "object" ? location.state : {}),
        protocolosBackFilters: {
          search,
          statusFilter,
          municipioFilter,
          vistoriadorFilter,
          startDateFilter,
          endDateFilter,
          sortKey,
          sortAsc,
        },
      },
    });

    navigate(`/protocolo/${protocoloId}`);
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  );

  const formatCpfCnpj = (val: string) => {
    if (val.length === 11) return val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (val.length === 14) return val.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return val;
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full">
      <div className="space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold text-foreground">Protocolos</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {search || statusFilter.length > 0 || municipioFilter || vistoriadorFilter || startDateFilter || endDateFilter
                ? `${filtered.length} processos de ${protocolosComProcesso.length} processos`
                : `${protocolosComProcesso.length} processos`
              }
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nº, razão social, CNPJ, município..."
                className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              title="Data inicial"
              className="flex h-10 w-full sm:w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              title="Data final"
              className="flex h-10 w-full sm:w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              onClick={() => navigate("/cadastro-protocolo")}
              className="inline-flex items-center justify-center gap-2 px-4 h-10 w-full sm:w-auto rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Novo Protocolo
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div ref={statusDropdownRef} className="relative w-full sm:w-56">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen((open) => !open)}
              title="Filtrar por status"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate text-left">
                {statusFilter.length > 0 ? `${statusFilter.length} status selecionado(s)` : "Todos os status"}
              </span>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", statusDropdownOpen && "rotate-180")} />
            </button>
            {statusDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover p-2 shadow-md">
                <div className="max-h-64 overflow-auto space-y-1">
                  {statusOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(option.value)}
                        onChange={() => toggleStatusFilter(option.value)}
                        className="h-4 w-4"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <select
            value={municipioFilter}
            onChange={(e) => setMunicipioFilter(e.target.value)}
            title="Filtrar por município"
            className="flex h-10 w-full sm:w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos os municípios</option>
            {uniqueMunicipios.map((m) => (
              <option key={m} value={m}>{m.toUpperCase()}</option>
            ))}
          </select>
          <select
            value={vistoriadorFilter}
            onChange={(e) => setVistoriadorFilter(e.target.value)}
            title="Filtrar por vistoriador"
            className="flex h-10 w-full sm:w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos os vistoriadores</option>
            {uniqueVistoriadores.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {search ? "Nenhum protocolo encontrado" : "Nenhum protocolo cadastrado"}
            </p>
            {!search && (
              <button
                onClick={() => navigate("/cadastro-protocolo")}
                className="mt-3 text-sm text-primary hover:underline"
              >
                Cadastrar primeiro protocolo
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto [transform:rotateX(180deg)]">
            <table className="w-full text-sm [transform:rotateX(180deg)]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <SortHeader label="Nº Protocolo" field="numero" />
                  <SortHeader label="Data Solicit." field="data_solicitacao" />
                  <SortHeader label="Razão Social" field="razao_social" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">CPF/CNPJ</th>
                  <SortHeader label="Município" field="municipio" />
                  <SortHeader label="Bairro" field="bairro" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Vistoriador</th>
                  <SortHeader label="Status" field="status" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const info = getEffectiveDisplayInfo(p.id);
                  const dl = getDeadline(p.id);
                  const dlActive = dl && dl.active;
                  const isEventoUnico = !!p.evento_unico;
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors cursor-pointer",
                        dlActive && dl.remaining <= 0 && "bg-destructive/5",
                        isEventoUnico && "bg-fuchsia-100/60 border-fuchsia-400"
                      )}
                      style={isEventoUnico ? { borderLeft: '6px solid #d946ef' } : {}}
                      onClick={() => openProtocoloDetail(p.id)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {p.numero}
                          {isEventoUnico && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-fuchsia-600 text-white border border-fuchsia-700 ml-1" title="Evento Único">
                              Evento Único
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(p.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-[240px] truncate" title={p.razao_social}>
                        <div>{p.nome_fantasia || p.razao_social}</div>
                        {p.nome_fantasia && (
                          <div className="text-xs text-muted-foreground truncate">{p.razao_social}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-xs">
                        {formatCpfCnpj(p.cnpj)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {(p.municipio || "").toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {(p.bairro || "").toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {(() => {
                          const proc = processoByProtocolo[p.id];
                          const vid = proc?.vistoriador_id;
                          return vid ? profileMap[vid] || "—" : "—";
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {info ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", displayStatusBadgeClass[info.status])}>
                              {displayStatusLabels[info.status]}
                            </span>
                            {info.stage && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium stage-badge">
                                {info.stage}ª Vist.
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                            Sem processo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {dlActive ? (
                          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", deadlineColorClass(dl.remaining))}>
                            {dl.remaining <= 15 ? (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            {dl.remaining <= 0 ? (dl.type === "validity" ? "Vencido" : "Expirado") : `${dl.remaining}d`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
