import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Car, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type RideRow = {
  id: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  vehicle_class: string | null;
  final_fare: number | null;
  rider_offer: number | null;
};

const ACTIVE_STATUSES = ["searching", "offered", "accepted", "arriving", "in_progress"] as const;
const LS_KEY = "pubstore:active_ride_v1";

const STATUS_LABEL: Record<string, { title: string; body: (r: RideRow) => string }> = {
  searching:   { title: "Looking for a driver", body: () => "We're matching you with nearby drivers." },
  offered:     { title: "New driver offer",     body: () => "A driver sent you an offer — review & accept." },
  accepted:    { title: "Driver accepted",      body: (r) => `Heading to ${r.pickup_address ?? "your pickup"}.` },
  arriving:    { title: "Driver is arriving",   body: () => "Your driver is nearby. Get ready!" },
  in_progress: { title: "Trip in progress",     body: (r) => `On the way to ${r.dropoff_address ?? "your destination"}.` },
  completed:   { title: "Trip completed",       body: () => "Thanks for riding. Don't forget to rate your driver." },
  cancelled:   { title: "Ride cancelled",       body: () => "Your ride was cancelled." },
};

async function notify(title: string, body: string, url = "/rides") {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    if (Notification.permission !== "granted") return;
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) {
      await reg.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "pubstore-ride", data: { url } });
    } else {
      new Notification(title, { body, icon: "/icons/icon-192.png", tag: "pubstore-ride" });
    }
  } catch { /* ignore */ }
}

export default function ActiveRideMonitor() {
  const { userId } = useRequireAuth();
  const location = useLocation();
  const [ride, setRide] = useState<RideRow | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  // Restore last-known ride id immediately so the banner persists across reloads.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) setRide(JSON.parse(cached));
    } catch { /* ignore */ }
  }, []);

  // Subscribe to the rider's own rides and keep the most recent active one.
  useEffect(() => {
    if (!userId) { setRide(null); return; }
    let alive = true;

    const fetchActive = async () => {
      const { data } = await supabase
        .from("rides")
        .select("id,status,pickup_address,dropoff_address,vehicle_class,final_fare,rider_offer")
        .eq("rider_id", userId)
        .in("status", ACTIVE_STATUSES as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      const next = (data as RideRow | null) ?? null;
      setRide(next);
      try {
        if (next) localStorage.setItem(LS_KEY, JSON.stringify(next));
        else localStorage.removeItem(LS_KEY);
      } catch { /* ignore */ }
    };

    fetchActive();
    const ch = supabase
      .channel(`active-ride:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `rider_id=eq.${userId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as RideRow | undefined;
          if (!row) return fetchActive();
          const prev = lastStatusRef.current;
          if (row.status && row.status !== prev) {
            const meta = STATUS_LABEL[row.status];
            if (meta) {
              const body = meta.body(row);
              toast(meta.title, { description: body });
              notify(meta.title, body);
            }
            lastStatusRef.current = row.status;
          }
          fetchActive();
        },
      )
      .subscribe();

    return () => { alive = false; supabase.removeChannel(ch); };
  }, [userId]);

  // Track status transitions even from the initial fetch.
  useEffect(() => {
    const s = ride?.status ?? null;
    if (s && s !== lastStatusRef.current) lastStatusRef.current = s;
  }, [ride?.status]);

  // Ask permission once when an active ride first appears.
  useEffect(() => {
    if (!ride) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [ride?.id]);

  if (!ride) return null;
  if (location.pathname.startsWith("/rides")) return null;

  const meta = STATUS_LABEL[ride.status] ?? { title: "Active ride", body: () => "Tap to view." };
  const fare = ride.final_fare ?? ride.rider_offer;

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRide(null);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  };

  return (
    <Link
      to="/rides"
      className="fixed left-1/2 -translate-x-1/2 bottom-[5.25rem] z-[60] w-[min(92vw,420px)]
                 flex items-center gap-3 px-3 py-2.5 rounded-2xl
                 bg-foreground text-background shadow-xl ring-1 ring-foreground/10
                 active:scale-[0.99] transition"
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-background/15">
        <Car className="h-4 w-4" />
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse ring-2 ring-foreground" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold leading-tight truncate">{meta.title}</div>
        <div className="text-[11px] opacity-80 truncate">
          {ride.dropoff_address ?? "Tap to view your ride"}
          {fare ? ` · $${Number(fare).toFixed(2)}` : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="h-7 w-7 rounded-full inline-flex items-center justify-center bg-background/10 hover:bg-background/20"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </Link>
  );
}
