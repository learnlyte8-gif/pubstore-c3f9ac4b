import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation } from "lucide-react";

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
  lat: number;
  lng: number;
  address?: string | null;
  name: string;
};

export default function SupplierLocationMap({ lat, lng, address, name }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: false, scrollWheelZoom: false }).setView([lat, lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    L.marker([lat, lng], { icon }).addTo(map).bindPopup(name);
    setTimeout(() => map.invalidateSize(), 100);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, name]);

  // Use platform-specific map URLs so iOS opens Apple Maps & Android opens Google Maps natively.
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const directionsUrl = isIOS
    ? `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold">Visit this supplier</h3>
      </div>
      {address && <p className="px-4 pb-3 text-xs text-muted-foreground">{address}</p>}
      <div ref={ref} className="w-full h-56 z-0" />
      <div className="p-3">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-pop"
        >
          <Navigation className="w-4 h-4" /> Get directions
        </a>
      </div>
    </div>
  );
}
