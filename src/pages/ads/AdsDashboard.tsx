import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pause, Play, BarChart3, Megaphone, MousePointerClick, Eye, DollarSign, Gift } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { fetchMySupplier } from "@/data/products";

const sb = supabase as any;

const PLACEMENT_LABEL: Record<string, string> = {
  banner: "Sticky banner",
  inline: "Feed card",
  interstitial: "Full-screen",
  rewarded: "Rewarded reel",
};

export default function AdsDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["my-ads"],
    queryFn: async () => {
      const { data } = await sb.from("ad_campaigns").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const totals = campaigns.reduce(
    (acc: any, c: any) => ({
      impressions: acc.impressions + (c.impressions || 0),
      clicks: acc.clicks + (c.clicks || 0),
      spent: acc.spent + Number(c.total_spent || 0),
    }),
    { impressions: 0, clicks: 0, spent: 0 },
  );

  const toggleStatus = async (id: string, status: string) => {
    const next = status === "active" ? "paused" : "active";
    const { error } = await sb.from("ad_campaigns").update({ status: next }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-ads"] });
  };

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight">PUBSTORE Ads</h1>
            <p className="text-[11px] text-muted-foreground">Promote your products across the marketplace</p>
          </div>
          <Button size="sm" asChild>
            <Link to="/store/ads/new"><Plus className="w-4 h-4 mr-1" /> New</Link>
          </Button>
        </div>
      </header>

      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        <Stat icon={Eye} label="Impressions" value={totals.impressions.toLocaleString()} />
        <Stat icon={MousePointerClick} label="Clicks" value={totals.clicks.toLocaleString()} />
        <Stat icon={DollarSign} label="Spent" value={`$${totals.spent.toFixed(2)}`} />
      </div>

      <div className="px-4 mt-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Your campaigns</p>
        {isLoading ? null : campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="w-7 h-7 text-muted-foreground" />}
            title="No campaigns yet"
            description="Run your first ad to reach buyers across PUBSTORE."
            action={<Button asChild><Link to="/store/ads/new"><Plus className="w-4 h-4 mr-1.5" /> Create campaign</Link></Button>}
          />
        ) : (
          <ul className="space-y-2">
            {campaigns.map((c: any) => {
              const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : "0.0";
              return (
                <li key={c.id} className="bg-card border rounded-2xl p-3 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
                      {c.creative?.image && <img src={c.creative.image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold truncate">{c.name}</p>
                        <StatusChip status={c.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {PLACEMENT_LABEL[c.placement]} · {c.pricing_mode === "cpc" ? `$${Number(c.max_bid_cpc).toFixed(2)} CPC` : `$${Number(c.daily_budget).toFixed(2)}/day`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-muted-foreground"><Eye className="w-3 h-3" /> {c.impressions}</span>
                        <span className="flex items-center gap-1 text-muted-foreground"><MousePointerClick className="w-3 h-3" /> {c.clicks}</span>
                        <span className="text-muted-foreground">CTR {ctr}%</span>
                        <span className="ml-auto font-bold">${Number(c.total_spent).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm" variant="outline" className="flex-1"
                      onClick={() => toggleStatus(c.id, c.status)}
                      disabled={c.status === "exhausted" || c.status === "ended"}
                    >
                      {c.status === "active" ? <><Pause className="w-3.5 h-3.5 mr-1" /> Pause</> : <><Play className="w-3.5 h-3.5 mr-1" /> Activate</>}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-card border rounded-2xl p-3 shadow-card">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
      <p className="text-lg font-extrabold mt-1">{value}</p>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    paused: "bg-muted text-muted-foreground",
    draft: "bg-muted text-muted-foreground",
    exhausted: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    ended: "bg-muted text-muted-foreground",
  };
  return <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${map[status] ?? map.draft}`}>{status}</span>;
}
