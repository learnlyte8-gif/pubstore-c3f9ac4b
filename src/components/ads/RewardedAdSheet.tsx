import { useEffect, useState } from "react";
import { Gift, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAd, useAdImpression, rewardAdView, trackAdEvent } from "@/hooks/useAds";
import { useQueryClient } from "@tanstack/react-query";

const DURATION = 15; // seconds

export default function RewardedAdSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: ad } = useAd("rewarded");
  useAdImpression(open ? ad : null);
  const [elapsed, setElapsed] = useState(0);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!open) { setElapsed(0); setClaimed(false); return; }
    const t = setInterval(() => setElapsed((v) => Math.min(DURATION, v + 1)), 1000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open || elapsed < DURATION || claimed || !ad) return;
    setClaimed(true);
    rewardAdView(ad.id).then((res) => {
      if (res.ok) {
        toast.success(`+${res.points} points earned 🎉`);
        qc.invalidateQueries({ queryKey: ["loyalty-points"] });
        qc.invalidateQueries({ queryKey: ["loyalty-ledger"] });
      } else {
        toast.error(res.error || "Could not credit points");
      }
    });
  }, [elapsed, open, claimed, ad, qc]);

  if (!open) return null;

  if (!ad) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 text-white">
        <div className="text-center">
          <p className="text-sm opacity-80 mb-4">No rewarded ads available right now.</p>
          <button onClick={onClose} className="px-5 h-11 rounded-full bg-white text-black font-bold">Close</button>
        </div>
      </div>
    );
  }

  const c = ad.creative ?? {};
  const pct = (elapsed / DURATION) * 100;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col text-white">
      <div className="absolute top-3 inset-x-3 z-10 flex items-center gap-2">
        <span className="px-2 py-1 rounded-full bg-amber-500 text-black text-[10px] font-extrabold uppercase">Earn 5 pts</span>
        <span className="text-[10px] opacity-80">{Math.max(0, DURATION - elapsed)}s</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-3 h-9 rounded-full bg-white/15 text-white text-xs font-bold flex items-center gap-1.5"
        >
          {elapsed >= DURATION ? "Done" : "Cancel"} <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => { trackAdEvent(ad.id, "click", "rewarded"); }}
        className="flex-1 flex flex-col items-center justify-center p-6 text-center"
      >
        {c.image && (
          <img src={c.image} alt="" className="w-full max-w-sm aspect-square rounded-3xl object-cover animate-kenburns" />
        )}
        <h2 className="text-2xl font-extrabold mt-6 max-w-md">{c.headline || "Sponsored"}</h2>
        {c.tagline && <p className="text-sm opacity-80 mt-2 max-w-md">{c.tagline}</p>}
      </button>

      {/* progress bar */}
      <div className="h-1.5 bg-white/15">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {elapsed >= DURATION && (
        <div className="bg-amber-500 text-black p-3 text-center text-sm font-bold flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" /> Reward credited — close to continue
        </div>
      )}
    </div>
  );
}

export function RewardedAdCTA({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-3 h-10 rounded-full bg-amber-500 text-black text-sm font-bold shadow-card hover:shadow-elevated transition ${className}`}
      >
        <Gift className="w-4 h-4" /> Watch & earn 5 pts
      </button>
      <RewardedAdSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
