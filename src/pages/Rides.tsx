import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Car, Bike, Crown, Users, MapPin, Navigation, Crosshair, Plus, Minus, Star, Clock, Zap, Shield, Phone, X, ArrowRight, Sparkles, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useNearbyDrivers, useRideOffers, useActiveRide, suggestFare, haversineKm, type Ride } from "@/hooks/useRides";
import RideMap from "@/components/rides/RideMap";
import CircleSpinner from "@/components/CircleSpinner";

type LatLng = { lat: number; lng: number };
type VClass = Ride["vehicle_class"];

const CLASSES: { id: VClass; label: string; icon: typeof Car; eta: string; seats: string; tone: string }[] = [
  { id: "moto",    label: "Moto",    icon: Bike,  eta: "2 min", seats: "1 seat",  tone: "from-amber-500 to-orange-400" },
  { id: "economy", label: "Economy", icon: Car,   eta: "4 min", seats: "4 seats", tone: "from-emerald-500 to-teal-400" },
  { id: "comfort", label: "Comfort", icon: Car,   eta: "5 min", seats: "4 seats", tone: "from-sky-500 to-blue-400" },
  { id: "xl",      label: "XL",      icon: Users, eta: "6 min", seats: "6 seats", tone: "from-zinc-900 to-zinc-600" },
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

export default function Rides() {
  const { userId, requireAuth } = useRequireAuth();
  const [me, setMe] = useState<LatLng | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [pickup, setPickup] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [vClass, setVClass] = useState<VClass>("economy");
  const [fare, setFare] = useState<number>(5);
  const [notes, setNotes] = useState("");
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const ride = useActiveRide(activeRideId);
  const offers = useRideOffers(activeRideId);
  const drivers = useNearbyDrivers(me, 10);

  const distance = useMemo(() => (pickup && dropoff ? haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng) : 0), [pickup, dropoff]);
  const suggested = useMemo(() => (distance > 0 ? suggestFare(distance, vClass) : 0), [distance, vClass]);

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

  // Live update rider position to the ride row while ride is active
  useEffect(() => {
    if (!activeRideId || !navigator.geolocation) return;
    const w = navigator.geolocation.watchPosition(async (p) => {
      const { latitude, longitude } = p.coords;
      setMe({ lat: latitude, lng: longitude });
      await supabase.from("rides").update({ rider_lat: latitude, rider_lng: longitude }).eq("id", activeRideId);
    }, undefined, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(w);
  }, [activeRideId]);

  // Suggest fare when distance changes
  useEffect(() => { if (suggested > 0) setFare(suggested); }, [suggested]);

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
      distance_km: Number(distance.toFixed(2)),
      rider_offer: fare,
      vehicle_class: vClass,
      notes: notes || null,
      rider_lat: me?.lat ?? pickup.lat,
      rider_lng: me?.lng ?? pickup.lng,
    }).select().single();
    setCreating(false);
    if (error || !data) { toast.error(error?.message ?? "Could not create ride"); return; }
    setActiveRideId(data.id);
    // simulate incoming driver counter-offers
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

  const inActiveFlow = ride && ["searching", "offered", "accepted", "arriving", "in_progress"].includes(ride.status);

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] bg-gradient-to-b from-background via-background to-muted/30">
      {/* Hero map */}
      <div className="relative">
        <div className="h-[42vh] min-h-[280px] w-full">
          <RideMap
            me={me}
            pickup={pickup ? { lat: pickup.lat, lng: pickup.lng } : null}
            dropoff={dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : null}
            drivers={inActiveFlow ? [] : drivers.map((d) => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) }))}
            driverPosition={ride?.driver_lat && ride?.driver_lng ? { lat: Number(ride.driver_lat), lng: Number(ride.driver_lng) } : null}
            className="w-full h-full"
          />
        </div>
        {/* Floating header chip */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="px-3 h-9 rounded-full bg-background/90 backdrop-blur border border-border shadow-card flex items-center gap-2 pointer-events-auto">
            <span className="relative w-2 h-2 rounded-full bg-emerald-500">
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
            </span>
            <span className="text-xs font-bold">{drivers.length} drivers nearby</span>
          </div>
          <button
            onClick={() => useMyLocationFor("pickup")}
            className="h-9 w-9 rounded-full bg-background/95 backdrop-blur border border-border shadow-card flex items-center justify-center pointer-events-auto"
          >
            {locBusy ? <CircleSpinner size={14} /> : <Crosshair className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main panel */}
      <div className="relative -mt-6 z-10">
        <div className="mx-3 rounded-3xl bg-card border border-border shadow-elevated overflow-hidden">
          {!inActiveFlow ? (
            <RequestPanel
              pickup={pickup} setPickup={setPickup}
              dropoff={dropoff} setDropoff={setDropoff}
              vClass={vClass} setVClass={setVClass}
              fare={fare} setFare={setFare}
              suggested={suggested} distance={distance}
              notes={notes} setNotes={setNotes}
              onSwap={swapPickupDrop}
              onUseMy={useMyLocationFor}
              onSubmit={requestRide}
              busy={creating}
              driversCount={drivers.length}
            />
          ) : (
            <ActiveRidePanel
              ride={ride!}
              offers={offers}
              onAccept={acceptOffer}
              onCancel={cancelRide}
            />
          )}
        </div>

        {/* Trust + perks */}
        <div className="px-3 mt-4 grid grid-cols-3 gap-2">
          <Perk icon={Shield} label="Verified drivers" tone="text-emerald-500" />
          <Perk icon={Zap} label="Fair-fare bidding" tone="text-amber-500" />
          <Perk icon={Wallet} label="In-app wallet pay" tone="text-sky-500" />
        </div>

        {/* Recent destinations / shortcuts */}
        <div className="px-3 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold tracking-wide">Saved & frequent</h3>
            <Link to="/addresses" className="text-xs font-semibold text-primary">Manage</Link>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-3 px-3 pb-2">
            {[
              { label: "Home", sub: "Set address", icon: MapPin, tone: "from-emerald-500 to-teal-400" },
              { label: "Work", sub: "Set address", icon: MapPin, tone: "from-sky-500 to-blue-400" },
              { label: "Airport", sub: "Quick fare", icon: Navigation, tone: "from-violet-500 to-fuchsia-400" },
              { label: "Mall", sub: "Quick fare", icon: Sparkles, tone: "from-rose-500 to-orange-400" },
            ].map((s) => (
              <button key={s.label} className="shrink-0 w-32 rounded-2xl bg-muted/50 p-3 text-left border border-border hover:bg-muted transition">
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
            <h3 className="text-sm font-bold tracking-wide">Live radar</h3>
            <span className="text-[11px] text-muted-foreground">{drivers.length} online · within 10km</span>
          </div>
          <div className="rounded-2xl bg-card border border-border shadow-card divide-y divide-border">
            {drivers.slice(0, 5).map((d) => {
              const km = me ? haversineKm(me.lat, me.lng, Number(d.lat), Number(d.lng)) : 0;
              return (
                <div key={d.user_id} className="flex items-center gap-3 p-3">
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white">
                    <Car className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{d.display_name ?? "Driver"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{d.vehicle_label ?? d.vehicle_class}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs font-bold"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {Number(d.rating).toFixed(1)}</div>
                    <p className="text-[10px] text-muted-foreground">{km.toFixed(1)} km</p>
                  </div>
                </div>
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
  notes: string;
  setNotes: (v: string) => void;
  onSwap: () => void;
  onUseMy: (which: "pickup" | "dropoff") => void;
  onSubmit: () => void;
  busy: boolean;
  driversCount: number;
}) {
  const { pickup, setPickup, dropoff, setDropoff, vClass, setVClass, fare, setFare, suggested, distance, notes, setNotes, onSwap, onUseMy, onSubmit, busy } = props;

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

      {/* Vehicle class */}
      <div>
        <p className="text-[11px] font-bold tracking-wider text-muted-foreground mb-2">CHOOSE A RIDE</p>
        <div className="grid grid-cols-4 gap-2">
          {CLASSES.map((c) => {
            const active = vClass === c.id;
            const Icon = c.icon;
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
                {active && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fare bidding */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-primary">YOUR FAIR FARE</p>
            <p className="text-[10px] text-muted-foreground">{distance > 0 ? `${distance.toFixed(1)} km` : "Set destination"} {suggested > 0 && ` · suggested $${suggested.toFixed(2)}`}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFare(Math.max(1, +(fare - 0.5).toFixed(2)))} className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
            <button onClick={() => setFare(+(fare + 0.5).toFixed(2))} className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight">${fare.toFixed(2)}</span>
          {suggested > 0 && fare < suggested * 0.85 && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">May get fewer offers</span>}
          {suggested > 0 && fare >= suggested * 1.1 && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Faster matches likely</span>}
        </div>
        <input
          type="range" min={Math.max(1, suggested * 0.6)} max={Math.max(suggested * 1.6, 20)} step={0.5} value={fare}
          onChange={(e) => setFare(Number(e.target.value))}
          className="w-full mt-2 accent-primary"
        />
      </div>

      {/* Notes */}
      <input
        value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Note for driver (optional)…"
        className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary"
      />

      <button
        onClick={onSubmit}
        disabled={busy || !pickup || !dropoff}
        className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-elevated disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <CircleSpinner size={16} /> : <><Sparkles className="w-4 h-4" /> Find drivers · ${fare.toFixed(2)}</>}
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

  if (ride.status === "searching" || ride.status === "offered") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-primary">FINDING YOU A DRIVER</p>
            <p className="text-xl font-black mt-0.5">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</p>
          </div>
          <button onClick={onCancel} className="h-9 px-3 rounded-full bg-muted text-xs font-bold flex items-center gap-1"><X className="w-3 h-3" /> Cancel</button>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-primary/60 via-primary to-primary/60 animate-[slide_1.4s_ease-in-out_infinite]" />
        </div>

        <div>
          <p className="text-xs font-bold mb-2">Driver offers ({offers.length})</p>
          {offers.length === 0 ? (
            <div className="rounded-xl bg-muted/40 border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Drivers are reviewing your offer of <span className="font-bold text-foreground">${ride.rider_offer.toFixed(2)}</span>…
            </div>
          ) : (
            <div className="space-y-2">
              {offers.map((o) => (
                <div key={o.id} className="rounded-2xl bg-card border border-border p-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 text-white font-bold flex items-center justify-center text-sm">
                    {(o.driver_name ?? "D").slice(0, 1)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{o.driver_name ?? "Driver"}</p>
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {o.driver_rating.toFixed(1)} · {o.vehicle_label}
                    </p>
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
  // Create 2-4 offers from random nearby drivers with slight fare variation
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
  // Move the driver coordinates progressively toward the rider
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
