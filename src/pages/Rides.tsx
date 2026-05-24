import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Car, Bike, Users, MapPin, Navigation, Crosshair, Plus, Minus, Star, Clock, Zap, Shield, Phone, X, ArrowRight,
  Sparkles, Wallet, TrendingUp, AlertTriangle, Route as RouteIcon, Gauge, Fuel, Leaf, Activity, Radio, Timer,
  CloudRain, Sun, ChevronRight, Flame, PlayCircle, CheckCircle2, Share2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useNearbyDrivers, useRideOffers, useActiveRide, suggestFare, haversineKm, type Ride, type RideOffer } from "@/hooks/useRides";
import RideMap from "@/components/rides/RideMap";
import RideChat from "@/components/rides/RideChat";
import RideRating from "@/components/rides/RideRating";
import CircleSpinner from "@/components/CircleSpinner";

type LatLng = { lat: number; lng: number };
type VClass = Ride["vehicle_class"];

const CLASSES: { id: VClass; label: string; icon: typeof Car; eta: string; seats: string; tone: string; mult: number }[] = [
  { id: "moto",    label: "Moto",    icon: Bike,  eta: "2 min", seats: "1 seat",  tone: "from-amber-500 to-orange-400", mult: 0.55 },
  { id: "economy", label: "Economy", icon: Car,   eta: "4 min", seats: "4 seats", tone: "from-emerald-500 to-teal-400", mult: 1.0 },
  { id: "comfort", label: "Comfort", icon: Car,   eta: "5 min", seats: "4 seats", tone: "from-sky-500 to-blue-400", mult: 1.35 },
  { id: "xl",      label: "XL",      icon: Users, eta: "6 min", seats: "6 seats", tone: "from-zinc-900 to-zinc-600", mult: 1.7 },
];

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16`);
    const j = await r.json();
    return j?.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
}

async function searchPlace(q: string): Promise<{ lat: number; lng: number; label: string }[]> {
  if (!q.trim()) return [];
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=6`);
    const j = await r.json();
    return (j ?? []).map((it: any) => ({ lat: Number(it.lat), lng: Number(it.lon), label: it.display_name }));
  } catch { return []; }
}

/** Build 3 alternative curved polyline routes between pickup → dropoff. */
function buildRoutes(p: LatLng, d: LatLng) {
  const make = (curve: number, segs = 24): [number, number][] => {
    const dx = d.lng - p.lng;
    const dy = d.lat - p.lat;
    // perpendicular offset
    const nx = -dy;
    const ny = dx;
    const norm = Math.sqrt(nx * nx + ny * ny) || 1;
    const ox = (nx / norm) * curve;
    const oy = (ny / norm) * curve;
    const cx = (p.lng + d.lng) / 2 + ox;
    const cy = (p.lat + d.lat) / 2 + oy;
    const out: [number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = (1 - t) * (1 - t) * p.lng + 2 * (1 - t) * t * cx + t * t * d.lng;
      const y = (1 - t) * (1 - t) * p.lat + 2 * (1 - t) * t * cy + t * t * d.lat;
      out.push([y, x]);
    }
    return out;
  };
  const base = haversineKm(p.lat, p.lng, d.lat, d.lng);
  const fastest = make(base * 0.003);
  const balanced = make(-base * 0.006);
  const scenic = make(base * 0.012);
  return [
    { id: "fastest",  label: "Fastest",  km: base * 1.05, mins: Math.max(4, Math.round(base * 2.4)),  traffic: "moderate" as const, coords: fastest,  color: "hsl(var(--primary))",         dash: undefined,  weight: 6, opacity: 0.95 },
    { id: "balanced", label: "Balanced", km: base * 1.18, mins: Math.max(5, Math.round(base * 2.8)),  traffic: "light" as const,    coords: balanced, color: "hsl(142 71% 45%)",            dash: "8 6",      weight: 4, opacity: 0.7 },
    { id: "scenic",   label: "Scenic",   km: base * 1.42, mins: Math.max(7, Math.round(base * 3.6)),  traffic: "free" as const,     coords: scenic,   color: "hsl(38 95% 55%)",             dash: "2 6",      weight: 4, opacity: 0.7 },
  ];
}

