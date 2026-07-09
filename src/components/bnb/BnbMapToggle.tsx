import { Map as MapIcon, List } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BnbMapToggle({
  view,
  onChange,
  className,
}: {
  view: "list" | "map";
  onChange: (v: "list" | "map") => void;
  className?: string;
}) {
  return (
    <button
      onClick={() => onChange(view === "list" ? "map" : "list")}
      className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-30 h-11 px-5 rounded-full bg-foreground text-background shadow-bnb-lg flex items-center gap-2 font-semibold text-[13px] hover:scale-105 transition-transform",
        className
      )}
    >
      {view === "list" ? (
        <>
          <MapIcon className="w-4 h-4" /> Map
        </>
      ) : (
        <>
          <List className="w-4 h-4" /> List
        </>
      )}
    </button>
  );
}
