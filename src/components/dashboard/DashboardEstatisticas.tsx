import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeDisplayStatus, DisplayStatus, displayStatusLabels, VistoriaData, computeStage, getCurrentVistoriadorId } from "@/lib/vistoriaStatus";
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

/* ── Local types ────────────────────────────────────────────────────────────────── */

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

/* ── Helpers ─────────────────────────────────────────────────────────────────────── */

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

/* ── Component ───────────────────────────────────────────────────────────────────── */

interface DashboardEstatisticasProps {
  dateRange: DateRange;
}

export default function DashboardEstatisticas({ dateRange }: DashboardEstatisticasProps) {
  const { isDev } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<RawProcesso[]>([]);
  const [vistorias, setVistorias] = useState<RawVistoria[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [regionaisMap, setRegionaisMap] = useState<Record<string, string>>({});
  const [bairroRegionalMap, setBairroRegionalMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      if (isDev) {
        setProcessos([
          { id: "1", status: "regional", vistoriador_id: "v1", regional_id: "r1", created_at: new Date().toISOString(), protocolos: { data_solicitacao: "2024-01-10", bairro: "Centro", municipio: "Rio Branco", area: 150 } },
          { id: "2", status: "certificado", vistoriador_id: "v1", regional_id: "r1", created_at: new Date().toISOString(), protocolos: { data_solicitacao: "2024-02-01", bairro: "Centro", municipio: "Rio Branco", area: 1200 } },
        ]);
        setVistorias([
          { processo_id: "1", data_1_atribuicao: "2024-01-12", data_1_vistoria: "2024-01-20", status_1_vistoria: "pendencia", data_2_atribuicao: null, data_2_vistoria: null, status_2_vistoria: null, data_3_atribuicao: null, data_3_vistoria: null, status_3_vistoria: null, data_1_retorno: "2024-01-25", data_2_retorno: null, vistoriador_1_id: "v1", vistoriador_2_id: null, vistoriador_3_id: null },
          { processo_id: "2", data_1_atribuicao: "2024-02-03", data_1_vistoria: "2024-02-10", status_1_vistoria: "aprovado", data_2_atribuicao: null, data_2_vistoria: null, status_2_vistoria: null, data_3_atribuicao: null, data_3_vistoria: null, status_3_vistoria: null, data_1_retorno: null, data_2_retorno: null, vistoriador_1_id: "v1", vistoriador_2_id: null, vistoriador_3_id: null },
        ]);
        setProfiles([{ user_id: "v1", patente: "CB", nome_guerra: "Admin Dev" }]);
        setRegionaisMap({ r1: "Regional Centro" });
        setLoading(false);
        return;
      }

      const [{ data: procs }, { data: vists }, { data: profs }, { data: regionais }, { data: bairros }] = await Promise.all([
        supabase.from("processos").select("id, status, vistoriador_id, regional_id, created_at, protocolos(data_solicitacao, bairro, municipio, area)"),
        supabase.from("vistorias").select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno, vistoriador_1_id, vistoriador_2_id, vistoriador_3_id"),
        supabase.from("profiles").select("user_id, patente, nome_guerra"),
        supabase.from("regionais").select("id, nome").order("nome"),
        supabase.from("bairros").select("nome, municipio, regional_id"),
      ]);

      setProcessos((procs || []) as unknown as RawProcesso[]);
      setVistorias((vists || []) as unknown as RawVistoria[]);
      setProfiles((profs || []) as Profile[]);

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

  /* ── Filtering ──────────────────────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return processos;
    return processos.filter((p) => {
      const d = new Date(p.created_at);
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to) {
        const end = new Date(dateRange.to);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    });
  }, [processos, dateRange]);

  const vistoriaMap = useMemo(() => {
    const m: Record<string, RawVistoria> = {};
    vistorias.forEach((v) => { m[v.processo_id] = v; });
    return m;
  }, [vistorias]);

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach((p) => { m[p.user_id] = [p.patente, p.nome_guerra].filter(Boolean).join(" "); });
    return m;
  }, [profiles]);

  /* ── Compute statistics ────────────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalProcessos = filtered.length;

    // --- 1) Inspections by stage ---
    let stage1 = 0, stage2 = 0, stage3 = 0;
    filtered.forEach((p) => {
      const v = vistoriaMap[p.id];
      if (!v) return;
      if (v.data_1_vistoria || v.status_1_vistoria) stage1++;
      if (v.data_2_vistoria || v.status_2_vistoria) stage2++;
      if (v.data_3_vistoria || v.status_3_vistoria) stage3++;
    });
    const totalVistorias = stage1 + stage2 + stage3;
    const stageData = [
      { name: "1ª Vistoria", value: stage1 },
      { name: "2ª Vistoria", value: stage2 },
      { name: "3ª Vistoria", value: stage3 },
    ];

    // --- 2) Status counts ---
    const byStatus: Record<string, number> = {};
    filtered.forEach((p) => {
      const v = vistoriaMap[p.id] as VistoriaData | undefined;
      const ds = computeDisplayStatus(p.status, v || null, p.protocolos?.data_solicitacao);
      byStatus[ds] = (byStatus[ds] || 0) + 1;
    });

    const statusCounts = [
      { key: "certificado", label: "Certificado", count: byStatus["certificado"] || 0 },
      { key: "certificado_termo", label: "Cert. Provisório", count: byStatus["certificado_termo"] || 0 },
      { key: "pendencias", label: "Pendência", count: byStatus["pendencias"] || 0 },
      { key: "expirado", label: "Expirados", count: byStatus["expirado"] || 0 },
      { key: "regional", label: "Aguardando", count: byStatus["regional"] || 0 },
      { key: "atribuido", label: "Atribuído", count: byStatus["atribuido"] || 0 },
    ];

    // --- 3) Status by stage ---
    // rows: result types, columns: 1ª/2ª/3ª
    const stageStatusGrid: Record<string, number[]> = {
      pendencias: [0, 0, 0],
      certificado: [0, 0, 0],
      certificado_termo: [0, 0, 0],
    };
    filtered.forEach((p) => {
      const v = vistoriaMap[p.id] as VistoriaData | undefined;
      const stage = computeStage(v || null);
      const ds = computeDisplayStatus(p.status, v || null, p.protocolos?.data_solicitacao);

      if (!stage) return;

      if (ds === "pendencias") {
        stageStatusGrid.pendencias[stage - 1]++;
      } else if (ds === "certificado") {
        stageStatusGrid.certificado[stage - 1]++;
      } else if (ds === "certificado_termo") {
        stageStatusGrid.certificado_termo[stage - 1]++;
      }
    });

    // --- 4) Average times ---
    const tempos1Vist: number[] = [];
    const temposRetorno1: number[] = [];
    const temposRetorno2: number[] = [];
    const temposCert: number[] = [];

    filtered.forEach((p) => {
      const v = vistoriaMap[p.id];
      const sol = p.protocolos?.data_solicitacao;
      if (!v || !sol) return;

      // Time to 1st inspection
      const d1 = daysBetween(sol, v.data_1_vistoria);
      if (d1 !== null) tempos1Vist.push(d1);

      // 1st return time
      const r1 = daysBetween(v.data_1_vistoria, v.data_1_retorno);
      if (r1 !== null) temposRetorno1.push(r1);

      // 2nd return time
      const r2 = daysBetween(v.data_2_vistoria, v.data_2_retorno);
      if (r2 !== null) temposRetorno2.push(r2);

      // Time to certification
      const ds = computeDisplayStatus(p.status, v as VistoriaData, sol);
      if (ds === "certificado") {
        // Find the date of the inspection that resulted in "reprovado" = certificado
        let certDate: string | null = null;
        for (let i = 3; i >= 1; i--) {
          const st = (v as any)[`status_${i}_vistoria`] as string | null;
          const dt = (v as any)[`data_${i}_vistoria`] as string | null;
          if (st === "reprovado" && dt) { certDate = dt; break; }
        }
        if (certDate) {
          const dc = daysBetween(sol, certDate);
          if (dc !== null) temposCert.push(dc);
        }
      }
      if (ds === "certificado_termo") {
        let certDate: string | null = null;
        for (let i = 3; i >= 1; i--) {
          const st = (v as any)[`status_${i}_vistoria`] as string | null;
          const dt = (v as any)[`data_${i}_vistoria`] as string | null;
          if (st === "aprovado" && dt) { certDate = dt; break; }
        }
        if (certDate) {
          const dc = daysBetween(sol, certDate);
          if (dc !== null) temposCert.push(dc);
        }
      }
    });

    const avgTempos = {
      primeiraVistoria: avg(tempos1Vist),
      retorno1: avg(temposRetorno1),
      retorno2: avg(temposRetorno2),
      certificacao: avg(temposCert),
    };

    // --- 5) By vistoriador (count + area sum from 1st inspection) ---
    const byVistoriador: Record<string, { count: number; area: number }> = {};
    filtered.forEach((p) => {
      const v = vistoriaMap[p.id];
      // Use vistoriador_1_id from vistoria (atribuído na 1ª etapa)
      const vid = v?.vistoriador_1_id || getCurrentVistoriadorId(p.vistoriador_id, v as VistoriaData | undefined || null);
      if (!vid) return;
      if (!byVistoriador[vid]) byVistoriador[vid] = { count: 0, area: 0 };
      byVistoriador[vid].count++;
      if (p.protocolos?.area) byVistoriador[vid].area += p.protocolos.area;
    });
    const vistoriadorData = Object.entries(byVistoriador)
      .map(([id, { count, area }]) => ({ name: profileMap[id] || "Desconhecido", count, area }))
      .sort((a, b) => b.count - a.count);

    // --- 6) Total area vistoriada (once per protocolo, only if 1st vistoria assigned) ---
    let totalAreaVistoriada = 0;
    filtered.forEach((p) => {
      const v = vistoriaMap[p.id];
      if ((v?.vistoriador_1_id || v?.data_1_atribuicao) && p.protocolos?.area) {
        totalAreaVistoriada += p.protocolos.area;
      }
    });

    // --- 6) By regional ---
    const byRegional: Record<string, number> = {};
    filtered.forEach((p) => {
      let regId = p.regional_id;
      if (!regId && p.protocolos) {
        regId = bairroRegionalMap[`${p.protocolos.bairro}|${p.protocolos.municipio}`] || null;
      }
      const name = regId ? (regionaisMap[regId] || "Desconhecida") : "Sem Regional";
      byRegional[name] = (byRegional[name] || 0) + 1;
    });
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
  }, [filtered, vistoriaMap, profileMap, regionaisMap, bairroRegionalMap]);

  /* ── Render ─────────────────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pct = (n: number) => stats.totalProcessos > 0 ? `${Math.round((n / stats.totalProcessos) * 100)}%` : "0%";

  return (
    <div className="space-y-6">
      {/* Header + filter */}
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

      {/* ── Row 1: Inspection stages + Status counts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vistorias por Etapa */}
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

        {/* Status counts + percentages */}
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
              <div key={s.key} className="flex items-center justify-between p-2.5 rounded-lg bg-accent/40">
                <span className="text-sm text-foreground">{s.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground">{s.count}</span>
                  <span className="text-xs text-muted-foreground min-w-[40px] text-right">{pct(s.count)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Status by stage table ── */}
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
              {[
                { key: "pendencias", label: "Pendência", color: "text-status-pending" },
                { key: "certificado", label: "Certificado", color: "text-status-certified" },
                { key: "certificado_termo", label: "Certificado Provisório", color: "text-primary" },
              ].map((row) => {
                const vals = stats.stageStatusGrid[row.key];
                const total = vals[0] + vals[1] + vals[2];
                return (
                  <tr key={row.key} className="border-b border-border/50 last:border-0">
                    <td className={cn("py-2.5 px-3 font-medium", row.color)}>{row.label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="text-center py-2.5 px-3 font-semibold text-foreground">{v}</td>
                    ))}
                    <td className="text-center py-2.5 px-3 font-bold text-foreground">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 3: Average times ── */}
      <div className="kpi-card">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Tempos Médios (dias)</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Até 1ª Vistoria", value: stats.avgTempos.primeiraVistoria, desc: "Solicitação → 1ª vistoria" },
            { label: "1º Retorno", value: stats.avgTempos.retorno1, desc: "1ª vistoria → retorno" },
            { label: "2º Retorno", value: stats.avgTempos.retorno2, desc: "2ª vistoria → retorno" },
            { label: "Até Certificação", value: stats.avgTempos.certificacao, desc: "Solicitação → certificação" },
          ].map((t) => (
            <div key={t.label} className="text-center p-3 rounded-xl bg-accent/50 space-y-1">
              <p className="text-2xl font-bold text-foreground">{t.value || "—"}</p>
              <p className="text-xs font-semibold text-foreground">{t.label}</p>
              <p className="text-[10px] text-muted-foreground">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Área total vistoriada ── */}
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

      {/* ── Row 4: By vistoriador + By regional ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By vistoriador */}
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

        {/* By regional */}
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
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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
