import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Navigation, ExternalLink, Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import RouteMap from "@/components/routes/RouteMap";
import { sortVistoriadores } from "@/lib/vistoriaStatus";

interface VistoriaRow {
  processo_id: string;
  data_1_atribuicao: string | null;
  data_2_atribuicao: string | null;
  data_3_atribuicao: string | null;
  status_1_vistoria: string | null;
  status_2_vistoria: string | null;
  status_3_vistoria: string | null;
}

interface ProcessoComProtocolo {
  id: string;
  protocolo_id: string;
  vistoriador_id: string | null;
  status: string;
  protocolo: {
    nome_fantasia: string | null;
    razao_social: string;
    endereco: string;
    bairro: string;
    municipio: string;
    latitude: number | null;
    longitude: number | null;
  };
  datasAtribuicao: string[];
}

interface Vistoriador {
  user_id: string;
  patente: string | null;
  nome_guerra: string | null;
}

const PONTO_PARTIDA = "-9.966142405683366,-67.80275437311697";
const START_COORDS: [number, number] = [-9.966142405683366, -67.80275437311697];

export default function RoutesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dataLimite, setDataLimite] = useState("");
  const [selectedVistoriadores, setSelectedVistoriadores] = useState<Set<string>>(new Set());
  const [routePriority, setRoutePriority] = useState<"coord" | "date">("coord");
  const [routeGenerated, setRouteGenerated] = useState(false);
  const [processos, setProcessos] = useState<ProcessoComProtocolo[]>([]);
  const [vistoriadores, setVistoriadores] = useState<Vistoriador[]>([]);
  const [vistorias, setVistorias] = useState<VistoriaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [canChangeVistoriador, setCanChangeVistoriador] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [{ data: roles }, { data: procsData }, { data: vistoriasData }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "vistoriador"),
        supabase
          .from("processos")
          .select("id, protocolo_id, vistoriador_id, status, protocolos(nome_fantasia, razao_social, endereco, bairro, municipio, latitude, longitude)")
          .neq("status", "certificado"),
        supabase
          .from("vistorias")
          .select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, status_1_vistoria, status_2_vistoria, status_3_vistoria"),
      ]);

      // Check if current user is admin or distribuidor
      if (user) {
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const isAdminOrDist = userRoles?.some(
          (r) => r.role === "admin" || r.role === "distribuidor"
        );
        setCanChangeVistoriador(!!isAdminOrDist);

        // Default to current user if they are a vistoriador
        const isVistoriador = roles?.some((r) => r.user_id === user.id);
        if (isVistoriador) {
          setSelectedVistoriadores(new Set([user.id]));
        }
      }

      if (roles?.length) {
        const ids = roles.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, patente, nome_guerra")
          .in("user_id", ids);
        if (profiles) setVistoriadores(sortVistoriadores(profiles));
      }

      if (procsData) {
        const mapped = procsData
          .filter((p) => p.protocolos)
          .map((p) => ({
            id: p.id,
            protocolo_id: p.protocolo_id,
            vistoriador_id: p.vistoriador_id,
            status: p.status,
            protocolo: p.protocolos,
            datasAtribuicao: [] as string[],
          }));
        setProcessos(mapped);
      }

      if (vistoriasData) setVistorias(vistoriasData);
      setLoading(false);
    }
    fetchData();
  }, []);

  // For each processo, find attribution dates that are pending (no result yet)
  const pendingAttrMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    vistorias.forEach((v) => {
      const dates: string[] = [];
      if (v.data_1_atribuicao && !v.status_1_vistoria) dates.push(v.data_1_atribuicao);
      if (v.data_2_atribuicao && !v.status_2_vistoria) dates.push(v.data_2_atribuicao);
      if (v.data_3_atribuicao && !v.status_3_vistoria) dates.push(v.data_3_atribuicao);
      if (dates.length) map[v.processo_id] = dates;
    });
    return map;
  }, [vistorias]);

  const filteredProcesses = useMemo(() => {
    if (!dataLimite) return [];

    return processos
      .filter((p) => {
        if (selectedVistoriadores.size > 0 && (!p.vistoriador_id || !selectedVistoriadores.has(p.vistoriador_id))) return false;

        const dates = pendingAttrMap[p.id];
        if (!dates?.length) return false;

        // At least one pending date must be <= dataLimite
        return dates.some((d) => d <= dataLimite);
      })
      .map((p) => ({
        ...p,
        datasAtribuicao: (pendingAttrMap[p.id] || []).filter((d) => d <= dataLimite),
      }));
  }, [processos, selectedVistoriadores, pendingAttrMap, dataLimite]);

  const selectedProcesses = filteredProcesses.filter((p) => selectedIds.has(p.id));

  // Optimized order after route generation (nearest-neighbor) grouped by date
  // the array holds process IDs in exact route order across all dates
  const [optimizedOrder, setOptimizedOrder] = useState<string[]>([]);

  const orderedProcesses = useMemo(() => {
    if (!routeGenerated || optimizedOrder.length === 0) return selectedProcesses;
    const map = new Map(selectedProcesses.map((p) => [p.id, p]));
    return optimizedOrder.map((id) => map.get(id)!).filter(Boolean);
  }, [routeGenerated, optimizedOrder, selectedProcesses]);

  const selectedRoutePoints = useMemo(
    () =>
      orderedProcesses
        .filter((p) => p.protocolo.latitude != null && p.protocolo.longitude != null)
        .map((p) => ({
          id: p.id,
          latitude: p.protocolo.latitude as number,
          longitude: p.protocolo.longitude as number,
          name: p.protocolo.nome_fantasia || p.protocolo.razao_social,
          address: p.protocolo.endereco,
          bairro: p.protocolo.bairro,
        })),
    [orderedProcesses]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredProcesses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProcesses.map((p) => p.id)));
    }
  };

  // Nearest-neighbor algorithm based on priority
  const handleGenerateRoute = () => {
    // 1. Separate processes with and without coordinates
    const withCoords: ProcessoComProtocolo[] = [];
    const noCoords: ProcessoComProtocolo[] = [];

    selectedProcesses.forEach((p) => {
      if (p.protocolo.latitude != null && p.protocolo.longitude != null) {
        withCoords.push(p);
      } else {
        noCoords.push(p);
      }
    });

    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const ordered: ProcessoComProtocolo[] = [];
    let currentLat = START_COORDS[0];
    let currentLng = START_COORDS[1];

    if (routePriority === "date") {
      // Group by earliest assignment date
      const groupedByDate: Record<string, ProcessoComProtocolo[]> = {};
      withCoords.forEach(p => {
        const date = p.datasAtribuicao.length > 0 ? [...p.datasAtribuicao].sort()[0] : "Sem Data";
        if (!groupedByDate[date]) groupedByDate[date] = [];
        groupedByDate[date].push(p);
      });

      // Sort dates
      const sortedDates = Object.keys(groupedByDate).sort((a, b) => a.localeCompare(b));

      // Nearest-neighbor per date group
      sortedDates.forEach(date => {
        const remaining = [...groupedByDate[date]];
        while (remaining.length > 0) {
          let nearestIdx = 0;
          let nearestDist = Infinity;
          for (let i = 0; i < remaining.length; i++) {
            const d = haversine(
              currentLat, currentLng,
              remaining[i].protocolo.latitude!, remaining[i].protocolo.longitude!
            );
            if (d < nearestDist) {
              nearestDist = d;
              nearestIdx = i;
            }
          }
          const nearest = remaining.splice(nearestIdx, 1)[0];
          ordered.push(nearest);
          currentLat = nearest.protocolo.latitude!;
          currentLng = nearest.protocolo.longitude!;
        }
      });
    } else {
      // 2. Global optimal route (current behavior)
      const remaining = [...withCoords];
      while (remaining.length > 0) {
        let nearestIdx = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const d = haversine(
            currentLat, currentLng,
            remaining[i].protocolo.latitude!, remaining[i].protocolo.longitude!
          );
          if (d < nearestDist) {
            nearestDist = d;
            nearestIdx = i;
          }
        }
        const nearest = remaining.splice(nearestIdx, 1)[0];
        ordered.push(nearest);
        currentLat = nearest.protocolo.latitude!;
        currentLng = nearest.protocolo.longitude!;
      }
    }

    // Add any without coords at the end
    setOptimizedOrder([...ordered, ...noCoords].map((p) => p.id));
    setRouteGenerated(true);
  };

  const buildGoogleMapsUrl = () => {
    const waypoints = orderedProcesses
      .filter((p) => p.protocolo.latitude && p.protocolo.longitude)
      .map((p) => `${p.protocolo.latitude},${p.protocolo.longitude}`);

    const origin = PONTO_PARTIDA;
    const destination = PONTO_PARTIDA;
    const baseUrl = "https://www.google.com/maps/dir/?api=1";
    
    if (waypoints.length === 0) {
      return `${baseUrl}&origin=${origin}&destination=${destination}&travelmode=driving`;
    }
    
    return `${baseUrl}&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints.join('|'))}&travelmode=driving`;
  };

  const copyRouteLink = () => {
    const url = buildGoogleMapsUrl();
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link da rota copiado!");
    });
  };

  const openGoogleMaps = () => {
    window.open(buildGoogleMapsUrl(), "_blank");
  };

  useEffect(() => {
    setSelectedIds(new Set());
    setRouteGenerated(false);
    setOptimizedOrder([]);
  }, [dataLimite, selectedVistoriadores, routePriority]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-foreground">Roteirização Inteligente</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Filtre por data limite e vistoriador para traçar rotas de vistorias pendentes
        </p>
      </div>

      {/* Filters */}
      <div className="kpi-card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Atribuídas até <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={dataLimite}
              onChange={(e) => setDataLimite(e.target.value)}
              className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2"
            />
          </div>
          <div className="row-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Vistoriadores {selectedVistoriadores.size === 0 && <span className="text-[10px] font-normal">(todos)</span>}
            </label>
            <div className={cn(
              "border border-input rounded-lg bg-background p-2.5 max-h-32 sm:max-h-40 overflow-y-auto space-y-2",
              !canChangeVistoriador && "opacity-60 bg-muted/30"
            )}>
              {vistoriadores.map((v) => (
                <label key={v.user_id} className={cn("flex items-center gap-2 text-sm select-none", canChangeVistoriador ? "cursor-pointer" : "cursor-not-allowed")}>
                  <input
                    type="checkbox"
                    disabled={!canChangeVistoriador}
                    checked={selectedVistoriadores.has(v.user_id)}
                    onChange={(e) => {
                      if (!canChangeVistoriador) return;
                      setSelectedVistoriadores(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(v.user_id);
                        else next.delete(v.user_id);
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded border-input accent-primary flex-shrink-0"
                  />
                  <span className="truncate">
                    {v.patente ? `${v.patente} ` : ""}{v.nome_guerra || "Usuário sem nome"}
                  </span>
                </label>
              ))}
              {vistoriadores.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum disponível</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Prioridade da Rota</label>
            <select
              value={routePriority}
              onChange={(e) => setRoutePriority(e.target.value as "coord" | "date")}
              className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2"
            >
              <option value="date">Por Data de Atribuição</option>
              <option value="coord">Otimizada (Sem Data)</option>
            </select>
          </div>
          <button
            onClick={handleGenerateRoute}
            disabled={selectedProcesses.length < 1}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 justify-center transition-colors shadow-sm",
              selectedProcesses.length < 1
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <Navigation className="w-4 h-4" />
            Gerar Rota ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Route list */}
      <div className="kpi-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {!routeGenerated && filteredProcesses.length > 0 && (
              <input
                type="checkbox"
                checked={selectedIds.size === filteredProcesses.length && filteredProcesses.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-input accent-primary"
              />
            )}
            <h3 className="text-sm font-semibold text-foreground">
              {routeGenerated ? "Rota Otimizada" : "Vistorias Pendentes"} ({filteredProcesses.length})
            </h3>
          </div>
          {routeGenerated && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRouteGenerated(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={copyRouteLink}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Link da Rota
              </button>
              <button
                onClick={openGoogleMaps}
                className="text-xs px-3 py-1.5 rounded-lg bg-accent text-foreground hover:bg-accent/80 flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Google Maps
              </button>
            </div>
          )}
        </div>

        {!dataLimite ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Informe a <strong>data limite</strong> para visualizar as vistorias pendentes.
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filteredProcesses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma vistoria pendente neste período.
          </p>
        ) : routeGenerated ? (
          <div className="space-y-3">
            {orderedProcesses.map((process, index) => (
              <div
                key={process.id}
                className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors animate-fade-in"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary-foreground">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {process.protocolo.nome_fantasia || process.protocolo.razao_social}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {process.protocolo.endereco}, {process.protocolo.bairro}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{process.protocolo.municipio}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {process.datasAtribuicao.join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(
              filteredProcesses.reduce((acc, process) => {
                const date = process.datasAtribuicao.length > 0 ? [...process.datasAtribuicao].sort()[0] : "Sem Data";
                if (!acc[date]) acc[date] = [];
                acc[date].push(process);
                return acc;
              }, {} as Record<string, ProcessoComProtocolo[]>)
            ).sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
             .map(([date, processesInDate]) => {
              const formatBRDate = (d: string) => {
                if (d === "Sem Data") return "Vistorias Sem Data";
                const [year, month, day] = d.split("-");
                return `Vistorias do dia ${day}/${month}/${year}`;
              };

              return (
                <div key={date} className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-1">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                      {formatBRDate(date)}
                    </span>
                    <span className="text-muted-foreground text-xs font-normal">
                      ({processesInDate.length} vistorias)
                    </span>
                  </h4>
                  {processesInDate.map((process) => (
                    <label
                      key={process.id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border transition-colors cursor-pointer",
                        selectedIds.has(process.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/30"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(process.id)}
                        onChange={() => toggleSelect(process.id)}
                        className="w-4 h-4 rounded border-input accent-primary flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {process.protocolo.nome_fantasia || process.protocolo.razao_social}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {process.protocolo.endereco}, {process.protocolo.bairro}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">{process.protocolo.municipio}</p>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {routeGenerated && orderedProcesses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-sm font-semibold text-foreground mb-3">Mapa da Rota</h4>
            <div className="rounded-xl overflow-hidden border border-border h-[400px]">
              <RouteMap start={START_COORDS} points={selectedRoutePoints} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}