import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Banknote, CreditCard, Star, Check, X, Save, RotateCcw, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { adminNavGroups } from "@/components/admin/adminNav";
import { ConsolePage, Card, FilterRow, StatusBadge, SkeletonList, Empty, Row, Field, fmt } from "@/components/admin/ui";
import {
  OverviewPanel, VerificationsPanel, ReportsPanel, OrdersPanel, SuppliersPanel,
  ProductsPanel, AdsPanel, CouponsPanel, NewsPanel, UsersPanel, AiCreditsPanel, PlansPanel,
} from "@/components/admin/panels";

const sb = supabase as any;

export default function Admin() {
  const { isAdmin, ready } = useIsAdmin();
  const navigate = useNavigate();
  const { section = "" } = useParams();

  useEffect(() => {
    if (ready && !isAdmin) {
      toast.error("Admins only");
      navigate("/account");
    }
  }, [ready, isAdmin, navigate]);

  if (!ready) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin) return null;

  return (
    <div className="pb-16 lg:pb-0">
      {/* Mobile chrome — desktop uses the console shell */}
      <div className="lg:hidden">
        <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
          <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="font-bold text-lg flex-1">Platform Admin</h1>
        </header>
        <div className="px-3 py-2 overflow-x-auto flex gap-2 border-b">
          {adminNavGroups.flatMap((g) => g.items).map((i) => (
            <Link
              key={i.label}
              to={i.section ? `/admin/${i.section}` : "/admin"}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold border transition ${
                i.section === section ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
              }`}
            >
              <i.icon className="w-3.5 h-3.5" /> {i.label}
            </Link>
          ))}
        </div>
      </div>

      <AdminSection section={section} />
    </div>
  );
}

function AdminSection({ section }: { section: string }) {
  switch (section) {
    case "": return <OverviewPanel />;
    case "verifications": return <VerificationsPanel />;
    case "reports": return <ReportsPanel />;
    case "reviews": return <ReviewsPanel />;
    case "assurance": return <AssurancePanel />;
    case "topups": return <ManualTopupsPanel />;
    case "withdrawals": return <WithdrawalsPanel />;
    case "refunds": return <RefundsPanel />;
    case "orders": return <OrdersPanel />;
    case "suppliers": return <SuppliersPanel />;
    case "products": return <ProductsPanel />;
    case "ads": return <AdsPanel />;
    case "coupons": return <CouponsPanel />;
    case "news": return <NewsPanel />;
    case "users": return <UsersPanel />;
    case "ai": return <AiCreditsPanel />;
    case "plans": return <PlansPanel />;
    case "settings": return <PlatformSettingsPanel />;
    default: return <ConsolePage title="Not found"><Empty label="Unknown admin section" /></ConsolePage>;
  }
}

// ----------------------------- Manual Top-ups -------------------------------

function ManualTopupsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "declined" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = sb.from("manual_topups").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    const userIds = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
    const { data: profs } = userIds.length ? await sb.from("profiles").select("user_id,display_name,username").in("user_id", userIds) : { data: [] };
    const pmap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    setRows((data ?? []).map((r: any) => ({ ...r, profile: pmap.get(r.user_id) })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await sb.rpc("approve_manual_topup", { _id: id, _admin_note: null });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Top-up approved & credited");
    load();
  };
  const decline = async (id: string) => {
    const reason = prompt("Reason for declining (optional)") ?? null;
    setBusy(id);
    const { error } = await sb.rpc("decline_manual_topup", { _id: id, _admin_note: reason });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Top-up declined");
    load();
  };

  return (
    <ConsolePage title="Manual top-ups" description="EcoCash transfers users say they've sent. Approving credits their PUBSTORE Pay wallet.">
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No top-ups in this view" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><CreditCard className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{r.profile?.display_name || r.profile?.username || r.user_id.slice(0, 8)}</p>
                  <p className="text-[11px] text-muted-foreground">Ref {r.reference} · {new Date(r.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold tabular-nums">{fmt(r.amount)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
              {r.note && <p className="text-[11px] text-muted-foreground mt-2 whitespace-pre-line">{r.note}</p>}
              {r.admin_note && <p className="text-[11px] mt-1 italic">Admin: {r.admin_note}</p>}
              {r.status === "pending" && (
                <div className="flex gap-2 mt-2 justify-end">
                  <Button size="sm" variant="outline" className="h-8" disabled={busy === r.id} onClick={() => decline(r.id)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Decline
                  </Button>
                  <Button size="sm" className="h-8" disabled={busy === r.id} onClick={() => approve(r.id)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Approve & credit
                  </Button>
                </div>
              )}
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// ----------------------------- Withdrawals ----------------------------------

function WithdrawalsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "declined" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = sb.from("withdrawal_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    const userIds = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
    const { data: profs } = userIds.length ? await sb.from("profiles").select("user_id,display_name,username").in("user_id", userIds) : { data: [] };
    const pmap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    setRows((data ?? []).map((r: any) => ({ ...r, profile: pmap.get(r.user_id) })));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await sb.rpc("approve_withdrawal_request", { _id: id, _admin_note: null });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal approved");
    load();
  };
  const decline = async (id: string) => {
    const reason = prompt("Reason for declining (refunds the held funds)") ?? null;
    setBusy(id);
    const { error } = await sb.rpc("decline_withdrawal_request", { _id: id, _admin_note: reason });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal declined & refunded");
    load();
  };

  return (
    <ConsolePage title="Withdrawals" description="Payout requests. Approve once the money has actually been sent.">
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No withdrawals in this view" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center"><Banknote className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{r.profile?.display_name || r.profile?.username || r.user_id.slice(0, 8)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.method} · {r.destination}{r.account_name ? ` · ${r.account_name}` : ""}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.account ?? "personal"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold tabular-nums">{fmt(r.amount)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
              {r.notes && <p className="text-[11px] text-muted-foreground mt-2 whitespace-pre-line">User: {r.notes}</p>}
              {r.admin_note && <p className="text-[11px] mt-1 italic">Admin: {r.admin_note}</p>}
              {r.status === "pending" && (
                <div className="flex gap-2 mt-2 justify-end">
                  <Button size="sm" variant="outline" className="h-8" disabled={busy === r.id} onClick={() => decline(r.id)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Decline
                  </Button>
                  <Button size="sm" className="h-8" disabled={busy === r.id} onClick={() => approve(r.id)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                </div>
              )}
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// ----------------------------- Trade Assurance ------------------------------

function AssurancePanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "declined" | "all">("pending");

  const load = async () => {
    setLoading(true);
    let q = sb.from("product_inquiries").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const remove = async (id: string) => {
    if (!confirm("Delete this inquiry (e.g. fraudulent)?")) return;
    const { error } = await sb.from("product_inquiries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Inquiry removed");
    load();
  };

  return (
    <ConsolePage title="Trade assurance" description="Buyer-to-seller purchase requests protected by escrow.">
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No inquiries" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-700 flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${r.product_id}`} className="text-[13px] font-semibold truncate block hover:underline">{r.product_title ?? "Product inquiry"}</Link>
                  <p className="text-[11px] text-muted-foreground truncate">Buyer {String(r.buyer_id).slice(0, 8)} → Supplier {String(r.supplier_id).slice(0, 8)}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.message && <p className="text-[11px] text-muted-foreground mt-2 whitespace-pre-line">{r.message}</p>}
              <div className="flex justify-end mt-2">
                <Button size="sm" variant="outline" className="h-8" onClick={() => remove(r.id)}>
                  <X className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              </div>
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// ----------------------------- Refunds --------------------------------------

function RefundsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"requested" | "refunded" | "declined" | "all">("requested");
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    let q = sb.from("orders")
      .select("id,ref_code,total,status,buyer_id,supplier_id,refund_status,refund_reason,refund_admin_note,escrow_status,escrow_amount,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    q = filter === "all" ? q.neq("refund_status", "none") : q.eq("refund_status", filter);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const resolve = async (id: string, approve: boolean) => {
    const { error } = await sb.rpc("resolve_order_refund", {
      _order_id: id,
      _approve: approve,
      _admin_note: note[id] ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Refund issued to buyer wallet" : "Refund declined");
    load();
  };

  return (
    <ConsolePage title="Refunds" description="Buyer refund requests on escrow-protected orders.">
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} options={["requested", "refunded", "declined", "all"]} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No refund requests" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center"><RotateCcw className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{r.ref_code ?? String(r.id).slice(0, 8)} · {fmt(r.total)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">Buyer {String(r.buyer_id).slice(0, 8)} · order {r.status} · escrow {r.escrow_status}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={r.refund_status} />
              </div>
              {r.refund_reason && <p className="text-[11px] text-muted-foreground mt-2 whitespace-pre-line">Reason: {r.refund_reason}</p>}
              {r.refund_admin_note && <p className="text-[11px] text-muted-foreground mt-1">Note: {r.refund_admin_note}</p>}
              {r.refund_status === "requested" && (
                <>
                  <div className="mt-2">
                    <Field label="Admin note (optional)">
                      <input
                        value={note[r.id] ?? ""}
                        onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                        className="w-full h-9 rounded-md border bg-background px-3 text-xs"
                        placeholder="Visible to the buyer"
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => resolve(r.id, false)}>
                      <X className="w-3.5 h-3.5 mr-1" /> Decline
                    </Button>
                    <Button size="sm" className="h-8" onClick={() => resolve(r.id, true)}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Refund buyer
                    </Button>
                  </div>
                </>
              )}
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// ----------------------------- Reviews --------------------------------------

function ReviewsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("reviews").select("*").order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    const { error } = await sb.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Review removed");
    load();
  };

  return (
    <ConsolePage title="Reviews" description="Moderate product reviews across the marketplace.">
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No reviews" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-yellow-500/15 text-yellow-700 flex items-center justify-center"><Star className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold">
                    {"★".repeat(Math.round(Number(r.rating ?? 0)))}{"☆".repeat(Math.max(0, 5 - Math.round(Number(r.rating ?? 0))))}
                    <span className="text-[11px] text-muted-foreground font-normal"> {new Date(r.created_at).toLocaleDateString()}</span>
                  </p>
                  {r.title && <p className="text-[13px] font-medium">{r.title}</p>}
                  {r.body && <p className="text-[12px] text-muted-foreground whitespace-pre-line">{r.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">Product {String(r.product_id).slice(0, 8)} · User {String(r.user_id).slice(0, 8)}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8" onClick={() => remove(r.id)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Row>
          ))}
        </div>
      )}
    </ConsolePage>
  );
}

