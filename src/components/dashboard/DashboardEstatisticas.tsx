import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DisplayStatus, displayStatusLabels, VistoriaData, computeStage, getCurrentVistoriadorId } from "@/lib/vistoriaStatus";
import { type PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";
import { resolveConsistentDisplayStatus } from "@/lib/processoConsistency";
import { DateRange } from "./DateRangeFilter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ClipboardList,
  Timer,
  Users,
  MapPin,
  BarChart3,
  Percent,
  Maximize2,
} from "lucide-react";
import { cn, formatArea } from "@/lib/utils";
import { differenceInDays } from "date-fns";

interface RawProcesso {
  id: string;
  status: string;
  vistoriador_id: string | null;
  regional_id: string | null;
  created_at: string;
  protocolos: {
    data_solicitacao: string;
    bairro: string;
    municipio: string;
    area: number | null;
  } | null;
}

interface RawVistoria {
  processo_id: string;
  data_1_atribuicao: string | null;
  data_2_atribuicao: string | null;
  data_3_atribuicao: string | null;
  data_1_vistoria: string | null;
  data_2_vistoria: string | null;
  data_3_vistoria: string | null;
  status_1_vistoria: string | null;
  status_2_vistoria: string | null;
  status_3_vistoria: string | null;
  data_1_retorno: string | null;
  data_2_retorno: string | null;
  vistoriador_1_id: string | null;
  vistoriador_2_id: string | null;
  vistoriador_3_id: string | null;
}

interface Profile {
  user_id: string;
  patente: string | null;
  nome_guerra: string | null;
}

function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  const diff = differenceInDays(db, da);
  return diff >= 0 ? diff : null;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function getCertificationDate(vistoria: RawVistoria | VistoriaData | undefined): string | null {
  if (!vistoria) return null;

  for (let i = 3; i >= 1; i--) {
    const status = (vistoria as any)[`status_${i}_vistoria`] as string | null;
    const date = (vistoria as any)[`data_${i}_vistoria`] as string | null;

    if ((status === "aprovado" || status === "reprovado") && date) {
      return date;
    }
  }

  return null;
}

const STAGE_LABELS = ["1ª Vistoria", "2ª Vistoria", "3ª Vistoria"];

const STATUS_LABELS_SHORT: Record<string, string> = {
  certificado: "Certificado",
  certificado_termo: "Cert. Provisório",
  pendencias: "Pendência",
  expirado: "Expirados",
};

const BAR_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(45, 93%, 47%)",
  "hsl(270, 60%, 55%)",
  "hsl(0, 84%, 60%)",
  "hsl(190, 80%, 42%)",
  "hsl(340, 82%, 52%)",
  "hsl(25, 95%, 53%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 65%, 60%)",
  "hsl(200, 70%, 50%)",
  "hsl(120, 50%, 40%)",
  "hsl(60, 70%, 45%)",
  "hsl(310, 60%, 50%)",
];

interface DashboardEstatisticasProps {
  dateRange: DateRange;
  totalProtocolosFiltrados?: number;
  filteredProtocolos?: any[];
  processoByProtocolo?: Record<string, any>;
  vistoriaMap?: Record<string, any>;
  pausasByProcesso?: Record<string, any[]>;
  termosMap?: Record<string, string>;
  profiles?: any[];
}

