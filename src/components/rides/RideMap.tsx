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

type SharedTripPin = {
  id: string;
  lat: number;
  lng: number;
  seats_available: number;
  seats_total: number;
  heading?: number;
  host_kind?: "peer" | "driver";
  dest_address?: string;
  seat_price?: number;
  onClick?: () => void;
};

type DemandPin = { id: string; lat: number; lng: number };

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
  sharedTrips?: SharedTripPin[];
  demand?: DemandPin[];
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
  iconSize: [20, 20], iconAnchor: [10, 10],
});
const dropoffIcon = L.divIcon({
  className: "",
  html: `<span class="block w-5 h-5 rounded-sm rotate-45 bg-rose-500 ring-4 ring-rose-500/30 shadow-lg"></span>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});
const demandIcon = L.divIcon({
  className: "",
  html: `<span class="block w-3 h-3 rounded-full bg-amber-500/80 ring-2 ring-amber-500/30 animate-pulse"></span>`,
  iconSize: [12, 12], iconAnchor: [6, 6],
});

const carIcon = (heading = 0, klass = "economy", seatsBadge?: string) => {
  const tone = klass === "moto" ? "#f59e0b" : klass === "xl" ? "#0f172a" : klass === "comfort" ? "#3b82f6" : "#10b981";
  return L.divIcon({
    className: "",
    html: `
      <div class="relative" style="transform: rotate(${heading}deg)">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="${tone}" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H19v1a1 1 0 0 1-2 0v-1H7v1a1 1 0 0 1-2 0v-1h-.5A1.5 1.5 0 0 1 3 15.5v-3A1.5 1.5 0 0 1 4.5 11H5zm2.1 0h9.8l-1-3H8.1l-1 3zM7 14.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
        </svg>
        ${seatsBadge ? `<span style="transform:rotate(${-heading}deg)" class="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center shadow ring-2 ring-white">${seatsBadge}</span>` : ""}
      </div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function RideMap({ me, pickup, dropoff, drivers = [], sharedTrips = [], demand = [], driverPosition, routes, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Persistent marker maps for smooth interpolation
  const driverMarkers = useRef<Map<string, { marker: L.Marker; from: LatLng; to: LatLng; t0: number; heading: number; klass: string }>>(new Map());
  const tripMarkers = useRef<Map<string, { marker: L.Marker; from: LatLng; to: LatLng; t0: number; heading: number; pin: SharedTripPin }>>(new Map());
  const rafRef = useRef<number | null>(null);

  // Init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = me ? [me.lat, me.lng] : pickup ? [pickup.lat, pickup.lng] : [-17.8252, 31.0335];
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(center, 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 80);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      driverMarkers.current.clear();
      tripMarkers.current.clear();
    };
  }, []); // eslint-disable-line

  // Static layers: me, pickup, dropoff, routes, demand, driverPosition
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
          lineCap: "round", lineJoin: "round",
        }).addTo(layer);
        r.coords.forEach((c) => bounds.push(c as L.LatLngExpression));
      });
    } else if (pickup && dropoff) {
      L.polyline([[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]], {
        color: "hsl(var(--primary))", weight: 4, opacity: 0.7, dashArray: "6 8",
      }).addTo(layer);
    }

    demand.forEach((d) => L.marker([d.lat, d.lng], { icon: demandIcon }).addTo(layer));

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
  }, [me, pickup, dropoff, demand, driverPosition, routes]);

  // Animated drivers (interpolated)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const now = performance.now();
    const seen = new Set<string>();
    drivers.forEach((d) => {
      seen.add(d.user_id);
      const target = { lat: Number(d.lat), lng: Number(d.lng) };
      const existing = driverMarkers.current.get(d.user_id);
      if (existing) {
        const current = existing.marker.getLatLng();
        existing.from = { lat: current.lat, lng: current.lng };
        existing.to = target;
        existing.t0 = now;
        existing.heading = d.heading ?? existing.heading;
        existing.klass = d.vehicle_class ?? existing.klass;
        existing.marker.setIcon(carIcon(existing.heading, existing.klass));
      } else {
        const marker = L.marker([target.lat, target.lng], { icon: carIcon(d.heading ?? 0, d.vehicle_class ?? "economy") })
          .bindTooltip(`<div style="font-weight:600">${d.display_name ?? "Driver"}</div><div style="font-size:11px;opacity:.7">${d.vehicle_label ?? ""} · ★ ${(d.rating ?? 4.8).toFixed(1)}</div>`,
            { direction: "top", offset: [0, -10] })
          .addTo(map);
        driverMarkers.current.set(d.user_id, { marker, from: target, to: target, t0: now, heading: d.heading ?? 0, klass: d.vehicle_class ?? "economy" });
      }
    });
    // Remove stale
    driverMarkers.current.forEach((v, k) => {
      if (!seen.has(k)) { map.removeLayer(v.marker); driverMarkers.current.delete(k); }
    });
  }, [drivers]);

  // Animated shared trip vehicles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const now = performance.now();
    const seen = new Set<string>();
    sharedTrips.forEach((p) => {
      seen.add(p.id);
      const target = { lat: Number(p.lat), lng: Number(p.lng) };
      const existing = tripMarkers.current.get(p.id);
      const badge = `${p.seats_available}`;
      if (existing) {
        const current = existing.marker.getLatLng();
        existing.from = { lat: current.lat, lng: current.lng };
        existing.to = target;
        existing.t0 = now;
        existing.heading = p.heading ?? existing.heading;
        existing.pin = p;
        existing.marker.setIcon(carIcon(existing.heading, "comfort", badge));
      } else {
        const m = L.marker([target.lat, target.lng], { icon: carIcon(p.heading ?? 0, "comfort", badge) })
          .bindTooltip(`<div style="font-weight:600">Pool · ${p.seats_available}/${p.seats_total} seats</div><div style="font-size:11px;opacity:.7">→ ${p.dest_address ?? ""}${p.seat_price ? ` · $${p.seat_price.toFixed(2)}/seat` : ""}</div>`,
            { direction: "top", offset: [0, -10] })
          .addTo(map);
        if (p.onClick) m.on("click", p.onClick);
        tripMarkers.current.set(p.id, { marker: m, from: target, to: target, t0: now, heading: p.heading ?? 0, pin: p });
      }
    });
    tripMarkers.current.forEach((v, k) => {
      if (!seen.has(k)) { map.removeLayer(v.marker); tripMarkers.current.delete(k); }
    });
  }, [sharedTrips]);

  // RAF interpolation loop
  useEffect(() => {
    const DURATION = 1200;
    const tick = () => {
      const now = performance.now();
      driverMarkers.current.forEach((v) => {
        const t = Math.min(1, (now - v.t0) / DURATION);
        v.marker.setLatLng([lerp(v.from.lat, v.to.lat, t), lerp(v.from.lng, v.to.lng, t)]);
      });
      tripMarkers.current.forEach((v) => {
        const t = Math.min(1, (now - v.t0) / DURATION);
        v.marker.setLatLng([lerp(v.from.lat, v.to.lat, t), lerp(v.from.lng, v.to.lng, t)]);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return <div ref={containerRef} className={className ?? "w-full h-full"} />;
}