export default function Rides() {
  const { userId, requireAuth } = useRequireAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<LatLng | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [pickup, setPickup] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [vClass, setVClass] = useState<VClass>("economy");
  const [fare, setFare] = useState<number>(5);
  const [notes, setNotes] = useState("");
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [routeChoice, setRouteChoice] = useState<"fastest" | "balanced" | "scenic">("fastest");
  const [tab, setTab] = useState<"now" | "schedule" | "share">("now");
  const [showRating, setShowRating] = useState(false);
  const [completedRide, setCompletedRide] = useState<Ride | null>(null);

  const ride = useActiveRide(activeRideId);
  const offers = useRideOffers(activeRideId);
  const drivers = useNearbyDrivers(me, 10);

  const distance = useMemo(() => (pickup && dropoff ? haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng) : 0), [pickup, dropoff]);
  const suggested = useMemo(() => (distance > 0 ? suggestFare(distance, vClass) : 0), [distance, vClass]);
  const routes = useMemo(() => (pickup && dropoff ? buildRoutes(pickup, dropoff) : []), [pickup, dropoff]);
  const activeRoute = routes.find((r) => r.id === routeChoice) ?? routes[0];

  // Surge index — simulated based on driver supply / demand
  const surge = useMemo(() => {
    if (drivers.length === 0) return 1.6;
    if (drivers.length < 3) return 1.35;
    if (drivers.length < 6) return 1.1;
    return 1.0;
  }, [drivers.length]);

  // Get my location once on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const { latitude, longitude } = p.coords;
        setMe({ lat: latitude, lng: longitude });
        if (!pickup) {
          const addr = await reverseGeocode(latitude, longitude);
          setPickup({ lat: latitude, lng: longitude, address: addr });
        }
        setLocBusy(false);
      },
      () => setLocBusy(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []); // eslint-disable-line

  // Live update rider position
  useEffect(() => {
    if (!activeRideId || !navigator.geolocation) return;
    const w = navigator.geolocation.watchPosition(async (p) => {
      const { latitude, longitude } = p.coords;
      setMe({ lat: latitude, lng: longitude });
      await supabase.from("rides").update({ rider_lat: latitude, rider_lng: longitude }).eq("id", activeRideId);
    }, undefined, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(w);
  }, [activeRideId]);

  useEffect(() => { if (suggested > 0) setFare(+(suggested * surge).toFixed(2)); }, [suggested, surge]);

  const requestRide = async () => {
    const uid = requireAuth({ message: "Sign in to request a ride" });
    if (!uid) return;
    if (!pickup || !dropoff) { toast.error("Set pickup and drop-off"); return; }
    setCreating(true);
    const { data, error } = await supabase.from("rides").insert({
      rider_id: uid,
      status: "searching",
      pickup_address: pickup.address,
      pickup_lat: pickup.lat, pickup_lng: pickup.lng,
      dropoff_address: dropoff.address,
      dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      distance_km: Number((activeRoute?.km ?? distance).toFixed(2)),
      rider_offer: fare,
      vehicle_class: vClass,
      notes: notes || null,
      rider_lat: me?.lat ?? pickup.lat,
      rider_lng: me?.lng ?? pickup.lng,
    }).select().single();
    setCreating(false);
    if (error || !data) { toast.error(error?.message ?? "Could not create ride"); return; }
    setActiveRideId(data.id);
    seedSimulatedOffers(data.id, drivers, fare, vClass);
    toast.success("Looking for nearby drivers…");
  };

  const acceptOffer = async (offerId: string, driverId: string, finalFare: number) => {
    if (!activeRideId) return;
    await supabase.from("ride_offers").update({ status: "rejected" }).eq("ride_id", activeRideId).neq("id", offerId);
    await supabase.from("ride_offers").update({ status: "accepted" }).eq("id", offerId);
    await supabase.from("rides").update({
      driver_id: driverId,
      status: "accepted",
      final_fare: finalFare,
      accepted_at: new Date().toISOString(),
    }).eq("id", activeRideId);
    toast.success("Driver accepted! Heading your way.");
    simulateDriverApproach(activeRideId);
  };

  const cancelRide = async () => {
    if (!activeRideId) return;
    await supabase.from("rides").update({ status: "cancelled" }).eq("id", activeRideId);
    setActiveRideId(null);
    toast.message("Ride cancelled");
  };

  const startTrip = async () => {
    if (!activeRideId) return;
    await supabase.from("rides").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", activeRideId);
    toast.success("Trip started");
  };

  const completeTrip = async () => {
    if (!activeRideId || !ride) return;
    await supabase.from("rides").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", activeRideId);
    setCompletedRide(ride);
    setShowRating(true);
    toast.success("Trip completed");
  };

  const shareTrip = async () => {
    if (!ride) return;
    const url = `${window.location.origin}/rides?share=${ride.id}`;
    const text = `I'm on a ${ride.vehicle_class} ride to ${ride.dropoff_address}. Track me: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: "My PUBSTORE ride", text, url }); return; } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(text); toast.success("Trip link copied"); }
    catch { toast.error("Could not share"); }
  };

  const swapPickupDrop = () => {
    if (!pickup || !dropoff) return;
    setPickup(dropoff); setDropoff(pickup);
  };

  const useMyLocationFor = async (which: "pickup" | "dropoff") => {
    if (!navigator.geolocation) return;
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(async (p) => {
      const addr = await reverseGeocode(p.coords.latitude, p.coords.longitude);
      const v = { lat: p.coords.latitude, lng: p.coords.longitude, address: addr };
      if (which === "pickup") setPickup(v); else setDropoff(v);
      setMe({ lat: v.lat, lng: v.lng });
      setLocBusy(false);
    }, () => setLocBusy(false), { enableHighAccuracy: true, timeout: 8000 });
  };

  const quickDestination = async (label: string) => {
    if (label === "Home" || label === "Work") {
      try {
        const saved = JSON.parse(localStorage.getItem(`ride_saved_${label.toLowerCase()}`) ?? "null");
        if (saved?.lat && saved?.lng) {
          setDropoff(saved);
          toast.success(`Drop-off set to ${label}`);
          return;
        }
      } catch { /* ignore */ }
      toast.message(`${label} not saved yet`, { action: { label: "Set", onClick: () => navigate("/addresses") } });
      return;
    }
    const center = pickup ?? me;
    const q = center ? `${label} near ${center.lat.toFixed(3)},${center.lng.toFixed(3)}` : label;
    const res = await searchPlace(q);
    if (res[0]) {
      setDropoff({ lat: res[0].lat, lng: res[0].lng, address: res[0].label });
      toast.success(`Drop-off set to ${label}`);
    } else {
      toast.error(`No ${label} found nearby`);
    }
  };

  // Auto-handle terminal ride states
  useEffect(() => {
    if (!ride) return;
    if (ride.status === "cancelled") {
      setActiveRideId(null);
    } else if (ride.status === "completed" && !showRating) {
      setCompletedRide(ride);
      setShowRating(true);
    }
  }, [ride?.status]); // eslint-disable-line

  const inActiveFlow = ride && ["searching", "offered", "accepted", "arriving", "in_progress"].includes(ride.status);

  const mapRoutes = activeRoute
    ? routes.map((r) => ({
        coords: r.coords,
        color: r.color,
        weight: r.id === routeChoice ? 6 : 3,
        opacity: r.id === routeChoice ? 0.95 : 0.45,
        dash: r.id === routeChoice ? undefined : "4 6",
      }))
    : undefined;

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] bg-gradient-to-b from-background via-background to-muted/30">
      {/* Hero map with overlays */}
      <div className="relative">
        <div className="h-[46vh] min-h-[320px] w-full">
          <RideMap
            me={me}
            pickup={pickup ? { lat: pickup.lat, lng: pickup.lng } : null}
            dropoff={dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : null}
            drivers={inActiveFlow ? [] : drivers.map((d) => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) }))}
            driverPosition={ride?.driver_lat && ride?.driver_lng ? { lat: Number(ride.driver_lat), lng: Number(ride.driver_lng) } : null}
            routes={mapRoutes as any}
            className="w-full h-full"
          />
        </div>

        {/* Top status strip */}
        <div className="absolute top-3 left-3 right-3 flex items-center gap-2 pointer-events-none">
          <div className="px-2.5 h-8 rounded-full bg-background/95 backdrop-blur border border-border shadow-card flex items-center gap-1.5 pointer-events-auto">
            <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500">
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
            </span>
            <span className="text-[10px] font-bold">{drivers.length} live</span>
          </div>
          <div className="px-2.5 h-8 rounded-full bg-background/95 backdrop-blur border border-border shadow-card flex items-center gap-1.5 pointer-events-auto">
            <Flame className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-bold">{surge.toFixed(2)}× surge</span>
          </div>
          <div className="px-2.5 h-8 rounded-full bg-background/95 backdrop-blur border border-border shadow-card flex items-center gap-1.5 pointer-events-auto">
            <Sun className="w-3 h-3 text-sky-500" />
            <span className="text-[10px] font-bold">24°</span>
          </div>
          <div className="ml-auto pointer-events-auto">
            <button
              onClick={() => useMyLocationFor("pickup")}
              className="h-8 w-8 rounded-full bg-background/95 backdrop-blur border border-border shadow-card flex items-center justify-center"
            >
              {locBusy ? <CircleSpinner size={12} /> : <Crosshair className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Bottom map overlay: route alternatives */}
        {!inActiveFlow && routes.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 pointer-events-auto">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {routes.map((r) => {
                const active = r.id === routeChoice;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRouteChoice(r.id as any)}
                    className={`shrink-0 px-3 h-9 rounded-full backdrop-blur border flex items-center gap-2 transition-all ${
                      active
                        ? "bg-foreground text-background border-foreground shadow-elevated scale-105"
                        : "bg-background/90 border-border"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
                    <span className="text-[10px] font-black tracking-wide uppercase">{r.label}</span>
                    <span className="text-[10px] font-bold opacity-80">{r.mins}m · {r.km.toFixed(1)}km</span>
                    <span className={`text-[9px] font-bold px-1.5 rounded-full ${
                      r.traffic === "free"     ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                      r.traffic === "light"    ? "bg-sky-500/20 text-sky-700 dark:text-sky-300" :
                                                  "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    }`}>{r.traffic}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mode tabs */}
      {!inActiveFlow && (
        <div className="px-3 mt-3">
          <div className="flex gap-1 p-1 rounded-2xl bg-muted/60 border border-border">
            {[
              { id: "now",      label: "Ride now",  icon: Zap },
              { id: "schedule", label: "Schedule",  icon: Timer },
              { id: "share",    label: "Pool",      icon: Users },
            ].map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`flex-1 h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                    active ? "bg-background shadow-card text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main panel */}
      <div className="relative mt-3 z-10">
        <div className="mx-3 rounded-3xl bg-card border border-border shadow-elevated overflow-hidden">
          {!inActiveFlow ? (
            <RequestPanel
              pickup={pickup} setPickup={setPickup}
              dropoff={dropoff} setDropoff={setDropoff}
              vClass={vClass} setVClass={setVClass}
              fare={fare} setFare={setFare}
              suggested={suggested} distance={activeRoute?.km ?? distance}
              etaMins={activeRoute?.mins ?? 0}
              surge={surge}
              notes={notes} setNotes={setNotes}
              onSwap={swapPickupDrop}
              onUseMy={useMyLocationFor}
              onSubmit={requestRide}
              busy={creating}
              driversCount={drivers.length}
              tab={tab}
            />
          ) : (
            <ActiveRidePanel
              ride={ride!}
              offers={offers}
              myUserId={userId ?? ""}
              onAccept={acceptOffer}
              onCancel={cancelRide}
              onStart={startTrip}
              onComplete={completeTrip}
              onShare={shareTrip}
            />
          )}
        </div>

        {/* Trip insight strip */}
        {!inActiveFlow && pickup && dropoff && (
          <div className="px-3 mt-3 grid grid-cols-4 gap-2">
            <Insight icon={RouteIcon} label="Route" value={`${(activeRoute?.km ?? distance).toFixed(1)}km`} tone="text-primary" />
            <Insight icon={Timer} label="ETA" value={`${activeRoute?.mins ?? 0}m`} tone="text-emerald-500" />
            <Insight icon={Fuel} label="CO₂" value={`${(((activeRoute?.km ?? distance) * 0.19)).toFixed(1)}kg`} tone="text-amber-500" />
            <Insight icon={Leaf} label="Saved" value={`$${(((activeRoute?.km ?? distance) * 0.35)).toFixed(1)}`} tone="text-rose-500" />
          </div>
        )}

        {/* Trust + perks */}
        <div className="px-3 mt-3 grid grid-cols-3 gap-2">
          <Perk icon={Shield} label="Verified drivers" tone="text-emerald-500" />
          <Perk icon={Zap} label="Fair-fare bidding" tone="text-amber-500" />
          <Perk icon={Wallet} label="In-app wallet" tone="text-sky-500" />
        </div>

        {/* Demand & surge zones */}
        <div className="px-3 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold tracking-wide">Demand zones</h3>
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Activity className="w-3 h-3" /> Updated live
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { area: "City Center", level: "High",   mult: "1.4×", trend: "+12%", tone: "from-rose-500 to-orange-400", icon: Flame },
              { area: "Airport",     level: "Peak",   mult: "1.7×", trend: "+28%", tone: "from-violet-500 to-fuchsia-400", icon: TrendingUp },
              { area: "University",  level: "Medium", mult: "1.1×", trend: "+4%",  tone: "from-sky-500 to-blue-400", icon: Activity },
              { area: "Suburbs",     level: "Low",    mult: "1.0×", trend: "−2%",  tone: "from-emerald-500 to-teal-400", icon: Leaf },
            ].map((z) => (
              <div key={z.area} className="rounded-2xl bg-card border border-border p-3 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${z.tone} flex items-center justify-center shadow-soft`}>
                    <z.icon className="w-4 h-4 text-white" />
                  </span>
                  <span className="text-[10px] font-black tracking-wider text-muted-foreground">{z.trend}</span>
                </div>
                <p className="text-sm font-black">{z.area}</p>
                <p className="text-[10px] text-muted-foreground">{z.level} demand</p>
                <p className="text-xs font-bold text-primary mt-0.5">{z.mult} surge</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent destinations / shortcuts */}
        <div className="px-3 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold tracking-wide">Saved & frequent</h3>
            <Link to="/addresses" className="text-xs font-semibold text-primary inline-flex items-center gap-0.5">Manage <ChevronRight className="w-3 h-3" /></Link>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-3 px-3 pb-2">
            {[
              { label: "Home",    sub: "Set address", icon: MapPin,     tone: "from-emerald-500 to-teal-400" },
              { label: "Work",    sub: "Set address", icon: MapPin,     tone: "from-sky-500 to-blue-400" },
              { label: "Airport", sub: "Quick fare",  icon: Navigation, tone: "from-violet-500 to-fuchsia-400" },
              { label: "Mall",    sub: "Quick fare",  icon: Sparkles,   tone: "from-rose-500 to-orange-400" },
              { label: "Hospital",sub: "Priority",    icon: AlertTriangle, tone: "from-red-500 to-rose-400" },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => quickDestination(s.label)}
                className="shrink-0 w-32 rounded-2xl bg-muted/50 p-3 text-left border border-border hover:bg-muted active:scale-95 transition"
              >
                <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.tone} flex items-center justify-center mb-2 shadow-soft`}>
                  <s.icon className="w-4 h-4 text-white" />
                </span>
                <p className="text-xs font-bold">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Driver radar list */}
        <div className="px-3 mt-5 pb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold tracking-wide flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-primary" /> Live radar</h3>
            <div className="flex items-center gap-2">
              <Link to="/driver" className="text-[11px] font-bold text-primary inline-flex items-center gap-1">
                <Car className="w-3 h-3" /> Switch to driver
              </Link>
              <span className="text-[11px] text-muted-foreground">{drivers.length} · 10km</span>
            </div>
          </div>
          <div className="rounded-2xl bg-card border border-border shadow-card divide-y divide-border">
            {drivers.slice(0, 6).map((d, idx) => {
              const km = me ? haversineKm(me.lat, me.lng, Number(d.lat), Number(d.lng)) : 0;
              const eta = Math.max(1, Math.round(km * 2.2));
              return (
                <button
                  type="button"
                  key={d.user_id}
                  onClick={() => {
                    setVClass(d.vehicle_class as VClass);
                    toast.message(`Picked ${d.vehicle_class} · ${d.display_name ?? "driver"}`);
                  }}
                  className="w-full text-left flex items-center gap-3 p-3 hover:bg-muted/50 transition"
                >
                  <span className={`w-9 h-9 rounded-full bg-gradient-to-br ${
                    d.vehicle_class === "moto" ? "from-amber-500 to-orange-400" :
                    d.vehicle_class === "comfort" ? "from-sky-500 to-blue-400" :
                    d.vehicle_class === "xl" ? "from-zinc-900 to-zinc-600" :
                    "from-emerald-500 to-teal-400"
                  } flex items-center justify-center text-white relative`}>
                    {d.vehicle_class === "moto" ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{d.display_name ?? `Driver ${idx + 1}`}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{d.vehicle_label ?? d.vehicle_class}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs font-bold justify-end"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {Number(d.rating).toFixed(1)}</div>
                    <p className="text-[10px] text-muted-foreground">{km.toFixed(1)}km · {eta}m</p>
                  </div>
                </button>
              );
            })}
            {drivers.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No drivers in range. Try again in a moment.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Request panel ---------- */
function RequestPanel(props: {
  pickup: { lat: number; lng: number; address: string } | null;
  setPickup: (v: { lat: number; lng: number; address: string } | null) => void;
  dropoff: { lat: number; lng: number; address: string } | null;
  setDropoff: (v: { lat: number; lng: number; address: string } | null) => void;
  vClass: VClass;
  setVClass: (v: VClass) => void;
  fare: number;
  setFare: (v: number) => void;
  suggested: number;
  distance: number;
  etaMins: number;
  surge: number;
  notes: string;
  setNotes: (v: string) => void;
  onSwap: () => void;
  onUseMy: (which: "pickup" | "dropoff") => void;
  onSubmit: () => void;
  busy: boolean;
  driversCount: number;
  tab: "now" | "schedule" | "share";
}) {
  const { pickup, setPickup, dropoff, setDropoff, vClass, setVClass, fare, setFare, suggested, distance, etaMins, surge, notes, setNotes, onSwap, onUseMy, onSubmit, busy, tab } = props;
  const baseFare = suggested;
  const surgeAdd = baseFare * (surge - 1);
  const platformFee = +(fare * 0.08).toFixed(2);
  const driverEarn = +(fare - platformFee).toFixed(2);

  return (
    <div className="p-4 space-y-4">
      {/* Address inputs */}
      <div className="relative rounded-2xl bg-muted/40 border border-border p-2">
        <AddressInput
          icon="pickup"
          placeholder="Pickup location"
          value={pickup?.address ?? ""}
          onPick={(p) => setPickup(p)}
          onUseMy={() => onUseMy("pickup")}
        />
        <div className="my-1.5 h-px bg-border ml-9" />
        <AddressInput
          icon="dropoff"
          placeholder="Where to?"
          value={dropoff?.address ?? ""}
          onPick={(p) => setDropoff(p)}
        />
        {pickup && dropoff && (
          <button
            onClick={onSwap}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border border-border shadow-soft flex items-center justify-center"
            aria-label="Swap"
          >
            <ArrowRight className="w-4 h-4 rotate-90" />
          </button>
        )}
      </div>

      {tab === "schedule" && (
        <div className="rounded-2xl bg-sky-500/10 border border-sky-500/20 p-3 flex items-center gap-2">
          <Timer className="w-4 h-4 text-sky-500 shrink-0" />
          <p className="text-[11px] text-foreground/80">Schedule up to 7 days ahead. We'll match you 15 min before pickup with the lowest fair fare.</p>
        </div>
      )}
      {tab === "share" && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="text-[11px] text-foreground/80">Pool with riders going your way. Save up to 35% — adds ~5 min to your trip.</p>
        </div>
      )}

      {/* Vehicle class with live price tags */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold tracking-wider text-muted-foreground">CHOOSE A RIDE</p>
          {distance > 0 && <p className="text-[10px] text-muted-foreground">{distance.toFixed(1)} km · ~{etaMins} min</p>}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {CLASSES.map((c) => {
            const active = vClass === c.id;
            const Icon = c.icon;
            const price = distance > 0 ? suggestFare(distance, c.id) * surge : 0;
            return (
              <button
                key={c.id}
                onClick={() => setVClass(c.id)}
                className={`relative rounded-2xl p-2.5 border transition-all text-left ${active ? "border-primary bg-primary/5 scale-[1.02] shadow-soft" : "border-border bg-card hover:bg-muted/50"}`}
              >
                <span className={`inline-flex w-8 h-8 rounded-xl bg-gradient-to-br ${c.tone} items-center justify-center mb-1.5 shadow-soft`}>
                  <Icon className="w-4 h-4 text-white" />
                </span>
                <p className="text-[11px] font-bold leading-none">{c.label}</p>
                <p className="text-[9px] text-muted-foreground mt-1">{c.eta} · {c.seats}</p>
                {price > 0 && <p className="text-[10px] font-black text-primary mt-1">${price.toFixed(2)}</p>}
                {active && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fare bidding with breakdown */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-primary">YOUR FAIR FARE</p>
            <p className="text-[10px] text-muted-foreground">
              {distance > 0 ? `${distance.toFixed(1)} km` : "Set destination"}
              {suggested > 0 && ` · suggested $${(suggested * surge).toFixed(2)}`}
              {surge > 1 && <span className="ml-1 text-amber-600 dark:text-amber-400 font-bold">{surge.toFixed(2)}× surge</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFare(Math.max(1, +(fare - 0.5).toFixed(2)))} className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
            <button onClick={() => setFare(+(fare + 0.5).toFixed(2))} className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight">${fare.toFixed(2)}</span>
          {suggested > 0 && fare < suggested * surge * 0.85 && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Fewer offers</span>}
          {suggested > 0 && fare >= suggested * surge * 1.1 && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"><Zap className="w-3 h-3" /> Faster</span>}
        </div>
        <input
          type="range" min={Math.max(1, suggested * 0.6)} max={Math.max(suggested * 2, 25)} step={0.5} value={fare}
          onChange={(e) => setFare(Number(e.target.value))}
          className="w-full mt-2 accent-primary"
        />
        {/* Fare breakdown */}
        {distance > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <p className="text-muted-foreground">Base</p>
              <p className="font-black">${baseFare.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Surge</p>
              <p className={`font-black ${surge > 1 ? "text-amber-600 dark:text-amber-400" : ""}`}>+${surgeAdd.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Driver gets</p>
              <p className="font-black text-emerald-600 dark:text-emerald-400">${driverEarn.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="flex items-center gap-2">
        <input
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Note for driver (optional)…"
          className="flex-1 h-10 px-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary"
        />
        <Link to="/wallet" className="h-10 px-3 rounded-xl bg-muted/50 border border-border text-[10px] font-bold flex items-center gap-1 hover:bg-muted">
          <Wallet className="w-3.5 h-3.5" /> Wallet
        </Link>
      </div>

      <button
        onClick={onSubmit}
        disabled={busy || !pickup || !dropoff}
        className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-elevated disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <CircleSpinner size={16} /> : <><Sparkles className="w-4 h-4" /> {tab === "schedule" ? "Schedule ride" : tab === "share" ? "Find pool" : "Find drivers"} · ${fare.toFixed(2)}</>}
      </button>
    </div>
  );
}

/* ---------- Address input with search dropdown ---------- */
function AddressInput({ icon, placeholder, value, onPick, onUseMy }: {
  icon: "pickup" | "dropoff";
  placeholder: string;
  value: string;
  onPick: (v: { lat: number; lng: number; address: string }) => void;
  onUseMy?: () => void;
}) {
  const [q, setQ] = useState(value);
  const [results, setResults] = useState<{ lat: number; lng: number; label: string }[]>([]);
  const [open, setOpen] = useState(false);
  const tRef = useRef<number | null>(null);
  useEffect(() => setQ(value), [value]);

  const onChange = (v: string) => {
    setQ(v); setOpen(true);
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = window.setTimeout(async () => {
      const r = await searchPlace(v);
      setResults(r);
    }, 300);
  };

  return (
    <div className="relative flex items-center gap-2 px-2 py-1.5">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${icon === "pickup" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400"}`}>
        {icon === "pickup" ? <span className="w-2 h-2 rounded-full bg-current" /> : <span className="w-2 h-2 rotate-45 bg-current" />}
      </span>
      <input
        value={q}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
      />
      {onUseMy && (
        <button onClick={onUseMy} className="text-[10px] font-bold text-primary px-2 py-1 rounded-md hover:bg-primary/10">USE MY LOCATION</button>
      )}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-popover border border-border rounded-xl shadow-elevated max-h-64 overflow-auto">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => { onPick({ lat: r.lat, lng: r.lng, address: r.label }); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-start gap-2"
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
              <span className="flex-1">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Active ride panel ---------- */
function ActiveRidePanel({ ride, offers, onAccept, onCancel }: {
  ride: Ride;
  offers: ReturnType<typeof useRideOffers> extends infer T ? T : never;
  onAccept: (id: string, driverId: string, fare: number) => void;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(ride.created_at).getTime();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [ride.created_at]);

  const acceptedOffer = offers.find((o) => o.status === "accepted");
  const sortedOffers = [...offers].sort((a, b) => a.fare - b.fare);
  const cheapest = sortedOffers[0];
  const fastest = [...offers].sort((a, b) => a.eta_minutes - b.eta_minutes)[0];

  if (ride.status === "searching" || ride.status === "offered") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-primary inline-flex items-center gap-1"><Radio className="w-3 h-3" /> FINDING YOU A DRIVER</p>
            <p className="text-2xl font-black mt-0.5 tabular-nums">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</p>
          </div>
          <button onClick={onCancel} className="h-9 px-3 rounded-full bg-muted text-xs font-bold flex items-center gap-1"><X className="w-3 h-3" /> Cancel</button>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-primary/60 via-primary to-primary/60 animate-[slide_1.4s_ease-in-out_infinite]" />
        </div>

        {/* Quick badges for cheapest/fastest */}
        {offers.length > 1 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5">
              <p className="text-[9px] font-bold tracking-wider text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"><Wallet className="w-3 h-3" /> CHEAPEST</p>
              <p className="text-sm font-black mt-0.5">${cheapest?.fare.toFixed(2)} · {cheapest?.driver_name}</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5">
              <p className="text-[9px] font-bold tracking-wider text-amber-600 dark:text-amber-400 inline-flex items-center gap-1"><Gauge className="w-3 h-3" /> FASTEST</p>
              <p className="text-sm font-black mt-0.5">{fastest?.eta_minutes}m · {fastest?.driver_name}</p>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold">Driver offers ({offers.length})</p>
            <p className="text-[10px] text-muted-foreground">Sorted by fare</p>
          </div>
          {offers.length === 0 ? (
            <div className="rounded-xl bg-muted/40 border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Drivers reviewing your offer of <span className="font-bold text-foreground">${ride.rider_offer.toFixed(2)}</span>…
            </div>
          ) : (
            <div className="space-y-2">
              {sortedOffers.map((o) => (
                <div key={o.id} className="rounded-2xl bg-card border border-border p-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 text-white font-bold flex items-center justify-center text-sm">
                    {(o.driver_name ?? "D").slice(0, 1)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{o.driver_name ?? "Driver"}</p>
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {o.driver_rating.toFixed(1)} · {o.driver_trips} trips
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{o.vehicle_label} · {o.vehicle_plate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black">${o.fare.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> {o.eta_minutes} min</p>
                  </div>
                  <button onClick={() => onAccept(o.id, o.driver_id, o.fare)} className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold">Accept</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Accepted / arriving / in_progress
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-wider text-emerald-600 dark:text-emerald-400">DRIVER ON THE WAY</p>
          <p className="text-xl font-black mt-0.5">${(ride.final_fare ?? ride.rider_offer).toFixed(2)} · {ride.vehicle_class}</p>
        </div>
        <button onClick={onCancel} className="h-9 px-3 rounded-full bg-muted text-xs font-bold flex items-center gap-1"><X className="w-3 h-3" /> Cancel</button>
      </div>

      {acceptedOffer && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 p-3 flex items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 text-white font-bold flex items-center justify-center">
            {(acceptedOffer.driver_name ?? "D").slice(0, 1)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{acceptedOffer.driver_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{acceptedOffer.vehicle_label} · {acceptedOffer.vehicle_plate}</p>
            <p className="text-[11px] flex items-center gap-1 mt-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {acceptedOffer.driver_rating.toFixed(1)} · {acceptedOffer.driver_trips} trips</p>
          </div>
          <button className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-elevated">
            <Phone className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat label="ETA" value={acceptedOffer ? `${acceptedOffer.eta_minutes}m` : "—"} icon={Clock} />
        <Stat label="Distance" value={`${ride.distance_km.toFixed(1)} km`} icon={Navigation} />
        <Stat label="Fare" value={`$${(ride.final_fare ?? ride.rider_offer).toFixed(2)}`} icon={Wallet} />
      </div>

      <div className="rounded-2xl bg-muted/40 border border-border p-3 text-xs space-y-1.5">
        <div className="flex items-start gap-2"><span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500" /> <span className="flex-1">{ride.pickup_address}</span></div>
        <div className="flex items-start gap-2"><span className="w-2 h-2 mt-1.5 rotate-45 bg-rose-500" /> <span className="flex-1">{ride.dropoff_address}</span></div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border p-2 text-center">
      <Icon className="w-3.5 h-3.5 mx-auto text-primary" />
      <p className="text-[9px] font-bold tracking-wider text-muted-foreground mt-1">{label}</p>
      <p className="text-sm font-black">{value}</p>
    </div>
  );
}

function Insight({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-2.5">
      <Icon className={`w-4 h-4 ${tone}`} />
      <p className="text-sm font-black mt-1">{value}</p>
      <p className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function Perk({ icon: Icon, label, tone }: { icon: typeof Shield; label: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-2.5 text-center">
      <Icon className={`w-4 h-4 mx-auto ${tone}`} />
      <p className="text-[10px] font-bold mt-1">{label}</p>
    </div>
  );
}

/* ---------- Demo: simulated counter-offers + driver approach ---------- */
async function seedSimulatedOffers(rideId: string, drivers: any[], userFare: number, vClass: VClass) {
  const pool = drivers.filter((d) => d.vehicle_class === vClass).slice(0, 6);
  const sample = (pool.length ? pool : drivers).slice(0, 4);
  for (let i = 0; i < sample.length; i++) {
    const d = sample[i];
    const delta = (Math.random() - 0.4) * (userFare * 0.25);
    setTimeout(async () => {
      await supabase.from("ride_offers").insert({
        ride_id: rideId,
        driver_id: d.user_id,
        driver_name: d.display_name,
        driver_rating: Number(d.rating ?? 4.8),
        driver_trips: 100 + Math.floor(Math.random() * 1800),
        vehicle_label: d.vehicle_label,
        vehicle_plate: ["ABC 123", "ZZ 4567", "GP 9911", "AAU 4421"][i % 4],
        fare: Math.max(1.5, +(userFare + delta).toFixed(2)),
        eta_minutes: 2 + Math.floor(Math.random() * 7),
        driver_lat: Number(d.lat),
        driver_lng: Number(d.lng),
      });
      await supabase.from("rides").update({ status: "offered" }).eq("id", rideId);
    }, 1500 + i * 1200);
  }
}

async function simulateDriverApproach(rideId: string) {
  const { data: r } = await supabase.from("rides").select("rider_lat,rider_lng,driver_lat,driver_lng").eq("id", rideId).maybeSingle();
  if (!r?.rider_lat || !r?.rider_lng) return;
  let dLat = Number(r.driver_lat ?? Number(r.rider_lat) + 0.01);
  let dLng = Number(r.driver_lng ?? Number(r.rider_lng) + 0.01);
  const tLat = Number(r.rider_lat);
  const tLng = Number(r.rider_lng);
  let steps = 0;
  const tick = setInterval(async () => {
    steps += 1;
    dLat += (tLat - dLat) * 0.18;
    dLng += (tLng - dLng) * 0.18;
    await supabase.from("rides").update({ driver_lat: dLat, driver_lng: dLng }).eq("id", rideId);
    if (steps > 18) clearInterval(tick);
  }, 1500);
}
