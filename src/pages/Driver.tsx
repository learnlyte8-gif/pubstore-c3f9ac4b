import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Car, Bike, Users, Power, Navigation, Crosshair, Star, Wallet, ArrowLeft,
  Zap, Inbox, Send, Clock, MapPin, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  useNearbyRideRequests, useActiveRide, suggestFare, haversineKm, type Ride,
} from "@/hooks/useRides";
import RideMap from "@/components/rides/RideMap";
import RideChat from "@/components/rides/RideChat";
import CircleSpinner from "@/components/CircleSpinner";

type LatLng = { lat: number; lng: number };
type VClass = Ride["vehicle_class"];

const CLASSES: { id: VClass; label: string; icon: typeof Car; tone: string }[] = [
  { id: "moto",    label: "Moto",    icon: Bike,  tone: "from-amber-500 to-orange-400" },
  { id: "economy", label: "Economy", icon: Car,   tone: "from-emerald-500 to-teal-400" },
  { id: "comfort", label: "Comfort", icon: Car,   tone: "from-sky-500 to-blue-400" },
  { id: "xl",      label: "XL",      icon: Users, tone: "from-zinc-900 to-zinc-600" },
];

export default function Driver() {
  const navigate = useNavigate();
  const { userId, requireAuth } = useRequireAuth();
  const [pos, setPos] = useState<LatLng | null>(null);
  const [online, setOnline] = useState(false);
  const [vClass, setVClass] = useState<VClass>("economy");
  const [vehicleLabel, setVehicleLabel] = useState("Toyota Corolla · White");
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);

  const ride = useActiveRide(activeRideId);
  const requests = useNearbyRideRequests(online ? pos : null, 12);

  // Capture position once on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // Watch position when online & push to driver_locations
  useEffect(() => {
    if (!online || !userId || !navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      async (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(loc);
        await supabase.from("driver_locations").upsert({
          user_id: userId,
          lat: loc.lat,
          lng: loc.lng,
          online: true,
          vehicle_class: vClass,
          vehicle_label: vehicleLabel,
          heading: p.coords.heading ?? 0,
        });
        // Also push to active ride if any
        if (activeRideId) {
          await supabase.from("rides").update({ driver_lat: loc.lat, driver_lng: loc.lng }).eq("id", activeRideId);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); };
  }, [online, userId, vClass, vehicleLabel, activeRideId]);

  const goOnline = async () => {
    const uid = requireAuth({ message: "Sign in to drive" });
    if (!uid || !pos) { if (!pos) toast.error("Need your location"); return; }
    await supabase.from("driver_locations").upsert({
      user_id: uid, lat: pos.lat, lng: pos.lng, online: true,
      vehicle_class: vClass, vehicle_label: vehicleLabel,
    });
    setOnline(true);
    toast.success("You're online — looking for riders");
  };

  const goOffline = async () => {
    if (!userId) return;
    await supabase.from("driver_locations").update({ online: false }).eq("user_id", userId);
    setOnline(false);
    toast.message("You're offline");
  };

  const sendOffer = async (req: Ride, fare: number) => {
    if (!userId || !pos) return;
    const eta = Math.max(2, Math.round(haversineKm(pos.lat, pos.lng, req.pickup_lat, req.pickup_lng) * 2.5));
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
    const { error } = await supabase.from("ride_offers").insert({
      ride_id: req.id,
      driver_id: userId,
      driver_name: profile?.display_name ?? "Driver",
      driver_rating: 4.9,
      driver_trips: 250,
      vehicle_label: vehicleLabel,
      vehicle_plate: "DRV 001",
      fare,
      eta_minutes: eta,
      driver_lat: pos.lat,
      driver_lng: pos.lng,
    });
    await supabase.from("rides").update({ status: "offered" }).eq("id", req.id);
    if (error) toast.error(error.message);
    else toast.success(`Offer sent for $${fare.toFixed(2)}`);
  };

  // Watch for offer acceptance => drives this driver's accepted ride into focus
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`driver-accepted:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${userId}` }, (payload) => {
        const r = payload.new as Ride;
        if (["accepted", "arriving", "in_progress"].includes(r.status)) {
          setActiveRideId(r.id);
        }
        if (r.status === "completed" || r.status === "cancelled") {
          setActiveRideId(null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const advance = async (next: Ride["status"]) => {
    if (!activeRideId) return;
    const stamps: Record<string, any> = {
      arriving: {},
      in_progress: { started_at: new Date().toISOString() },
      completed: { completed_at: new Date().toISOString(), final_fare: ride?.final_fare ?? ride?.rider_offer ?? 0 },
    };
    await supabase.from("rides").update({ status: next, ...(stamps[next] ?? {}) }).eq("id", activeRideId);
    if (next === "completed") {
      toast.success("Trip complete");
      setActiveRideId(null);
    }
  };

  const inActive = ride && ["accepted", "arriving", "in_progress"].includes(ride.status);

  return (
    <div className="bg-zinc-950 text-zinc-50 min-h-[calc(100dvh-3.5rem)]">
      {/* Hero */}
      <div className="relative">
        <div className="h-[40vh] min-h-[260px]">
          <RideMap
            me={pos}
            pickup={ride ? { lat: ride.pickup_lat, lng: ride.pickup_lng } : null}
            dropoff={ride ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng } : null}
            drivers={[]}
            driverPosition={null}
            className="w-full h-full"
          />
        </div>
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <button
            onClick={() => navigate("/rides")}
            className="h-9 px-3 rounded-full bg-zinc-950/85 backdrop-blur border border-zinc-100/15 flex items-center gap-1.5 text-xs font-bold pointer-events-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Rider mode
          </button>
          <span className="px-3 h-9 rounded-full bg-zinc-950/85 backdrop-blur border border-zinc-100/15 flex items-center gap-2 text-xs font-bold pointer-events-auto">
            <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400" : "bg-zinc-500"}`} />
            {online ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </div>

      <div className="relative -mt-6 z-10 px-3">
        <div className="rounded-3xl bg-zinc-900 border border-zinc-100/10 shadow-elevated overflow-hidden">
          {!inActive ? (
            <div className="p-4 space-y-4">
              {/* Vehicle setup */}
              <div>
                <p className="text-[10px] font-mono font-bold tracking-[0.2em] text-zinc-500">YOUR VEHICLE</p>
                <input
                  value={vehicleLabel}
                  onChange={(e) => setVehicleLabel(e.target.value)}
                  className="w-full mt-2 h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-100/10 text-sm font-semibold outline-none focus:border-emerald-400/50"
                  placeholder="Make, model, color"
                />
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {CLASSES.map((c) => {
                    const active = vClass === c.id;
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setVClass(c.id)}
                        className={`rounded-xl p-2 border text-left transition ${active ? "border-emerald-400/60 bg-emerald-400/5" : "border-zinc-100/10 bg-zinc-950"}`}
                      >
                        <span className={`inline-flex w-7 h-7 rounded-lg bg-gradient-to-br ${c.tone} items-center justify-center mb-1`}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </span>
                        <p className="text-[10px] font-bold">{c.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Online toggle */}
              <button
                onClick={online ? goOffline : goOnline}
                className={`w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-elevated transition ${online ? "bg-zinc-50 text-zinc-950" : "bg-emerald-400 text-zinc-950"}`}
              >
                <Power className="w-5 h-5" />
                {online ? "Go offline" : "Go online"}
              </button>

              {/* Earnings strip */}
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Today" value="$0" icon={Wallet} />
                <Stat label="Trips" value="0" icon={Car} />
                <Stat label="Rating" value="5.0" icon={Star} />
              </div>
            </div>
          ) : (
            <ActiveTripPanel
              ride={ride!}
              myUserId={userId ?? ""}
              onAdvance={advance}
            />
          )}
        </div>

        {/* Pending requests */}
        {online && !inActive && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold tracking-wider uppercase">Incoming requests</h3>
              <span className="text-[11px] text-zinc-400">{requests.length} within 12km</span>
            </div>
            <div className="space-y-2">
              {requests.length === 0 ? (
                <div className="rounded-2xl bg-zinc-900 border border-zinc-100/10 p-6 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                  <Inbox className="w-6 h-6 opacity-50" />
                  Waiting for nearby riders…
                </div>
              ) : (
                requests.map((r) => (
                  <RequestCard key={r.id} req={r} myPos={pos} onSend={sendOffer} />
                ))
              )}
            </div>
          </div>
        )}

        {/* CTA when offline */}
        {!online && (
          <Link
            to="/rides"
            className="mt-5 mb-8 block rounded-2xl bg-zinc-900 border border-zinc-100/10 p-4 text-center text-xs font-semibold text-zinc-400"
          >
            Want to ride instead? <span className="text-emerald-400 font-bold">Open rider mode →</span>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------------- Active trip panel ---------------- */
function ActiveTripPanel({
  ride, myUserId, onAdvance,
}: { ride: Ride; myUserId: string; onAdvance: (s: Ride["status"]) => void }) {
  return (
    <div className="p-4 space-y-3 text-zinc-50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">
            {ride.status.replace("_", " ")}
          </p>
          <p className="text-2xl font-black mt-0.5">${(ride.final_fare ?? ride.rider_offer).toFixed(2)}</p>
        </div>
        <RideChat rideId={ride.id} myUserId={myUserId} counterpartName="Rider" />
      </div>

      <div className="rounded-xl bg-zinc-950 border border-zinc-100/10 p-3 text-xs space-y-1.5">
        <div className="flex items-start gap-2"><span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-400" /> <span className="flex-1">{ride.pickup_address}</span></div>
        <div className="flex items-start gap-2"><span className="w-2 h-2 mt-1.5 rotate-45 bg-rose-400" /> <span className="flex-1">{ride.dropoff_address}</span></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Distance" value={`${ride.distance_km.toFixed(1)} km`} icon={Navigation} />
        <Stat label="Class" value={ride.vehicle_class} icon={Car} />
        <Stat label="Pay" value={`$${(ride.final_fare ?? ride.rider_offer).toFixed(2)}`} icon={Wallet} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ride.status === "accepted" && (
          <>
            <button onClick={() => onAdvance("arriving")} className="h-11 rounded-xl bg-zinc-50 text-zinc-950 text-sm font-bold">I'm on the way</button>
            <button onClick={() => onAdvance("in_progress")} className="h-11 rounded-xl bg-emerald-400 text-zinc-950 text-sm font-bold">Start trip</button>
          </>
        )}
        {ride.status === "arriving" && (
          <button onClick={() => onAdvance("in_progress")} className="col-span-2 h-11 rounded-xl bg-emerald-400 text-zinc-950 text-sm font-bold">Start trip</button>
        )}
        {ride.status === "in_progress" && (
          <button onClick={() => onAdvance("completed")} className="col-span-2 h-11 rounded-xl bg-rose-400 text-zinc-950 text-sm font-bold">Complete trip</button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Request card with bidding ---------------- */
function RequestCard({
  req, myPos, onSend,
}: { req: Ride; myPos: LatLng | null; onSend: (r: Ride, fare: number) => void }) {
  const distFromMe = myPos ? haversineKm(myPos.lat, myPos.lng, req.pickup_lat, req.pickup_lng) : 0;
  const suggested = suggestFare(req.distance_km, req.vehicle_class);
  const [counter, setCounter] = useState<number>(req.rider_offer);

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-100/10 p-3 space-y-2 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
            {req.vehicle_class} · {req.distance_km.toFixed(1)} km · {distFromMe.toFixed(1)} km away
          </p>
          <p className="text-xs font-bold mt-1 truncate flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-400" />{req.pickup_address.split(",")[0]}</p>
          <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1"><MapPin className="w-3 h-3 text-rose-400" />{req.dropoff_address.split(",")[0]}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">RIDER OFFERS</p>
          <p className="text-lg font-black tabular-nums">${req.rider_offer.toFixed(2)}</p>
          <p className="text-[10px] text-zinc-500">sug ${suggested.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          step={0.5}
          value={counter}
          onChange={(e) => setCounter(Number(e.target.value))}
          className="w-24 h-9 px-2 rounded-lg bg-zinc-950 border border-zinc-100/10 text-sm font-bold text-center"
        />
        <button
          onClick={() => onSend(req, req.rider_offer)}
          className="flex-1 h-9 rounded-lg bg-zinc-50 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1"
        >
          <Zap className="w-3 h-3" /> Accept ${req.rider_offer.toFixed(2)}
        </button>
        <button
          onClick={() => onSend(req, counter)}
          className="h-9 px-3 rounded-lg bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center gap-1"
        >
          <Send className="w-3 h-3" /> Bid
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <div className="rounded-xl bg-zinc-950 border border-zinc-100/10 p-2 text-center">
      <Icon className="w-3.5 h-3.5 mx-auto text-emerald-400" />
      <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">{label}</p>
      <p className="text-sm font-black capitalize">{value}</p>
    </div>
  );
}
