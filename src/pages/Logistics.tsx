import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Truck, Package, Plus, Star, Handshake, MapPin, Send, Check, X, Clock,
  CheckCircle2, PackageCheck, MessageCircle, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchLogisticsRequests } from "@/data/newVerticals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";

const VEHICLE_TYPES = [
  { slug: "bike", label: "Bike", maxKg: 5 },
  { slug: "car", label: "Car", maxKg: 50 },
  { slug: "van", label: "Van", maxKg: 500 },
  { slug: "truck", label: "Truck", maxKg: 5000 },
];

const STATUS_FLOW = ["open", "accepted", "picked_up", "delivered", "completed"] as const;
type Status = typeof STATUS_FLOW[number] | "cancelled";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  accepted: "Driver accepted",
  picked_up: "Picked up",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

type Tab = "browse" | "request" | "mine" | "couriers";

export default function Logistics() {
  const [tab, setTab] = useState<Tab>("browse");
  const [userId, setUserId] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Realtime invalidations for everyone on this screen
  useEffect(() => {
    const ch = supabase
      .channel("logistics-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "logistics_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["logistics-requests"] });
        qc.invalidateQueries({ queryKey: ["my-logistics-requests"] });
        qc.invalidateQueries({ queryKey: ["my-driver-jobs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "logistics_bids" }, () => {
        qc.invalidateQueries({ queryKey: ["request-bids"] });
        qc.invalidateQueries({ queryKey: ["my-driver-bids"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: requests = [] } = useQuery({
    queryKey: ["logistics-requests"],
    queryFn: () => fetchLogisticsRequests({ status: "open", limit: 30 }),
  });

  return (
    <div className="pb-8">
      <header className="px-4 pt-4 pb-3 bg-gradient-to-br from-orange-600 via-red-600 to-rose-600 text-white">
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Logistics & delivery</h1>
            <p className="text-[11px] opacity-90">Couriers, freight & supplier delivery partners.</p>
          </div>
        </div>

        <div className="mt-3 flex bg-white/15 backdrop-blur rounded-full p-1 overflow-x-auto scrollbar-none">
          {([
            ["browse", "Open jobs"],
            ["request", "Request"],
            ["mine", "My deliveries"],
            ["couriers", "Couriers"],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 px-3 h-9 rounded-full text-[11px] font-bold transition ${tab === t ? "bg-white text-foreground" : "text-white/90"}`}
            >{label}</button>
          ))}
        </div>
      </header>

      {tab === "browse" && (
        <div className="px-4 mt-4 space-y-2">
          {requests.length === 0 ? (
            <EmptyState title="No active requests" description="Open delivery requests will show here in real time." />
          ) : (
            requests.map((r: any) => (
              <RequestCardForDriver key={r.id} request={r} currentUserId={userId} />
            ))
          )}
        </div>
      )}

      {tab === "request" && <DeliveryRequestForm onPosted={() => setTab("mine")} />}
      {tab === "mine" && <MyDeliveries currentUserId={userId} />}
      {tab === "couriers" && <CouriersDirectory />}
    </div>
  );
}

/* ------------------------------ Driver view ------------------------------ */

function RequestCardForDriver({ request, currentUserId }: { request: any; currentUserId: string | null }) {
  const isOwner = currentUserId && currentUserId === request.buyer_id;
  const [showBid, setShowBid] = useState(false);

  const { data: myBid } = useQuery({
    queryKey: ["my-driver-bids", request.id, currentUserId],
    enabled: !!currentUserId && !isOwner,
    queryFn: async () => {
      const { data } = await supabase
        .from("logistics_bids")
        .select("*")
        .eq("request_id", request.id)
        .eq("driver_id", currentUserId!)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="bg-card border rounded-2xl p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-sm leading-tight">{request.title}</p>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize shrink-0">{request.vehicle_type}</span>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="truncate">{request.pickup_address}</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /><span className="truncate">{request.dropoff_address}</span></div>
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-2">
          {request.weight_kg && <span className="flex items-center gap-0.5"><Package className="w-3 h-3" /> {request.weight_kg}kg</span>}
          {request.distance_km && <span>{request.distance_km.toFixed(1)}km</span>}
        </span>
        {request.budget && <span className="text-sm font-bold text-foreground">${request.budget}</span>}
      </div>

      {!currentUserId ? (
        <Link to="/auth" className="mt-3 block text-center h-9 leading-9 rounded-full bg-foreground text-background text-xs font-bold">Sign in to bid</Link>
      ) : isOwner ? (
        <p className="mt-3 text-[11px] text-muted-foreground text-center">Your request · check <b>My deliveries</b> for bids.</p>
      ) : myBid ? (
        <div className="mt-3 flex items-center justify-between px-3 h-9 rounded-full bg-muted text-xs">
          <span className="font-bold">Your bid: ${Number(myBid.fare).toFixed(2)} · {myBid.eta_minutes}min</span>
          <span className="capitalize text-[10px] font-bold">{myBid.status}</span>
        </div>
      ) : showBid ? (
        <BidForm
          requestId={request.id}
          onDone={() => setShowBid(false)}
          suggestedFare={request.budget}
        />
      ) : (
        <Button onClick={() => setShowBid(true)} className="mt-3 w-full h-9 text-xs">
          <Send className="w-3.5 h-3.5 mr-1.5" /> Bid on this job
        </Button>
      )}
    </div>
  );
}

function BidForm({ requestId, suggestedFare, onDone }: { requestId: string; suggestedFare: number | null; onDone: () => void }) {
  const [fare, setFare] = useState(suggestedFare ? String(suggestedFare) : "");
  const [eta, setEta] = useState("30");
  const [message, setMessage] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const fareN = Number(fare);
    const etaN = Number(eta);
    if (!fareN || fareN <= 0) { toast.error("Enter a valid fare"); return; }
    if (!etaN || etaN <= 0) { toast.error("Enter an ETA"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in first"); setBusy(false); return; }
    const { data: profile } = await supabase.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle();
    const { error } = await supabase.from("logistics_bids").insert({
      request_id: requestId,
      driver_id: user.id,
      fare: fareN,
      eta_minutes: etaN,
      message: message || null,
      vehicle_label: vehicleLabel || null,
      driver_name: profile?.display_name ?? user.email?.split("@")[0] ?? "Driver",
      driver_avatar: profile?.avatar_url ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bid sent — buyer will be notified");
    onDone();
  };

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-muted/40 p-2">
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={fare} onChange={(e) => setFare(e.target.value)} placeholder="Fare ($)" className="h-10 rounded-xl border bg-background px-3 text-sm" />
        <input type="number" value={eta} onChange={(e) => setEta(e.target.value)} placeholder="ETA (min)" className="h-10 rounded-xl border bg-background px-3 text-sm" />
      </div>
      <input value={vehicleLabel} onChange={(e) => setVehicleLabel(e.target.value)} placeholder="Vehicle (e.g. Toyota Hilux)" className="w-full h-10 rounded-xl border bg-background px-3 text-sm" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Note to buyer (optional)" rows={2} className="w-full rounded-xl border bg-background p-2 text-sm" />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 h-9 text-xs" onClick={onDone}>Cancel</Button>
        <Button className="flex-1 h-9 text-xs" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send bid"}</Button>
      </div>
    </div>
  );
}

/* ------------------------------ My deliveries ----------------------------- */

function MyDeliveries({ currentUserId }: { currentUserId: string | null }) {
  const [view, setView] = useState<"buyer" | "driver">("buyer");

  if (!currentUserId) {
    return <div className="px-4 mt-6"><EmptyState title="Sign in" description="Sign in to view your deliveries." /></div>;
  }

  return (
    <div className="px-4 mt-4 space-y-3">
      <div className="flex bg-muted rounded-full p-1">
        <button onClick={() => setView("buyer")} className={`flex-1 h-9 rounded-full text-xs font-bold ${view === "buyer" ? "bg-background shadow" : "text-muted-foreground"}`}>
          <Inbox className="w-3.5 h-3.5 inline mr-1" /> I'm sending
        </button>
        <button onClick={() => setView("driver")} className={`flex-1 h-9 rounded-full text-xs font-bold ${view === "driver" ? "bg-background shadow" : "text-muted-foreground"}`}>
          <Truck className="w-3.5 h-3.5 inline mr-1" /> I'm delivering
        </button>
      </div>
      {view === "buyer" ? <BuyerDeliveries userId={currentUserId} /> : <DriverJobs userId={currentUserId} />}
    </div>
  );
}

function BuyerDeliveries({ userId }: { userId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["my-logistics-requests", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("logistics_requests")
        .select("*")
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  if (rows.length === 0) return <EmptyState title="No deliveries yet" description="Post a delivery request to get bids from drivers." />;

  return (
    <div className="space-y-2">
      {rows.map((r) => <BuyerRequestRow key={r.id} request={r} />)}
    </div>
  );
}

function BuyerRequestRow({ request }: { request: any }) {
  const [open, setOpen] = useState(false);
  const status = request.status as Status;

  return (
    <div className="bg-card border rounded-2xl p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{request.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{request.pickup_address} → {request.dropoff_address}</p>
        </div>
        <StatusPill status={status} />
      </div>

      <StatusSteps status={status} />

      {status === "open" && (
        <button onClick={() => setOpen((v) => !v)} className="mt-2 w-full text-xs font-bold text-primary">
          {open ? "Hide bids" : "View bids"}
        </button>
      )}
      {open && status === "open" && <BidsList requestId={request.id} />}

      {(status === "accepted" || status === "picked_up" || status === "delivered") && (
        <BuyerActions request={request} />
      )}

      {status === "open" && (
        <button
          onClick={async () => {
            if (!confirm("Cancel this delivery?")) return;
            const { error } = await supabase.from("logistics_requests").update({ status: "cancelled" }).eq("id", request.id);
            if (error) toast.error(error.message); else toast.success("Cancelled");
          }}
          className="mt-2 text-[11px] text-muted-foreground"
        >Cancel request</button>
      )}
    </div>
  );
}

function BidsList({ requestId }: { requestId: string }) {
  const { data: bids = [] } = useQuery({
    queryKey: ["request-bids", requestId],
    queryFn: async () => {
      const { data } = await supabase
        .from("logistics_bids")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const accept = async (bid: any) => {
    const { error: e1 } = await supabase.from("logistics_bids").update({ status: "accepted" }).eq("id", bid.id);
    if (e1) return toast.error(e1.message);
    await supabase.from("logistics_bids").update({ status: "rejected" }).eq("request_id", requestId).neq("id", bid.id);
    const { error: e2 } = await supabase.from("logistics_requests").update({
      status: "accepted",
      assigned_driver_id: bid.driver_id,
    }).eq("id", requestId);
    if (e2) return toast.error(e2.message);
    toast.success("Driver accepted — they're on the way");
  };

  if (bids.length === 0) {
    return <p className="mt-2 text-[11px] text-muted-foreground text-center py-3">No bids yet — drivers are looking.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {bids.map((b: any) => (
        <div key={b.id} className="rounded-xl border bg-background p-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
            {b.driver_avatar && <img src={b.driver_avatar} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">{b.driver_name || "Driver"}</p>
            <p className="text-[10px] text-muted-foreground">
              <Star className="w-2.5 h-2.5 inline fill-amber-400 text-amber-400" /> {Number(b.driver_rating ?? 5).toFixed(1)}
              {b.vehicle_label ? ` · ${b.vehicle_label}` : ""}
            </p>
            {b.message && <p className="text-[11px] mt-0.5 line-clamp-2">{b.message}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold">${Number(b.fare).toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{b.eta_minutes} min</p>
            <button onClick={() => accept(b)} className="mt-1 px-2 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              <Check className="w-2.5 h-2.5 inline" /> Accept
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BuyerActions({ request }: { request: any }) {
  const status = request.status as Status;

  const markDelivered = async () => {
    const { error } = await supabase.from("logistics_requests").update({ status: "delivered" }).eq("id", request.id);
    if (error) toast.error(error.message); else toast.success("Marked as delivered");
  };

  const confirmReceived = async () => {
    const { error } = await supabase.from("logistics_requests").update({ status: "completed" }).eq("id", request.id);
    if (error) toast.error(error.message); else toast.success("Delivery complete — thanks!");
  };

  return (
    <div className="mt-3 flex gap-2">
      <Link to="/messages" className="flex-1 h-9 rounded-full border bg-background text-xs font-bold flex items-center justify-center gap-1">
        <MessageCircle className="w-3.5 h-3.5" /> Message driver
      </Link>
      {status === "picked_up" && (
        <Button onClick={markDelivered} className="flex-1 h-9 text-xs">
          <PackageCheck className="w-3.5 h-3.5 mr-1" /> Mark delivered
        </Button>
      )}
      {status === "delivered" && (
        <Button onClick={confirmReceived} className="flex-1 h-9 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirm received
        </Button>
      )}
    </div>
  );
}

function DriverJobs({ userId }: { userId: string }) {
  const { data: bids = [] } = useQuery({
    queryKey: ["my-driver-jobs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("logistics_bids")
        .select("*, logistics_requests(*)")
        .eq("driver_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as any[];
    },
  });

  if (bids.length === 0) return <EmptyState title="No jobs yet" description="Bid on open jobs to get started." />;

  return (
    <div className="space-y-2">
      {bids.map((b) => <DriverJobRow key={b.id} bid={b} />)}
    </div>
  );
}

function DriverJobRow({ bid }: { bid: any }) {
  const req = bid.logistics_requests;
  if (!req) return null;
  const status = req.status as Status;

  const pickup = async () => {
    const { error } = await supabase.from("logistics_requests").update({ status: "picked_up" }).eq("id", req.id);
    if (error) toast.error(error.message); else toast.success("Pickup confirmed");
  };

  const deliver = async () => {
    const { error } = await supabase.from("logistics_requests").update({ status: "delivered" }).eq("id", req.id);
    if (error) toast.error(error.message); else toast.success("Marked as delivered — awaiting buyer confirmation");
  };

  const isAssigned = req.assigned_driver_id === bid.driver_id;

  return (
    <div className="bg-card border rounded-2xl p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{req.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{req.pickup_address} → {req.dropoff_address}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold">${Number(bid.fare).toFixed(2)}</p>
          <StatusPill status={isAssigned ? status : (bid.status as Status)} />
        </div>
      </div>
      <StatusSteps status={isAssigned ? status : "open"} />
      {isAssigned && (
        <div className="mt-2 flex gap-2">
          <Link to="/messages" className="flex-1 h-9 rounded-full border bg-background text-xs font-bold flex items-center justify-center gap-1">
            <MessageCircle className="w-3.5 h-3.5" /> Message buyer
          </Link>
          {status === "accepted" && <Button onClick={pickup} className="flex-1 h-9 text-xs">Confirm pickup</Button>}
          {status === "picked_up" && <Button onClick={deliver} className="flex-1 h-9 text-xs">Mark delivered</Button>}
          {status === "delivered" && <span className="flex-1 h-9 leading-9 rounded-full bg-muted text-center text-xs font-bold">Awaiting buyer confirmation</span>}
          {status === "completed" && <span className="flex-1 h-9 leading-9 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-center text-xs font-bold">Completed ✓</span>}
        </div>
      )}
      {!isAssigned && bid.status === "rejected" && (
        <p className="mt-2 text-[11px] text-muted-foreground text-center">Buyer chose another driver.</p>
      )}
    </div>
  );
}

/* ------------------------------ UI helpers ------------------------------ */

function StatusPill({ status }: { status: Status }) {
  const tone =
    status === "completed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    : status === "cancelled" ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
    : status === "open" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    : "bg-primary/10 text-primary";
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tone}`}>{STATUS_LABEL[status] ?? status}</span>;
}

function StatusSteps({ status }: { status: Status }) {
  if (status === "cancelled") return null;
  const idx = STATUS_FLOW.indexOf(status as any);
  return (
    <div className="mt-2 flex items-center gap-1">
      {STATUS_FLOW.map((s, i) => (
        <div key={s} className={`flex-1 h-1 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
      ))}
    </div>
  );
}

/* ------------------------------ Couriers (unchanged) ------------------------------ */

function CouriersDirectory() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [mySupplierId, setMySupplierId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserId(user?.id ?? null);
      if (user) {
        const { data } = await supabase.from("suppliers").select("id").eq("owner_id", user.id).maybeSingle();
        setMySupplierId(data?.id ?? null);
      }
    });
  }, []);

  const { data: couriers = [] } = useQuery({
    queryKey: ["couriers-directory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courier_profiles" as any)
        .select("*")
        .eq("active", true)
        .eq("offers_supplier_partnerships", true)
        .order("rating", { ascending: false })
        .limit(40);
      return (data ?? []) as any[];
    },
  });

  const { data: myPartnerships = [] } = useQuery({
    queryKey: ["my-supplier-partnerships", mySupplierId],
    enabled: !!mySupplierId,
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_courier_partnerships" as any)
        .select("courier_user_id, status")
        .eq("supplier_id", mySupplierId!);
      return (data ?? []) as any[];
    },
  });

  const invite = async (courierUserId: string) => {
    if (!userId) { toast.error("Sign in first"); return; }
    if (!mySupplierId) { toast.error("Set up your supplier store first"); return; }
    const { error } = await supabase.from("supplier_courier_partnerships" as any).insert({
      supplier_id: mySupplierId,
      courier_user_id: courierUserId,
      initiated_by: "supplier",
      message: "We'd like to partner with you for our deliveries.",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Invitation sent");
    qc.invalidateQueries({ queryKey: ["my-supplier-partnerships"] });
  };

  return (
    <div className="px-4 mt-4 space-y-3">
      <div className="rounded-2xl bg-card border p-3">
        <div className="flex items-center gap-2">
          <Handshake className="w-4 h-4 text-orange-500" />
          <p className="font-bold text-sm">Supplier ↔ courier partnerships</p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Suppliers can invite a courier as their dedicated delivery partner. Couriers must register and opt in from{" "}
          <Link to="/store/services/logistics" className="text-orange-500 font-bold">courier mode</Link>.
        </p>
      </div>

      {couriers.length === 0 ? (
        <EmptyState title="No couriers yet" description="Couriers open to supplier partnerships will appear here." />
      ) : (
        <div className="space-y-2">
          {couriers.map((c: any) => {
            const existing = myPartnerships.find((p) => p.courier_user_id === c.user_id);
            return (
              <div key={c.id} className="bg-card border rounded-2xl p-3 flex gap-3 shadow-card">
                <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0">
                  {c.vehicle_photo && <img src={c.vehicle_photo} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{c.company_name || c.display_name || "Courier"}</p>
                  <p className="text-[11px] text-muted-foreground capitalize truncate">
                    {c.vehicle_type?.replace("_", " ")} · up to {c.max_weight_kg ?? "—"}kg {c.city ? `· ${c.city}` : ""}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] mt-1">
                    <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{Number(c.rating ?? 5).toFixed(1)}</span>
                    <span className="text-muted-foreground">{c.deliveries_completed ?? 0} deliveries</span>
                  </div>
                </div>
                <div className="shrink-0">
                  {existing ? (
                    <span className="px-3 h-8 rounded-full bg-muted text-[11px] font-bold flex items-center capitalize">{existing.status}</span>
                  ) : mySupplierId ? (
                    <Button size="sm" onClick={() => invite(c.user_id)} className="h-8 text-[11px]">Invite</Button>
                  ) : (
                    <Link to="/become-supplier" className="px-3 h-8 rounded-full bg-muted text-[11px] font-bold flex items-center">Become supplier</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Request form ------------------------------ */

function DeliveryRequestForm({ onPosted }: { onPosted: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [weight, setWeight] = useState("");
  const [vehicle, setVehicle] = useState("bike");
  const [budget, setBudget] = useState("");
  const [packageKind, setPackageKind] = useState("parcel");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !pickup.trim() || !dropoff.trim()) { toast.error("Fill in title, pickup, and drop-off"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in first"); setBusy(false); return; }
    const { error } = await supabase.from("logistics_requests").insert({
      buyer_id: user.id,
      title: title.trim(),
      pickup_address: pickup.trim(),
      dropoff_address: dropoff.trim(),
      weight_kg: weight ? Number(weight) : null,
      vehicle_type: vehicle,
      package_kind: packageKind,
      budget: budget ? Number(budget) : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Delivery posted — drivers will bid");
    qc.invalidateQueries({ queryKey: ["logistics-requests"] });
    qc.invalidateQueries({ queryKey: ["my-logistics-requests"] });
    onPosted();
  };

  return (
    <div className="px-4 mt-4 space-y-3">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What are you sending? *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Documents to law firm" className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pickup address *</label>
        <div className="relative mt-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={pickup} onChange={(e) => setPickup(e.target.value)} className="w-full h-11 rounded-xl border bg-background pl-7 pr-3 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Drop-off address *</label>
        <div className="relative mt-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} className="w-full h-11 rounded-xl border bg-background pl-7 pr-3 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle type</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {VEHICLE_TYPES.map((v) => (
            <button key={v.slug} onClick={() => setVehicle(v.slug)} className={`h-12 rounded-xl border text-xs font-bold ${vehicle === v.slug ? "bg-foreground text-background" : "bg-card"}`}>
              <p>{v.label}</p>
              <p className="text-[9px] opacity-70">≤{v.maxKg}kg</p>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weight (kg)</label>
          <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Budget ($)</label>
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1" />
        </div>
      </div>
      <Button onClick={submit} disabled={busy} className="w-full h-12">
        <Plus className="w-4 h-4 mr-2" /> {busy ? "Posting…" : "Post delivery request"}
      </Button>
    </div>
  );
}
