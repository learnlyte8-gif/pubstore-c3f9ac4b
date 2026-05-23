import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Phone, MessageCircle, ShieldCheck, Percent, Calendar, Check, FileText } from "lucide-react";
import { fetchFinanceProducts, FINANCE_KINDS, type FinanceProduct } from "@/data/newVerticals";
import EmptyState from "@/components/EmptyState";
import FinanceApplicationDialog from "@/components/marketplace/FinanceApplicationDialog";

export default function Finance() {
  const [kind, setKind] = useState<string>("");
  const [applyFor, setApplyFor] = useState<FinanceProduct | null>(null);
  const { data: products = [] } = useQuery({
    queryKey: ["finance-products", kind],
    queryFn: () => fetchFinanceProducts({ kind: kind || undefined, limit: 60 }),
  });

  return (
    <div className="pb-8">
      <header className="px-4 pt-4 pb-3 bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-700 text-white">
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Banknote className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Finance & insurance</h1>
            <p className="text-[11px] opacity-90">Loans, vehicle financing, working capital, insurance.</p>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
          <button onClick={() => setKind("")} className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold ${kind === "" ? "bg-white text-foreground" : "bg-white/15 text-white"}`}>All</button>
          {FINANCE_KINDS.map((k) => (
            <button key={k.slug} onClick={() => setKind(k.slug)} className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold ${kind === k.slug ? "bg-white text-foreground" : "bg-white/15 text-white"}`}>{k.label}</button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4">
        {products.length === 0 ? (
          <EmptyState title="No products yet" description="Finance providers will list their products here." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {products.map((p) => (
              <div key={p.id} className="bg-card border rounded-2xl overflow-hidden shadow-card">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-emerald-600 to-teal-700">
                  {p.cover && <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur text-[9px] font-bold uppercase capitalize">{p.kind.replace("_", " ")}</span>
                  {p.featured && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-400 text-foreground text-[9px] font-bold uppercase">Featured</span>}
                </div>
                <div className="p-3">
                  <p className="font-bold text-sm leading-tight">{p.title}</p>
                  {p.provider_name && <p className="text-[11px] text-muted-foreground">by {p.provider_name}</p>}
                  <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                    {p.interest_rate != null && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted font-bold">
                        <Percent className="w-3 h-3" /> {p.interest_rate}% APR
                      </span>
                    )}
                    {p.term_months && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted font-bold">
                        <Calendar className="w-3 h-3" /> {p.term_months}mo
                      </span>
                    )}
                    {(p.min_amount || p.max_amount) && (
                      <span className="px-2 py-0.5 rounded-full bg-muted font-bold">
                        ${p.min_amount?.toLocaleString() ?? "0"}–${p.max_amount?.toLocaleString() ?? "∞"}
                      </span>
                    )}
                  </div>
                  {p.features.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {p.features.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-[11px] flex items-start gap-1">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-1.5 mt-2">
                    {p.contact_phone && <a href={`tel:${p.contact_phone}`} className="flex-1 h-8 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-1"><Phone className="w-3 h-3" /> Apply</a>}
                    {p.contact_whatsapp && <a href={`https://wa.me/${p.contact_whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener" className="flex-1 h-8 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1"><MessageCircle className="w-3 h-3" /> Chat</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
