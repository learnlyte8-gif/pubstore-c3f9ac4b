import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import CircleSpinner from "@/components/CircleSpinner";
import EmptyState from "@/components/EmptyState";

const sb = supabase as any;
const money = (n: any) => `$${Number(n ?? 0).toFixed(2)}`;

type Tab = "overview" | "commissions" | "promoters" | "payouts" | "fraud";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "commissions", label: "Commissions" },
  { id: "promoters", label: "Promoters" },
  { id: "payouts", label: "Payouts" },
  { id: "fraud", label: "Risk events" },
];

export default function PromotePanel() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 h-9 rounded-full text-xs font-bold border transition ${
              tab === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
            }`}
          >{t.label}</button>
        ))}
      </div>
      {tab === "overview" && <Overview />}
      {tab === "commissions" && <Commissions />}
      {tab === "promoters" && <Promoters />}
      {tab === "payouts" && <Payouts />}
      {tab === "fraud" && <Fraud />}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3 bg-card">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Overview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-promote-overview"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("admin_promote_overview");
      if (error) throw error;
      return data as any;
    },
  });
  if (isLoading) return <CircleSpinner size={26} />;
  const o = data ?? {};
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <Card label="Promoters" value={String(o.promoters ?? 0)} />
      <Card label="Active promoters" value={String(o.active_promoters ?? 0)} />
      <Card label="Clicks" value={String(o.clicks ?? 0)} />
      <Card label="Attributed orders" value={String(o.attributed_orders ?? 0)} />
      <Card label="Pending commission" value={money(o.commission_pending)} />
      <Card label="Available commission" value={money(o.commission_available)} />
      <Card label="Paid out" value={money(o.commission_paid)} />
      <Card label="Reversed" value={money(o.commission_reversed)} />
      <Card label="Promoter GMV" value={money(o.promoter_gmv)} />
      <Card label="Open risk events" value={String(o.fraud_open ?? 0)} />
    </div>
  );
}

const STATUSES = ["pending", "confirmed", "available", "paid", "reversed"];

function Commissions() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-commissions", status],
    queryFn: async () => {
      let q = sb.from("commissions").select("*").order("created_at", { ascending: false }).limit(200);
      if (status) q = q.eq("status", status);
      const { data } = await q;
      return data ?? [];
    },
  });

  const setStatusFor = async (id: string, next: string) => {
    const { error } = await sb.rpc("admin_set_commission_status", { _commission_id: id, _status: next, _reason: "admin console" });
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${next}`);
    qc.invalidateQueries({ queryKey: ["admin-commissions"] });
    qc.invalidateQueries({ queryKey: ["admin-promote-overview"] });
  };

  if (isLoading) return <CircleSpinner size={26} />;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {["", ...STATUSES].map((s) => (
          <button key={s || "all"} onClick={() => setStatus(s)}
            className={`px-3 h-8 rounded-full text-xs font-semibold border ${status === s ? "bg-foreground text-background" : "bg-card"}`}>
            {s || "All"}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState title="No commissions" description="Attributed sales will appear here." /> : (
        <div className="rounded-xl border divide-y">
          {rows.map((r: any) => (
            <div key={r.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{money(r.commission_amount)} · {r.status}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  promoter {r.promoter_id?.slice(0, 8)} · order {r.order_id?.slice(0, 8)} · {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setStatusFor(r.id, "available")}>Release</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setStatusFor(r.id, "reversed")}>Reverse</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Promoters() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-promoters"],
    queryFn: async () => {
      const { data } = await sb.from("promoter_profiles").select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const toggleHold = async (id: string, frozen: boolean) => {
    const { error } = await sb.rpc("admin_set_promoter_hold", { _promoter_id: id, _frozen: frozen, _reason: "admin console" });
    if (error) { toast.error(error.message); return; }
    toast.success(frozen ? "Promoter put on hold" : "Hold removed");
    qc.invalidateQueries({ queryKey: ["admin-promoters"] });
  };

  if (isLoading) return <CircleSpinner size={26} />;
  if (rows.length === 0) return <EmptyState title="No promoters yet" description="People who join Promote & Earn show up here." />;

  return (
    <div className="rounded-xl border divide-y">
      {rows.map((p: any) => (
        <div key={p.user_id} className="p-3 flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Code {p.code} · level {p.level}</p>
            <p className="text-[11px] text-muted-foreground">
              risk {p.risk_band ?? "n/a"} ({Number(p.risk_score ?? 0).toFixed(0)}) · {p.frozen ? "on hold" : "active"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => toggleHold(p.user_id, !p.frozen)}>
            {p.frozen ? "Remove hold" : "Put on hold"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function Payouts() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-promoter-payouts"],
    queryFn: async () => {
      const { data } = await sb.from("promoter_payouts").select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  if (isLoading) return <CircleSpinner size={26} />;
  if (rows.length === 0) return <EmptyState title="No payouts yet" description="Promoter withdrawals appear here." />;
  return (
    <div className="rounded-xl border divide-y">
      {rows.map((p: any) => (
        <div key={p.id} className="p-3">
          <p className="text-sm font-semibold">{money(p.amount)} · {p.status}</p>
          <p className="text-[11px] text-muted-foreground">
            promoter {p.promoter_id?.slice(0, 8)} · {new Date(p.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

function Fraud() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-promoter-fraud"],
    queryFn: async () => {
      const { data } = await sb.from("promoter_fraud_events").select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  if (isLoading) return <CircleSpinner size={26} />;
  if (rows.length === 0) return <EmptyState title="Nothing suspicious" description="Self-purchases and other risk signals appear here." />;
  return (
    <div className="rounded-xl border divide-y">
      {rows.map((f: any) => (
        <div key={f.id} className="p-3">
          <p className="text-sm font-semibold">{f.kind} · {f.severity ?? "info"}</p>
          <p className="text-[11px] text-muted-foreground">
            promoter {f.promoter_id?.slice(0, 8)} · {new Date(f.created_at).toLocaleString()}
          </p>
          {f.detail ? <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap">{JSON.stringify(f.detail)}</pre> : null}
        </div>
      ))}
    </div>
  );
}