export default function DashboardEstatisticas({ 
  dateRange, 
  totalProtocolosFiltrados,
  filteredProtocolos,
  processoByProtocolo,
  vistoriaMap: propsVistoriaMap,
  pausasByProcesso: propsPausas,
  termosMap: propsTermos,
  profiles: propsProfiles
}: DashboardEstatisticasProps) {
  const { isDev } = useAuth();
  const [loading, setLoading] = useState(true);
  const [regionaisMap, setRegionaisMap] = useState<Record<string, string>>({});
  const [bairroRegionalMap, setBairroRegionalMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      if (isDev) {
        setRegionaisMap({ r1: "Regional Centro" });
        setLoading(false);
        return;
      }

      const [{ data: regionais }, { data: bairros }] = await Promise.all([
        supabase.from("regionais").select("id, nome").order("nome"),
        supabase.from("bairros").select("nome, municipio, regional_id"),
      ]);

      const rm: Record<string, string> = {};
      (regionais || []).forEach((r: any) => { rm[r.id] = r.nome; });
      setRegionaisMap(rm);

      const brm: Record<string, string> = {};
      (bairros || []).forEach((b: any) => {
        if (b.regional_id) brm[`${b.nome}|${b.municipio}`] = b.regional_id;
      });
      setBairroRegionalMap(brm);

      setLoading(false);
    }
    fetchData();
  }, [isDev]);

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (propsProfiles) {
      propsProfiles.forEach((p) => { m[p.user_id] = [p.patente, p.nome_guerra].filter(Boolean).join(" "); });
    }
    return m;
  }, [propsProfiles]);

  const stats = useMemo(() => {
    if (!filteredProtocolos || !processoByProtocolo || !propsVistoriaMap || !propsPausas || !propsTermos) {
      return null;
    }
    const totalProcessos = filteredProtocolos.length;

    let stage1 = 0, stage2 = 0, stage3 = 0;
    const byStatus: Record<string, number> = {};
    const stageStatusGrid: Record<string, number[]> = {
      pendencias: [0, 0, 0],
      certificado: [0, 0, 0],
      certificado_termo: [0, 0, 0],
      expirado: [0, 0, 0],
      cancelado: [0, 0, 0],
    };

    const tempos1Vist: number[] = [];
    const temposRetorno1: number[] = [];
    const temposRetorno2: number[] = [];
    const temposCert: number[] = [];

    const byVistoriador: Record<string, { count: number; area: number }> = {};
    let totalAreaVistoriada = 0;
    const byRegional: Record<string, number> = {};

    let eventoUnicoCount = 0;

    filteredProtocolos.forEach((proto) => {
      if (proto.evento_unico === true) {
        eventoUnicoCount++;
      }

      const p = processoByProtocolo[proto.id];
      if (!p) {
        byStatus.regional = (byStatus.regional || 0) + 1;
        let regId = null;
        if (proto.bairro && proto.municipio) {
           regId = bairroRegionalMap[`${proto.bairro}|${proto.municipio}`] || null;
        }
        const name = regId ? (regionaisMap[regId] || "Desconhecida") : "Sem Regional";
        byRegional[name] = (byRegional[name] || 0) + 1;
        return;
      }

      const v = propsVistoriaMap[p.id];
      const pausas = propsPausas[p.id] || [];
      const termo = propsTermos[p.id] || null;
      const dataSolicitacao = proto.data_solicitacao;

      const ds = resolveConsistentDisplayStatus({
        dbStatus: p.status,
        vistoria: v || null,
        dataSolicitacao: dataSolicitacao || null,
        pausas,
        termoValidade: termo,
      });
      byStatus[ds] = (byStatus[ds] || 0) + 1;

      if (v) {
        if (v.data_1_vistoria || v.status_1_vistoria) stage1++;
        if (v.data_2_vistoria || v.status_2_vistoria) stage2++;
        if (v.data_3_vistoria || v.status_3_vistoria) stage3++;

        const mapTerminal = (original: string) => {
          if (ds === "expirado") return "expirado";
          if (ds === "cancelado") return "cancelado";
          return original;
        };

        if (v.status_1_vistoria === "pendencia") {
           // Se foi pendência e cancelou logo depois, podemos exibir como cancelado para fechar a conta? 
           // Não, vamos mapear apenas os terminais para bater com o KPI de Certificado. Mas se a última ação foi pendência e cancelou, 
           // seria melhor mapear para cancelado SE for a última vistoria?
           // O usuário não reclamou de pendência. Vamos manter pendência como pendência.
           stageStatusGrid.pendencias[0]++;
        }
        if (v.status_1_vistoria === "reprovado") stageStatusGrid[mapTerminal("certificado")][0]++;
        if (v.status_1_vistoria === "aprovado") stageStatusGrid[mapTerminal("certificado_termo")][0]++;
        
        if (v.status_2_vistoria === "pendencia") stageStatusGrid.pendencias[1]++;
        if (v.status_2_vistoria === "reprovado") stageStatusGrid[mapTerminal("certificado")][1]++;
        if (v.status_2_vistoria === "aprovado") stageStatusGrid[mapTerminal("certificado_termo")][1]++;
        
        if (v.status_3_vistoria === "pendencia") stageStatusGrid.pendencias[2]++;
        if (v.status_3_vistoria === "reprovado") stageStatusGrid[mapTerminal("certificado")][2]++;
        if (v.status_3_vistoria === "aprovado") stageStatusGrid[mapTerminal("certificado_termo")][2]++;


        if (dataSolicitacao) {
          const d1 = daysBetween(dataSolicitacao, v.data_1_vistoria);
          if (d1 !== null) tempos1Vist.push(d1);

          const r1 = daysBetween(v.data_1_retorno, v.data_2_vistoria);
          if (r1 !== null) temposRetorno1.push(r1);

          const r2 = daysBetween(v.data_2_retorno, v.data_3_vistoria);
          if (r2 !== null) temposRetorno2.push(r2);

          const certDate = getCertificationDate(v);
          if (certDate) {
            const dc = daysBetween(dataSolicitacao, certDate);
            if (dc !== null) temposCert.push(dc);
          }
        }

        const vid = v.vistoriador_1_id || getCurrentVistoriadorId(p.vistoriador_id, v);
        if (vid) {
          if (!byVistoriador[vid]) byVistoriador[vid] = { count: 0, area: 0 };
          byVistoriador[vid].count++;
          if (proto.area) byVistoriador[vid].area += proto.area;
        }

        if ((v.vistoriador_1_id || v.data_1_atribuicao) && proto.area) {
          totalAreaVistoriada += proto.area;
        }
      }

      let regId = p.regional_id;
      if (!regId) {
        regId = bairroRegionalMap[`${proto.bairro}|${proto.municipio}`] || null;
      }
      const name = regId ? (regionaisMap[regId] || "Desconhecida") : "Sem Regional";
      byRegional[name] = (byRegional[name] || 0) + 1;
    });

    const totalVistorias = stage1 + stage2 + stage3;
    const stageData = [
      { name: "1ª Vistoria", value: stage1 },
      { name: "2ª Vistoria", value: stage2 },
      { name: "3ª Vistoria", value: stage3 },
    ];

    const statusCounts = [
      { key: "cancelado", label: "Cancelados", count: byStatus["cancelado"] || 0 },
      { key: "evento_unico", label: "Evento Único", count: eventoUnicoCount, color: "#d946ef" },
      { key: "certificado", label: "Certificado", count: byStatus["certificado"] || 0 },
      { key: "certificado_termo", label: "Cert. Provisório", count: byStatus["certificado_termo"] || 0 },
      { key: "pendencias", label: "Pendência", count: byStatus["pendencias"] || 0 },
      { key: "expirado", label: "Expirados", count: byStatus["expirado"] || 0 },
      { key: "regional", label: "Aguardando", count: byStatus["regional"] || 0 },
      { key: "atribuido", label: "Atribuído", count: byStatus["atribuido"] || 0 },
    ];

    const avgTempos = {
      primeiraVistoria: { value: avg(tempos1Vist), count: tempos1Vist.length },
      retorno1: { value: avg(temposRetorno1), count: temposRetorno1.length },
      retorno2: { value: avg(temposRetorno2), count: temposRetorno2.length },
      certificacao: { value: avg(temposCert), count: temposCert.length },
    };

    const vistoriadorData = Object.entries(byVistoriador)
      .map(([id, { count, area }]) => ({ name: profileMap[id] || "Desconhecido", count, area }))
      .sort((a, b) => b.count - a.count);

    const regionalData = Object.entries(byRegional)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalProcessos,
      totalVistorias,
      stageData,
      statusCounts,
      stageStatusGrid,
      avgTempos,
      vistoriadorData,
      regionalData,
      byStatus,
      totalAreaVistoriada,
    };
  }, [filteredProtocolos, processoByProtocolo, propsVistoriaMap, propsPausas, propsTermos, profileMap, regionaisMap, bairroRegionalMap]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pct = (n: number) => stats.totalProcessos > 0 ? `${Math.round((n / stats.totalProcessos) * 100)}%` : "0%";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">Estatísticas</h3>
        </div>
        {dateRange.from ? (
          <span className="text-xs text-muted-foreground">
            Filtro aplicado no dashboard
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Vistorias por Etapa</h4>
            <span className="ml-auto text-xs text-muted-foreground bg-accent rounded-full px-2 py-0.5">
              Total: {stats.totalVistorias}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stats.stageData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="value" name="Vistorias" radius={[6, 6, 0, 0]}>
                {stats.stageData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Status dos Processos</h4>
            <span className="ml-auto text-xs text-muted-foreground bg-accent rounded-full px-2 py-0.5">
              {stats.totalProcessos} processos
            </span>
          </div>
          <div className="space-y-2">
            {stats.statusCounts.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between p-2.5 rounded-lg bg-accent/40"
              >
                <span className="text-sm flex items-center gap-2 text-foreground">
                  {s.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground">{s.count}</span>
                  <span className="text-xs text-muted-foreground min-w-[40px] text-right">{pct(s.count)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="kpi-card">
        <h4 className="text-sm font-semibold text-foreground mb-4">Resultado por Etapa</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Resultado</th>
                {STAGE_LABELS.map((l) => (
                  <th key={l} className="text-center py-2 px-3 text-muted-foreground font-medium">{l}</th>
                ))}
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
        {(() => {
          const columnSums = [0, 1, 2].map(i =>
            ["pendencias", "certificado", "certificado_termo", "expirado", "cancelado"].reduce((sum, key) => sum + (stats.stageStatusGrid[key]?.[i] || 0), 0)
          );
          const totalRowsSum = columnSums.reduce((a, b) => a + b, 0);

          return [
            { key: "pendencias", label: "Pendência", color: "text-status-pending" },
            { key: "certificado", label: "Certificado", color: "text-status-certified" },
            { key: "certificado_termo", label: "Certificado Provisório", color: "text-primary" },
            { key: "expirado", label: "Certificado (Expirou)", color: "text-status-risk" },
            { key: "cancelado", label: "Cancelado", color: "text-muted-foreground" },
          ].map((row) => {
            const vals = stats.stageStatusGrid[row.key];
            const total = vals[0] + vals[1] + vals[2];
            
            // Only render row if there are any items in it, or if it's one of the main 3
            const isMainRow = ["pendencias", "certificado", "certificado_termo"].includes(row.key);
            if (!isMainRow && total === 0) return null;
            
            const getPct = (v: number, colIndex: number) => {
              const colSum = columnSums[colIndex] || 1;
              if (v === 0) return " (0%)";
              return ` (${Math.round((v / colSum) * 100)}%)`;
            };

            const getRowTotalPct = (v: number) => {
              const globalSum = totalRowsSum || 1;
              if (v === 0) return " (0%)";
              return ` (${Math.round((v / globalSum) * 100)}%)`;
            };

            return (
              <tr key={row.key} className="border-b border-border/50 last:border-0">
                <td className={cn("py-2.5 px-3 font-medium", row.color)}>{row.label}</td>
                {vals.map((v, i) => (
                  <td key={i} className="text-center py-2.5 px-3 font-semibold text-foreground">
                    {v}
                    <span className="text-[11px] text-muted-foreground font-normal block sm:inline">{getPct(v, i)}</span>
                  </td>
                ))}
                <td className="text-center py-2.5 px-3 font-bold text-foreground">
                  {total}
                  <span className="text-[11px] text-muted-foreground font-normal block sm:inline">{getRowTotalPct(total)}</span>
                </td>
              </tr>
            );
          });
        })()}
        {(() => {
          const vals = [0, 1, 2].map(i =>
            ["pendencias", "certificado", "certificado_termo", "expirado", "cancelado"].reduce((sum, key) => sum + (stats.stageStatusGrid[key]?.[i] || 0), 0)
          );
          const total = vals.reduce((a, b) => a + b, 0);
          
          const getColumnTotalPct = (v: number, index: number) => {
            if (total === 0 || v === 0) return " (0%)";
            return ` (${Math.round((v / total) * 100)}%)`;
          };

          return (
            <tr className="border-t border-border font-bold bg-muted/40">
              <td className="py-2.5 px-3 text-foreground">Totais</td>
              {vals.map((v, i) => (
                <td key={i} className="text-center py-2.5 px-3 text-foreground">
                  {v}
                  <span className="text-[11px] font-normal text-muted-foreground block sm:inline">{getColumnTotalPct(v, i)}</span>
                </td>
              ))}
              <td className="text-center py-2.5 px-3 text-foreground">
                {total}
                <span className="text-[11px] font-normal text-muted-foreground block sm:inline"> (100%)</span>
              </td>
            </tr>
          );
        })()}
            </tbody>
          </table>
        </div>
      </div>

      <div className="kpi-card">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Tempos Médios (dias)</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Até 1ª Vistoria", metric: stats.avgTempos.primeiraVistoria, desc: "Solicitação → 1ª vistoria" },
            { label: "1º Retorno", metric: stats.avgTempos.retorno1, desc: "1º retorno → 2ª vistoria" },
            { label: "2º Retorno", metric: stats.avgTempos.retorno2, desc: "2º retorno → 3ª vistoria" },
            { label: "Até Certificação", metric: stats.avgTempos.certificacao, desc: "Solicitação → certificação" },
          ].map((t) => (
            <div key={t.label} className="text-center p-3 rounded-xl bg-accent/50 space-y-1">
              <p className="text-2xl font-bold text-foreground">{t.metric.value || "—"}</p>
              <p className="text-xs font-semibold text-foreground">{t.label}</p>
              <p className="text-[10px] text-muted-foreground">{t.desc}</p>
              <p className="text-[10px] text-muted-foreground">Base: {t.metric.count} processo{t.metric.count === 1 ? "" : "s"}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Cada média usa apenas os processos que chegaram a essa etapa. Os valores não devem ser somados entre si.
        </p>
      </div>

      <div className="kpi-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Área Total Vistoriada</h4>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.totalAreaVistoriada > 0
              ? <>{formatArea(stats.totalAreaVistoriada)} <span className="text-sm font-normal text-muted-foreground">m²</span></>
              : <span className="text-muted-foreground">—</span>
            }
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-6">Soma da área dos protocolos com 1ª vistoria atribuída — contabilizado uma vez por protocolo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Vistorias por Vistoriador</h4>
          </div>
          {stats.vistoriadorData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vistoriador</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Vistorias</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Área Total (m²)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.vistoriadorData.map((row, i) => (
                    <tr key={row.name} className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                          />
                          <span className="font-medium text-foreground">{row.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-2.5 px-3 font-bold text-foreground">{row.count}</td>
                      <td className="text-right py-2.5 px-3 text-muted-foreground">
                        {row.area > 0 ? formatArea(row.area) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado disponível</p>
          )}
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Vistorias por Regional</h4>
          </div>
          {stats.regionalData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(160, stats.regionalData.length * 36)}>
              <BarChart data={stats.regionalData} layout="vertical" barSize={20} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={120} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const totalProcessos = stats.totalProcessos || 1;
                      const pct = Math.round((data.value / totalProcessos) * 100);
                      return (
                        <div className="bg-popover border border-border rounded-lg p-2 shadow-sm text-xs">
                          <p className="font-semibold text-foreground">{data.name}</p>
                          <p className="text-muted-foreground mt-0.5">
                            Processos: <span className="font-semibold text-foreground">{data.value}</span>
                            <span className="ml-1 text-primary font-medium">({pct}%)</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" name="Processos" radius={[0, 6, 6, 0]}>
                  {stats.regionalData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado disponível</p>
          )}
        </div>
      </div>
    </div>
  );
}
