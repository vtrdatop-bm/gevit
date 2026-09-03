import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, FileText, ChevronDown, ChevronUp, Plus, AlertTriangle, Clock, ArrowLeft, Calendar, User, CalendarOff, UserMinus, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DisplayStatus,
  VistoriaStage,
  VistoriaData,
  computeStage,
  displayStatusLabels,
  displayStatusBadgeClass,
  getCurrentVistoriadorId,
} from "@/lib/vistoriaStatus";
import { computeDeadline, deadlineColorClass, DeadlineResult, PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";
import { pickLatestProcessByProtocolo, resolveConsistentDisplayStatus, fetchAllRows } from "@/lib/processoConsistency";

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
  evento_unico?: boolean;
  agendar?: boolean;
  data_agendamento?: string | null;
}

interface Processo {
  id: string;
  protocolo_id: string;
  status: string;
  regional_id: string | null;
  data_prevista: string | null;
  vistoriador_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TimelineSnapshot {
  status: DisplayStatus;
  stage: VistoriaStage;
  date: Date;
}

type SortKey = "numero" | "data_solicitacao" | "razao_social" | "municipio" | "bairro" | "status";
type StatusFilterValue = DisplayStatus | "termo_vencido";

function getDisplayedRequestDateInfo(
  protocolo: Protocolo,
  processoByProtocolo: Record<string, Processo>,
  vistoriaMap: Record<string, VistoriaData>
): { prefix: "S" | "1R" | "2R"; date: string } {
  const processo = processoByProtocolo[protocolo.id];
  const vistoria = processo ? vistoriaMap[processo.id] : null;

  if (vistoria?.data_2_retorno) {
    return { prefix: "2R", date: vistoria.data_2_retorno };
  }

  if (vistoria?.data_1_retorno) {
    return { prefix: "1R", date: vistoria.data_1_retorno };
  }

  return { prefix: "S", date: protocolo.data_solicitacao };
}

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

  const [selectedProtocolIds, setSelectedProtocolIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [vistoriadores, setVistoriadores] = useState<{ id: string; name: string }[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedVistoriadorId, setSelectedVistoriadorId] = useState("");
  const [assignDate, setAssignDate] = useState("");

  const { isDev } = useAuth();

  const fetchData = useCallback(async () => {
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
        { id: "proc1", protocolo_id: "p1", status: "regional", regional_id: "r1", data_prevista: "2024-04-05", vistoriador_id: "v1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "proc2", protocolo_id: "p2", status: "certificado", regional_id: "r2", data_prevista: "2024-03-25", vistoriador_id: "v1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ];
      setProtocolos(mockProt);
      setProcessos(mockProc);
      setVistoriaMap({
        "proc1": { processo_id: "proc1", data_1_atribuicao: "2024-03-22" } as any,
        "proc2": { processo_id: "proc2", data_1_atribuicao: "2024-03-22", data_1_vistoria: "2024-03-24", status_1_vistoria: "aprovado" } as any
      });
      setProfileMap({ "v1": "Administrador (Dev)" });
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
      const [p, profiles, vRoles] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase
            .from("protocolos")
            .select(`
              *,
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
                  processo_id,
                  data_1_atribuicao,
                  data_2_atribuicao,
                  data_3_atribuicao,
                  data_1_vistoria,
                  data_2_vistoria,
                  data_3_vistoria,
                  status_1_vistoria,
                  status_2_vistoria,
                  status_3_vistoria,
                  data_1_retorno,
                  data_2_retorno,
                  vistoriador_1_id,
                  vistoriador_2_id,
                  vistoriador_3_id
                ),
                pausas(
                  processo_id,
                  data_inicio,
                  data_fim,
                  etapa
                ),
                termos_compromisso(
                  processo_id,
                  data_validade
                )
              )
            `)
            .order("created_at", { ascending: false })
            .range(from, to)
        ),
        supabase.from("profiles").select("user_id, patente, nome_guerra").then(res => res.data),
        supabase.from("user_roles").select("user_id").eq("role", "vistoriador").then(res => res.data),
      ]);

      // Unpack nested data to preserve identical flat patterns and maps
      const protocolsData = (p || []).map((proto: any) => {
        const { processos, ...rest } = proto;
        return rest;
      });

      const flatProcessos: any[] = [];
      const flatVistorias: any[] = [];
      const flatPausas: any[] = [];
      const flatTermos: any[] = [];

