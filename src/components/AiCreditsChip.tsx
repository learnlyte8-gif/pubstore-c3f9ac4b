import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAiCredits } from "@/hooks/useAiCredits";

/**
 * Compact AI credit meter for the app bar. Shows the shopper's remaining AI
 * credits (or free trial actions), and links to the AI credits dashboard.
 */
export default function AiCreditsChip() {
  const { userId, balance, trialRemaining } = useAiCredits();
  if (!userId) return null;

  const usingTrial = balance <= 0 && trialRemaining > 0;
  const value = usingTrial ? trialRemaining : balance;
  const empty = value <= 0;

  return (
    <Link
      to="/ai-credits"
      aria-label={`AI credits: ${value} left`}
      title={
        usingTrial
          ? `${trialRemaining} free AI actions left — AI search and Tapson use these`
          : empty
            ? "Out of AI credits — top up to keep using AI search"
            : `${balance.toLocaleString()} AI credits left`
      }
      className={`shrink-0 flex items-center gap-1 h-8 px-1 active:scale-95 transition ${
        empty ? "text-destructive" : "text-foreground"
      }`}
    >
      <Sparkles className="w-4 h-4" strokeWidth={2.2} />
      <span className="text-[12px] font-bold tabular-nums tracking-tight">
        {value.toLocaleString()}
        {usingTrial && <span className="ml-0.5 font-semibold opacity-70">free</span>}
      </span>
    </Link>
  );
}
