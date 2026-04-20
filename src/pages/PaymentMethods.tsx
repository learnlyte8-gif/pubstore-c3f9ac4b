import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CreditCard, Plus, Smartphone, Wallet, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Method = { id: string; kind: "card" | "wallet" | "mpesa"; label: string; sub: string; default?: boolean };

const seed: Method[] = [
  { id: "m1", kind: "card", label: "Visa •••• 4242", sub: "Expires 12/27", default: true },
  { id: "m2", kind: "mpesa", label: "M-Pesa", sub: "+254 712 ••• 678" },
  { id: "m3", kind: "wallet", label: "Pubstore Wallet", sub: "$120.50 balance" },
];

export default function PaymentMethods() {
  const [items, setItems] = useState<Method[]>(seed);
  const remove = (id: string) => { setItems((xs) => xs.filter((m) => m.id !== id)); toast.success("Removed"); };

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-bold text-lg flex-1">Payment methods</h1>
      </header>

      <div className="px-4 py-4 space-y-3">
        {items.map((m) => {
          const Icon = m.kind === "card" ? CreditCard : m.kind === "mpesa" ? Smartphone : Wallet;
          return (
            <div key={m.id} className="bg-card rounded-2xl border shadow-card p-4 flex items-center gap-3">
              <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center shadow-elevated"><Icon className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">{m.label}</p>
                  {m.default && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Default</span>}
                </div>
                <p className="text-xs text-muted-foreground">{m.sub}</p>
              </div>
              <button onClick={() => remove(m.id)} className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          );
        })}

        <Button onClick={() => toast.info("Open secure payment provider")} className="w-full h-12 mt-2"><Plus className="w-4 h-4 mr-2" /> Add payment method</Button>

        <div className="bg-muted rounded-2xl p-4 mt-4 flex gap-3">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Secured by Trade Assurance</p>
            <p className="text-xs text-muted-foreground mt-0.5">Payments are protected end-to-end. We never store your full card details on our servers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
