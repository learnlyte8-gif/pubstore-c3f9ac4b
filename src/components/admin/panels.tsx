import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ShieldCheck, Users, Store, Package, ShoppingBag, Flag, Megaphone, Newspaper, Ticket, Sparkles,
  Crown, CreditCard, Banknote, RotateCcw, Check, X, ExternalLink, Search, Eye, EyeOff, BadgeCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConsolePage, Card, StatCard, FilterRow, StatusBadge, SkeletonList, Empty, Row, fmt } from "@/components/admin/ui";

const sb = supabase as any;

const useProfiles = (ids: string[]) => {
  const [map, setMap] = useState<Map<string, any>>(new Map());
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) { setMap(new Map()); return; }
    (async () => {
      const { data } = await sb.from("profiles").select("user_id,display_name,username,avatar_url").in("user_id", ids);
      setMap(new Map((data ?? []).map((p: any) => [p.user_id, p])));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
};

const who = (p: any, id: string) => p?.display_name || p?.username || String(id ?? "").slice(0, 8);

// ------------------------------- Overview -----------------------------------

export function OverviewPanel() {
  const [s, setS] = useState<any>(null);

  const load = async () => {
    const count = async (table: string, build?: (q: any) => any) => {
      let q = sb.from(table).select("id", { count: "exact", head: true });
      if (build) q = build(q);
      const { count: c } = await q;
      return c ?? 0;
    };
    const [verif, topups, withdrawals, refunds, reports, orders, products, suppliers] = await Promise.all([
      (async () => (await sb.from("user_verifications").select("id", { count: "exact", head: true }).eq("status", "pending")).count ?? 0)(),
      count("manual_topups", (q) => q.eq("status", "pending")),
      count("withdrawal_requests", (q) => q.eq("status", "pending")),
      count("orders", (q) => q.eq("refund_status", "requested")),
      count("user_reports", (q) => q.eq("status", "pending")),
      count("orders"),
      count("products", (q) => q.eq("active", true)),
      count("suppliers"),
    ]);
    setS({ verif, topups, withdrawals, refunds, reports, orders, products, suppliers });
  };
  useEffect(() => { load(); }, []);

  return (
    <ConsolePage title="Platform overview" description="Everything waiting on an admin decision, at a glance.">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Needs attention</p>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={ShieldCheck} label="Verifications" value={s?.verif ?? "—"} hint="pending review" to="/admin/verifications" />
        <StatCard icon={CreditCard} label="Top-ups" value={s?.topups ?? "—"} hint="awaiting approval" to="/admin/topups" />
        <StatCard icon={Banknote} label="Withdrawals" value={s?.withdrawals ?? "—"} hint="awaiting payout" to="/admin/withdrawals" />
        <StatCard icon={RotateCcw} label="Refunds" value={s?.refunds ?? "—"} hint="requested" to="/admin/refunds" />
        <StatCard icon={Flag} label="Reports" value={s?.reports ?? "—"} hint="unreviewed" to="/admin/reports" />
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Marketplace</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ShoppingBag} label="Orders" value={s?.orders ?? "—"} hint="all time" to="/admin/orders" />
        <StatCard icon={Package} label="Live products" value={s?.products ?? "—"} to="/admin/products" />
        <StatCard icon={Store} label="Stores" value={s?.suppliers ?? "—"} to="/admin/suppliers" />
        <StatCard icon={Crown} label="Plans" value="Manage" hint="tiers & commission" to="/admin/plans" />
      </div>
    </ConsolePage>
  );
}

// ---------------------------- Verifications ---------------------------------

