import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { Map as MapIcon, Loader2, MapPin, Star, ShieldCheck, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const meIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:hsl(var(--primary));border:3px solid white;box-shadow:0 0 0 3px hsl(var(--primary)/0.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

type NearbySupplier = {
  id: string;
  name: string;
  country: string | null;
  rating: number;
  verified: boolean;
  gold: boolean;
  logo: string | null;
  latitude: number;
  longitude: number;
  location_address: string | null;
  distance_km: number;
};

const RADII = [10, 25, 50, 100, 250] as const;
type Radius = (typeof RADII)[number];

// Haversine distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function SuppliersNearMe() {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [denied, setDenied] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [radius, setRadius] = useState<Radius>(250);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState<NearbySupplier[] | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const meMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const supplierLayerRef = useRef<L.LayerGroup | null>(null);

  // Auto-request geolocation on mount
  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDenied(false);
        setLoadingLoc(false);
      },
      () => {
        setDenied(true);
        setLoadingLoc(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  };

  // Fetch suppliers with coords once
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id,name,country,rating,verified,gold,logo,latitude,longitude,location_address")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (!alive) return;
      const list = (data ?? []).map((s: any) => ({
        ...s,
        rating: Number(s.rating ?? 0),
        verified: !!s.verified,
        gold: !!s.gold,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        distance_km: 0,
      })) as NearbySupplier[];
      setAllSuppliers(list);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Compute filtered + sorted nearby
  const nearby = useMemo<NearbySupplier[]>(() => {
    if (!me || !allSuppliers) return [];
    return allSuppliers
      .filter((s) => (verifiedOnly ? s.verified : true))
      .map((s) => ({ ...s, distance_km: haversine(me.lat, me.lng, s.latitude, s.longitude) }))
      .filter((s) => s.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km);
  }, [me, allSuppliers, radius, verifiedOnly]);

  // Init map once we have a location
  useEffect(() => {
    if (!me || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false }).setView(
      [me.lat, me.lng],
      11,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    meMarkerRef.current = L.marker([me.lat, me.lng], { icon: meIcon }).addTo(map);
    supplierLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      meMarkerRef.current = null;
      radiusCircleRef.current = null;
      supplierLayerRef.current = null;
    };
  }, [me]);

  // Update radius circle + markers whenever filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;

    if (radiusCircleRef.current) radiusCircleRef.current.remove();
    radiusCircleRef.current = L.circle([me.lat, me.lng], {
      radius: radius * 1000,
      color: "hsl(var(--primary))",
      weight: 1.5,
      fillColor: "hsl(var(--primary))",
      fillOpacity: 0.08,
    }).addTo(map);

    const layer = supplierLayerRef.current;
    if (layer) {
      layer.clearLayers();
      nearby.forEach((s) => {
        const m = L.marker([s.latitude, s.longitude], { icon }).bindPopup(
          `<div style="font-family:inherit;min-width:160px">
            <strong>${escapeHtml(s.name)}</strong><br/>
            <span style="font-size:11px;color:#666">${escapeHtml(s.country ?? "")} · ${s.distance_km.toFixed(1)} km</span><br/>
            <a href="/supplier/${s.id}" style="color:hsl(var(--primary));font-weight:600;font-size:12px">View store →</a>
          </div>`,
        );
        layer.addLayer(m);
      });
    }

    // Fit bounds nicely
    if (nearby.length > 0) {
      const bounds = L.latLngBounds([[me.lat, me.lng], ...nearby.map((s) => [s.latitude, s.longitude] as [number, number])]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    } else {
      map.setView([me.lat, me.lng], Math.min(map.getZoom(), 11));
    }
  }, [nearby, me, radius]);

  // Empty state — not yet asked for location
  if (!me) {
    return (
      <section className="px-4 mt-6">
        <div className="rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-card border border-border shadow-card overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-pop">
                <MapIcon className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-bold leading-tight">Suppliers near me</h2>
                <p className="text-xs text-muted-foreground">Find verified stores you can visit in person.</p>
              </div>
            </div>
            <button
              onClick={requestLocation}
              disabled={loadingLoc}
              className="mt-4 w-full h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-pop disabled:opacity-60"
            >
              {loadingLoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {loadingLoc ? "Locating…" : denied ? "Try again" : "Find suppliers near me"}
            </button>
            {denied && (
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Location permission was blocked. Enable it in your browser settings to use this feature.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 mt-6">
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-start gap-2">
          <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center mt-0.5 shadow-soft">
            <MapIcon className="w-4 h-4 text-foreground" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-base font-bold leading-tight">Suppliers near me</h2>
            <p className="text-xs text-muted-foreground">{nearby.length} within {radius} km</p>
          </div>
        </div>
        <button onClick={requestLocation} className="text-[11px] font-semibold text-primary inline-flex items-center gap-1">
          <Navigation className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {RADII.map((r) => (
          <button
            key={r}
            onClick={() => setRadius(r)}
            className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold transition ${
              radius === r ? "bg-foreground text-background shadow-card" : "bg-muted text-muted-foreground"
            }`}
          >
            {r} km
          </button>
        ))}
        <button
          onClick={() => setVerifiedOnly((v) => !v)}
          className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold transition inline-flex items-center gap-1 ${
            verifiedOnly ? "bg-primary text-primary-foreground shadow-card" : "bg-muted text-muted-foreground"
          }`}
        >
          <ShieldCheck className="w-3 h-3" /> Verified only
        </button>
      </div>

      {/* Map */}
      <div className="mt-3 rounded-2xl overflow-hidden border border-border shadow-card">
        <div ref={containerRef} className="w-full h-72 z-0" />
      </div>

      {nearby.length === 0 && (
        <div className="mt-3 p-5 rounded-2xl bg-muted/40 border border-border text-center">
          <p className="text-sm font-semibold">No suppliers within {radius} km</p>
          <p className="text-xs text-muted-foreground mt-1">Try widening the radius or turning off the verified filter.</p>
        </div>
      )}
    </section>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
