import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type SharedTrip = {
  id: string;
  host_id: string;
  host_kind: "peer" | "driver";
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  dest_address: string;
  dest_lat: number;
  dest_lng: number;
  departure_at: string;
  seats_total: number;
  seats_available: number;
  seat_price: number;
  currency: string;
  vehicle_label: string | null;
  vehicle_class: string;
  notes: string | null;
  current_lat: number | null;
  current_lng: number | null;
  heading: number | null;
  status: "open" | "full" | "in_progress" | "completed" | "cancelled";
  created_at: string;
};

export type SharedTripJoin = {
  id: string;
  trip_id: string;
  rider_id: string;
  seats: number;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  paid: boolean;
  amount_due: number | null;
  created_at: string;
};

/** Open + in_progress shared trips near a point (client-side filter; realtime). */
export function useNearbySharedTrips(center: { lat: number; lng: number } | null, radiusKm = 25) {
  const [trips, setTrips] = useState<SharedTrip[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await sb
        .from("shared_trips")
        .select("*")
        .in("status", ["open", "in_progress"])
        .gte("departure_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order("departure_at", { ascending: true })
        .limit(100);
      if (!alive) return;
      const all = (data ?? []) as SharedTrip[];
      if (!center) { setTrips(all); return; }
      const within = (t: SharedTrip) => {
        const dLat = ((t.origin_lat - center.lat) * Math.PI) / 180;
        const dLng = ((t.origin_lng - center.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos((center.lat * Math.PI) / 180) * Math.cos((t.origin_lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
        return 2 * 6371 * Math.asin(Math.sqrt(a)) <= radiusKm;
      };
      setTrips(all.filter(within));
    };
    load();
    const ch = supabase
      .channel("shared-trips-near")
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_trips" }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [center?.lat, center?.lng, radiusKm]);

  return trips;
}

/** Auto-matched trips for a rider's specific pickup → dropoff. */
export function useMatchedTrips(
  pickup: { lat: number; lng: number } | null,
  dropoff: { lat: number; lng: number } | null,
  radiusKm = 4,
) {
  const [matches, setMatches] = useState<SharedTrip[]>([]);
  useEffect(() => {
    if (!pickup || !dropoff) { setMatches([]); return; }
    let alive = true;
    const load = async () => {
      const { data } = await sb.rpc("match_shared_trips", {
        _pickup_lat: pickup.lat, _pickup_lng: pickup.lng,
        _dropoff_lat: dropoff.lat, _dropoff_lng: dropoff.lng,
        _radius_km: radiusKm,
      });
      if (alive) setMatches((data ?? []) as SharedTrip[]);
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, radiusKm]);
  return matches;
}

/** Joins on a specific trip (host view) or rider's own joins. */
export function useTripJoins(tripId: string | null) {
  const [joins, setJoins] = useState<SharedTripJoin[]>([]);
  useEffect(() => {
    if (!tripId) { setJoins([]); return; }
    const load = async () => {
      const { data } = await sb.from("shared_trip_joins")
        .select("*").eq("trip_id", tripId).order("created_at", { ascending: true });
      setJoins((data ?? []) as SharedTripJoin[]);
    };
    load();
    const ch = supabase
      .channel(`trip-joins:${tripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_trip_joins", filter: `trip_id=eq.${tripId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);
  return joins;
}

/** All joins belonging to the current user (across trips). */
export function useMyJoins(userId: string | null) {
  const [joins, setJoins] = useState<SharedTripJoin[]>([]);
  useEffect(() => {
    if (!userId) { setJoins([]); return; }
    const load = async () => {
      const { data } = await sb.from("shared_trip_joins")
        .select("*").eq("rider_id", userId).order("created_at", { ascending: false });
      setJoins((data ?? []) as SharedTripJoin[]);
    };
    load();
    const ch = supabase
      .channel(`my-joins:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_trip_joins", filter: `rider_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);
  return joins;
}
