import { useEffect, useState } from "react";
import { Truck, Radio, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RideMap from "@/components/rides/RideMap";

type Loc = { lat: number; lng: number; heading?: number; updated_at?: string };

type Props = {
  courierUserId: string;
  courierLabel?: string | null;
  destination?: { lat: number; lng: number } | null;
};

/**
 * Live courier tracking — subscribes to driver_locations for the assigned
 * courier and renders their last known position on a map.
 */
export default function CourierTrackingCard({ courierUserId, courierLabel, destination }: Props) {
  const [pos, setPos] = useState<Loc | null>(null);
  const [courier, setCourier] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: c } = await supabase
        .from("courier_profiles" as any)
        .select("display_name,company_name,vehicle_photo,vehicle_type,phone,whatsapp")
        .eq("user_id", courierUserId).maybeSingle();
      if (mounted) setCourier(c);
      const { data } = await supabase
        .from("driver_locations")
        .select("lat,lng,heading,updated_at")
        .eq("user_id", courierUserId).maybeSingle();
      if (mounted && data) setPos(data as Loc);
    })();

    const ch = supabase
      .channel(`courier-loc-${courierUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `user_id=eq.${courierUserId}` },
        (p) => {
          const r = p.new as any;
          if (r?.lat != null && r?.lng != null) setPos({ lat: r.lat, lng: r.lng, heading: r.heading, updated_at: r.updated_at });
        },
      )
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [courierUserId]);

  const fresh = pos?.updated_at ? (Date.now() - new Date(pos.updated_at).getTime()) < 5 * 60 * 1000 : false;

  return (
    <div className="rounded-2xl bg-card border border-border shadow-card mt-3 overflow-hidden">
      <div className="p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0 flex items-center justify-center">
          {courier?.vehicle_photo
            ? <img src={courier.vehicle_photo} alt="" className="w-full h-full object-cover" />
            : <Truck className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{courierLabel || courier?.company_name || courier?.display_name || "Courier"}</p>
          <p className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
            <Radio className={`w-3 h-3 ${fresh ? "text-emerald-500" : "text-muted-foreground"}`} />
            {fresh ? "Live · tracking now" : pos ? `Last seen ${new Date(pos.updated_at!).toLocaleTimeString()}` : "Waiting for first location ping…"}
          </p>
        </div>
        {courier?.whatsapp && (
          <a href={`https://wa.me/${String(courier.whatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
             className="h-8 px-3 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center">Message</a>
        )}
      </div>
      {pos ? (
        <RideMap
          me={null}
          pickup={null}
          dropoff={destination ?? null}
          driverPosition={{ lat: pos.lat, lng: pos.lng }}
          className="h-56"
        />
      ) : (
        <div className="h-32 flex items-center justify-center text-[11px] text-muted-foreground border-t bg-muted/30">
          <MapPin className="w-3.5 h-3.5 mr-1" /> Courier hasn't shared a location yet
        </div>
      )}
    </div>
  );
}
