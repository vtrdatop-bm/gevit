import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProcessStatus } from "@/types/process";
import { DisplayStatus, displayStatusLabels, computeDisplayStatus } from "@/lib/vistoriaStatus";
import { Filter } from "lucide-react";
import "leaflet/dist/leaflet.css";

const statusMarkerColors: Record<DisplayStatus, string> = {
  regional: "#eab308",
  atribuido: "#8b5cf6",
  pendencias: "#ef4444",
  certificado_termo: "#3b82f6",
  certificado: "#22c55e",
  expirado: "#737373",
};

interface MapProcess {
  id: string;
  vistoriador_id: string | null;
  status: ProcessStatus;
  displayStatus: DisplayStatus;
  data_prevista: string | null;
  vistoriador_nome: string | null;
  vistoria: any | null;
  protocolo: {
    numero: string;
    nome_fantasia: string | null;
    razao_social: string;
    endereco: string;
    bairro: string;
    municipio: string;
    latitude: number | null;
    longitude: number | null;
  };
}

const getVistoriaStage = (v: any): string | null => {
  if (!v) return null;
  if (v.data_3_atribuicao || v.data_3_vistoria) return "3ª Vistoria";
  if (v.data_2_atribuicao || v.data_2_vistoria) return "2ª Vistoria";
  if (v.data_1_atribuicao || v.data_1_vistoria) return "1ª Vistoria";
  return null;
};

const getVistoriaResult = (v: any): string | null => {
  if (!v) return null;
  const labels: Record<string, string> = { aprovado: "Aprovado", pendencia: "Pendência", reprovado: "Reprovado" };
  if (v.status_3_vistoria) return labels[v.status_3_vistoria] || v.status_3_vistoria;
  if (v.status_2_vistoria) return labels[v.status_2_vistoria] || v.status_2_vistoria;
  if (v.status_1_vistoria) return labels[v.status_1_vistoria] || v.status_1_vistoria;
  return null;
};

export default function MapPage() {
  const { isDev } = useAuth();

  const fetchData = useCallback(async () => {
    if (isDev) {
      setProcessos([]);
      setLoading(false);
      return;
    }

    const [{ data: procs }, { data: profiles }, { data: vistorias }] = await Promise.all([
      supabase
        .from("processos")
        .select("id, status, data_prevista, vistoriador_id, protocolos(numero, nome_fantasia, razao_social, endereco, bairro, municipio, latitude, longitude)")
        .neq("status", "expirado"),
      supabase.from("profiles").select("user_id, nome_completo"),
      supabase.from("vistorias").select("processo_id, data_1_atribuicao, data_2_atribuicao, data_3_atribuicao, data_1_vistoria, data_2_vistoria, data_3_vistoria, status_1_vistoria, status_2_vistoria, status_3_vistoria"),
    ]);

    const profMap: Record<string, string> = {};
    (profiles || []).forEach((p) => { profMap[p.user_id] = p.nome_completo; });

    const vistMap: Record<string, any> = {};
    (vistorias || []).forEach((v: any) => { vistMap[v.processo_id] = v; });

    const mapped: MapProcess[] = (procs || []).map((p: any) => {
      const vistoria = vistMap[p.id] || null;
      return {
        id: p.id,
        vistoriador_id: p.vistoriador_id || null,
        status: p.status as ProcessStatus,
        displayStatus: computeDisplayStatus(p.status, vistoria),
        data_prevista: p.data_prevista,
        vistoriador_nome: p.vistoriador_id ? profMap[p.vistoriador_id] || null : null,
        protocolo: p.protocolos,
        vistoria,
      };
    });

    setProcessos(mapped);
    setLoading(false);
  }, []);

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

  const filteredProcesses =
    filterStatus === "all"
      ? processos
      : filterStatus === "minhas"
        ? processos.filter((p) => p.vistoriador_id === user?.id)
        : processos.filter((p) => p.displayStatus === filterStatus);

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

      map.eachLayer((layer: any) => {
        if (layer instanceof L.CircleMarker) map.removeLayer(layer);
      });

      const bounds: [number, number][] = [];

      filteredProcesses.forEach((process) => {
        const lat = process.protocolo?.latitude;
        const lng = process.protocolo?.longitude;
        if (!lat || !lng) return;

        bounds.push([lat, lng]);
        const color = statusMarkerColors[process.displayStatus];

        const marker = L.circleMarker([lat, lng], {
          radius: 10,
          fillColor: color,
          color: color,
          weight: 2,
          opacity: 0.9,
          fillOpacity: 0.6,
        }).addTo(map);

        const stage = getVistoriaStage(process.vistoria);
        const result = getVistoriaResult(process.vistoria);

        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 200px;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${process.protocolo.nome_fantasia || process.protocolo.razao_social}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${process.protocolo.razao_social}</div>
            <div style="font-size: 11px; color: #888; margin-bottom: 2px;">📍 ${process.protocolo.endereco}, ${process.protocolo.bairro}</div>
            <div style="font-size: 11px; color: #888; margin-bottom: 2px;">📋 ${displayStatusLabels[process.displayStatus]}</div>
            ${stage ? `<div style="font-size: 11px; color: #888; margin-bottom: 2px;">🔍 ${stage}${result ? ` — ${result}` : ""}</div>` : ""}
            ${process.data_prevista ? `<div style="font-size: 11px; color: #888; margin-bottom: 2px;">📅 Previsto: ${process.data_prevista}</div>` : ""}
            ${process.vistoriador_nome ? `<div style="font-size: 11px; color: #888;">👤 ${process.vistoriador_nome}</div>` : ""}
          </div>
        `);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    });
  }, [filteredProcesses, mapReady]);

  const processesWithCoords = processos.filter((p) => p.protocolo?.latitude && p.protocolo?.longitude).length;

  return (
    <div className="p-4 md:p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Mapa Interativo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {processesWithCoords > 0
              ? `${processesWithCoords} vistorias geolocalizadas`
              : "Nenhuma vistoria com coordenadas cadastradas"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {(["all", "minhas", "regional", "atribuido", "pendencias", "certificado_termo", "certificado"] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterStatus === status
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              {status === "all" ? "Todos" : status === "minhas" ? "Minhas Vistorias" : displayStatusLabels[status]}
            </button>
          )
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(statusMarkerColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">
              {displayStatusLabels[status as DisplayStatus]}
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
