import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, FileText, ChevronDown, ChevronUp, Plus, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
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

type SortKey = "numero" | "data_solicitacao" | "razao_social" | "municipio" | "bairro" | "status";

export default function ProtocolosPage() {
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [vistoriaMap, setVistoriaMap] = useState<Record<string, VistoriaData>>({});
  const [pausasByProcesso, setPausasByProcesso] = useState<Record<string, DeadlinePausaData[]>>({});
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [termosMap, setTermosMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "termo_vencido" | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("data_solicitacao");
  const [sortAsc, setSortAsc] = useState(true);
  const navigate = useNavigate();

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

  const processoByProtocolo = useMemo(() => {
    const map: Record<string, Processo> = {};
    processos.forEach((p) => { map[p.protocolo_id] = p; });
    return map;
  }, [processos]);

  const getDisplayInfo = (protocoloId: string): { status: DisplayStatus; stage: VistoriaStage } | null => {
    const proc = processoByProtocolo[protocoloId];
    if (!proc) return null;
    const vistoria = vistoriaMap[proc.id] || null;
    return {
      status: computeDisplayStatus(proc.status, vistoria),
      stage: computeStage(vistoria),
    };
  };

  const getDeadline = (protocoloId: string): DeadlineResult | null => {
    const proc = processoByProtocolo[protocoloId];
    if (!proc) return null;
    const vistoria = vistoriaMap[proc.id] || null;
    const info = getDisplayInfo(protocoloId);
    return computeDeadline(vistoria, pausasByProcesso[proc.id] || [], info?.status, termosMap[proc.id] || null);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = protocolos;
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
    if (statusFilter) {
      list = list.filter((p) => {
        const info = getDisplayInfo(p.id);
        if (statusFilter === "termo_vencido") {
          if (info?.status !== "certificado_termo") return false;
          const dl = getDeadline(p.id);
          return dl && dl.active && dl.remaining <= 0;
        }
        return info?.status === statusFilter;
      });
    }
    return [...list].sort((a, b) => {
      let va: string, vb: string;
      if (sortKey === "status") {
        va = getDisplayInfo(a.id)?.status || "zzz";
        vb = getDisplayInfo(b.id)?.status || "zzz";
      } else {
        va = (a[sortKey] || "") as string;
        vb = (b[sortKey] || "") as string;
      }
      const cmp = va.localeCompare(vb);
      return sortAsc ? cmp : -cmp;
    });
  }, [protocolos, search, statusFilter, sortKey, sortAsc, processoByProtocolo, vistoriaMap]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Protocolos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {protocolos.length} protocolo{protocolos.length !== 1 ? "s" : ""} cadastrado{protocolos.length !== 1 ? "s" : ""}
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DisplayStatus | "termo_vencido" | "")}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
          >
            <option value="">Todos os status</option>
            {(Object.entries(displayStatusLabels) as [DisplayStatus, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
            <option value="termo_vencido">Cert. Provisório Vencido</option>
          </select>
          <button
            onClick={() => navigate("/cadastro-protocolo")}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Novo Protocolo
          </button>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                  const info = getDisplayInfo(p.id);
                  const dl = getDeadline(p.id);
                  const dlActive = dl && dl.active;
                  return (
                    <tr key={p.id} className={cn("hover:bg-muted/30 transition-colors cursor-pointer", dlActive && dl.remaining <= 0 && "bg-destructive/5")} onClick={() => navigate(`/protocolo/${p.id}`)}>
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        {p.numero}
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
