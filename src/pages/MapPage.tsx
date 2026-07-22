import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DisplayStatus, displayStatusLabels, getDisplayStatusLabel, getCurrentVistoriadorId, sortVistoriadores } from "@/lib/vistoriaStatus";
import { PausaData as DeadlinePausaData } from "@/lib/deadlineUtils";
import { Filter, Layers, Navigation, MousePointerClick, MapPin, Search, Maximize2, Minimize2, ArrowLeft, ChevronDown, Calendar, User, CalendarOff, UserMinus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";

import { STATUS_MARKER_COLORS } from "@/lib/constants";
import { MAP_MOCK_PROCESSOS } from "@/mocks/mockData";
import { ProtocoloData, VistoriaData, ProcessStatus } from "@/types/database";
import { Vistoriador } from "@/types/user";
import { cn } from "@/lib/utils";
import { resolveConsistentDisplayStatus, fetchAllRows } from "@/lib/processoConsistency";

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
  const lastOpenedProtocoloId = location.state?.lastOpenedProtocoloId as string | undefined;
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
  const markersRef = useRef<{ marker: any, protocoloIds: string[], isMultiple: boolean, baseColor: string }[]>([]);
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

  const [selectedProtocolIds, setSelectedProtocolIds] = useState<string[]>([]);
  const selectedProtocolIdsRef = useRef<string[]>([]);
  useEffect(() => {
    selectedProtocolIdsRef.current = selectedProtocolIds;
  }, [selectedProtocolIds]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [assignDate, setAssignDate] = useState("");
  const [selectedBulkVistoriadorId, setSelectedBulkVistoriadorId] = useState("");

  const fetchData = useCallback(async () => {
    if (isDev) {
      setProcessos(MAP_MOCK_PROCESSOS as any);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [
        procs,
        protocolosData,
        profilesData,
        vistorias,
        roles,
        regionaisData,
        bairrosData,
        pausasData,
        termosData
      ] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase
            .from("processos")
            .select("id, status, data_prevista, vistoriador_id, regional_id, updated_at, created_at, protocolos(id, numero, nome_fantasia, razao_social, endereco, bairro, municipio, latitude, longitude, data_solicitacao, evento_unico, data_evento)")
            .range(from, to)
        ),
        fetchAllRows<any>((from, to) =>
          supabase
            .from("protocolos")
            .select("id, numero, nome_fantasia, razao_social, endereco, bairro, municipio, latitude, longitude, data_solicitacao, evento_unico, data_evento")
            .range(from, to)
        ),
        supabase.from("profiles").select("user_id, patente, nome_guerra").then(res => res.data),
        fetchAllRows<any>((from, to) =>
          supabase
            .from("vistorias")
            .select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria, data_1_retorno, data_2_retorno, vistoriador_1_id, vistoriador_2_id, vistoriador_3_id")
            .range(from, to)
        ),
        supabase.from("user_roles").select("user_id").eq("role", "vistoriador").then(res => res.data),
        supabase.from("regionais").select("id, nome").order("nome").then(res => res.data),
        supabase.from("bairros").select("nome, municipio, regional_id").then(res => res.data),
        fetchAllRows<any>((from, to) =>
          supabase
            .from("pausas")
            .select("processo_id, data_inicio, data_fim, etapa")
            .range(from, to)
        ),
        fetchAllRows<any>((from, to) =>
          supabase
            .from("termos_compromisso")
            .select("processo_id, data_validade")
            .range(from, to)
        ),
      ]);

    if (regionaisData) setRegionais(regionaisData);

    const bairroRegionalMap: Record<string, string> = {};
    (bairrosData || []).forEach((b) => {
      if (b.regional_id) {
        bairroRegionalMap[`${b.nome.toUpperCase()}|${b.municipio.toUpperCase()}`] = b.regional_id;
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

    const mapped: MapProcess[] = (procs || [])
      .filter((p: any) => p != null)
      .map((p: any) => {
        const vist = vistoriaMap[p.id] || null;
        const finalStatus = resolveConsistentDisplayStatus({
          dbStatus: p.status,
          vistoria: vist,
          dataSolicitacao: p.protocolos?.data_solicitacao,
          pausas: pausasByProcesso[p.id] || [],
          termoValidade: termosMap[p.id] || null,
        });
        const activeVistoriadorId = getCurrentVistoriadorId(p.vistoriador_id, vist);

        let resolvedRegionalId = p.regional_id;
        if (!resolvedRegionalId && p.protocolos) {
          resolvedRegionalId = bairroRegionalMap[`${(p.protocolos.bairro || "").toUpperCase()}|${(p.protocolos.municipio || "").toUpperCase()}`] || null;
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
        const finalStatus = resolveConsistentDisplayStatus({
          dbStatus: "regional",
          vistoria: null,
          dataSolicitacao: proto.data_solicitacao,
          pausas: [],
          termoValidade: null,
        });
        const resolvedRegionalId = bairroRegionalMap[`${(proto.bairro || "").toUpperCase()}|${(proto.municipio || "").toUpperCase()}`] || null;

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
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [user, isDev]);

  useEffect(() => {
    void fetchData();

    const channel = supabase
      .channel("map-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "processos" }, () => { void fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "protocolos" }, () => { void fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "vistorias" }, () => { void fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "pausas" }, () => { void fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "termos_compromisso" }, () => { void fetchData(); })
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
    // Sempre registra o último protocolo aberto
    navigate(location.pathname + location.search, {
      replace: true,
      state: {
        ...(location.state && typeof location.state === "object" ? location.state : {}),
        mapBackFilters: {
          filterStatus,
          selectedVistoriador,
          selectedRegional,
        },
        lastOpenedProtocoloId: protocoloId,
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



      markersRef.current = [];

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
        const baseColor = isEventoUnico ? "#06b6d4" : STATUS_MARKER_COLORS[primaryProcess.displayStatus];
        const isMultiple = groupProcesses.length > 1;

        const isSelected = groupProcesses.some(p => selectedProtocolIdsRef.current.includes(p.protocolo.id));
        const color = isSelected ? "#f59e0b" : (isMultiple ? "#ffffff" : baseColor);
        const weight = isSelected ? 4 : (isMultiple ? 3 : 2);

        const marker = L.circleMarker([lat, lng], {
          radius: getRadius(isMultiple, map.getZoom()),
          fillColor: baseColor,
          color: color,
          weight: weight,
          opacity: 1,
          fillOpacity: 0.7,
        }).addTo(map);

        marker.on('click', () => {
          setTimeout(() => marker.openPopup(), 10);
          setSelectedProtocolIds(prev => {
            const isCurrentlySelected = groupProcesses.some(p => prev.includes(p.protocolo.id));
            if (isCurrentlySelected) {
              return prev.filter(id => !groupProcesses.some(p => p.protocolo.id === id));
            } else {
              return [...prev, ...groupProcesses.map(p => p.protocolo.id)];
            }
          });
        });

        markersRef.current.push({ marker, protocoloIds: groupProcesses.map(p => p.protocolo.id), isMultiple, baseColor });

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
                  ${process.protocolo.evento_unico ? `<div style=\"font-size: 11px; color: #0e7490; font-weight: bold; margin-bottom: 6px;\">Evento Único${process.protocolo.data_evento ? ` — ${new Date(process.protocolo.data_evento + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</div>` : ""}
                  <div style="display: flex; flex-direction: column; gap: 3px; margin-bottom: 10px;">
                    <div style="font-size: 11px; color: #444; display: flex; align-items: start; gap: 4px;">
                      <span>📍</span> <span>${process.protocolo.endereco}, ${process.protocolo.bairro}</span>
                    </div>
                    <div style="font-size: 11px; color: #444; display: flex; align-items: center; gap: 4px;">
                      <span>📋</span> <span>${getDisplayStatusLabel(process.displayStatus, process.vistoria)}</span>
                    </div>
                    ${stage ? `<div style=\"font-size: 11px; color: #444; display: flex; align-items: center; gap: 4px;\">\n                      <span>🔍</span> <span>${stage}${result ? ` — ${result}` : ""}</span>\n                    </div>` : ""}
                    ${process.vistoriador_nome ? `<div style=\"font-size: 11px; color: #444; display: flex; align-items: center; gap: 4px;\">\n                      <span>👤</span> <span>${process.vistoriador_nome}</span>\n                    </div>` : ""}
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

        if (lastOpenedProtocoloId && groupProcesses.some((p) => p.protocolo.id === lastOpenedProtocoloId)) {
          focusMarker = marker;
          targetCoords = [lat, lng];
        } else if (focusProcessoId && groupProcesses.some((p) => p.id === focusProcessoId)) {
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
        markersRef.current.forEach(({ marker, isMultiple }) => {
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
  }, [filteredProcesses, mapReady, focusProcessoId, focusCoords, lastOpenedProtocoloId]);

  useEffect(() => {
    markersRef.current.forEach(({ marker, protocoloIds, isMultiple, baseColor }) => {
      const isSelected = protocoloIds.some(id => selectedProtocolIds.includes(id));
      marker.setStyle({
        color: isSelected ? "#f59e0b" : (isMultiple ? "#ffffff" : baseColor),
        weight: isSelected ? 4 : (isMultiple ? 3 : 2),
      });
    });
  }, [selectedProtocolIds]);

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

  // Abrir popup automaticamente ao voltar do detalhe
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    // Sempre prioriza o último protocolo aberto, se existir
    const lastId = location.state?.lastOpenedProtocoloId;
    const lastCoords = location.state?.lastOpenedCoords;
    const focusId = location.state?.focusProcessoId;
    const focusCoords = location.state?.focusCoords;
    if (lastId && lastCoords) {
      import("leaflet").then((L) => {
        const map = mapInstance.current;
        const [lat, lng] = lastCoords;
        map.setView([lat, lng], 18);
        setTimeout(() => {
          const markerEl = document.querySelector(`.leaflet-marker-icon, .leaflet-interactive`);
          if (markerEl) {
            markerEl.dispatchEvent(new Event('click'));
          }
        }, 500);
      });
    } else if (focusId && focusCoords) {
      import("leaflet").then((L) => {
        const map = mapInstance.current;
        const [lat, lng] = focusCoords;
        map.setView([lat, lng], 18);
        setTimeout(() => {
          const markerEl = document.querySelector(`.leaflet-marker-icon, .leaflet-interactive`);
          if (markerEl) {
            markerEl.dispatchEvent(new Event('click'));
          }
        }, 500);
      });
    }
  }, [mapReady, location.state]);

  const totalProcessos = processos.length;
  const filteredTotal = filteredProcesses.length;
  const totalGeolocalized = processos.filter((p) => p.protocolo?.latitude && p.protocolo?.longitude).length;

  const isFiltered = filterStatus.length > 0 || selectedVistoriador !== "" || selectedRegional !== "";

  const handleBulkSchedule = async () => {
    if (selectedProtocolIds.length === 0 || !scheduledDate) return;
    try {
      if (isDev) {
        setProcessos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.protocolo.id)) {
              return {
                ...p,
                protocolo: {
                  ...p.protocolo,
                  agendar: true,
                  data_agendamento: scheduledDate,
                }
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
        setProcessos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.protocolo.id)) {
              return {
                ...p,
                protocolo: {
                  ...p.protocolo,
                  agendar: false,
                  data_agendamento: null,
                }
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
    if (selectedProtocolIds.length === 0 || !selectedBulkVistoriadorId || !assignDate) return;
    try {
      if (isDev) {
        setProcessos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.protocolo.id)) {
              return {
                ...p,
                status: "regional",
                vistoriador_id: selectedBulkVistoriadorId
              };
            }
            return p;
          })
        );
      } else {
        const todayStr = assignDate;
        
        for (const protoId of selectedProtocolIds) {
          const proc = processos.find(p => p.protocolo.id === protoId);

          if (!proc) continue;

          if (proc.id.startsWith("proto-")) {
            const { data: newProc, error: procErr } = await supabase
              .from("processos")
              .insert({
                protocolo_id: protoId,
                status: "regional",
                vistoriador_id: selectedBulkVistoriadorId
              })
              .select("id")
              .single();
            if (procErr) throw procErr;

            const { error: vistErr } = await supabase
              .from("vistorias")
              .insert({
                processo_id: newProc.id,
                data_1_atribuicao: todayStr,
                vistoriador_1_id: selectedBulkVistoriadorId
              });
            if (vistErr) throw vistErr;
          } else {
            const { error: procErr } = await supabase
              .from("processos")
              .update({
                status: "regional",
                vistoriador_id: selectedBulkVistoriadorId
              })
              .eq("id", proc.id);
            if (procErr) throw procErr;

            const { data: vistData } = await supabase
              .from("vistorias")
              .select("id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao")
              .eq("processo_id", proc.id)
              .maybeSingle();

            if (vistData) {
              const stageNum = getVistoriaStage(proc.vistoria) === "3ª Vistoria" ? 3 : getVistoriaStage(proc.vistoria) === "2ª Vistoria" ? 2 : 1;
              const vistUpdate: any = {};
              if (stageNum === 2) {
                vistUpdate.data_2_atribuicao = todayStr;
                vistUpdate.vistoriador_2_id = selectedBulkVistoriadorId;
              } else if (stageNum === 3) {
                vistUpdate.data_3_atribuicao = todayStr;
                vistUpdate.vistoriador_3_id = selectedBulkVistoriadorId;
              } else {
                vistUpdate.data_1_atribuicao = todayStr;
                vistUpdate.vistoriador_1_id = selectedBulkVistoriadorId;
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
                  vistoriador_1_id: selectedBulkVistoriadorId
                });
              if (vistErr) throw vistErr;
            }
          }
        }
      }
      toast.success(`${selectedProtocolIds.length} protocolo(s) atribuído(s) com sucesso!`);
      setSelectedProtocolIds([]);
      setSelectedBulkVistoriadorId("");
      setAssignDate("");
      setIsAssignModalOpen(false);
      if (!isDev) {
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao realizar atribuição: " + err.message);
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedProtocolIds.length === 0) return;
    try {
      if (isDev) {
        setProcessos(prev =>
          prev.map(p => {
            if (selectedProtocolIds.includes(p.protocolo.id)) {
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
          const proc = processos.find(p => p.protocolo.id === protoId);
          if (!proc) continue;
          if (proc.id.startsWith("proto-")) continue;

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
            const stageNum = getVistoriaStage(proc.vistoria) === "3ª Vistoria" ? 3 : getVistoriaStage(proc.vistoria) === "2ª Vistoria" ? 2 : 1;
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
      {selectedProtocolIds.length > 0 && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-background/95 backdrop-blur border border-border shadow-lg rounded-full px-6 py-3.5 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200">
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
            onClick={() => setSelectedProtocolIds([])}
            className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1.5"
          >
            Limpar
          </button>
        </div>,
        document.body
      )}

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
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
        </div>,
        document.body
      )}

      {isAssignModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
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
                  value={selectedBulkVistoriadorId}
                  onChange={(e) => setSelectedBulkVistoriadorId(e.target.value)}
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
                    setSelectedBulkVistoriadorId("");
                    setAssignDate("");
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkAssign}
                  disabled={!selectedBulkVistoriadorId || !assignDate}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
