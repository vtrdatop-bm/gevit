import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DisplayStatus, displayStatusLabels, computeDisplayStatus, getDisplayStatusLabel, getCurrentVistoriadorId, sortVistoriadores } from "@/lib/vistoriaStatus";
import { computeDeadline, PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";
import { Filter, Layers, Navigation, MousePointerClick, MapPin, Search, Maximize2, Minimize2, ArrowLeft, ChevronDown } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { STATUS_MARKER_COLORS } from "@/lib/constants";
import { MAP_MOCK_PROCESSOS } from "@/mocks/mockData";
import { ProtocoloData, VistoriaData, ProcessStatus } from "@/types/database";
import { Vistoriador } from "@/types/user";
import { cn } from "@/lib/utils";

interface MapProcess {
  id: string;
  vistoriador_id: string | null;
  status: ProcessStatus;
  displayStatus: DisplayStatus;
  data_prevista: string | null;
  vistoriador_nome: string | null;
  vistoria: VistoriaData | null;
  protocolo: ProtocoloData;
  regional_id: string | null;
}

const getVistoriaStage = (v: VistoriaData | null): string | null => {
  if (!v) return null;
  if (v.data_3_atribuicao || v.data_3_vistoria) return "3ª Vistoria";
  if (v.data_2_atribuicao || v.data_2_vistoria) return "2ª Vistoria";
  if (v.data_1_atribuicao || v.data_1_vistoria) return "1ª Vistoria";
  return null;
};

const getVistoriaResult = (v: VistoriaData | null): string | null => {
  if (!v) return null;
  const labels: Record<string, string> = { aprovado: "Aprovado", pendencia: "Pendência", reprovado: "Reprovado" };
  if (v.status_3_vistoria) return labels[v.status_3_vistoria] || v.status_3_vistoria;
  if (v.status_2_vistoria) return labels[v.status_2_vistoria] || v.status_2_vistoria;
  if (v.status_1_vistoria) return labels[v.status_1_vistoria] || v.status_1_vistoria;
  return null;
};

export default function MapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusProcessoId = location.state?.focusProcessoId as string | undefined;
  const focusCoords = location.state?.focusCoords as [number, number] | undefined;
  const restoredFilters = (location.state as {
    mapBackFilters?: {
      filterStatus?: (DisplayStatus | "minhas")[];
      selectedVistoriador?: string;
      selectedRegional?: string;
    };
  } | null)?.mapBackFilters;

  const { isDev, user } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [processos, setProcessos] = useState<MapProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<(DisplayStatus | "minhas")[]>(restoredFilters?.filterStatus || []);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const statusDropdownPanelRef = useRef<HTMLDivElement | null>(null);
  const statusDropdownButtonRef = useRef<HTMLButtonElement | null>(null);
  const [statusDropdownPosition, setStatusDropdownPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const [selectedVistoriador, setSelectedVistoriador] = useState(restoredFilters?.selectedVistoriador || "");
  const [vistoriadores, setVistoriadores] = useState<Vistoriador[]>([]);
  const [selectedRegional, setSelectedRegional] = useState(restoredFilters?.selectedRegional || "");
  const [regionais, setRegionais] = useState<{ id: string; nome: string }[]>([]);
  const [canChangeVistoriador, setCanChangeVistoriador] = useState(false);

  const fetchData = useCallback(async () => {
    if (isDev) {
      setProcessos(MAP_MOCK_PROCESSOS as any);
      setLoading(false);
      return;
    }

    const [{ data: procs }, { data: protocolosData }, { data: profilesData }, { data: vistorias }, { data: roles }, { data: regionaisData }, { data: bairrosData }, { data: pausasData }, { data: termosData }] = await Promise.all([
      supabase
        .from("processos")
        .select("id, status, data_prevista, vistoriador_id, regional_id, protocolos(id, numero, nome_fantasia, razao_social, endereco, bairro, municipio, latitude, longitude, data_solicitacao)"),
      supabase.from("protocolos").select("id, numero, nome_fantasia, razao_social, endereco, bairro, municipio, latitude, longitude, data_solicitacao"),
      supabase.from("profiles").select("user_id, patente, nome_guerra"),
      supabase.from("vistorias").select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno, vistoriador_1_id, vistoriador_2_id, vistoriador_3_id"),
      supabase.from("user_roles").select("user_id").eq("role", "vistoriador"),
      supabase.from("regionais").select("id, nome").order("nome"),
      supabase.from("bairros").select("nome, municipio, regional_id"),
      supabase.from("pausas").select("processo_id, data_inicio, data_fim, etapa"),
      supabase.from("termos_compromisso").select("processo_id, data_validade"),
    ]);

    if (regionaisData) setRegionais(regionaisData);

    const bairroRegionalMap: Record<string, string> = {};
    (bairrosData || []).forEach((b) => {
      if (b.regional_id) {
        bairroRegionalMap[`${b.nome}|${b.municipio}`] = b.regional_id;
      }
    });

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

      const isVistoriador = userRoles?.some((r) => r.role === "vistoriador");
      if (isVistoriador) {
        setSelectedVistoriador(user.id);
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

    const profMap: Record<string, string> = {};
    (profilesData || []).forEach((p) => { profMap[p.user_id] = [p.patente, p.nome_guerra].filter(Boolean).join(" "); });

    const vistoriaMap: Record<string, any> = {};
    (vistorias || []).forEach((v) => { vistoriaMap[v.processo_id] = v; });

    const pausasByProcesso: Record<string, DeadlinePausaData[]> = {};
    (pausasData || []).forEach((p: any) => {
      if (!pausasByProcesso[p.processo_id]) pausasByProcesso[p.processo_id] = [];
      pausasByProcesso[p.processo_id].push(p);
    });

    const termosMap: Record<string, string> = {};
    (termosData || []).forEach((t: any) => {
      termosMap[t.processo_id] = t.data_validade;
    });

    const mapped: MapProcess[] = (procs || []).map((p: any) => {
      const vist = vistoriaMap[p.id] || null;
      const dStatus = computeDisplayStatus(p.status, vist, p.protocolos?.data_solicitacao);
      const deadlineResult = computeDeadline(vist, pausasByProcesso[p.id] || [], dStatus, termosMap[p.id] || null);
      const finalStatus = deadlineResult.active && deadlineResult.remaining <= 0 && deadlineResult.type === "expiration"
        ? "expirado"
        : dStatus;
      const activeVistoriadorId = getCurrentVistoriadorId(p.vistoriador_id, vist);

      let resolvedRegionalId = p.regional_id;
      if (!resolvedRegionalId && p.protocolos) {
        resolvedRegionalId = bairroRegionalMap[`${p.protocolos.bairro}|${p.protocolos.municipio}`] || null;
      }

      return {
        id: p.id,
        vistoriador_id: activeVistoriadorId,
        status: p.status,
        displayStatus: finalStatus,
        data_prevista: p.data_prevista,
        vistoriador_nome: profMap[activeVistoriadorId || ""] || "Não atribuído",
        vistoria: vist,
        protocolo: p.protocolos,
        regional_id: resolvedRegionalId,
      };
    });

    const protocoloIdsComProcesso = new Set((mapped || []).map((p) => p.protocolo?.id).filter(Boolean));
    const orfaos: MapProcess[] = (protocolosData || [])
      .filter((proto: any) => !protocoloIdsComProcesso.has(proto.id))
      .map((proto: any) => {
        const dStatus = computeDisplayStatus("regional", null, proto.data_solicitacao);
        const deadlineResult = computeDeadline(null, [], dStatus, null);
        const finalStatus = deadlineResult.active && deadlineResult.remaining <= 0 && deadlineResult.type === "expiration"
          ? "expirado"
          : dStatus;
        const resolvedRegionalId = bairroRegionalMap[`${proto.bairro}|${proto.municipio}`] || null;

        return {
          id: `proto-${proto.id}`,
          vistoriador_id: null,
          status: "regional" as ProcessStatus,
          displayStatus: finalStatus,
          data_prevista: null,
          vistoriador_nome: "Não atribuído",
          vistoria: null,
          protocolo: proto,
          regional_id: resolvedRegionalId,
        };
      });

    setProcessos([...(mapped || []), ...orfaos]);
    setLoading(false);
  }, [user, isDev]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("map-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "processos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "protocolos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "vistorias" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!statusDropdownRef.current) return;
      const clickedTrigger = statusDropdownRef.current.contains(target);
      const clickedPanel = statusDropdownPanelRef.current?.contains(target);
      if (!clickedTrigger && !clickedPanel) {
        setStatusDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!statusDropdownOpen) return;

    const updatePosition = () => {
      if (!statusDropdownButtonRef.current) return;
      const rect = statusDropdownButtonRef.current.getBoundingClientRect();
      setStatusDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [statusDropdownOpen]);

  const statusOptions = useMemo(() => {
    const base: Array<{ value: DisplayStatus | "minhas"; label: string }> = [
      { value: "regional", label: getDisplayStatusLabel("regional") },
      { value: "aguardando_retorno", label: getDisplayStatusLabel("aguardando_retorno") },
      { value: "atribuido", label: getDisplayStatusLabel("atribuido") },
      { value: "pendencias", label: getDisplayStatusLabel("pendencias") },
      { value: "expirado", label: getDisplayStatusLabel("expirado") },
      { value: "certificado_termo", label: getDisplayStatusLabel("certificado_termo") },
      { value: "certificado", label: getDisplayStatusLabel("certificado") },
      { value: "cancelado", label: getDisplayStatusLabel("cancelado") },
    ];

    if (canChangeVistoriador) {
      base.unshift({ value: "minhas", label: "Minhas Vistorias" });
    }

    return base;
  }, [canChangeVistoriador]);

  const toggleStatusFilter = (value: DisplayStatus | "minhas") => {
    setFilterStatus((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const openProtocoloDetail = useCallback((protocoloId: string) => {
    navigate(location.pathname + location.search, {
      replace: true,
      state: {
        ...(location.state && typeof location.state === "object" ? location.state : {}),
        mapBackFilters: {
          filterStatus,
          selectedVistoriador,
          selectedRegional,
        },
      },
    });

    navigate(`/protocolo/${protocoloId}`);
  }, [navigate, location.pathname, location.search, location.state, filterStatus, selectedVistoriador, selectedRegional]);

  const filteredProcesses = processos.filter((p) => {
    if (selectedVistoriador && p.vistoriador_id !== selectedVistoriador) return false;
    if (selectedRegional && p.regional_id !== selectedRegional) return false;

    if (filterStatus.includes("minhas") && p.vistoriador_id !== user?.id) return false;

    const selectedStatuses = filterStatus.filter((s): s is DisplayStatus => s !== "minhas");
    if (selectedStatuses.length === 0) return true;
    return selectedStatuses.includes(p.displayStatus);
  });

  // Init map centered on Rio Branco, AC
  useEffect(() => {
    if (loading || !mapRef.current || mapInstance.current) return;

    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstance.current) return;
      const map = L.map(mapRef.current, {
        zoomControl: false,
      }).setView([-9.975, -67.81], 13);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a>',
      }).addTo(map);

      mapInstance.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [loading]);

  // Update markers
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    import("leaflet").then((L) => {
      const map = mapInstance.current;
      if (!map) return; // Component unmounted before import resolved

      map.eachLayer((layer: any) => {
        if (layer instanceof L.CircleMarker) map.removeLayer(layer);
      });

      const bounds: [number, number][] = [];
      let focusMarker: L.CircleMarker | L.Marker | null = null;
      let targetCoords: [number, number] | null = focusCoords || null;

      const groups = new Map<string, MapProcess[]>();
      filteredProcesses.forEach((p) => {
        if (p.protocolo?.latitude && p.protocolo?.longitude) {
          const key = `${p.protocolo.latitude},${p.protocolo.longitude}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(p);
        }
      });



      const markersData: { marker: L.CircleMarker, isMultiple: boolean }[] = [];

      const getRadius = (isMult: boolean, zoom: number) => {
        const maxRadius = isMult ? 12 : 10;
        const minRadius = isMult ? 6 : 4;
        if (zoom >= 15) return maxRadius;
        if (zoom <= 6) return minRadius;
        const fraction = (zoom - 6) / 9;
        return minRadius + (maxRadius - minRadius) * fraction;
      };

      groups.forEach((groupProcesses, coordsKey) => {
        const [lat, lng] = coordsKey.split(",").map(Number);
        bounds.push([lat, lng]);

        // If multiple, use a special style or just the status of the first one
        // Better: count and maybe show a badge (though CircleMarker is limited)
        const primaryProcess = groupProcesses[0];
        const isEventoUnico = !!primaryProcess.protocolo.evento_unico;
        const color = isEventoUnico ? "#06b6d4" : STATUS_MARKER_COLORS[primaryProcess.displayStatus];
        const isMultiple = groupProcesses.length > 1;

        const marker = L.circleMarker([lat, lng], {
          radius: getRadius(isMultiple, map.getZoom()),
          fillColor: color,
          color: isMultiple ? "#ffffff" : color,
          weight: isMultiple ? 3 : 2,
          opacity: 1,
          fillOpacity: 0.7,
        }).addTo(map);

        markersData.push({ marker, isMultiple });

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; min-width: 250px; max-height: 400px; overflow-y: auto; padding: 4px;">
            ${isMultiple ? `<div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #ef4444; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
              <span>⚠️</span> <span>${groupProcesses.length} protocolos neste local</span>
            </div>` : ""}
            
            ${groupProcesses.map((process, idx) => {
          const stage = getVistoriaStage(process.vistoria);
          const result = getVistoriaResult(process.vistoria);
          return `
                <div style="${idx > 0 ? "margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee;" : ""}">
                  <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px; color: #1a1a1a;">
                    ${process.protocolo.numero}
                  </div>
                  <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px; color: #333;">
                    ${process.protocolo.nome_fantasia || process.protocolo.razao_social}
                  </div>
                  <div style="font-size: 11px; color: #666; margin-bottom: 8px; line-height: 1.3;">
                    ${process.protocolo.razao_social}
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 3px; margin-bottom: 10px;">
                    <div style="font-size: 11px; color: #444; display: flex; align-items: start; gap: 4px;">
                      <span>📍</span> <span>${process.protocolo.endereco}, ${process.protocolo.bairro}</span>
                    </div>
                    <div style="font-size: 11px; color: #444; display: flex; align-items: center; gap: 4px;">
                      <span>📋</span> <span>${getDisplayStatusLabel(process.displayStatus, process.vistoria)}</span>
                    </div>
                    ${stage ? `<div style="font-size: 11px; color: #444; display: flex; align-items: center; gap: 4px;">
                      <span>🔍</span> <span>${stage}${result ? ` — ${result}` : ""}</span>
                    </div>` : ""}
                    ${process.vistoriador_nome ? `<div style="font-size: 11px; color: #444; display: flex; align-items: center; gap: 4px;">
                      <span>👤</span> <span>${process.vistoriador_nome}</span>
                    </div>` : ""}
                  </div>
                  <button 
                    onclick="window.dispatchEvent(new CustomEvent('open-protocolo', { detail: '${process.protocolo.id}' }))"
                    style="width: 100%; background: hsl(var(--primary)); color: white; border: none; padding: 7px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 4px;"
                  >
                    Ver Detalhes
                  </button>
                </div>
              `;
        }).join("")}
          </div>
        `;

        marker.bindPopup(popupContent, {
          className: 'protocolo-popup',
          maxWidth: 300
        });

        if (focusProcessoId && groupProcesses.some(p => p.id === focusProcessoId)) {
          focusMarker = marker;
          targetCoords = [lat, lng];
        }
      });

      if (focusMarker && targetCoords) {
        map.setView(targetCoords, 18);
        (focusMarker as any).openPopup();
      } else if (targetCoords) {
        map.setView(targetCoords, 18);
        L.marker(targetCoords).addTo(map).bindPopup("Localização selecionada").openPopup();
      } else if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }

      const updateRadii = () => {
        const zoom = map.getZoom();
        markersData.forEach(({ marker, isMultiple }) => {
          marker.setRadius(getRadius(isMultiple, zoom));
        });
      };

      map.on('zoomend', updateRadii);

      // Cleanup
      const oldCleanup = (map as any)._customZoomCleanup;
      if (oldCleanup) {
        map.off('zoomend', oldCleanup);
      }
      (map as any)._customZoomCleanup = updateRadii;
    });
  }, [filteredProcesses, mapReady, focusProcessoId, focusCoords]);

  useEffect(() => {
    const handleOpenProtocolo = (e: any) => {
      const id = e.detail;
      if (id) {
        openProtocoloDetail(id);
      }
    };

    window.addEventListener('open-protocolo', handleOpenProtocolo);
    return () => window.removeEventListener('open-protocolo', handleOpenProtocolo);
  }, [openProtocoloDetail]);

  const totalProcessos = processos.length;
  const filteredTotal = filteredProcesses.length;
  const totalGeolocalized = processos.filter((p) => p.protocolo?.latitude && p.protocolo?.longitude).length;

  const isFiltered = filterStatus.length > 0 || selectedVistoriador !== "" || selectedRegional !== "";

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
            <h2 className="text-2xl font-bold text-foreground">Mapa Interativo</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isFiltered
              ? `${filteredTotal} de ${totalProcessos} processos`
              : `${totalProcessos} processos`}
            {totalGeolocalized === 0
              ? " - Nenhum processo com coordenadas"
              : ` - ${totalGeolocalized} com coordenadas`}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="relative z-30 overflow-visible flex flex-col sm:flex-row sm:items-center gap-4 bg-muted/40 p-3 rounded-xl border border-border">
        {/* Status Filter */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <Filter className="w-4 h-4 text-muted-foreground mr-1" />
          <div ref={statusDropdownRef} className="w-full sm:w-64">
            <button
              ref={statusDropdownButtonRef}
              type="button"
              onClick={() => setStatusDropdownOpen((open) => !open)}
              title="Filtrar por status"
              className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate text-left">
                {filterStatus.length > 0 ? `${filterStatus.length} status selecionado(s)` : "Todos os status"}
              </span>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", statusDropdownOpen && "rotate-180")} />
            </button>

            {statusDropdownOpen && createPortal(
              <div
                ref={statusDropdownPanelRef}
                className="fixed z-[2000] rounded-md border border-border bg-popover p-2 shadow-md"
                style={{
                  top: statusDropdownPosition.top,
                  left: statusDropdownPosition.left,
                  width: statusDropdownPosition.width,
                }}
              >
                <div className="max-h-64 overflow-auto space-y-1">
                  {statusOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={filterStatus.includes(option.value)}
                        onChange={() => toggleStatusFilter(option.value)}
                        className="h-4 w-4"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>

        {/* Vistoriador Selection */}
        {canChangeVistoriador && (
          <div className="flex flex-wrap items-center gap-4 pl-4 border-l border-border sr-only sm:not-sr-only">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Vistoriador:</span>
              <select
                title="Filtrar por Vistoriador"
                value={selectedVistoriador}
                onChange={(e) => setSelectedVistoriador(e.target.value)}
                className="text-xs rounded-lg border border-input bg-background px-3 py-1.5 min-w-[150px] focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todos</option>
                {vistoriadores.map((v) => (
                  <option key={v.user_id} value={v.user_id}>
                    {v.patente ? `${v.patente} ` : ""}{v.nome_guerra || "Usuário sem nome"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 border-l border-border pl-4">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Regional:</span>
              <select
                title="Filtrar por Regional"
                value={selectedRegional}
                onChange={(e) => setSelectedRegional(e.target.value)}
                className="text-xs rounded-lg border border-input bg-background px-3 py-1.5 min-w-[150px] focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todas</option>
                {regionais.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Vistoriador & Regional for Mobile */}
      {canChangeVistoriador && (
        <div className="sm:hidden flex flex-col gap-3 px-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtrar por Vistoriador</label>
            <select
              title="Filtrar por Vistoriador (Mobile)"
              value={selectedVistoriador}
              onChange={(e) => setSelectedVistoriador(e.target.value)}
              className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2"
            >
              <option value="">Todos os Vistoriadores</option>
              {vistoriadores.map((v) => (
                <option key={v.user_id} value={v.user_id}>
                  {v.patente ? `${v.patente} ` : ""}{v.nome_guerra || "Usuário sem nome"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtrar por Regional</label>
            <select
              title="Filtrar por Regional (Mobile)"
              value={selectedRegional}
              onChange={(e) => setSelectedRegional(e.target.value)}
              className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2"
            >
              <option value="">Todas as Regionais</option>
              {regionais.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_MARKER_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">
              {getDisplayStatusLabel(status as DisplayStatus)}
            </span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-[400px] rounded-xl overflow-hidden border border-border">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center min-h-[400px]">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-full" style={{ minHeight: 400 }} />
        )}
      </div>
    </div>
  );
}
