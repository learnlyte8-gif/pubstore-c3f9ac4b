import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Wallet as WalletIcon, ArrowLeft, CheckCircle2 } from "lucide-react";

const sb = supabase as any;

type Info = { title: string; amount: number; status: string; paid: boolean; supplier?: string | null };

const KIND_LABEL: Record<string, string> = {
  "stay": "Stay booking",
  "car-rental": "Car rental",
  "property": "Property inquiry",
  "finance": "Finance application",
  "vehicle": "Vehicle inquiry",
  "service-bid": "Service bid",
  "logistics-bid": "Courier bid",
  "shared-trip-seat": "Ride-share seat",
};

async function loadInfo(kind: string, id: string): Promise<Info | null> {
  try {
    if (kind === "stay") {
      const { data } = await sb.from("stay_bookings").select("total,status,paid,stays(title,suppliers(name))").eq("id", id).maybeSingle();
      if (!data) return null;
      return { title: data.stays?.title ?? "Stay", amount: Number(data.total ?? 0), status: data.status, paid: !!data.paid, supplier: data.stays?.suppliers?.name };
    }
    if (kind === "car-rental") {
      const { data } = await sb.from("car_rental_bookings").select("estimated_total,status,paid,car_rentals(title)").eq("id", id).maybeSingle();
      if (!data) return null;
      return { title: data.car_rentals?.title ?? "Car rental", amount: Number(data.estimated_total ?? 0), status: data.status, paid: !!data.paid };
    }
    if (kind === "property") {
      const { data } = await sb.from("property_inquiries").select("amount_due,status,paid,properties(title)").eq("id", id).maybeSingle();
      if (!data) return null;
      return { title: data.properties?.title ?? "Property", amount: Number(data.amount_due ?? 0), status: data.status, paid: !!data.paid };
    }
    if (kind === "finance") {
      const { data } = await sb.from("finance_applications").select("amount_due,status,paid,finance_products(title)").eq("id", id).maybeSingle();
      if (!data) return null;
      return { title: data.finance_products?.title ?? "Finance product", amount: Number(data.amount_due ?? 0), status: data.status, paid: !!data.paid };
    }
    if (kind === "vehicle") {
      const { data } = await sb.from("vehicle_inquiries").select("amount_due,status,paid,vehicles(title)").eq("id", id).maybeSingle();
      if (!data) return null;
      return { title: data.vehicles?.title ?? "Vehicle", amount: Number(data.amount_due ?? 0), status: data.status, paid: !!data.paid };
    }
    if (kind === "service-bid") {
      const { data } = await sb.from("service_bids").select("price,status,paid,service_requests(title)").eq("id", id).maybeSingle();
      if (!data) return null;
      return { title: data.service_requests?.title ?? "Service", amount: Number(data.price ?? 0), status: data.status, paid: !!data.paid };
    }
    if (kind === "logistics-bid") {
      const { data } = await sb.from("logistics_bids").select("fare,status,paid,logistics_requests(title)").eq("id", id).maybeSingle();
      if (!data) return null;
      return { title: data.logistics_requests?.title ?? "Delivery", amount: Number(data.fare ?? 0), status: data.status, paid: !!data.paid };
    }
    if (kind === "shared-trip-seat") {
      const { data } = await sb.from("shared_trip_joins").select("amount_due,status,paid,seats,shared_trips(dest_address,seat_price)").eq("id", id).maybeSingle();
      if (!data) return null;
      return {
        title: `${data.seats} seat${data.seats > 1 ? "s" : ""} → ${data.shared_trips?.dest_address ?? "shared trip"}`,
        amount: Number(data.amount_due ?? 0),
        status: data.status,
        paid: !!data.paid,
      };
    }
  } catch { /* noop */ }
  return null;
}

export default function PayAction() {
  const { kind = "", id = "" } = useParams();
  const nav = useNavigate();
  const { balance, refresh } = useWallet();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setInfo(await loadInfo(kind, id));
      setLoading(false);
    })();
  }, [kind, id]);

  const onPay = async () => {
    if (!info) return;
    if (balance < info.amount) {
      toast.error("Wallet balance is too low. Please top up first.");
      nav("/wallet");
      return;
    }
    setPaying(true);
    const { error } = await sb.rpc("pay_service_action_with_wallet", { _kind: kind, _record_id: id });
    setPaying(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment successful");
    refresh();
    setInfo(await loadInfo(kind, id));
  };

  const label = KIND_LABEL[kind] ?? "Service";

  return (
    <div className="container max-w-md mx-auto p-4 space-y-4">
      <button onClick={() => nav(-1)} className="flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <WalletIcon className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Pay with PUBSTORE Pay</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !info ? (
          <p className="text-sm text-muted-foreground">Record not found or you don't have access.</p>
        ) : (
          <>
            <div className="space-y-1">
              <div className="text-xs uppercase text-muted-foreground">{label}</div>
              <div className="font-semibold">{info.title}</div>
              {info.supplier && <div className="text-sm text-muted-foreground">{info.supplier}</div>}
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount due</span>
                <span className="font-semibold">${info.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your wallet</span>
                <span className={balance < info.amount ? "text-destructive font-semibold" : "font-semibold"}>
                  ${balance.toFixed(2)}
                </span>
              </div>
            </div>

            {info.paid ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Payment received. Thank you!</span>
              </div>
            ) : !["accepted","approved","confirmed","awarded","assigned"].includes(info.status) ? (
              <p className="text-sm text-muted-foreground">
                This {label.toLowerCase()} is currently <strong>{info.status}</strong>. Payment unlocks once the supplier accepts.
              </p>
            ) : balance < info.amount ? (
              <Button asChild className="w-full"><Link to="/wallet">Top up wallet</Link></Button>
            ) : (
              <Button onClick={onPay} disabled={paying} className="w-full">
                {paying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pay ${info.amount.toFixed(2)} now
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
