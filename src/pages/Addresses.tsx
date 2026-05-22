import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Home, Briefcase, Star, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CircleSpinner from "@/components/CircleSpinner";

type Addr = {
  id: string;
  label: string | null;
  recipient: string;
  phone: string | null;
  line1: string;
  city: string | null;
  region: string | null;
  country: string | null;
  is_default: boolean | null;
};

const ICON_FOR = (label: string | null) => {
  const l = (label ?? "").toLowerCase();
  if (l === "home") return Home;
  if (l === "work") return Briefcase;
  return MapPin;
};

export default function Addresses() {
  const [items, setItems] = useState<Addr[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Addr | null>(null);
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Addr[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setDefault = async (id: string) => {
    if (!userId) return;
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    await load();
    toast.success("Default address updated");
  };
  const remove = async (id: string) => {
    await supabase.from("addresses").delete().eq("id", id);
    setItems((xs) => xs.filter((a) => a.id !== id));
    toast.success("Address removed");
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) return;
    const f = new FormData(e.currentTarget);
    const payload = {
      user_id: userId,
      label: String(f.get("label") || "Home"),
      recipient: String(f.get("recipient") || ""),
      phone: String(f.get("phone") || ""),
      line1: String(f.get("line1") || ""),
      city: String(f.get("city") || ""),
      region: String(f.get("region") || ""),
      country: String(f.get("country") || ""),
    };
    if (editing) {
      await supabase.from("addresses").update(payload).eq("id", editing.id);
      toast.success("Address updated");
    } else {
      const isFirst = items.length === 0;
      await supabase.from("addresses").insert({ ...payload, is_default: isFirst });
      toast.success("Address added");
    }
    setEditing(null);
    setAdding(false);
    await load();
  };

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-bold text-lg flex-1">Addresses</h1>
        {!adding && !editing && (
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-1" /> New</Button>
        )}
      </header>

      <div className="px-4 py-4 space-y-3">
        {loading && <p className="text-center text-sm text-muted-foreground py-8"><CircleSpinner size={28} /></p>}

        {!loading && items.length === 0 && !adding && !editing && (
          <div className="text-center py-12">
            <MapPin className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-bold mt-2">No addresses yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add one to start placing orders.</p>
          </div>
        )}

        {!editing && !adding && items.map((a) => {
          const Icon = ICON_FOR(a.label);
          return (
            <div key={a.id} className="bg-card rounded-2xl border shadow-card p-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm capitalize">{a.label || "Address"}</p>
                    {a.is_default && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Default</span>}
                  </div>
                  <p className="text-sm font-semibold mt-0.5">{a.recipient}{a.phone ? ` · ${a.phone}` : ""}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.line1}{a.city ? `, ${a.city}` : ""}{a.country ? `, ${a.country}` : ""}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t">
                {!a.is_default && (
                  <button onClick={() => setDefault(a.id)} className="flex-1 h-9 rounded-lg bg-muted text-xs font-bold flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5" /> Set default
                  </button>
                )}
                <button onClick={() => setEditing(a)} className="flex-1 h-9 rounded-lg bg-muted text-xs font-bold flex items-center justify-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => remove(a.id)} className="h-9 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {(adding || editing) && (
          <form onSubmit={onSubmit} className="bg-card rounded-2xl border shadow-card p-4 space-y-3">
            <p className="font-bold">{editing ? "Edit address" : "New address"}</p>
            <Input name="label" defaultValue={editing?.label ?? "Home"} placeholder="Label (Home, Work…)" />
            <Input name="recipient" required defaultValue={editing?.recipient} placeholder="Recipient name" />
            <Input name="phone" defaultValue={editing?.phone ?? ""} placeholder="Phone" />
            <Input name="line1" required defaultValue={editing?.line1} placeholder="Street address" />
            <div className="grid grid-cols-2 gap-2">
              <Input name="city" defaultValue={editing?.city ?? ""} placeholder="City" />
              <Input name="region" defaultValue={editing?.region ?? ""} placeholder="Region" />
            </div>
            <Input name="country" defaultValue={editing?.country ?? ""} placeholder="Country" />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Save</Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(null); setAdding(false); }}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
