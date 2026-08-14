import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Crosshair, Search } from "lucide-react";

// Fix default marker icons (bundlers strip the relative paths leaflet expects)
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Props = {
  lat: number | null;
  lng: number | null;
  address?: string | null;
  onChange: (next: { lat: number; lng: number; address: string }) => void;
};

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=0`,
      { headers: { Accept: "application/json" } },
    );
    const j = await r.json();
    return j?.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

async function forwardGeocode(q: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } },
    );
    const j = await r.json();
    const hit = Array.isArray(j) ? j[0] : null;
    if (!hit) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon), address: hit.display_name ?? q };
  } catch {
    return null;
  }
}

export default function LocationPicker({ lat, lng, address, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [latText, setLatText] = useState(lat != null ? String(lat) : "");
  const [lngText, setLngText] = useState(lng != null ? String(lng) : "");

  // Keep the latest onChange so map handlers (bound once) never call a stale closure.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const commit = useCallback(async (la: number, ln: number, addr?: string) => {
    setBusy(true);
    const resolved = addr ?? (await reverseGeocode(la, ln));
    setBusy(false);
    onChangeRef.current({ lat: la, lng: ln, address: resolved });
  }, []);

  const initial = useMemo<[number, number]>(
    () => (lat != null && lng != null ? [lat, lng] : [20, 0]),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const initialZoom = lat != null && lng != null ? 13 : 2;

  const ensureMarker = useCallback(
    (map: L.Map, la: number, ln: number) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([la, ln]);
        return markerRef.current;
      }
      const m = L.marker([la, ln], { icon, draggable: true }).addTo(map);
      m.on("dragend", (e) => {
        const p = (e.target as L.Marker).getLatLng();
        void commit(p.lat, p.lng);
      });
      markerRef.current = m;
      return m;
    },
    [commit],
  );

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(initial, initialZoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    if (lat != null && lng != null) ensureMarker(map, lat, lng);

    map.on("click", (e) => {
      const { lat: la, lng: ln } = e.latlng;
      ensureMarker(map, la, ln);
      void commit(la, ln);
    });
    // Resize hack — Leaflet needs invalidate after layout settles
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker + inputs when external lat/lng change (e.g. after geolocate / search)
  useEffect(() => {
    if (lat != null) setLatText(String(lat));
    if (lng != null) setLngText(String(lng));
    if (!mapRef.current || lat == null || lng == null) return;
    ensureMarker(mapRef.current, lat, lng);
    mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 13));
  }, [lat, lng, ensureMarker]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setBusy(false);
        await commit(latitude, longitude);
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const searchPlace = async () => {
    if (!query.trim()) return;
    setBusy(true);
    const hit = await forwardGeocode(query.trim());
    setBusy(false);
    if (hit) await commit(hit.lat, hit.lng, hit.address);
  };

  const applyManualCoords = () => {
    const la = Number(latText);
    const ln = Number(lngText);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return;
    void commit(la, ln);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void searchPlace();
              }
            }}
            placeholder="Search an address or place"
            className="w-full h-11 rounded-xl border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void searchPlace()}
          className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-pop"
        >
          Find
        </button>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-border shadow-card">
        <div ref={containerRef} className="w-full h-64 z-0" />
        <button
          type="button"
          onClick={useMyLocation}
          className="absolute top-2 right-2 z-[400] h-9 px-3 rounded-full bg-background/95 backdrop-blur shadow-card text-xs font-bold flex items-center gap-1.5 border border-border"
        >
          {busy ? <CircleSpinner size={14} /> : <Crosshair className="w-3.5 h-3.5" />}
          Use my location
        </button>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <input
          value={latText}
          onChange={(e) => setLatText(e.target.value)}
          onBlur={applyManualCoords}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyManualCoords())}
          inputMode="decimal"
          placeholder="Latitude"
          className="h-11 rounded-xl border bg-background px-3 text-sm"
        />
        <input
          value={lngText}
          onChange={(e) => setLngText(e.target.value)}
          onBlur={applyManualCoords}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyManualCoords())}
          inputMode="decimal"
          placeholder="Longitude"
          className="h-11 rounded-xl border bg-background px-3 text-sm"
        />
        <button
          type="button"
          onClick={applyManualCoords}
          className="h-11 px-4 rounded-xl border bg-card text-sm font-bold"
        >
          Apply
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs">
        <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
        <p className="text-muted-foreground">
          {lat != null && lng != null ? (
            <>
              <span className="font-semibold text-foreground">Pinned:</span>{" "}
              {address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
            </>
          ) : (
            "Tap the map, search an address, or type coordinates to set your store location."
          )}
        </p>
      </div>
    </div>
  );
}
