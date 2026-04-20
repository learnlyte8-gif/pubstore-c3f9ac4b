import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Home, Briefcase, Star, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Addr = { id: string; type: "home" | "work" | "other"; name: string; phone: string; line: string; city: string; country: string; default?: boolean };

const seed: Addr[] = [
  { id: "a1", type: "home", name: "Kuki Doe", phone: "+254 712 345 678", line: "12 Ngong Lane, Apt 4B", city: "Nairobi", country: "Kenya", default: true },
  { id: "a2", type: "work", name: "Kuki Doe", phone: "+254 712 345 678", line: "Pubstore HQ, 5th Floor", city: "Nairobi", country: "Kenya" },
];

export default function Addresses() {
  const [items, setItems] = useState<Addr[]>(seed);
  const [adding, setAdding] = useState(false);

  const setDefault = (id: string) => {
    setItems((xs) => xs.map((a) => ({ ...a, default: a.id === id })));
    toast.success("Default address updated");
  };
  const remove = (id: string) => {
    setItems((xs) => xs.filter((a) => a.id !== id));
    toast.success("Address removed");
  };

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-bold text-lg flex-1">Addresses</h1>
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-1" /> New</Button>
      </header>

      <div className="px-4 py-4 space-y-3">
        {items.map((a) => {
          const Icon = a.type === "home" ? Home : a.type === "work" ? Briefcase : MapPin;
          return (
            <div key={a.id} className="bg-card rounded-2xl border shadow-card p-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm capitalize">{a.type}</p>
                    {a.default && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Default</span>}
                  </div>
                  <p className="text-sm font-semibold mt-0.5">{a.name} · {a.phone}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.line}, {a.city}, {a.country}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t">
                {!a.default && <button onClick={() => setDefault(a.id)} className="flex-1 h-9 rounded-lg bg-muted text-xs font-bold flex items-center justify-center gap-1"><Star className="w-3.5 h-3.5" /> Set default</button>}
                <button className="flex-1 h-9 rounded-lg bg-muted text-xs font-bold flex items-center justify-center gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => remove(a.id)} className="h-9 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          );
        })}

        {adding && (
          <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setItems((xs) => [...xs, { id: `a${Date.now()}`, type: "other", name: String(f.get("name")), phone: String(f.get("phone")), line: String(f.get("line")), city: String(f.get("city")), country: String(f.get("country")) }]); setAdding(false); toast.success("Address added"); }} className="bg-card rounded-2xl border shadow-card p-4 space-y-3">
            <p className="font-bold">New address</p>
            {["name", "phone", "line", "city", "country"].map((f) => (
              <input key={f} name={f} required placeholder={f[0].toUpperCase() + f.slice(1)} className="w-full h-11 rounded-lg border bg-background px-3 text-sm" />
            ))}
            <div className="flex gap-2"><Button type="submit" className="flex-1">Save</Button><Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button></div>
          </form>
        )}
      </div>
    </div>
  );
}
