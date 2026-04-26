import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Stay } from "@/data/verticals";

export default function StayBookingDialog({
  stay, open, onOpenChange,
}: { stay: Stay; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { requireAuth } = useRequireAuth();
  const [checkIn, setCheckIn] = useState<Date | undefined>();
  const [checkOut, setCheckOut] = useState<Date | undefined>();
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const diff = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
    return Math.max(0, diff);
  }, [checkIn, checkOut]);

  const subtotal = nights * stay.price_per_night;
  const cleaning = nights > 0 ? Math.round(stay.price_per_night * 0.15) : 0;
  const service = Math.round(subtotal * 0.1);
  const total = subtotal + cleaning + service;

  const reserve = async () => {
    const uid = requireAuth({ message: "Sign in to reserve" });
    if (!uid) return;
    if (!checkIn || !checkOut || nights < 1) { toast.error("Pick valid dates"); return; }
    if (guests > stay.guests) { toast.error(`Max ${stay.guests} guests`); return; }
    setBusy(true);
    const { error } = await supabase.from("stay_bookings").insert({
      stay_id: stay.id,
      guest_id: uid,
      check_in: format(checkIn, "yyyy-MM-dd"),
      check_out: format(checkOut, "yyyy-MM-dd"),
      guests,
      nights,
      nightly_rate: stay.price_per_night,
      cleaning_fee: cleaning,
      service_fee: service,
      total,
      currency: stay.currency || "USD",
      notes: notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reserved! Host will confirm shortly.");
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full sm:max-w-md bg-card border-t sm:border sm:rounded-3xl shadow-elevated max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b">
          <div className="flex items-start justify-between">
            <div>
              <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> Reserve
              </p>
              <h3 className="font-serif text-2xl mt-1.5 leading-tight">{stay.title}</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">{stay.city}{stay.country ? `, ${stay.country}` : ""}</p>
            </div>
            <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <DateField label="Check-in" date={checkIn} setDate={setCheckIn} />
            <DateField label="Check-out" date={checkOut} setDate={setCheckOut} min={checkIn} />
          </div>

          {/* Guests */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Guests</p>
            <div className="flex items-center justify-between bg-muted/40 border border-border rounded-xl p-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold"><Users className="w-4 h-4 text-muted-foreground" /> {guests} guest{guests !== 1 && "s"}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                  className="w-8 h-8 rounded-full bg-background border border-border text-sm font-bold"
                >−</button>
                <button
                  onClick={() => setGuests(Math.min(stay.guests, guests + 1))}
                  className="w-8 h-8 rounded-full bg-background border border-border text-sm font-bold"
                >+</button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Max {stay.guests} guests · {stay.bedrooms} bedroom{stay.bedrooms !== 1 && "s"}</p>
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything the host should know? (optional)"
            className="w-full bg-muted/40 border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
          />

          {/* Summary */}
          {nights > 0 && (
            <div className="rounded-2xl bg-muted/40 border border-border p-3 text-sm space-y-1.5">
              <Row label={`$${Math.round(stay.price_per_night)} × ${nights} night${nights !== 1 && "s"}`} value={`$${subtotal.toFixed(2)}`} />
              <Row label="Cleaning fee" value={`$${cleaning.toFixed(2)}`} />
              <Row label="Service fee" value={`$${service.toFixed(2)}`} />
              <div className="h-px bg-border my-1" />
              <Row label={<span className="font-bold">Total</span>} value={<span className="font-black tabular-nums">${total.toFixed(2)}</span>} />
            </div>
          )}
        </div>

        <div className="p-5 pt-2">
          <button
            onClick={reserve}
            disabled={busy || nights < 1}
            className="w-full h-12 rounded-2xl bg-foreground text-background font-bold shadow-elevated disabled:opacity-50"
          >
            {busy ? "Reserving…" : nights > 0 ? `Reserve · $${total.toFixed(2)}` : "Pick dates to continue"}
          </button>
          <p className="text-[10px] text-center text-muted-foreground mt-2">You won't be charged yet — host confirms first.</p>
        </div>
      </div>
    </div>
  );
}

function DateField({ label, date, setDate, min }: { label: string; date: Date | undefined; setDate: (d: Date | undefined) => void; min?: Date }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className={cn("w-full h-11 px-3 rounded-xl bg-muted/40 border border-border flex items-center gap-2 text-sm text-left", !date && "text-muted-foreground")}>
            <CalendarIcon className="w-4 h-4" />
            {date ? format(date, "MMM d, yyyy") : "Select"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => { setDate(d); setOpen(false); }}
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || (min ? d <= min : false)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
