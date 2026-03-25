import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface RoutePoint {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  bairro: string;
}

interface RouteMapProps {
  start: [number, number];
  points: RoutePoint[];
}

const getCssTokenColor = (token: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value ? `hsl(${value})` : fallback;
};

const createNumberedIcon = (L: any, n: number, color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const createStartIcon = (L: any, color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">P</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const buildOsrmUrl = (coords: [number, number][]) => {
  const encoded = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
  return `https://router.project-osrm.org/route/v1/driving/${encoded}?overview=full&geometries=geojson`;
};

export default function RouteMap({ start, points }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const layersRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    let mounted = true;

    import("leaflet").then((LModule) => {
      const L = (LModule as any).default ?? LModule;
      if (!mounted || !mapRef.current || mapInstance.current) return;

      const map = L.map(mapRef.current, {
        zoomControl: false,
      }).setView(start, 13);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      layersRef.current = L.layerGroup().addTo(map);
      mapInstance.current = map;
    });

    return () => {
      mounted = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      layersRef.current = null;
    };
  }, [start]);

  useEffect(() => {
    if (!mapInstance.current || !layersRef.current) return;

    const controller = new AbortController();

    import("leaflet").then(async (LModule) => {
      if (controller.signal.aborted || !mapInstance.current || !layersRef.current) return;

      const L = (LModule as any).default ?? LModule;
      const map = mapInstance.current;
      const layers = layersRef.current;

      layers.clearLayers();

      const primaryColor = getCssTokenColor("--primary", "#1e3a5f");
      const accentColor = getCssTokenColor("--accent", "#16a34a");
      const routeStops: [number, number][] = [start];

      L.marker(start, { icon: createStartIcon(L, accentColor) })
        .addTo(layers)
        .bindPopup("Ponto de Partida");

      points.forEach((point, index) => {
        const latLng: [number, number] = [point.latitude, point.longitude];
        routeStops.push(latLng);

        L.marker(latLng, {
          icon: createNumberedIcon(L, index + 1, primaryColor),
        })
          .addTo(layers)
          .bindPopup(`<strong>${index + 1}. ${point.name}</strong><br />${point.address}, ${point.bairro}`);
      });

      if (routeStops.length <= 1) {
        map.setView(start, 13);
        return;
      }

      let routePath: [number, number][] = routeStops;

      try {
        const response = await fetch(buildOsrmUrl(routeStops), {
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          const geometry = data?.routes?.[0]?.geometry?.coordinates;

          if (Array.isArray(geometry) && geometry.length > 1) {
            routePath = geometry
              .filter((coord: unknown) => Array.isArray(coord) && coord.length >= 2)
              .map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
          }
        }
      } catch {
        // fallback automático para linha simples entre os pontos
      }

      if (controller.signal.aborted || !mapInstance.current || !layersRef.current) return;

      L.polyline(routePath, {
        color: primaryColor,
        weight: 4,
        opacity: 0.9,
      }).addTo(layers);

      map.fitBounds(routePath, { padding: [30, 30], maxZoom: 15 });
    });

    return () => controller.abort();
  }, [points, start]);

  return <div ref={mapRef} className="w-full h-full" style={{ minHeight: 400 }} />;
}
