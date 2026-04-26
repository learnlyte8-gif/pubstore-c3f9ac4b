import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X, Car, Calculator, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/data/verticals";

type Mode = "test_drive" | "financing" | "inquiry";

export default function VehicleInquiryDialog({
  vehicle, open, onOpenChange, initialMode = "inquiry",
}: { vehicle: Vehicle; open: boolean; onOpenChange: (v: boolean) => void; initialMode?: Mode }) {
  const { requireAuth } = useRequireAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [date, setDate] = useState<Date | undefined>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  // Financing params
  const [downPct, setDownPct] = useState(20);
  const [termMonths, setTermMonths] = useState(60);
  const [apr, setApr] = useState(7.5);
  const [busy, setBusy] = useState(false);

  const downPayment = useMemo(() => Math.round((vehicle.price * downPct) / 100), [vehicle.price, downPct]);
  const monthly = useMemo(() => {
    const principal = vehicle.price - downPayment;
    const r = apr / 100 / 12;
    if (principal <= 0) return 0;
    if (r === 0) return principal / termMonths;
    return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
  }, [vehicle.price, downPayment, apr, termMonths]);

  const submit = async () => {
    const uid = requireAuth({ message: "Sign in to send inquiry" });
    if (!uid) return;
    if (mode === "test_drive" && !date) { toast.error("Pick a date for the test drive"); return; }
    if (!name.trim()) { toast.error("Add your name"); return; }
    if (!phone.trim() && !email.trim()) { toast.error("Add a phone or email"); return; }
    setBusy(true);
    const { error } = await supabase.from("vehicle_inquiries").insert({
      vehicle_id: vehicle.id,
      buyer_id: uid,
      kind: mode,
      preferred_date: date ? format(date, "yyyy-MM-dd") : null,
      contact_name: name,
      contact_phone: phone || null,
      contact_email: email || null,
      down_payment: mode === "financing" ? downPayment : null,
      loan_term_months: mode === "financing" ? termMonths : null,
      estimated_monthly: mode === "financing" ? Number(monthly.toFixed(2)) : null,
      message: message || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(mode === "test_drive" ? "Test drive requested" : mode === "financing" ? "Financing request sent" : "Inquiry sent");
    onOpenChange(false);
  };

  if (!open) return null;

  const tabs: { id: Mode; label: string; icon: typeof Car }[] = [
    { id: "inquiry", label: "Inquire", icon: MessageSquare },
    { id: "test_drive", label: "Test drive", icon: Car },
    { id: "financing", label: "Finance", icon: Calculator },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full sm:max-w-md bg-zinc-50 text-zinc-950 sm:rounded-3xl shadow-elevated max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-zinc-200">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-500">{vehicle.year ?? ""} · {vehicle.make ?? ""}</p>
              <h3 className="font-black text-2xl mt-0.5 tracking-tight leading-tight truncate">{vehicle.title}</h3>
              <p className="text-sm font-black tabular-nums mt-1">${vehicle.price.toLocaleString()}</p>
            </div>
            <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-3 bg-zinc-100 rounded-xl p-1">
            {tabs.map((t) => {
              const active = mode === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setMode(t.id)}
                  className={`h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition ${active ? "bg-zinc-950 text-zinc-50 shadow" : "text-zinc-600"}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 space-y-3">
          {mode === "test_drive" && (
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">Preferred date</p>
              <DateField date={date} setDate={setDate} />
            </div>
          )}

          {mode === "financing" && (
            <div className="rounded-2xl bg-zinc-100 border border-zinc-200 p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                  <span>Down payment · {downPct}%</span>
                  <span className="tabular-nums">${downPayment.toLocaleString()}</span>
                </div>
                <Slider min={5} max={60} step={5} value={[downPct]} onValueChange={([v]) => setDownPct(v)} />
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                  <span>Term</span>
                  <span className="tabular-nums">{termMonths} months</span>
                </div>
                <Slider min={12} max={84} step={12} value={[termMonths]} onValueChange={([v]) => setTermMonths(v)} />
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                  <span>APR</span>
                  <span className="tabular-nums">{apr.toFixed(1)}%</span>
                </div>
                <Slider min={2} max={18} step={0.5} value={[apr]} onValueChange={([v]) => setApr(v)} />
              </div>
              <div className="rounded-xl bg-zinc-950 text-zinc-50 p-3 text-center">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-400">Estimated monthly</p>
                <p className="text-3xl font-black tracking-tighter tabular-nums mt-0.5">${monthly.toFixed(0)}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">over {termMonths} months · est. only</p>
              </div>
            </div>
          )}

          <Field label="Your name" value={name} onChange={setName} placeholder="Full name" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+1…" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="you@…" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">Message</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder={mode === "test_drive" ? "Best time of day, trade-in, etc." : "Anything you'd like to know"}
              className="w-full bg-zinc-100 border border-zinc-200 rounded-xl p-3 text-sm outline-none focus:border-zinc-950"
            />
          </div>
        </div>

        <div className="p-5 pt-0">
          <button
            onClick={submit}
            disabled={busy}
            className="w-full h-12 rounded-2xl bg-zinc-950 text-zinc-50 font-bold shadow-elevated disabled:opacity-50"
          >
            {busy ? "Sending…" : mode === "test_drive" ? "Schedule test drive" : mode === "financing" ? "Send financing request" : "Send inquiry"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-xl bg-zinc-100 border border-zinc-200 text-sm font-semibold outline-none focus:border-zinc-950"
      />
    </div>
  );
}

function DateField({ date, setDate }: { date: Date | undefined; setDate: (d: Date | undefined) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn("w-full h-11 px-3 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center gap-2 text-sm text-left font-semibold", !date && "text-zinc-500")}>
          <CalendarIcon className="w-4 h-4" />
          {date ? format(date, "EEE, MMM d, yyyy") : "Pick a date"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { setDate(d); setOpen(false); }}
          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