export function VerificationsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const profiles = useProfiles(useMemo(() => Array.from(new Set(rows.map((r) => r.user_id))), [rows]));

  const load = async () => {
    setLoading(true);
    let q = sb.from("user_verifications").select("*").order("submitted_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const openDoc = async (path: string) => {
    if (/^https?:/.test(path)) return window.open(path, "_blank");
    const { data, error } = await sb.storage.from("verifications").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Could not open document");
    window.open(data.signedUrl, "_blank");
  };

  const review = async (id: string, status: "approved" | "rejected") => {
    const notes = status === "rejected" ? prompt("Reason shown to the user (optional)") ?? null : null;
    setBusy(id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await sb.from("user_verifications")
      .update({ status, notes, reviewer_id: user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Identity approved" : "Verification rejected");
    load();
  };

  return (
    <ConsolePage title="Identity verification" description="Review submitted ID documents. Approving unlocks cash on delivery and higher withdrawal limits.">
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} options={["pending", "approved", "rejected", "all"]} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="Nothing in this view" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <Link to={`/u/${r.user_id}`} className="text-[13px] font-semibold hover:underline truncate block">
                    {who(profiles.get(r.user_id), r.user_id)}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">Submitted {new Date(r.submitted_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="outline" className="h-8" onClick={() => openDoc(r.id_card_url)}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> ID card
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => openDoc(r.proof_residency_url)}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Proof of residency
                </Button>
                {r.status !== "approved" && (
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" className="h-8" disabled={busy === r.id} onClick={() => review(r.id, "rejected")}>
                      <X className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                    <Button size="sm" className="h-8" disabled={busy === r.id} onClick={() => review(r.id, "approved")}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                  </div>
                )}
              </div>
              {r.notes && <p className="text-[11px] text-muted-foreground mt-2">Note: {r.notes}</p>}
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// ------------------------------- Reports ------------------------------------

export function ReportsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const ids = useMemo(() => Array.from(new Set(rows.flatMap((r) => [r.reporter_id, r.reported_id]))), [rows]);
  const profiles = useProfiles(ids);

  const load = async () => {
    setLoading(true);
    let q = sb.from("user_reports").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await sb.from("user_reports").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  };

  return (
    <ConsolePage title="Reports & abuse" description="User-submitted reports about accounts, listings and messages.">
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} options={["pending", "reviewing", "resolved", "dismissed", "all"]} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No reports" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"><Flag className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{r.reason}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {who(profiles.get(r.reporter_id), r.reporter_id)} reported {who(profiles.get(r.reported_id), r.reported_id)}
                    {r.content_type ? ` · ${r.content_type}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.description && <p className="text-[12px] text-muted-foreground mt-2 whitespace-pre-line">{r.description}</p>}
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus(r.id, "dismissed")}>Dismiss</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus(r.id, "reviewing")}>Reviewing</Button>
                <Button size="sm" className="h-8" onClick={() => setStatus(r.id, "resolved")}><Check className="w-3.5 h-3.5 mr-1" /> Resolve</Button>
              </div>
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// -------------------------------- Orders ------------------------------------

export function OrdersPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    let q = sb.from("orders")
      .select("id,ref_code,total,status,escrow_status,payment_status,refund_status,buyer_id,supplier_id,courier_id,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  return (
    <ConsolePage title="Orders & escrow" description="Every order on the platform with its payment and escrow state.">
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load}
        options={["all", "awaiting_payment", "placed", "processing", "shipped", "delivered", "cancelled"]} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No orders" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Escrow</th>
                <th className="px-3 py-2 font-medium">Refund</th>
                <th className="px-3 py-2 font-medium">Placed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.ref_code ?? String(r.id).slice(0, 8)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(r.total)}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2"><StatusBadge status={r.escrow_status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{r.refund_status ?? "none"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </ConsolePage>
  );
}

// ------------------------------- Suppliers ----------------------------------

export function SuppliersPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await sb.from("suppliers")
      .select("id,name,slug,owner_id,verified,gold,trade_assurance,country,city,created_at")
      .order("created_at", { ascending: false }).limit(300);
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (id: string, field: string, value: boolean) => {
    const { error } = await sb.from("suppliers").update({ [field]: value }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Store updated");
    load();
  };

  const filtered = rows.filter((r) => !q || `${r.name} ${r.slug} ${r.city} ${r.country}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <ConsolePage
      title="Stores"
      description="Verify, badge and audit seller accounts."
      actions={
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stores" className="h-9 w-[240px] rounded-md border bg-background pl-9 pr-3 text-[13px]" />
        </div>
      }
    >
      {loading ? <SkeletonList /> : filtered.length === 0 ? <Empty label="No stores" /> : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Row key={r.id}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Store className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <Link to={`/supplier/${r.slug ?? r.id}`} className="text-[13px] font-semibold hover:underline truncate block">{r.name}</Link>
                  <p className="text-[11px] text-muted-foreground truncate">{[r.city, r.country].filter(Boolean).join(", ") || "No location"} · joined {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={r.verified ? "default" : "outline"} className="h-8" onClick={() => toggle(r.id, "verified", !r.verified)}>
                    <BadgeCheck className="w-3.5 h-3.5 mr-1" /> {r.verified ? "Verified" : "Verify"}
                  </Button>
                  <Button size="sm" variant={r.trade_assurance ? "default" : "outline"} className="h-8" onClick={() => toggle(r.id, "trade_assurance", !r.trade_assurance)}>
                    Assurance
                  </Button>
                  <Button size="sm" variant={r.gold ? "default" : "outline"} className="h-8" onClick={() => toggle(r.id, "gold", !r.gold)}>
                    Gold
                  </Button>
                </div>
              </div>
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// -------------------------------- Products ----------------------------------

export function ProductsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    let query = sb.from("products").select("id,title,price,active,supplier_id,created_at,image").order("created_at", { ascending: false }).limit(300);
    if (filter === "live") query = query.eq("active", true);
    if (filter === "hidden") query = query.eq("active", false);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const setActive = async (id: string, active: boolean) => {
    const { error } = await sb.from("products").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Product published" : "Product hidden");
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Permanently delete this product?")) return;
    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Product deleted");
    load();
  };

  const filtered = rows.filter((r) => !q || String(r.title).toLowerCase().includes(q.toLowerCase()));

  return (
    <ConsolePage
      title="Products"
      description="Moderate listings across every store — hide policy violations or remove them entirely."
      actions={
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="h-9 w-[240px] rounded-md border bg-background pl-9 pr-3 text-[13px]" />
        </div>
      }
    >
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} options={["all", "live", "hidden"]} />
      {loading ? <SkeletonList /> : filtered.length === 0 ? <Empty label="No products" /> : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Row key={r.id}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                  {r.image && <img src={r.image} alt={r.title} className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${r.id}`} className="text-[13px] font-semibold hover:underline truncate block">{r.title}</Link>
                  <p className="text-[11px] text-muted-foreground">{fmt(r.price)} · {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={r.active ? "active" : "hidden"} />
                <Button size="sm" variant="outline" className="h-8" onClick={() => setActive(r.id, !r.active)}>
                  {r.active ? <><EyeOff className="w-3.5 h-3.5 mr-1" /> Hide</> : <><Eye className="w-3.5 h-3.5 mr-1" /> Publish</>}
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => remove(r.id)}><X className="w-3.5 h-3.5" /></Button>
              </div>
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// ---------------------------------- Ads -------------------------------------

export function AdsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("ad_campaigns").select("*").order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <ConsolePage title="Ad campaigns" description="Live sponsored placements, spend and delivery.">
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No campaigns" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Campaign</th>
                <th className="px-3 py-2 font-medium">Placement</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Spend</th>
                <th className="px-3 py-2 font-medium">Impr.</th>
                <th className="px-3 py-2 font-medium">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{r.placement}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 tabular-nums">{fmt(r.total_spent)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.impressions ?? 0}</td>
                  <td className="px-3 py-2 tabular-nums">{r.clicks ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </ConsolePage>
  );
}

// -------------------------------- Coupons -----------------------------------

export function CouponsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("coupons").select("*").order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <ConsolePage title="Coupons" description="Discount codes issued by stores across the marketplace.">
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No coupons" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Discount</th>
                <th className="px-3 py-2 font-medium">Min. spend</th>
                <th className="px-3 py-2 font-medium">Uses</th>
                <th className="px-3 py-2 font-medium">Expires</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium uppercase">{r.code}</td>
                  <td className="px-3 py-2">{r.discount_type === "percent" ? `${r.discount_value}%` : fmt(r.discount_value)}</td>
                  <td className="px-3 py-2">{r.min_subtotal ? fmt(r.min_subtotal) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{r.uses_count ?? 0}{r.max_uses ? ` / ${r.max_uses}` : ""}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.active ? "active" : "declined"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </ConsolePage>
  );
}

// ---------------------------------- News ------------------------------------

export function NewsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("news_articles").select("id,slug,title,category,featured,published_at,views").order("published_at", { ascending: false }).limit(200);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleFeatured = async (id: string, featured: boolean) => {
    const { error } = await sb.from("news_articles").update({ featured }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    const { error } = await sb.from("news_articles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Article deleted");
    load();
  };

  return (
    <ConsolePage
      title="News & editorial"
      description="Curate the newsroom feed."
      actions={<Link to="/store/services/news"><Button size="sm" className="h-9"><Newspaper className="w-4 h-4 mr-1" /> Write article</Button></Link>}
    >
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No articles" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Newspaper className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground">{r.category ?? "General"} · {r.published_at ? new Date(r.published_at).toLocaleDateString() : "unpublished"} · {r.views ?? 0} views</p>
                </div>
                <Button size="sm" variant={r.featured ? "default" : "outline"} className="h-8" onClick={() => toggleFeatured(r.id, !r.featured)}>Featured</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => remove(r.id)}><X className="w-3.5 h-3.5" /></Button>
              </div>
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// ----------------------------- Users & roles ---------------------------------

export function UsersPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [roles, setRoles] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("profiles")
      .select("user_id,display_name,username,avatar_url,created_at,buyer_tier,supplier_tier")
      .order("created_at", { ascending: false }).limit(300);
    const { data: rr } = await sb.from("user_roles").select("user_id,role");
    const m = new Map<string, string[]>();
    (rr ?? []).forEach((r: any) => m.set(r.user_id, [...(m.get(r.user_id) ?? []), r.role]));
    setRoles(m);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, role: string, on: boolean) => {
    const { error } = on
      ? await sb.from("user_roles").insert({ user_id: userId, role })
      : await sb.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) return toast.error(error.message);
    toast.success(`Role ${on ? "granted" : "revoked"}`);
    load();
  };

  const filtered = rows.filter((r) => !q || `${r.display_name} ${r.username}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <ConsolePage
      title="Users & roles"
      description="Grant admin access, review tiers and look up accounts."
      actions={
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users" className="h-9 w-[240px] rounded-md border bg-background pl-9 pr-3 text-[13px]" />
        </div>
      }
    >
      {loading ? <SkeletonList /> : filtered.length === 0 ? <Empty label="No users" /> : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const rs = roles.get(r.user_id) ?? [];
            return (
              <Row key={r.user_id}>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                    {r.avatar_url ? <img src={r.avatar_url} alt={r.display_name ?? "User"} className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-muted-foreground" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link to={`/u/${r.user_id}`} className="text-[13px] font-semibold hover:underline truncate block">{who(r, r.user_id)}</Link>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.username ? `@${r.username} · ` : ""}buyer {r.buyer_tier ?? "—"} · supplier {r.supplier_tier ?? "—"}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {(["admin", "supplier", "buyer"] as const).map((role) => (
                      <Button
                        key={role}
                        size="sm"
                        variant={rs.includes(role) ? "default" : "outline"}
                        className="h-8 capitalize"
                        onClick={() => setRole(r.user_id, role, !rs.includes(role))}
                      >
                        {role}
                      </Button>
                    ))}
                  </div>
                </div>
              </Row>
            );
          })}
        </div>
      )}
    </ConsolePage>
  );
}

