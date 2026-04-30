import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, Package, MapPin, Clock, Plus, ArrowRight, DollarSign } from "lucide-react";
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

export default function Logistics() {
  const [tab, setTab] = useState<"browse" | "request">("browse");
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
            <p className="text-[11px] opacity-90">Last-mile, courier, freight — drivers bid on your delivery.</p>
          </div>
        </div>

        <div className="mt-3 flex bg-white/15 backdrop-blur rounded-full p-1">
          {(["browse", "request"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-9 rounded-full text-xs font-bold transition ${tab === t ? "bg-white text-foreground" : "text-white/90"}`}
            >{t === "browse" ? "Open requests" : "Request delivery"}</button>
          ))}
        </div>
      </header>

      {tab === "browse" && (
        <div className="px-4 mt-4">
          {requests.length === 0 ? (
            <EmptyState title="No active requests" description="Delivery requests will show here in real time." />
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="bg-card border rounded-2xl p-3 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm leading-tight">{r.title}</p>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{r.vehicle_type}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="truncate">{r.pickup_address}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span className="truncate">{r.dropoff_address}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {r.weight_kg && <span className="flex items-center gap-0.5"><Package className="w-3 h-3" /> {r.weight_kg}kg</span>}
                      {r.distance_km && <span>{r.distance_km.toFixed(1)}km</span>}
                    </span>
                    {r.budget && <span className="text-sm font-bold text-foreground">${r.budget}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "request" && <DeliveryRequestForm onPosted={() => setTab("browse")} />}
    </div>
  );
}

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