// ----------------------------- Platform Settings ----------------------------

function PlatformSettingsPanel() {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("platform_settings").select("value").eq("key", "manual_topup").maybeSingle();
      const v = (data?.value ?? {}) as any;
      setNumber(v.number ?? "");
      setName(v.name ?? "");
      setInstructions(v.instructions ?? "");
      setEnabled(v.enabled !== false);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const value = { enabled, number: number.trim(), name: name.trim(), instructions: instructions.trim() };
    const { error } = await sb.from("platform_settings").upsert({ key: "manual_topup", value, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  return (
    <ConsolePage title="Platform settings" description="Global switches that affect every user.">
      {loading ? <SkeletonList /> : (
        <Card className="p-4 space-y-3 max-w-xl">
          <div>
            <p className="text-[13px] font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Manual EcoCash top-up</p>
            <p className="text-[11px] text-muted-foreground">Users send EcoCash to this number to top up PUBSTORE Pay. You review references and approve them under Manual top-ups.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
          </label>
          <Field label="EcoCash number">
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. 0771234567" className="w-full h-10 rounded-md border bg-background px-3 text-sm" />
          </Field>
          <Field label="Account name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="PUBSTORE" className="w-full h-10 rounded-md border bg-background px-3 text-sm" />
          </Field>
          <Field label="Instructions to users">
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} className="w-full rounded-md border bg-background p-3 text-sm" />
          </Field>
          <Button onClick={save} disabled={saving} className="h-10"><Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save"}</Button>
        </Card>
      )}
    </ConsolePage>
  );
}
