import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Ride = {
  id: string;
  rider_id: string;
  driver_id: string | null;
  status: "searching" | "offered" | "accepted" | "arriving" | "in_progress" | "completed" | "cancelled";
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_km: number;
  rider_offer: number;
  final_fare: number | null;
  currency: string;
  vehicle_class: "economy" | "comfort" | "xl" | "moto";
  notes: string | null;
  rider_lat: number | null;
  rider_lng: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  created_at: string;
};

export type RideOffer = {
  id: string;
  ride_id: string;
  driver_id: string;
  driver_name: string | null;
  driver_avatar: string | null;
  driver_rating: number;
  driver_trips: number;
  vehicle_label: string | null;
  vehicle_plate: string | null;
  fare: number;
  eta_minutes: number;
  driver_lat: number | null;
  driver_lng: number | null;
  status: string;
  created_at: string;
};

export type DriverLocation = {
  user_id: string;
  display_name: string | null;
  vehicle_class: string;
  vehicle_label: string | null;
  rating: number;
  online: boolean;
  lat: number;
  lng: number;
  heading: number;
  updated_at: string;
};

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function suggestFare(km: number, vehicleClass: Ride["vehicle_class"]) {
  const base = { economy: 1.5, comfort: 2.2, xl: 3.0, moto: 1.0 }[vehicleClass];
  const perKm = { economy: 0.8, comfort: 1.2, xl: 1.6, moto: 0.5 }[vehicleClass];
  return Math.max(2, Math.round((base + km * perKm) * 100) / 100);
}

export function useNearbyDrivers(center: { lat: number; lng: number } | null, radiusKm = 8) {
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.from("driver_locations").select("*").eq("online", true).limit(200);
      if (!mounted) return;
      const all = (data ?? []) as DriverLocation[];
      if (!center) { setDrivers(all); return; }
      setDrivers(all.filter((d) => haversineKm(center.lat, center.lng, Number(d.lat), Number(d.lng)) <= radiusKm));
    };
    load();
    const ch = supabase
      .channel("rides:drivers")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [center?.lat, center?.lng, radiusKm]);

  return drivers;
}

export function useRideOffers(rideId: string | null) {
  const [offers, setOffers] = useState<RideOffer[]>([]);

  useEffect(() => {
    if (!rideId) { setOffers([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from("ride_offers").select("*").eq("ride_id", rideId).order("fare", { ascending: true });
      setOffers((data ?? []) as RideOffer[]);
    };
    load();
    const ch = supabase
      .channel(`ride-offers:${rideId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_offers", filter: `ride_id=eq.${rideId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rideId]);

  return offers;
}

export function useActiveRide(rideId: string | null) {
  const [ride, setRide] = useState<Ride | null>(null);

  useEffect(() => {
    if (!rideId) { setRide(null); return; }
    const load = async () => {
      const { data } = await supabase.from("rides").select("*").eq("id", rideId).maybeSingle();
      setRide((data as Ride | null) ?? null);
    };
    load();
    const ch = supabase
      .channel(`ride:${rideId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rideId]);

  return ride;
}
