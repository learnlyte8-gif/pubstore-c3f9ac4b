import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LatLng = { lat: number; lng: number };

type Driver = {
  user_id: string;
  display_name?: string | null;
  vehicle_label?: string | null;
  vehicle_class?: string;
  rating?: number;
  lat: number;
  lng: number;
  heading?: number;
};

type RouteOption = {
  coords: [number, number][];
  color?: string;
  weight?: number;
  dash?: string;
  opacity?: number;
};

type Props = {
  me: LatLng | null;
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  drivers?: Driver[];
  driverPosition?: LatLng | null;
  routes?: RouteOption[];
  className?: string;
};

const meIcon = L.divIcon({
  className: "",
  html: `<span class="block w-4 h-4 rounded-full bg-primary ring-4 ring-primary/30 shadow-lg"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const pickupIcon = L.divIcon({
  className: "",
  html: `<span class="block w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/30 shadow-lg"></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const dropoffIcon = L.divIcon({
  className: "",
  html: `<span class="block w-5 h-5 rounded-sm rotate-45 bg-rose-500 ring-4 ring-rose-500/30 shadow-lg"></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const carIcon = (heading = 0, klass = "economy") => {
  const tone = klass === "moto" ? "#f59e0b" : klass === "xl" ? "#0f172a" : klass === "comfort" ? "#3b82f6" : "#10b981";
  return L.divIcon({
    className: "",
    html: `
      <div style="transform: rotate(${heading}deg)" class="relative">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="${tone}" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H19v1a1 1 0 0 1-2 0v-1H7v1a1 1 0 0 1-2 0v-1h-.5A1.5 1.5 0 0 1 3 15.5v-3A1.5 1.5 0 0 1 4.5 11H5zm2.1 0h9.8l-1-3H8.1l-1 3zM7 14.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
        </svg>
      </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

export default function RideMap({ me, pickup, dropoff, drivers = [], driverPosition, routes, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = me ? [me.lat, me.lng] : pickup ? [pickup.lat, pickup.lng] : [-17.8252, 31.0335];
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(center, 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 80);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds: L.LatLngExpression[] = [];

    if (me) {
      L.marker([me.lat, me.lng], { icon: meIcon }).addTo(layer);
      bounds.push([me.lat, me.lng]);
    }
    if (pickup) {
      L.marker([pickup.lat, pickup.lng], { icon: pickupIcon }).bindTooltip("Pickup", { direction: "top", offset: [0, -8] }).addTo(layer);
      bounds.push([pickup.lat, pickup.lng]);
    }
    if (dropoff) {
      L.marker([dropoff.lat, dropoff.lng], { icon: dropoffIcon }).bindTooltip("Drop-off", { direction: "top", offset: [0, -8] }).addTo(layer);
      bounds.push([dropoff.lat, dropoff.lng]);
    }
    if (routes && routes.length > 0) {
      routes.forEach((r) => {
        L.polyline(r.coords, {
          color: r.color ?? "hsl(var(--primary))",
          weight: r.weight ?? 5,
          opacity: r.opacity ?? 0.85,
          dashArray: r.dash,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layer);
        r.coords.forEach((c) => bounds.push(c as L.LatLngExpression));
      });
    } else if (pickup && dropoff) {
      L.polyline([[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]], {
        color: "hsl(var(--primary))",
        weight: 4,
        opacity: 0.7,
        dashArray: "6 8",
      }).addTo(layer);
    }

    drivers.forEach((d) => {
      L.marker([d.lat, d.lng], { icon: carIcon(d.heading ?? 0, d.vehicle_class) })
        .bindTooltip(
          `<div style="font-weight:600">${d.display_name ?? "Driver"}</div><div style="font-size:11px;opacity:.7">${d.vehicle_label ?? ""} · ★ ${(d.rating ?? 4.8).toFixed(1)}</div>`,
          { direction: "top", offset: [0, -10] },
        )
        .addTo(layer);
    });

    if (driverPosition) {
      L.marker([driverPosition.lat, driverPosition.lng], { icon: carIcon(0, "comfort") })
        .bindTooltip("Your driver", { direction: "top", offset: [0, -10], permanent: true })
        .addTo(layer);
      bounds.push([driverPosition.lat, driverPosition.lng]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0] as L.LatLngExpression, 14);
    }
  }, [me, pickup, dropoff, drivers, driverPosition]);

  return <div ref={containerRef} className={className ?? "w-full h-full"} />;
}
