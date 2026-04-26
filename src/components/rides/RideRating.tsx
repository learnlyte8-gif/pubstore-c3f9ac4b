import { useState } from "react";
import { Star, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function RideRating({
  rideId,
  raterId,
  rateeId,
  direction,
  rateeName,
  onClose,
}: {
  rideId: string;
  raterId: string;
  rateeId: string;
  direction: "rider_to_driver" | "driver_to_rider";
  rateeName: string;
  onClose: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from("ride_ratings").insert({
      ride_id: rideId,
      rater_id: raterId,
      ratee_id: rateeId,
      direction,
      stars,
      comment: comment || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thanks for the feedback!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in">
      <div className="w-full sm:max-w-md bg-card border-t sm:border sm:rounded-3xl shadow-elevated p-5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Trip complete</p>
            <h3 className="font-black text-xl mt-0.5">How was your trip with {rateeName}?</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center" aria-label="Skip">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-center gap-2 my-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              className="p-1 transition hover:scale-110"
              aria-label={`${n} stars`}
            >
              <Star
                className={`w-9 h-9 ${n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment (optional)"
          rows={3}
          className="w-full bg-muted/50 border border-border rounded-2xl p-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="w-full mt-3 h-12 rounded-2xl bg-primary text-primary-foreground font-bold shadow-elevated disabled:opacity-50"
        >
          Submit rating
        </button>
        <button onClick={onClose} className="w-full mt-2 text-xs text-muted-foreground font-semibold">Skip for now</button>
      </div>
    </div>
  );
}