// ------------------------------- AI credits ----------------------------------

export function AiCreditsPanel() {
  const [plans, setPlans] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [p, c, k] = await Promise.all([
        sb.from("ai_plans").select("*").order("sort_order"),
        sb.from("ai_feature_costs").select("*"),
        sb.from("ai_credit_packs").select("*"),
      ]);
      setPlans(p.data ?? []);
      setCosts(c.data ?? []);
      setPacks(k.data ?? []);
    })();
  }, []);

  return (
    <ConsolePage title="AI credits" description="Plans, top-up packs and what each AI feature costs a user.">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-[13px] font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Plans</p>
          <div className="space-y-2">
            {plans.map((p) => (
              <div key={p.code} className="flex items-center gap-2 text-[12px] border-b last:border-0 pb-2">
                <span className="font-medium flex-1">{p.name}</span>
                <span className="tabular-nums">{fmt(p.price_usd)}/mo</span>
                <span className="text-muted-foreground tabular-nums">{p.monthly_credits} cr</span>
              </div>
            ))}
            {plans.length === 0 && <p className="text-[12px] text-muted-foreground">No plans configured.</p>}
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-semibold mb-3">Top-up packs</p>
          <div className="space-y-2">
            {packs.map((p) => (
              <div key={p.code} className="flex items-center gap-2 text-[12px] border-b last:border-0 pb-2">
                <span className="font-medium flex-1">{p.name ?? p.code}</span>
                <span className="tabular-nums">{fmt(p.price_usd)}</span>
                <span className="text-muted-foreground tabular-nums">{p.credits} cr</span>
              </div>
            ))}
            {packs.length === 0 && <p className="text-[12px] text-muted-foreground">No packs configured.</p>}
          </div>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <p className="text-[13px] font-semibold mb-3">Feature costs</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {costs.map((c) => (
              <div key={c.feature} className="flex items-center justify-between text-[12px] rounded-lg border px-3 py-2">
                <span className="truncate">{c.feature}</span>
                <span className="font-semibold tabular-nums">{c.credits ?? c.cost_credits} cr</span>
              </div>
            ))}
            {costs.length === 0 && <p className="text-[12px] text-muted-foreground">No feature costs configured.</p>}
          </div>
        </Card>
      </div>
    </ConsolePage>
  );
}

// --------------------------- Plans & commission -------------------------------

export function PlansPanel() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await sb.from("supplier_plans").select("*").order("sort");
      setRows(data ?? []);
    })();
  }, []);

  return (
    <ConsolePage title="Plans & commission" description="Seller tiers, their commission rate and listing caps. Subscriptions are purchased on the web only.">
      <div className="grid md:grid-cols-3 gap-4">
        {rows.map((p) => (
          <Card key={p.code} className="p-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              <p className="text-[15px] font-semibold">{p.name}</p>
              <StatusBadge status={p.is_active ? "active" : "declined"} />
            </div>
            <p className="text-[24px] font-semibold tracking-tight mt-2">{fmt(p.price_usd)}<span className="text-[12px] text-muted-foreground font-normal">/mo</span></p>
            <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
              <li>Commission {(Number(p.commission_rate) * 100).toFixed(1)}%</li>
              <li>{p.product_limit ? `${p.product_limit} listings` : "Unlimited listings"}</li>
              {(p.perks ?? []).map?.((perk: string) => <li key={perk}>{perk}</li>)}
            </ul>
          </Card>
        ))}
        {rows.length === 0 && <Empty label="No plans configured" />}
      </div>
    </ConsolePage>
  );
}