      (p || []).forEach((proto: any) => {
        const procs = proto.processos || [];
        procs.forEach((procItem: any) => {
          const { vistorias, pausas: pItems, termos_compromisso, ...procRest } = procItem;
          flatProcessos.push(procRest);

          if (vistorias) {
            if (Array.isArray(vistorias)) {
              flatVistorias.push(...vistorias);
            } else {
              flatVistorias.push(vistorias);
            }
          }
          if (pItems) {
            if (Array.isArray(pItems)) {
              flatPausas.push(...pItems);
            } else {
              flatPausas.push(pItems);
            }
          }
          if (termos_compromisso) {
            if (Array.isArray(termos_compromisso)) {
              flatTermos.push(...termos_compromisso);
            } else {
              flatTermos.push(termos_compromisso);
            }
          }
        });
      });

      setProtocolos(protocolsData || []);
      const vm: Record<string, VistoriaData> = {};
      flatVistorias.forEach((v: any) => { vm[v.processo_id] = v; });
      setVistoriaMap(vm);
      const pm: Record<string, string> = {};
      (profiles || []).forEach((pr: any) => { pm[pr.user_id] = [pr.patente, pr.nome_guerra].filter(Boolean).join(" "); });
      setProfileMap(pm);

      const vistoriadorUserIds = new Set((vRoles || []).map((r: any) => r.user_id));
      const listVistoriadores = (profiles || [])
        .filter((pr: any) => vistoriadorUserIds.has(pr.user_id))
        .map((pr: any) => ({
          id: pr.user_id,
          name: [pr.patente, pr.nome_guerra].filter(Boolean).join(" ")
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setVistoriadores(listVistoriadores);
      const pMap: Record<string, DeadlinePausaData[]> = {};
      flatPausas.forEach((pa: any) => {
        if (!pMap[pa.processo_id]) pMap[pa.processo_id] = [];
        pMap[pa.processo_id].push(pa);
      });
      setPausasByProcesso(pMap);
      const tMap: Record<string, string> = {};
      flatTermos.forEach((t: any) => { tMap[t.processo_id] = t.data_validade; });
      setTermosMap(tMap);

      // Keep inspector information aligned with the most recent stage in vistorias.
      const updatedProcessos = flatProcessos.map(p => {
        const v = vm[p.id];
        if (v) {
          return { ...p, vistoriador_id: getCurrentVistoriadorId(p.vistoriador_id, v) };
        }
        return p;
      });
      setProcessos(updatedProcessos as Processo[]);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }, [isDev]);

  useEffect(() => {
    fetchData();

    if (isDev) {
      return;
    }

    const channel = supabase
      .channel("protocolos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "protocolos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "processos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "vistorias" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pausas" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "termos_compromisso" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, isDev]);

  const handleBulkSchedule = async () => {
    if (selectedProtocolIds.length === 0 || !scheduledDate) return;
    try {
      if (isDev) {
        setProtocolos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.id)) {
              return {
                ...p,
                agendar: true,
                data_agendamento: scheduledDate,
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

  const handleBulkUnschedule = async () => {
    if (selectedProtocolIds.length === 0) return;
    try {
      if (isDev) {
        setProtocolos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.id)) {
              return {
                ...p,
                agendar: false,
                data_agendamento: null,
              };
            }
            return p;
          })
        );
      } else {
        const { error } = await supabase
          .from("protocolos")
          .update({
            agendar: false,
            data_agendamento: null
          })
          .in("id", selectedProtocolIds);

        if (error) throw error;
      }
      toast.success(`${selectedProtocolIds.length} agendamento(s) removido(s) com sucesso!`);
      setSelectedProtocolIds([]);
      if (!isDev) {
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao remover agendamento: " + err.message);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedProtocolIds.length === 0 || !selectedVistoriadorId || !assignDate) return;
    try {
      if (isDev) {
        setProcessos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.protocolo_id)) {
              return {
                ...p,
                status: "regional",
                vistoriador_id: selectedVistoriadorId
              };
            }
            return p;
          })
        );
      } else {
        const todayStr = assignDate;
        let successCount = 0;
        const errs: string[] = [];
        
        await Promise.all(selectedProtocolIds.map(async (protoId) => {
          try {
            const proc = processoByProtocolo[protoId];

            if (!proc) {
              const { data: newProc, error: procErr } = await supabase
                .from("processos")
                .insert({
                  protocolo_id: protoId,
                  status: "regional",
                  vistoriador_id: selectedVistoriadorId
                })
                .select("id")
                .single();
              if (procErr) throw procErr;

              const { error: vistErr } = await supabase
                .from("vistorias")
                .insert({
                  processo_id: newProc.id,
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
                const stageNum = getDisplayInfo(protoId)?.stage || 1;
                const vistUpdate: any = {};
                
                let targetStage = stageNum;
                if (targetStage === 1 && vistData.status_1_vistoria) targetStage = 2;
                if (targetStage === 2 && vistData.status_2_vistoria) targetStage = 3;

                if (targetStage === 2) {
                  vistUpdate.data_2_atribuicao = todayStr;
                  vistUpdate.vistoriador_2_id = selectedVistoriadorId;
                } else if (targetStage === 3) {
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
            successCount++;
          } catch (err: any) {
            console.error(err);
            errs.push(err.message);
          }
        }));
      }
      
      toast.success(`${selectedProtocolIds.length} protocolo(s) processado(s).`);
      setSelectedProtocolIds([]);
      setSelectedVistoriadorId("");
      setAssignDate("");
      setIsAssignModalOpen(false);
      if (!isDev) {
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro geral: " + err.message);
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedProtocolIds.length === 0) return;
    try {
      if (isDev) {
        setProcessos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.protocolo_id)) {
              return {
                ...p,
                status: "regional",
                vistoriador_id: null
              };
            }
            return p;
          })
        );
      } else {
        for (const protoId of selectedProtocolIds) {
          const proc = processoByProtocolo[protoId];
          if (!proc) continue;

          const { error: procErr } = await supabase
            .from("processos")
            .update({
              vistoriador_id: null
            })
            .eq("id", proc.id);
          if (procErr) throw procErr;

          const { data: vistData } = await supabase
            .from("vistorias")
            .select("id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao")
            .eq("processo_id", proc.id)
            .maybeSingle();

          if (vistData) {
            const stageNum = getDisplayInfo(protoId)?.stage || 1;
            const vistUpdate: any = {};
            if (stageNum === 3) {
              vistUpdate.data_3_atribuicao = null;
              vistUpdate.vistoriador_3_id = null;
            } else if (stageNum === 2) {
              vistUpdate.data_2_atribuicao = null;
              vistUpdate.vistoriador_2_id = null;
            } else {
              vistUpdate.data_1_atribuicao = null;
              vistUpdate.vistoriador_1_id = null;
            }
            const { error: vistErr } = await supabase
              .from("vistorias")
              .update(vistUpdate)
              .eq("id", vistData.id);
            if (vistErr) throw vistErr;
          }
        }
      }
      toast.success(`${selectedProtocolIds.length} atribuição(ões) removida(s) com sucesso!`);
      setSelectedProtocolIds([]);
      if (!isDev) {
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao remover atribuição: " + err.message);
    }
  };

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
    return pickLatestProcessByProtocolo(processos);
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
    
    const finalStatus = resolveConsistentDisplayStatus({
      dbStatus: proc.status,
      vistoria,
      dataSolicitacao: proto?.data_solicitacao,
      pausas: pausasByProcesso[proc.id] || [],
      termoValidade: termosMap[proc.id] || null,
    });
    const stage = computeStage(vistoria);

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

  const referenceDateByProtocolo = useMemo(() => {
    if (!hasPeriodFilter) return {} as Record<string, Date>;

    const start = startDateFilter ? new Date(`${startDateFilter}T00:00:00`) : null;
    const effectiveEndDate = endDateFilter || startDateFilter;
    const end = effectiveEndDate ? new Date(`${effectiveEndDate}T23:59:59.999`) : null;

    const referenceDates: Record<string, Date> = {};

    protocolosComProcesso.forEach((protocolo) => {
      const referenceInfo = getDisplayedRequestDateInfo(protocolo, processoByProtocolo, vistoriaMap);
      const referenceDate = new Date(`${referenceInfo.date}T00:00:00`);

      if (start && referenceDate < start) return;
      if (end && referenceDate > end) return;

      referenceDates[protocolo.id] = referenceDate;
    });

    return referenceDates;
  }, [hasPeriodFilter, startDateFilter, endDateFilter, protocolosComProcesso, processoByProtocolo, vistoriaMap]);

  const getEffectiveDisplayInfo = (protocoloId: string): { status: DisplayStatus; stage: VistoriaStage } | null => {
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
      list = list.filter((p) => Boolean(referenceDateByProtocolo[p.id]));
    }

    return [...list].sort((a, b) => {
      let va: string, vb: string;
      if (sortKey === "status") {
        va = getEffectiveDisplayInfo(a.id)?.status || "zzz";
        vb = getEffectiveDisplayInfo(b.id)?.status || "zzz";
      } else if (sortKey === "data_solicitacao") {
        va = getDisplayedRequestDateInfo(a, processoByProtocolo, vistoriaMap).date;
        vb = getDisplayedRequestDateInfo(b, processoByProtocolo, vistoriaMap).date;
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
  }, [protocolosComProcesso, search, statusFilter, municipioFilter, vistoriadorFilter, hasPeriodFilter, referenceDateByProtocolo, sortKey, sortAsc, processoByProtocolo, vistoriaMap, pausasByProcesso, termosMap]);

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
        {field === "numero" && (
          <input
            type="checkbox"
            checked={filtered.length > 0 && selectedProtocolIds.length === filtered.length}
            ref={(input) => {
              if (input) {
                input.indeterminate = selectedProtocolIds.length > 0 && selectedProtocolIds.length < filtered.length;
              }
            }}
            onChange={(e) => {
              const checked = e.target.checked;
              if (checked) {
                setSelectedProtocolIds(filtered.map(x => x.id));
              } else {
                setSelectedProtocolIds([]);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="mr-2 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
        )}
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
                  <SortHeader label="Data Sol./Ret." field="data_solicitacao" />
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
                        isEventoUnico && "bg-cyan-100/60 border-cyan-400",
                        (() => {
                          if (info?.status !== "atribuido") return false;
                          const proc = processoByProtocolo[p.id];
                          if (!proc) return false;
                          const vistoria = vistoriaMap[proc.id];
                          if (!vistoria || !info.stage) return false;
                          
                          const visitDate = (vistoria as any)[`data_${info.stage}_vistoria`];
                          return Boolean(visitDate);
                        })() && "bg-green-100"
                      )}
                      style={isEventoUnico ? { borderLeft: '6px solid #d946ef' } : {}}
                      onClick={() => openProtocoloDetail(p.id)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedProtocolIds.includes(p.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedProtocolIds(prev => {
                                if (checked) {
                                  return [...prev, p.id];
                                } else {
                                  return prev.filter(id => id !== p.id);
                                }
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                          />
                          {p.numero}
                          {isEventoUnico && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-600 text-white border border-cyan-700 ml-1" title="Evento Único">
                              Evento Único
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {(() => {
                          const displayedDate = getDisplayedRequestDateInfo(p, processoByProtocolo, vistoriaMap);
                          const prefixClass = displayedDate.prefix === "S"
                            ? "bg-sky-100 text-sky-700 border border-sky-200"
                            : displayedDate.prefix === "1R"
                              ? "bg-orange-100 text-orange-700 border border-orange-200"
                              : "bg-rose-100 text-rose-600 border border-rose-200";

                          return (
                            <div className="inline-flex items-center gap-2">
                              <span className={cn("inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[11px] font-semibold", prefixClass)}>
                                {displayedDate.prefix}
                              </span>
                              <span>{new Date(displayedDate.date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                            </div>
                          );
                        })()}
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
            onClick={handleBulkUnschedule}
            className="flex items-center gap-1.5 text-xs font-semibold border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 px-4 py-2 rounded-full transition-colors"
          >
            <CalendarOff className="w-3.5 h-3.5" />
            Desagendar
          </button>
          <button
            onClick={handleBulkUnassign}
            className="flex items-center gap-1.5 text-xs font-semibold border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 px-4 py-2 rounded-full transition-colors"
          >
            <UserMinus className="w-3.5 h-3.5" />
            Desatribuir
          </button>
          <button
            onClick={() => navigate("/mapa", { state: { highlightProtocolIds: selectedProtocolIds } })}
            className="flex items-center gap-1.5 text-xs font-semibold border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 px-4 py-2 rounded-full transition-colors"
          >
            <Map className="w-3.5 h-3.5" />
            Ver no mapa
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
              <div className="space-y-2">
                <label htmlFor="bulk-assign-date" className="text-xs font-medium text-muted-foreground">
                  Data de Atribuição
                </label>
                <input
                  id="bulk-assign-date"
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsAssignModalOpen(false);
                    setSelectedVistoriadorId("");
                    setAssignDate("");
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkAssign}
                  disabled={!selectedVistoriadorId || !assignDate}
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
