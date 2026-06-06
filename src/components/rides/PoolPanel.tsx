import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Users, Plus, MapPin, Clock, DollarSign, Car, Shield, Sparkles, ChevronRight, X, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CircleSpinner from "@/components/CircleSpinner";
import {
  useNearbySharedTrips,
  useMatchedTrips,
  useTripJoins,
  useMyJoins,
  type SharedTrip,
} from "@/hooks/useSharedTrips";

const sb = supabase as any;
type LatLng = { lat: number; lng: number; address: string };

function fmtETA(iso: string) {
  const d = new Date(iso);
  const diff = (d.getTime() - Date.now()) / 60000;
  if (diff < 0) return "departing";
  if (diff < 60) return `in ${Math.round(diff)}m`;
  if (diff < 60 * 24) return `in ${Math.round(diff / 60)}h`;
  return d.toLocaleDateString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export default function PoolPanel({
  userId,
  me,
  pickup,
  dropoff,
}: {
  userId: string | null;
  me: { lat: number; lng: number } | null;
  pickup: LatLng | null;
  dropoff: LatLng | null;
}) {
  const [mode, setMode] = useState<"find" | "host" | "trips">("find");
  const trips = useNearbySharedTrips(me, 25);
  const matches = useMatchedTrips(
    pickup ? { lat: pickup.lat, lng: pickup.lng } : null,
    dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : null,
    4,
  );
  const myJoins = useMyJoins(userId);

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-1 p-1 rounded-2xl bg-muted/60 border border-border">
        {[
          { id: "find", label: "Browse", icon: MapPin },
          { id: "host", label: "Host trip", icon: Plus },
          { id: "trips", label: "My pool", icon: Users },
        ].map((t) => {
          const active = mode === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setMode(t.id as any)}
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

      {mode === "find" && (
        <FindMode trips={trips} matches={matches} pickup={pickup} dropoff={dropoff} userId={userId} />
      )}
      {mode === "host" && <HostMode userId={userId} pickup={pickup} dropoff={dropoff} />}
      {mode === "trips" && <MyPool userId={userId} myJoins={myJoins} />}
    </div>
  );
}

/* ---------------- FIND ---------------- */
function FindMode({
  trips, matches, pickup, dropoff, userId,
}: {
  trips: SharedTrip[]; matches: SharedTrip[]; pickup: LatLng | null; dropoff: LatLng | null; userId: string | null;
}) {
  const matchIds = new Set(matches.map((m) => m.id));
  const others = trips.filter((t) => !matchIds.has(t.id));

  return (
    <div className="space-y-3">
      {pickup && dropoff && matches.length > 0 && (
        <div className="rounded-2xl rides-glass-soft p-3 border border-[hsl(var(--rides-mint)/0.3)]">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-[hsl(var(--rides-mint))]" />
            <p className="rides-label !text-[hsl(var(--rides-mint))]">
              {matches.length} match{matches.length > 1 ? "es" : ""} on your route
            </p>
          </div>
          <div className="space-y-2">
            {matches.map((t) => <TripCard key={t.id} trip={t} userId={userId} pickup={pickup} dropoff={dropoff} highlight />)}
          </div>
        </div>
      )}


      {!pickup || !dropoff ? (
        <p className="text-xs text-muted-foreground text-center py-2">Set your pickup & drop-off above to see route matches.</p>
      ) : null}

      <div>
        <p className="text-[11px] font-bold tracking-wider text-muted-foreground mb-2">
          {others.length ? "OTHER TRIPS NEARBY" : "NO OTHER TRIPS NEARBY"}
        </p>
        <div className="space-y-2">
          {others.slice(0, 12).map((t) => (
            <TripCard key={t.id} trip={t} userId={userId} pickup={pickup} dropoff={dropoff} />
          ))}
          {others.length === 0 && (
            <div className="text-center py-6 rounded-2xl bg-muted/40 border border-dashed border-border">
              <Users className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Be the first to post a trip from your area.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TripCard({ trip, userId, pickup, dropoff, highlight }: {
  trip: SharedTrip; userId: string | null; pickup: LatLng | null; dropoff: LatLng | null; highlight?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [seats, setSeats] = useState(1);
  const join = async () => {
    if (!userId) { toast.error("Sign in to join"); return; }
    if (userId === trip.host_id) { toast.error("That's your own trip"); return; }
    setBusy(true);
    const { error } = await sb.from("shared_trip_joins").insert({
      trip_id: trip.id,
      rider_id: userId,
      seats,
      pickup_address: pickup?.address ?? null,
      pickup_lat: pickup?.lat ?? null,
      pickup_lng: pickup?.lng ?? null,
      dropoff_address: dropoff?.address ?? null,
      dropoff_lat: dropoff?.lat ?? null,
      dropoff_lng: dropoff?.lng ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Request sent to host");
  };
  const total = (trip.seat_price * seats).toFixed(2);

  return (
    <div className={`rides-card p-3 ${highlight ? "rides-card-active" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded rides-chip">
              {trip.host_kind === "driver" ? <><Shield className="inline w-2.5 h-2.5 mr-0.5" />Pro driver</> : <><Users className="inline w-2.5 h-2.5 mr-0.5" />Peer</>}
            </span>
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtETA(trip.departure_at)}</span>
          </div>
          <p className="text-sm font-bold truncate">→ {trip.dest_address}</p>
          <p className="text-[11px] text-muted-foreground truncate">from {trip.origin_address}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-black leading-none text-[hsl(var(--rides-mint))]">${trip.seat_price.toFixed(0)}</p>
          <p className="text-[9px] text-muted-foreground">per seat</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted">
            <Car className="w-3 h-3" />{trip.vehicle_label ?? trip.vehicle_class}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full rides-chip font-bold">
            {trip.seats_available}/{trip.seats_total} seats
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
            <button onClick={() => setSeats(Math.max(1, seats - 1))} className="w-6 h-6 rounded-full bg-background text-xs">−</button>
            <span className="text-[11px] font-bold w-4 text-center">{seats}</span>
            <button onClick={() => setSeats(Math.min(trip.seats_available, seats + 1))} className="w-6 h-6 rounded-full bg-background text-xs">+</button>
          </div>
          <button
            onClick={join}
            disabled={busy || trip.seats_available < 1}
            className="h-8 px-3 rounded-full rides-cta text-[11px] inline-flex items-center gap-1"
          >
            {busy ? <CircleSpinner size={12} /> : <>Join · ${total}</>}
          </button>
        </div>
      </div>
    </div>

  );
}

/* ---------------- HOST ---------------- */
function HostMode({ userId, pickup, dropoff }: { userId: string | null; pickup: LatLng | null; dropoff: LatLng | null }) {
  const defaultDep = useMemo(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  }, []);
  const [departure, setDeparture] = useState(defaultDep);
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState(3);
  const [vehicle, setVehicle] = useState("");
  const [vClass, setVClass] = useState<"moto" | "economy" | "comfort" | "xl">("economy");
  const [hostKind, setHostKind] = useState<"peer" | "driver">("peer");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!userId) { toast.error("Sign in first"); return; }
    if (!pickup || !dropoff) { toast.error("Set origin & destination at the top"); return; }
    setBusy(true);
    const { error } = await sb.from("shared_trips").insert({
      host_id: userId,
      host_kind: hostKind,
      origin_address: pickup.address,
      origin_lat: pickup.lat, origin_lng: pickup.lng,
      dest_address: dropoff.address,
      dest_lat: dropoff.lat, dest_lng: dropoff.lng,
      departure_at: new Date(departure).toISOString(),
      seats_total: seats,
      seats_available: seats,
      seat_price: price,
      vehicle_label: vehicle || null,
      vehicle_class: vClass,
      notes: notes || null,
      current_lat: pickup.lat,
      current_lng: pickup.lng,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Trip posted — riders nearby will be matched");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl rides-glass-soft p-3 space-y-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[11px] truncate">{pickup?.address ?? "Set pickup above"}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-[11px] truncate">{dropoff?.address ?? "Set drop-off above"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setHostKind("peer")}
          className={`rides-card p-2.5 text-left ${hostKind === "peer" ? "rides-card-active" : ""}`}
        >
          <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[hsl(var(--rides-mint))]" /><span className="text-[11px] font-bold">Peer / carpool</span></div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Split fuel with riders going your way</p>
        </button>
        <button
          onClick={() => setHostKind("driver")}
          className={`rides-card p-2.5 text-left ${hostKind === "driver" ? "rides-card-active" : ""}`}
        >
          <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[hsl(var(--rides-mint))]" /><span className="text-[11px] font-bold">Pro driver</span></div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Offer a shared commercial ride</p>
        </button>
      </div>


      <label className="block">
        <span className="text-[10px] font-bold tracking-wider text-muted-foreground">DEPARTURE</span>
        <input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)}
          className="mt-1 w-full h-10 px-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary" />
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground">SEATS</span>
          <input type="number" min={1} max={8} value={seats} onChange={(e) => setSeats(Number(e.target.value))}
            className="mt-1 w-full h-10 px-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary" />
        </label>
        <label className="block col-span-2">
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground">PRICE PER SEAT ($)</span>
          <input type="number" min={0} step={0.5} value={price} onChange={(e) => setPrice(Number(e.target.value))}
            className="mt-1 w-full h-10 px-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary" />
        </label>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {(["moto", "economy", "comfort", "xl"] as const).map((c) => (
          <button key={c} onClick={() => setVClass(c)}
            className={`p-2 rounded-xl border text-[10px] font-bold capitalize ${vClass === c ? "border-primary bg-primary/10" : "border-border"}`}>
            {c}
          </button>
        ))}
      </div>

      <input value={vehicle} onChange={(e) => setVehicle(e.target.value)}
        placeholder="Vehicle (e.g. Toyota Hiace · ADX 1234)"
        className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary" />

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (luggage limits, route stops, smoking…)"
        rows={2}
        className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary" />

      <button onClick={submit} disabled={busy}
        className="w-full h-12 rounded-2xl rides-cta text-sm flex items-center justify-center gap-2">

        {busy ? <CircleSpinner size={16} /> : <><Plus className="w-4 h-4" /> Post trip</>}
      </button>
    </div>
  );
}

/* ---------------- MY POOL ---------------- */
function MyPool({ userId, myJoins }: { userId: string | null; myJoins: ReturnType<typeof useMyJoins> }) {
  const [hostedTrips, setHostedTrips] = useState<SharedTrip[]>([]);
  const [loaded, setLoaded] = useState(false);

  useMemo(() => {
    if (!userId) return;
    (async () => {
      const { data } = await sb.from("shared_trips").select("*").eq("host_id", userId).order("departure_at", { ascending: false }).limit(20);
      setHostedTrips((data ?? []) as SharedTrip[]);
      setLoaded(true);
    })();
  }, [userId]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold tracking-wider text-muted-foreground mb-2">SEATS I JOINED</p>
        {myJoins.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 rounded-xl bg-muted/30">No active seat requests.</p>
        ) : (
          <div className="space-y-2">
            {myJoins.map((j) => (
              <div key={j.id} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold capitalize">{j.status} · {j.seats} seat{j.seats > 1 ? "s" : ""}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{j.pickup_address ?? "Pickup TBD"} → {j.dropoff_address ?? "TBD"}</p>
                </div>
                {j.status === "accepted" && !j.paid && (
                  <Link to={`/pay/shared-trip-seat/${j.id}`} className="h-8 px-3 rounded-full rides-cta text-[11px] inline-flex items-center gap-1">
                    Pay <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
                {j.paid && <span className="text-[10px] text-emerald-600 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Paid</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold tracking-wider text-muted-foreground mb-2">TRIPS I'M HOSTING</p>
        {!loaded ? <CircleSpinner size={16} /> : hostedTrips.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 rounded-xl bg-muted/30">Post a trip from the Host tab.</p>
        ) : (
          <div className="space-y-2">
            {hostedTrips.map((t) => <HostedTripRow key={t.id} trip={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function HostedTripRow({ trip }: { trip: SharedTrip }) {
  const joins = useTripJoins(trip.id);
  const [open, setOpen] = useState(false);
  const decide = async (jid: string, status: "accepted" | "declined") => {
    const { error } = await sb.from("shared_trip_joins").update({ status }).eq("id", jid);
    if (error) toast.error(error.message); else toast.success(`Request ${status}`);
  };
  const pending = joins.filter((j) => j.status === "pending").length;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full p-3 flex items-center justify-between text-left">
        <div className="min-w-0">
          <p className="text-[11px] font-bold truncate">→ {trip.dest_address}</p>
          <p className="text-[10px] text-muted-foreground">{fmtETA(trip.departure_at)} · {trip.seats_available}/{trip.seats_total} seats · ${trip.seat_price.toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {pending > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white">{pending} new</span>}
          <ChevronRight className={`w-4 h-4 transition ${open ? "rotate-90" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-border p-2 space-y-1.5">
          {joins.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">No requests yet.</p>}
          {joins.map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-muted/40">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold capitalize">{j.status} · {j.seats} seat{j.seats > 1 ? "s" : ""}{j.paid ? " · paid" : ""}</p>
                <p className="text-[10px] text-muted-foreground truncate">{j.pickup_address ?? "Pickup TBD"}</p>
              </div>
              {j.status === "pending" && (
                <div className="flex items-center gap-1">
                  <button onClick={() => decide(j.id, "accepted")} className="w-7 h-7 rounded-full rides-cta flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => decide(j.id, "declined")} className="w-7 h-7 rounded-full bg-muted text-foreground flex items-center justify-center"><XCircle className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
