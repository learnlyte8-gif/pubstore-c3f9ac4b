import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, RefreshCw, ExternalLink, Calendar, Phone, Mail, MapPin, DollarSign, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useRequireAuth";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";

type ActionRow = {
  id: string;
  title: string;
  subtitle?: string | null;
  status: string;
  created_at: string;
  contact?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  meta?: string[];
  link?: string | null;
};

type SectionKey =
  | "stays" | "car-rentals" | "vehicles" | "industrial" | "agro"
  | "properties" | "finance" | "pros" | "driver" | "logistics";

const STATUS_OPTIONS: Record<string, string[]> = {
  stay_bookings: ["pending", "confirmed", "declined", "cancelled", "completed"],
  car_rental_bookings: ["pending", "confirmed", "declined", "active", "completed", "cancelled"],
  vehicle_inquiries: ["open", "responded", "closed"],
  property_inquiries: ["new", "responded", "scheduled", "closed"],
  finance_applications: ["submitted", "in_review", "approved", "declined"],
  rfqs: ["open", "quoted", "closed"],
  service_requests: ["open", "assigned", "completed", "cancelled"],
};

const AGRO_CATEGORIES = ["produce", "equipment", "inputs", "livestock", "services", "project"];
const INDUSTRIAL_CATEGORIES = ["machinery", "materials", "logistics", "equipment", "services"];

async function fetchActions(section: SectionKey, uid: string): Promise<{ table: string; rows: ActionRow[] }> {
  switch (section) {
    case "stays": {
      const { data } = await supabase
        .from("stay_bookings")
        .select("id, status, created_at, check_in, check_out, guests, nights, total, currency, notes, stay:stays!inner(id, title, supplier:suppliers!inner(owner_id))")
        .eq("stay.supplier.owner_id", uid)
        .order("created_at", { ascending: false });
      const rows: ActionRow[] = (data ?? []).map((b: any) => ({
        id: b.id, status: b.status, created_at: b.created_at,
        title: b.stay?.title ?? "Stay booking",
        subtitle: `${b.guests} guests · ${b.nights} night${b.nights === 1 ? "" : "s"}`,
        meta: [
          `${new Date(b.check_in).toLocaleDateString()} → ${new Date(b.check_out).toLocaleDateString()}`,
          `${b.currency} ${Number(b.total).toLocaleString()}`,
        ],
        link: b.stay?.id ? `/stays/${b.stay.id}` : null,
      }));
      return { table: "stay_bookings", rows };
    }
    case "car-rentals": {
      const { data } = await supabase
        .from("car_rental_bookings")
        .select("id, status, created_at, renter_name, renter_phone, renter_email, pickup_at, return_at, pickup_location, estimated_total, currency, notes, rental:car_rentals!inner(id, title, owner_user_id)")
        .eq("rental.owner_user_id", uid)
        .order("created_at", { ascending: false });
      const rows: ActionRow[] = (data ?? []).map((b: any) => ({
        id: b.id, status: b.status, created_at: b.created_at,
        title: b.rental?.title ?? "Rental booking",
        subtitle: b.notes,
        contact: { name: b.renter_name, phone: b.renter_phone, email: b.renter_email },
        meta: [
          `${new Date(b.pickup_at).toLocaleDateString()} → ${new Date(b.return_at).toLocaleDateString()}`,
          b.pickup_location || "",
          b.estimated_total ? `${b.currency} ${Number(b.estimated_total).toLocaleString()}` : "",
        ].filter(Boolean) as string[],
        link: b.rental?.id ? `/car-rentals/${b.rental.id}` : null,
      }));
      return { table: "car_rental_bookings", rows };
    }
    case "vehicles": {
      const { data } = await supabase
        .from("vehicle_inquiries")
        .select("id, status, created_at, kind, contact_name, contact_phone, contact_email, preferred_date, message, down_payment, estimated_monthly, vehicle:vehicles!inner(id, title, supplier:suppliers!inner(owner_id))")
        .eq("vehicle.supplier.owner_id", uid)
        .order("created_at", { ascending: false });
      const rows: ActionRow[] = (data ?? []).map((b: any) => ({
        id: b.id, status: b.status, created_at: b.created_at,
        title: b.vehicle?.title ?? "Vehicle inquiry",
        subtitle: `${b.kind === "test_drive" ? "Test drive" : b.kind === "financing" ? "Financing" : "Inquiry"}${b.message ? " · " + b.message : ""}`,
        contact: { name: b.contact_name, phone: b.contact_phone, email: b.contact_email },
        meta: [
          b.preferred_date ? new Date(b.preferred_date).toLocaleDateString() : "",
          b.estimated_monthly ? `~$${b.estimated_monthly}/mo` : "",
        ].filter(Boolean) as string[],
        link: b.vehicle?.id ? `/auto/${b.vehicle.id}` : null,
      }));
      return { table: "vehicle_inquiries", rows };
    }
    case "properties": {
      const { data } = await supabase
        .from("property_inquiries")
        .select("id, status, created_at, inquirer_name, inquirer_phone, inquirer_email, preferred_date, message, property:properties!inner(id, title, owner_user_id)")
        .eq("property.owner_user_id", uid)
        .order("created_at", { ascending: false });
      const rows: ActionRow[] = (data ?? []).map((b: any) => ({
        id: b.id, status: b.status, created_at: b.created_at,
        title: b.property?.title ?? "Property inquiry",
        subtitle: b.message,
        contact: { name: b.inquirer_name, phone: b.inquirer_phone, email: b.inquirer_email },
        meta: [b.preferred_date ? new Date(b.preferred_date).toLocaleDateString() : ""].filter(Boolean) as string[],
        link: null,
      }));
      return { table: "property_inquiries", rows };
    }
    case "finance": {
      const { data } = await supabase
        .from("finance_applications")
        .select("id, status, created_at, applicant_name, applicant_phone, applicant_email, amount_requested, term_months, purpose, monthly_income, employment_status, notes, product:finance_products!inner(id, title, owner_user_id)")
        .eq("product.owner_user_id", uid)
        .order("created_at", { ascending: false });
      const rows: ActionRow[] = (data ?? []).map((b: any) => ({
        id: b.id, status: b.status, created_at: b.created_at,
        title: b.product?.title ?? "Finance application",
        subtitle: b.purpose,
        contact: { name: b.applicant_name, phone: b.applicant_phone, email: b.applicant_email },
        meta: [
          b.amount_requested ? `Wants $${Number(b.amount_requested).toLocaleString()}` : "",
          b.term_months ? `${b.term_months}mo` : "",
          b.monthly_income ? `Income $${Number(b.monthly_income).toLocaleString()}/mo` : "",
          b.employment_status || "",
        ].filter(Boolean) as string[],
      }));
      return { table: "finance_applications", rows };
    }
    case "industrial": case "agro": {
      const cats = section === "agro" ? AGRO_CATEGORIES : INDUSTRIAL_CATEGORIES;
      const { data } = await supabase
        .from("rfqs")
        .select("id, status, created_at, title, category, qty, unit, target_price, ship_to, details")
        .in("category", cats)
        .order("created_at", { ascending: false })
        .limit(50);
      const rows: ActionRow[] = (data ?? []).map((b: any) => ({
        id: b.id, status: b.status, created_at: b.created_at,
        title: b.title,
        subtitle: b.details,
        meta: [
          `${b.qty}${b.unit ? " " + b.unit : ""}`,
          b.target_price ? `Target $${Number(b.target_price).toLocaleString()}` : "",
          b.ship_to || "",
        ].filter(Boolean) as string[],
        link: "/rfq",
      }));
      return { table: "rfqs", rows };
    }
    case "pros": {
      // service requests in this provider's categories
      const { data: provs } = await supabase.from("service_providers").select("category").eq("user_id", uid);
      const cats = Array.from(new Set((provs ?? []).map((p: any) => p.category)));
      if (cats.length === 0) return { table: "service_requests", rows: [] };
      const { data } = await supabase
        .from("service_requests")
        .select("id, status, created_at, title, description, category, budget, currency, city, deadline")
        .in("category", cats)
        .order("created_at", { ascending: false })
        .limit(50);
      const rows: ActionRow[] = (data ?? []).map((b: any) => ({
        id: b.id, status: b.status, created_at: b.created_at,
        title: b.title,
        subtitle: b.description,
        meta: [
          b.category,
          b.budget ? `${b.currency} ${Number(b.budget).toLocaleString()}` : "",
          b.city || "",
          b.deadline ? `by ${new Date(b.deadline).toLocaleDateString()}` : "",
        ].filter(Boolean) as string[],
        link: "/services",
      }));
      return { table: "service_requests", rows };
    }
    case "driver":
    case "logistics":
      return { table: "", rows: [] };
  }
}

