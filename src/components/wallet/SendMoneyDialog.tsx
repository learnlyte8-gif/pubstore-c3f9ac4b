import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Send, Loader2, User as UserIcon, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

type Recipient = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function SendMoneyDialog({
  open,
  onOpenChange,
  balance,
  currentUserId,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  balance: number;
  currentUserId: string | null;
  onSent: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setRecipient(null);
      setAmount(""); setNote(""); setSending(false);
    }
  }, [open]);

  useEffect(() => {
    if (recipient) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("user_id", currentUserId ?? "00000000-0000-0000-0000-000000000000")
        .limit(8);
      if (!cancelled) {
        setResults((data as Recipient[]) ?? []);
        setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, recipient, currentUserId]);

  const handleSend = async () => {
    const amt = Number(amount);
    if (!recipient) { toast.error("Pick a recipient"); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter an amount"); return; }
    if (amt > balance) { toast.error("Insufficient balance"); return; }

    setSending(true);
    const { error } = await supabase.rpc("transfer_wallet_funds", {
      _recipient_id: recipient.user_id,
      _amount: Math.round(amt * 100) / 100,
      _note: note.trim() || null,
    });
    setSending(false);
    if (error) { toast.error(error.message || "Transfer failed"); return; }
    toast.success(`Sent ${fmt(amt)} to ${recipient.display_name || recipient.username || "user"} 🎉`);
    onSent();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Send money
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl bg-muted/50 px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Balance</span>
            <span className="text-sm font-black tabular-nums">{fmt(balance)}</span>
          </div>

          {!recipient ? (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search by username or name"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-11"
                />
              </div>
              <div className="max-h-64 overflow-y-auto -mx-1">
                {searching ? (
                  <p className="text-center text-xs text-muted-foreground py-4">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    {query.trim().length < 2 ? "Type at least 2 characters" : "No users found"}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {results.map((r) => (
                      <li key={r.user_id}>
                        <button
                          onClick={() => setRecipient(r)}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition text-left"
                        >
                          <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center overflow-hidden shrink-0">
                            {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold truncate">{r.display_name || r.username || "User"}</span>
                            {r.username && <span className="block text-[11px] text-muted-foreground truncate">@{r.username}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-2 rounded-xl border border-border bg-muted/30">
                <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center overflow-hidden shrink-0">
                  {recipient.avatar_url ? <img src={recipient.avatar_url} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{recipient.display_name || recipient.username || "User"}</p>
                  {recipient.username && <p className="text-[11px] text-muted-foreground truncate">@{recipient.username}</p>}
                </div>
                <button onClick={() => setRecipient(null)} className="text-[11px] font-bold text-primary">Change</button>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-black text-muted-foreground">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                    className="h-14 w-full rounded-xl border border-border bg-muted/40 pl-8 pr-3 text-2xl font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Note (optional)</label>
                <Input
                  placeholder="What's it for?"
                  value={note}
                  maxLength={120}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <Button onClick={handleSend} disabled={sending} className="w-full h-12 text-base font-black">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Send {amount ? fmt(Number(amount) || 0) : ""}</>}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
