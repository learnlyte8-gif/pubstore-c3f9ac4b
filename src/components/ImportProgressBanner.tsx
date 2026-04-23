import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, X, Download } from "lucide-react";
import { useImportJob } from "@/store/importJob";

export default function ImportProgressBanner() {
  const { state, dismiss } = useImportJob();
  const visible = state.running || (state.total > 0 && state.finishedAt);
  if (!visible) return null;

  const pct = state.total ? Math.round((state.done / state.total) * 100) : 0;
  const errored = state.items.filter((i) => i.status === "error").length;
  const succeeded = state.items.filter((i) => i.status === "done").length;

  return (
    <div className="fixed inset-x-0 bottom-16 lg:bottom-4 z-50 px-3 pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="rounded-2xl border bg-card shadow-elevated p-3 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {state.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-bold truncate">
                {state.running
                  ? `Importing ${state.done}/${state.total}…`
                  : `Import finished · ${succeeded} added${errored ? `, ${errored} errored` : ""}`}
              </p>
              <span className="text-[10px] font-bold text-muted-foreground shrink-0">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5 gap-2">
              <p className="text-[10px] text-muted-foreground truncate">
                {state.sourceLabel || "Bulk import"}
              </p>
              <Link to="/store/import" className="text-[10px] font-bold text-primary inline-flex items-center gap-1 shrink-0">
                <Download className="w-3 h-3" /> View
              </Link>
            </div>
          </div>
          {!state.running && (
            <button
              onClick={dismiss}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