export default function ServiceActionsTab({ section }: { section: SectionKey }) {
  const { userId } = useAuthUser();
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["service-actions", section, userId],
    queryFn: () => fetchActions(section, userId!),
    enabled: !!userId,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!userId) return <p className="px-4 py-12 text-center text-sm text-muted-foreground">Sign in to see your inbox</p>;

  const table = data?.table ?? "";
  const rows = data?.rows ?? [];
  const statusOptions = STATUS_OPTIONS[table] ?? [];

  const updateStatus = async (id: string, status: string) => {
    if (!table) return;
    setBusyId(id);
    const { error } = await (supabase as any).from(table).update({ status }).eq("id", id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["service-actions", section, userId] });
  };

  return (
    <div className="px-3 pt-3 pb-8">
      <div className="flex items-center justify-between px-1 mb-3">
        <div>
          <h2 className="font-bold text-base flex items-center gap-2"><Inbox className="w-4 h-4" /> Actions inbox</h2>
          <p className="text-[11px] text-muted-foreground">Requests and bookings buyers send for this service.</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {section === "driver" || section === "logistics" ? (
        <EmptyState title="Coming soon" description="Driver and courier requests will appear here when buyers send them." />
      ) : isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No actions yet" description="When buyers submit requests or bookings, they'll land here." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <article key={r.id} className="bg-card border rounded-2xl p-3 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm leading-tight">{r.title}</p>
                  {r.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.subtitle}</p>}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-muted shrink-0">{r.status}</span>
              </div>

              {(r.meta && r.meta.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {r.meta.map((m, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/70 font-medium">{m}</span>
                  ))}
                </div>
              )}

              {r.contact && (r.contact.name || r.contact.phone || r.contact.email) && (
                <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                  {r.contact.name && <span className="font-bold">{r.contact.name}</span>}
                  {r.contact.phone && <a href={`tel:${r.contact.phone}`} className="flex items-center gap-1 text-primary"><Phone className="w-3 h-3" />{r.contact.phone}</a>}
                  {r.contact.email && <a href={`mailto:${r.contact.email}`} className="flex items-center gap-1 text-primary"><Mail className="w-3 h-3" />{r.contact.email}</a>}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t">
                <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                <div className="flex items-center gap-1.5">
                  {r.link && (
                    <a href={r.link} className="px-2 h-7 rounded-full bg-muted text-[10px] font-bold flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View
                    </a>
                  )}
                  {statusOptions.length > 0 && (
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      disabled={busyId === r.id}
                      className="h-7 rounded-full border bg-background px-2 text-[10px] font-bold"
                    >
                      {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
