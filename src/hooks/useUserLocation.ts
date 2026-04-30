import { useEffect, useState } from "react";

export type UserLocation = { lat: number; lng: number } | null;

const STORAGE_KEY = "user_geo_location_v1";

/**
 * Lightweight, app-wide user geolocation hook.
 * - Reads cached coords from localStorage so cards can render distances on first paint.
 * - Asks the browser for a fresh fix in the background (silently — no prompt spam if denied).
 */
export function useUserLocation(): UserLocation {
  const [loc, setLoc] = useState<UserLocation>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (typeof v?.lat === "number" && typeof v?.lng === "number") return v;
    } catch {
      /* ignore */
    }
    return null;
  });

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLoc(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      },
      () => {
        /* denied or error — silently keep cached value (or null) */
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return loc;
}

/** Haversine distance in km. */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
