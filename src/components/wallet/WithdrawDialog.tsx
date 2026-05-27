import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Landmark, CreditCard, ArrowUpRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sb = supabase as any;

type Method = "ecocash" | "onemoney" | "bank" | "paypal";

const METHODS: { id: Method; label: string; hint: string; icon: typeof Smartphone; placeholder: string }[] = [
  { id: "ecocash", label: "EcoCash", hint: "Mobile money", icon: Smartphone, placeholder: "077 123 4567" },
  { id: "onemoney", label: "OneMoney", hint: "Mobile money", icon: Smartphone, placeholder: "071 234 5678" },
  { id: "bank", label: "Bank transfer", hint: "Bank account", icon: Landmark, placeholder: "Account number" },
  { id: "paypal", label: "PayPal", hint: "Email", icon: CreditCard, placeholder: "you@example.com" },
];

export default function WithdrawDialog({
  open, onOpenChange, balance, onSubmitted,
}: { open: boolean; onOpenChange: (v: boolean) => void; balance: number; onSubmitted?: () => void }) {
  const [method, setMethod] = useState<Method>("ecocash");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [accountName, setAccountName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setAmount(""); setDestination(""); setAccountName(""); setNotes(""); }
  }, [open]);

  const current = METHODS.find((m) => m.id === method)!;
  const numAmount = Number(amount);
  const valid = Number.isFinite(numAmount) && numAmount >= 5 && numAmount <= balance && destination.trim().length >= 3;

  const submit = async () => {
    if (!valid) {
      if (numAmount > balance) toast.error("Amount exceeds your balance");
      else toast.error("Please complete the form (min $5)");
      return;
    }
    setBusy(true);
    try {
      const { error } = await sb.rpc("request_wallet_withdrawal", {
        _amount: numAmount,
        _method: method,
        _destination: destination.trim(),
        _account_name: accountName.trim() || null,
        _notes: notes.trim() || null,
      });
      if (error) throw error;
      toast.success(`Withdrawal of $${numAmount.toFixed(2)} requested`);
      onOpenChange(false);
      onSubmitted?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit withdrawal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </span>
            Request withdrawal
          </DialogTitle>
          <DialogDescription>
            Available balance · <span className="font-bold text-foreground tabular-nums">${balance.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payout method</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`h-14 rounded-xl border px-3 flex items-center gap-2 text-left transition ${
                      active ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-muted/40"
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? "bg-primary/20 text-primary" : "bg-background text-foreground"}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-black truncate">{m.label}</span>
                      <span className="block text-[10px] text-muted-foreground truncate">{m.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="wd-amount">Amount (USD)</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">$</span>
              <Input
                id="wd-amount"
                type="number"
                inputMode="decimal"
                min={5}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Min $5.00"
                className="pl-7 font-black tabular-nums"
              />
            </div>
            <div className="flex gap-1.5 mt-2">
              {[10, 25, 50, 100].filter((q) => q <= balance).map((q) => (
                <button key={q} type="button" onClick={() => setAmount(String(q))} className="px-2.5 h-7 rounded-full text-[11px] font-bold bg-muted hover:bg-primary/10">
                  ${q}
                </button>
              ))}
              {balance >= 5 && (
                <button type="button" onClick={() => setAmount(balance.toFixed(2))} className="px-2.5 h-7 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                  All
                </button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="wd-dest">{current.label} {method === "bank" ? "account number" : method === "paypal" ? "email" : "number"}</Label>
            <Input id="wd-dest" className="mt-1.5" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={current.placeholder} />
          </div>

          <div>
            <Label htmlFor="wd-name">Account / holder name</Label>
            <Input id="wd-name" className="mt-1.5" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Full name on account" />
          </div>

          <div>
            <Label htmlFor="wd-notes">Notes (optional)</Label>
            <Input id="wd-notes" className="mt-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bank name, branch, etc." />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Funds are held on your wallet immediately. Payouts usually clear within 1–3 business days. You can cancel a pending request for a full refund.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={!valid || busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Request $${numAmount > 0 ? numAmount.toFixed(2) : "0.00"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
