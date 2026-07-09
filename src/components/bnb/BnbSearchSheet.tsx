import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Users, Minus, Plus } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GuestUnits = "guests" | "seats" | "passengers" | "party" | "occupants" | "quantity" | "none";

export interface BnbSearchState {
  where: string;
  dates?: DateRange;
  count: number;
}

const UNIT_LABEL: Record<GuestUnits, string> = {
  guests: "Guests",
  seats: "Seats",
  passengers: "Passengers",
  party: "Party size",
  occupants: "Occupants",
  quantity: "Quantity",
  none: "",
};

export default function BnbSearchSheet({
  open,
  onOpenChange,
  value,
  onChange,
  onApply,
  onClear,
  units = "guests",
  whereLabel = "Where",
  wherePlaceholder = "Search destinations",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: BnbSearchState;
  onChange: (v: BnbSearchState) => void;
  onApply: () => void;
  onClear: () => void;
  units?: GuestUnits;
  whereLabel?: string;
  wherePlaceholder?: string;
}) {
  const [step, setStep] = useState<"where" | "when" | "who">("where");
  const showGuests = units !== "none";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-base font-semibold">Search</DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-3">
          <Section active={step === "where"} onClick={() => setStep("where")} label={whereLabel} preview={value.where || "I'm flexible"}>
            <div className="pt-3">
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--bnb-foggy))]" />
                <Input
                  autoFocus
                  value={value.where}
                  onChange={(e) => onChange({ ...value, where: e.target.value })}
                  placeholder={wherePlaceholder}
                  className="pl-9 h-11 rounded-xl"
                />
              </div>
            </div>
          </Section>

          <Section active={step === "when"} onClick={() => setStep("when")} label="When" preview={formatRange(value.dates) || "Add dates"}>
            <div className="pt-3 pointer-events-auto">
              <Calendar
                mode="range"
                selected={value.dates}
                onSelect={(r) => onChange({ ...value, dates: r })}
                numberOfMonths={1}
                className={cn("p-3 pointer-events-auto rounded-xl border")}
              />
            </div>
          </Section>

          {showGuests && (
            <Section active={step === "who"} onClick={() => setStep("who")} label="Who" preview={value.count ? `${value.count} ${UNIT_LABEL[units].toLowerCase()}` : `Add ${UNIT_LABEL[units].toLowerCase()}`}>
              <div className="pt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[hsl(var(--bnb-foggy))]" />
                  <span className="text-sm font-medium">{UNIT_LABEL[units]}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onChange({ ...value, count: Math.max(0, value.count - 1) })}
                    className="w-9 h-9 grid place-items-center rounded-full border hover:border-foreground disabled:opacity-40"
                    disabled={value.count <= 0}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{value.count}</span>
                  <button
                    onClick={() => onChange({ ...value, count: value.count + 1 })}
                    className="w-9 h-9 grid place-items-center rounded-full border hover:border-foreground"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Section>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <button className="text-sm font-semibold underline" onClick={onClear}>Clear all</button>
          <Button onClick={onApply} className="rounded-xl bg-[hsl(var(--bnb-rausch))] text-[hsl(var(--bnb-rausch-foreground))] hover:bg-[hsl(var(--bnb-rausch))]/90 h-11 px-6 font-semibold">
            <CalendarIcon className="w-4 h-4 mr-2" /> Search
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  active,
  onClick,
  label,
  preview,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border transition-shadow", active ? "shadow-bnb bg-background" : "bg-muted/40")}>
      <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--bnb-foggy))]">{label}</span>
        <span className="text-sm font-medium truncate max-w-[60%] text-right">{preview}</span>
      </button>
      {active && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function formatRange(r?: DateRange) {
  if (!r?.from) return "";
  if (!r.to) return format(r.from, "MMM d");
  return `${format(r.from, "MMM d")} – ${format(r.to, "MMM d")}`;
}
