import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Banknote, CreditCard, MessageSquare, Star, Settings as SettingsIcon, Check, X, RefreshCw, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";

const sb = supabase as any;
const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

type Tab = "topups" | "withdrawals" | "refunds" | "assurance" | "reviews" | "settings";

export default function Admin() {
  const { isAdmin, ready } = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("topups");

  useEffect(() => {
    if (ready && !isAdmin) {
      toast.error("Admins only");
      navigate("/account");
    }
  }, [ready, isAdmin, navigate]);

  if (!ready) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin) return null;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "topups", label: "Top-ups", icon: CreditCard },
    { id: "withdrawals", label: "Withdrawals", icon: Banknote },
    { id: "refunds", label: "Refunds", icon: RotateCcw },
    { id: "assurance", label: "Trade Assurance", icon: ShieldCheck },
    { id: "reviews", label: "Reviews", icon: Star },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="pb-16">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-bold text-lg flex-1">Platform Admin</h1>
      </header>

      <div className="px-3 py-2 overflow-x-auto flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold border transition ${
              tab === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "topups" && <ManualTopupsPanel />}
        {tab === "withdrawals" && <WithdrawalsPanel />}
        {tab === "assurance" && <AssurancePanel />}
        {tab === "reviews" && <ReviewsPanel />}
        {tab === "settings" && <PlatformSettingsPanel />}
      </div>
    </div>
  );
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
    <div>
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No top-ups in this view" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-3 shadow-card">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><CreditCard className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{r.profile?.display_name || r.profile?.username || r.user_id.slice(0, 8)}</p>
                  <p className="text-[11px] text-muted-foreground">Ref {r.reference} · {new Date(r.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums">{fmt(r.amount)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
              {r.note && <p className="text-[11px] text-muted-foreground mt-2 whitespace-pre-line">{r.note}</p>}
              {r.admin_note && <p className="text-[11px] mt-1 italic">Admin: {r.admin_note}</p>}
              {r.status === "pending" && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="flex-1 h-8" disabled={busy === r.id} onClick={() => decline(r.id)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Decline
                  </Button>
                  <Button size="sm" className="flex-1 h-8" disabled={busy === r.id} onClick={() => approve(r.id)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Approve & credit
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div>
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No withdrawals in this view" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-3 shadow-card">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center"><Banknote className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{r.profile?.display_name || r.profile?.username || r.user_id.slice(0, 8)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.method} · {r.destination}{r.account_name ? ` · ${r.account_name}` : ""}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.account ?? "personal"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums">{fmt(r.amount)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
              {r.notes && <p className="text-[11px] text-muted-foreground mt-2 whitespace-pre-line">User: {r.notes}</p>}
              {r.admin_note && <p className="text-[11px] mt-1 italic">Admin: {r.admin_note}</p>}
              {r.status === "pending" && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="flex-1 h-8" disabled={busy === r.id} onClick={() => decline(r.id)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Decline
                  </Button>
                  <Button size="sm" className="flex-1 h-8" disabled={busy === r.id} onClick={() => approve(r.id)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div>
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No inquiries" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-3 shadow-card">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${r.product_id}`} className="text-sm font-bold truncate block hover:underline">{r.product_title ?? "Product inquiry"}</Link>
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
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div>
      <FilterRow filter={filter} setFilter={setFilter} onRefresh={load} />
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No refund requests" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-3 shadow-card">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center"><RotateCcw className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{r.ref_code ?? String(r.id).slice(0, 8)} · {fmt(r.total)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">Buyer {String(r.buyer_id).slice(0, 8)} · order {r.status} · escrow {r.escrow_status}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={r.refund_status} />
              </div>
              {r.refund_reason && <p className="text-[11px] text-muted-foreground mt-2 whitespace-pre-line">Reason: {r.refund_reason}</p>}
              {r.refund_admin_note && <p className="text-[11px] text-muted-foreground mt-1">Note: {r.refund_admin_note}</p>}
              {r.refund_status === "requested" && (
                <>
                  <Field label="Admin note (optional)">
                    <input
                      value={note[r.id] ?? ""}
                      onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                      className="w-full h-9 rounded-xl border bg-background px-3 text-xs"
                      placeholder="Visible to the buyer"
                    />
                  </Field>
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
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={load} className="text-xs font-bold inline-flex items-center gap-1 px-2 h-7 rounded-md hover:bg-muted"><RefreshCw className="w-3 h-3" /> Refresh</button>
      </div>
      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No reviews" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-3 shadow-card">
              <div className="flex items-start gap-2">
                <span className="w-9 h-9 rounded-xl bg-yellow-500/15 text-yellow-700 flex items-center justify-center"><Star className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{"★".repeat(Math.round(Number(r.rating ?? 0)))}{"☆".repeat(Math.max(0, 5 - Math.round(Number(r.rating ?? 0))))}  <span className="text-[11px] text-muted-foreground font-normal">{new Date(r.created_at).toLocaleDateString()}</span></p>
                  {r.title && <p className="text-sm font-semibold">{r.title}</p>}
                  {r.body && <p className="text-[12px] text-muted-foreground whitespace-pre-line">{r.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">Product {String(r.product_id).slice(0, 8)} · User {String(r.user_id).slice(0, 8)}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8" onClick={() => remove(r.id)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

  if (loading) return <Empty label="Loading…" />;

  return (
    <div className="space-y-3 max-w-xl">
      <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-card">
        <div>
          <p className="text-sm font-black tracking-tight">Manual EcoCash top-up</p>
          <p className="text-[11px] text-muted-foreground">Users send EcoCash to this number to top up PUBSTORE Pay. You'll review references and approve.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
        </label>
        <Field label="EcoCash number">
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. 0771234567" className="w-full h-10 rounded-xl border bg-background px-3 text-sm" />
        </Field>
        <Field label="Account name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="PUBSTORE" className="w-full h-10 rounded-xl border bg-background px-3 text-sm" />
        </Field>
        <Field label="Instructions to users">
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} className="w-full rounded-xl border bg-background p-3 text-sm" />
        </Field>
        <Button onClick={save} disabled={saving} className="h-10"><Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

// ----------------------------- Shared bits ----------------------------------

function FilterRow({ filter, setFilter, onRefresh }: { filter: string; setFilter: (v: any) => void; onRefresh: () => void }) {
  const opts = ["pending", "approved", "declined", "all"] as const;
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex gap-1 overflow-x-auto">
        {opts.map((o) => (
          <button key={o} onClick={() => setFilter(o)} className={`px-2.5 h-7 rounded-full text-[11px] font-bold border capitalize ${filter === o ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>{o}</button>
        ))}
      </div>
      <button onClick={onRefresh} className="ml-auto text-xs font-bold inline-flex items-center gap-1 px-2 h-7 rounded-md hover:bg-muted"><RefreshCw className="w-3 h-3" /> Refresh</button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "approved"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : status === "declined"
    ? "bg-red-500/15 text-red-700 dark:text-red-300"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls} capitalize`}>{status}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function SkeletonList() {
  return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />)}</div>;
}

function Empty({ label }: { label: string }) {
  return <div className="text-center text-sm text-muted-foreground py-10">{label}</div>;
}
