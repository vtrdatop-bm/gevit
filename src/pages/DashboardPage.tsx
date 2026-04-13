import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { computeDisplayStatus, DisplayStatus, displayStatusLabels, VistoriaData } from "@/lib/vistoriaStatus";
import { computeDeadline, PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Users,
  ArrowLeft,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import KpiCard from "@/components/dashboard/KpiCard";
import DateRangeFilter, { DateRange } from "@/components/dashboard/DateRangeFilter";
import DashboardEstatisticas from "@/components/dashboard/DashboardEstatisticas";


const STATUS_COLORS: Record<string, string> = {
  regional: "hsl(45, 93%, 47%)",
  atribuido: "hsl(270, 60%, 55%)",
  pendencias: "hsl(0, 84%, 60%)",
  certificado_termo: "hsl(217, 91%, 60%)",
  certificado: "hsl(142, 71%, 45%)",
  expirado: "hsl(0, 0%, 45%)",
};
export default function DashboardPage() {
  const navigate = useNavigate();
  const { isDev } = useAuth();
  const [protocolos, setProtocolos] = useState<any[]>([]);
  const [processos, setProcessos] = useState<any[]>([]);
  const [vistorias, setVistorias] = useState<any[]>([]);
  const [pausasByProcesso, setPausasByProcesso] = useState<Record<string, DeadlinePausaData[]>>({});
  const [termosMap, setTermosMap] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  useEffect(() => {
    async function fetch() {
      if (isDev) {
        setProcessos([
          { id: "1", status: "regional", created_at: new Date().toISOString() },
          { id: "2", status: "certificado", created_at: new Date().toISOString() },
        ]);
        setVistorias([
          { processo_id: "1", status_1_vistoria: "pendencia" }
        ]);
        setProfiles([
          { user_id: "dev-id", nome_guerra: "ADMIN", ativo: true }
        ]);
        setLoading(false);
        return;
      }

      const [{ data: prots }, { data: procs }, { data: vists }, { data: profs }, { data: pausas }, { data: termos }] = await Promise.all([
        supabase.from("protocolos").select("id, data_solicitacao, created_at"),
        supabase.from("processos").select("id, status, data_prevista, vistoriador_id, created_at, protocolos(data_solicitacao)"),
        supabase.from("vistorias").select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno"),
        supabase.from("profiles").select("user_id, nome_guerra, ativo"),
        supabase.from("pausas").select("processo_id, data_inicio, data_fim, etapa"),
        supabase.from("termos_compromisso").select("processo_id, data_validade"),
      ]);
      setProtocolos(prots || []);
      setProcessos(procs || []);
      setVistorias(vists || []);
      setProfiles(profs || []);

      const pMap: Record<string, DeadlinePausaData[]> = {};
      (pausas || []).forEach((p: any) => {
        if (!pMap[p.processo_id]) pMap[p.processo_id] = [];
        pMap[p.processo_id].push(p);
      });
      setPausasByProcesso(pMap);

      const tMap: Record<string, string> = {};
      (termos || []).forEach((t: any) => {
        tMap[t.processo_id] = t.data_validade;
      });
      setTermosMap(tMap);

      setLoading(false);
    }
    fetch();
  }, [isDev]);

  const processoByProtocolo = useMemo(() => {
    const map: Record<string, any> = {};
    processos.forEach((p: any) => {
      map[p.protocolo_id] = p;
    });
    return map;
  }, [processos]);

  const filteredProtocolos = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return protocolos;
    return protocolos.filter((p) => {
      const d = new Date(p.created_at);
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to) {
        const end = new Date(dateRange.to);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    });
  }, [protocolos, dateRange]);

  const vistoriaMap = useMemo(() => {
    const m: Record<string, VistoriaData> = {};
    vistorias.forEach((v: any) => { m[v.processo_id] = v; });
    return m;
  }, [vistorias]);

  const stats = useMemo(() => {
    const total = filteredProtocolos.length;
    const byStatus: Record<string, number> = {};
    filteredProtocolos.forEach((proto) => {
      const proc = processoByProtocolo[proto.id];
      if (!proc) {
        byStatus.regional = (byStatus.regional || 0) + 1;
        return;
      }

      const baseStatus = computeDisplayStatus(
        proc.status,
        vistoriaMap[proc.id] || null,
        proto.data_solicitacao || null
      );
      const deadline = computeDeadline(
        vistoriaMap[proc.id] || null,
        pausasByProcesso[proc.id] || [],
        baseStatus,
        termosMap[proc.id] || null
      );
      const finalStatus = deadline.active && deadline.remaining <= 0 && deadline.type === "expiration"
        ? "expirado"
        : baseStatus;

      byStatus[finalStatus] = (byStatus[finalStatus] || 0) + 1;
    });

    const certificados = byStatus["certificado"] || 0;
    const certificadosTermo = byStatus["certificado_termo"] || 0;
    const pendentes = byStatus["pendencias"] || 0;
    const aguardando = byStatus["regional"] || 0;
    const atribuidos = byStatus["atribuido"] || 0;
    const expirados = byStatus["expirado"] || 0;

    const pieData = Object.entries(byStatus)
      .filter(([, v]) => v > 0)
      .map(([status, value]) => ({
        name: displayStatusLabels[status as DisplayStatus] || status,
        value,
        color: STATUS_COLORS[status] || "hsl(220, 9%, 46%)",
      }));

    const vistoriadoresAtivos = profiles.filter((p) => p.ativo).length;
    const taxaCertificacao = total > 0 ? Math.round(((certificados + certificadosTermo) / total) * 100) : 0;

    return { total, aguardando, atribuidos, certificados, certificadosTermo, pendentes, expirados, pieData, vistoriadoresAtivos, taxaCertificacao };
  }, [filteredProtocolos, profiles, processoByProtocolo, vistoriaMap, pausasByProcesso, termosMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do sistema de vistorias técnicas
          </p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Total de Processos"
          value={stats.total}
          icon={LayoutDashboard}
        />
        <KpiCard
          title="Aguardando Vistoria"
          value={stats.aguardando}
          icon={Clock}
          color="bg-status-risk/15"
        />
        <KpiCard
          title="Atribuído"
          value={stats.atribuidos}
          icon={ClipboardCheck}
          color="bg-purple-500/15"
        />
        <KpiCard
          title="Certificados"
          value={stats.certificados}
          icon={CheckCircle2}
          color="bg-status-certified/15"
        />
        <KpiCard
          title="Cert. Provisório"
          value={stats.certificadosTermo}
          icon={CheckCircle2}
          color="bg-blue-500/15"
        />
        <KpiCard
          title="Pendentes"
          value={stats.pendentes}
          icon={AlertTriangle}
          color="bg-status-pending/15"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie chart */}
        <div className="kpi-card lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Distribuição por Status
          </h3>
          {stats.pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {stats.pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum processo cadastrado.</p>
          )}
        </div>

        {/* Quick stats */}
        <div className="kpi-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Indicadores Operacionais
          </h3>
          <div className="space-y-4">
            {[
              { label: "Expirados", value: String(stats.expirados), icon: XCircle, color: "text-status-pending" },
              { label: "Usuários ativos", value: String(stats.vistoriadoresAtivos), icon: Users, color: "text-primary" },
              { label: "Taxa de certificação", value: `${stats.taxaCertificacao}%`, icon: TrendingUp, color: "text-status-certified" },
              { label: "Pendências", value: String(stats.pendentes), icon: AlertTriangle, color: "text-status-risk" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span className="text-sm text-foreground">{item.label}</span>
                </div>
                <span className="text-lg font-bold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <hr className="border-border" />
      <DashboardEstatisticas />
    </div>
  );
}
