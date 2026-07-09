import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

export interface BnbMapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  title: string;
  image?: string;
  href?: string;
}

declare global {
  interface Window {
    google?: any;
    __bnbMapInit?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.google?.maps) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const tracking = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID ?? "";
  if (!key) return Promise.reject(new Error("no-key"));

  scriptPromise = new Promise<void>((resolve, reject) => {
    window.__bnbMapInit = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__bnbMapInit${tracking ? `&channel=${tracking}` : ""}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("script-failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default function BnbMapView({ pins }: { pins: BnbMapPin[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(
      () => {
        if (cancelled || !ref.current || !window.google?.maps) return;
        const valid = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        const center = valid[0] ? { lat: valid[0].lat, lng: valid[0].lng } : { lat: 0, lng: 20 };
        const map = new window.google.maps.Map(ref.current, {
          center,
          zoom: valid.length > 1 ? 4 : 10,
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        const bounds = new window.google.maps.LatLngBounds();
        valid.forEach((p) => {
          const marker = new window.google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            label: { text: p.label, color: "white", fontSize: "12px", fontWeight: "700" },
            title: p.title,
          });
          if (p.href) marker.addListener("click", () => (window.location.href = p.href!));
          bounds.extend(marker.getPosition()!);
        });
        if (valid.length > 1) map.fitBounds(bounds, 60);
        setStatus("ready");
      },
      () => !cancelled && setStatus("error"),
    );
    return () => {
      cancelled = true;
    };
  }, [pins]);

  const valid = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (status === "error" || (status === "ready" && valid.length === 0)) {
    return (
      <div className="flex-1 grid place-items-center bg-muted/40 rounded-2xl m-4 min-h-[60vh]">
        <div className="text-center px-8">
          <MapPin className="w-8 h-8 mx-auto text-[hsl(var(--bnb-foggy))]" />
          <p className="mt-2 text-sm font-semibold">Map unavailable</p>
          <p className="text-xs text-[hsl(var(--bnb-foggy))]">Showing list results instead.</p>
        </div>
      </div>
    );
  }

  return <div ref={ref} className="w-full h-[calc(100vh-180px)] rounded-2xl overflow-hidden" />;
}
