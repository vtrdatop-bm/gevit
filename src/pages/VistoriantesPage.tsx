import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardList, MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  type DisplayStatus,
  type VistoriaData,
  computeDisplayStatus,
  displayStatusBadgeClass,
  displayStatusLabels,
  sortVistoriadores,
} from "@/lib/vistoriaStatus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type InspectionStatus =
  | "atribuida"
  | "agendada"
  | "realizada"
  | "aguardando_retorno"
  | "pendencia"
  | "aprovada"
  | "reprovada";

type InspectionStatusFilter = "all" | InspectionStatus;

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
  etapa: 1 | 2 | 3;
  vistoriadorId: string;
  vistoriadorNome: string;
  status: InspectionStatus;
  dataAtribuicao: string | null;
  dataVistoria: string | null;
  dataRetorno: string | null;
  effectiveDate: string;
  currentProcessStatus: DisplayStatus;
}

const STATUS_OPTIONS: { value: InspectionStatusFilter; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "atribuida", label: "Atribuída" },
  { value: "agendada", label: "Agendada" },
  { value: "realizada", label: "Realizada" },
  { value: "aguardando_retorno", label: "Aguardando retorno" },
  { value: "pendencia", label: "Com pendência" },
  { value: "aprovada", label: "Aprovada" },
  { value: "reprovada", label: "Reprovada" },
];

