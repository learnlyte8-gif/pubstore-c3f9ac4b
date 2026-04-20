import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Loader2, Crosshair } from "lucide-react";

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

export default function LocationPicker({ lat, lng, address, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [busy, setBusy] = useState(false);

  const initial = useMemo<[number, number]>(
    () => (lat != null && lng != null ? [lat, lng] : [20, 0]),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const initialZoom = lat != null && lng != null ? 13 : 2;

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(initial, initialZoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    if (lat != null && lng != null) {
      markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", async (e) => {
        const p = (e.target as L.Marker).getLatLng();
        setBusy(true);
        const addr = await reverseGeocode(p.lat, p.lng);
        setBusy(false);
        onChange({ lat: p.lat, lng: p.lng, address: addr });
      });
    }
    map.on("click", async (e) => {
      const { lat: la, lng: ln } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([la, ln]);
      } else {
        markerRef.current = L.marker([la, ln], { icon, draggable: true }).addTo(map);
        markerRef.current.on("dragend", async (ev) => {
          const p = (ev.target as L.Marker).getLatLng();
          setBusy(true);
          const addr = await reverseGeocode(p.lat, p.lng);
          setBusy(false);
          onChange({ lat: p.lat, lng: p.lng, address: addr });
        });
      }
      setBusy(true);
      const addr = await reverseGeocode(la, ln);
      setBusy(false);
      onChange({ lat: la, lng: ln, address: addr });
    });
    // Resize hack — Leaflet needs invalidate after layout settles
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker when external lat/lng change (e.g. after geolocate)
  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(mapRef.current);
    }
    mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 13));
  }, [lat, lng]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const addr = await reverseGeocode(latitude, longitude);
        setBusy(false);
        onChange({ lat: latitude, lng: longitude, address: addr });
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-card">
        <div ref={containerRef} className="w-full h-64 z-0" />
        <button
          type="button"
          onClick={useMyLocation}
          className="absolute top-2 right-2 z-[400] h-9 px-3 rounded-full bg-background/95 backdrop-blur shadow-card text-xs font-bold flex items-center gap-1.5 border border-border"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
          Use my location
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
            "Tap on the map to drop a pin where buyers can find your store."
          )}
        </p>
      </div>
    </div>
  );
}