const inspectionStatusMeta: Record<InspectionStatus, { label: string; className: string }> = {
  atribuida: { label: "Atribuída", className: "bg-[hsl(var(--status-assigned))]/10 text-[hsl(var(--status-assigned))] border-[hsl(var(--status-assigned))]/20" },
  agendada: { label: "Agendada", className: "bg-primary/10 text-primary border-primary/20" },
  realizada: { label: "Realizada", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  aguardando_retorno: { label: "Aguardando retorno", className: "bg-[hsl(var(--status-retorno))]/10 text-[hsl(var(--status-retorno))] border-[hsl(var(--status-retorno))]/20" },
  pendencia: { label: "Com pendência", className: "bg-[hsl(var(--status-pending))]/10 text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending))]/20" },
  aprovada: { label: "Aprovada", className: "bg-[hsl(var(--status-certified-term))]/10 text-[hsl(var(--status-certified-term))] border-[hsl(var(--status-certified-term))]/20" },
  reprovada: { label: "Reprovada", className: "bg-[hsl(var(--status-certified))]/10 text-[hsl(var(--status-certified))] border-[hsl(var(--status-certified))]/20" },
};

function formatProfileName(profile: Profile) {
  return [profile.patente, profile.nome_guerra].filter(Boolean).join(" ") || "Sem nome";
}

function getInspectionStatus(
  dataVistoria: string | null,
  dataRetorno: string | null,
  resultado: string | null
): InspectionStatus {
  if (resultado === "pendencia") return "pendencia";
  if (resultado === "aprovado") return "aprovada";
  if (resultado === "reprovado") return "reprovada";
  if (dataRetorno) return "aguardando_retorno";
  if (dataVistoria) {
    const today = new Date();
    const inspectionDate = new Date(`${dataVistoria}T00:00:00`);
    today.setHours(0, 0, 0, 0);
    return inspectionDate >= today ? "agendada" : "realizada";
  }
  return "atribuida";
}

function formatDate(date: string | null) {
  return date ? new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR") : "-";
}

export default function VistoriantesPage() {
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<ProcessoComProtocolo[]>([]);
  const [vistoriaMap, setVistoriaMap] = useState<Record<string, RawVistoria>>({});
  const [vistoriadores, setVistoriadores] = useState<Profile[]>([]);
  const [selectedVistoriador, setSelectedVistoriador] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const [{ data: procs }, { data: vists }, { data: profs }, { data: roleRows }] = await Promise.all([
        supabase
          .from("processos")
          .select("id, protocolo_id, status, data_prevista, vistoriador_id, protocolos(numero, razao_social, nome_fantasia, bairro, municipio, data_solicitacao)"),
        supabase
          .from("vistorias")
          .select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno, vistoriador_1_id, vistoriador_2_id, vistoriador_3_id"),
        supabase.from("profiles").select("user_id, patente, nome_guerra"),
        supabase.from("user_roles").select("user_id").eq("role", "vistoriador"),
      ]);

      setProcessos(((procs as unknown as ProcessoComProtocolo[]) || []).filter((processo) => !!processo.protocolos));

      const nextVistoriaMap: Record<string, RawVistoria> = {};
      ((vists as RawVistoria[]) || []).forEach((vistoria) => {
        nextVistoriaMap[vistoria.processo_id] = vistoria;
      });
      setVistoriaMap(nextVistoriaMap);

      const vistoriadorIds = new Set(((roleRows as { user_id: string }[]) || []).map((row) => row.user_id));
      const nextProfiles = sortVistoriadores(
        (((profs as Profile[]) || []).filter((profile) => vistoriadorIds.has(profile.user_id)))
      );
      setVistoriadores(nextProfiles);
      setLoading(false);
    }

    void loadData();
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
      const currentProcessStatus = computeDisplayStatus(processo.status, vistoria, protocolo.data_solicitacao);

      ([1, 2, 3] as const).forEach((etapa) => {
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

        const dataRetorno = etapa === 1
          ? vistoria?.data_1_retorno || null
          : etapa === 2
            ? vistoria?.data_2_retorno || null
            : null;

        if (!vistoriadorId) return;

        const effectiveDate = dataVistoria || dataAtribuicao || protocolo.data_solicitacao;

        rows.push({
          id: `${processo.id}-${etapa}`,
          processoId: processo.id,
          protocoloId: processo.protocolo_id,
          protocoloNumero: protocolo.numero,
          empresa: protocolo.nome_fantasia || protocolo.razao_social,
          razaoSocial: protocolo.razao_social,
          municipio: protocolo.municipio,
          bairro: protocolo.bairro,
          dataSolicitacao: protocolo.data_solicitacao,
          etapa,
          vistoriadorId,
          vistoriadorNome: vistoriadorNameMap[vistoriadorId] || "Vistoriador não identificado",
          status: getInspectionStatus(dataVistoria, dataRetorno, resultado),
          dataAtribuicao,
          dataVistoria,
          dataRetorno,
          effectiveDate,
          currentProcessStatus,
        });
      });
    });

    return rows.sort((a, b) => {
      return b.effectiveDate.localeCompare(a.effectiveDate);
    });
  }, [processos, vistoriaMap, vistoriadorNameMap]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inspectionRows.filter((row) => {
      if (selectedVistoriador !== "all" && row.vistoriadorId !== selectedVistoriador) {
        return false;
      }

      if (selectedStatus !== "all" && row.status !== selectedStatus) {
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
          row.vistoriadorNome,
          row.municipio,
          row.bairro,
        ].join(" ").toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [endDate, inspectionRows, search, selectedStatus, selectedVistoriador, startDate]);

  const statusCounts = useMemo(() => {
    const counts: Record<InspectionStatusFilter, number> = {
      all: 0,
      atribuida: 0,
      agendada: 0,
      realizada: 0,
      aguardando_retorno: 0,
      pendencia: 0,
      aprovada: 0,
      reprovada: 0,
    };

    inspectionRows.forEach((row) => {
      if (selectedVistoriador !== "all" && row.vistoriadorId !== selectedVistoriador) {
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
          row.vistoriadorNome,
          row.municipio,
          row.bairro,
        ].join(" ").toLowerCase();

        if (!haystack.includes(query)) {
          return;
        }
      }

      counts.all += 1;
      counts[row.status] += 1;
    });

    return counts;
  }, [endDate, inspectionRows, search, selectedVistoriador, startDate]);

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="space-y-1.5 xl:col-span-2">
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
            <SelectTrigger>
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

      <Tabs value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as InspectionStatusFilter)} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          {STATUS_OPTIONS.map((status) => (
            <TabsTrigger
              key={status.value}
              value={status.value}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {status.label} ({statusCounts[status.value]})
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_OPTIONS.map((status) => (
          <TabsContent key={status.value} value={status.value} className="mt-0">
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Nº Protocolo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Empresa</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Vistoriador</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Etapa</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground tracking-wider">Data vistoria</th>
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
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {row.vistoriadorNome}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-2 text-foreground">
                              <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
                              {row.etapa}ª vistoria
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1.5">
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", inspectionStatusMeta[row.status].className)}>
                                {inspectionStatusMeta[row.status].label}
                              </span>
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", displayStatusBadgeClass[row.currentProcessStatus])}>
                                {displayStatusLabels[row.currentProcessStatus]}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            <div>{formatDate(row.dataVistoria)}</div>
                            <div className="text-xs text-muted-foreground/80">Atrib.: {formatDate(row.dataAtribuicao)}</div>
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
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}