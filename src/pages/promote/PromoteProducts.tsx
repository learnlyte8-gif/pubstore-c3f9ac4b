import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, TrendingUp, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import PromoteTabs from "./PromoteTabs";
import { PROMOTE_SORTS, usePromotableProducts, usePromoterProfile, type PromoteSort } from "@/hooks/usePromote";
import { commissionPerUnit } from "@/data/products";
import { money } from "@/lib/promote";

export default function PromoteProducts() {
  const [sort, setSort] = useState<PromoteSort>("earning");
  const [search, setSearch] = useState("");
  const { profile, userId } = usePromoterProfile();
  const { data: products, isLoading } = usePromotableProducts(sort, search);

  return (
    <div className="pb-24 lg:pb-10">
      <header className="px-4 pt-4 pb-3 space-y-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Promote &amp; Earn</h1>
          <p className="text-sm text-muted-foreground">
            Share products you love. When someone buys through your link, you earn a commission in your PUBSTORE wallet.
          </p>
        </div>
        <PromoteTabs />
      </header>

      {profile?.frozen ? (
        <div className="mx-4 mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive" />
          <span>Your promoter account is on hold{profile.frozen_reason ? `: ${profile.frozen_reason}` : "."} Contact support to review it.</span>
        </div>
      ) : null}

      {!userId ? (
        <div className="mx-4 rounded-2xl border bg-card p-4 text-sm">
          <Link to="/auth" className="font-bold text-primary">Sign in</Link> to start earning from products you share.
        </div>
      ) : null}

      <div className="px-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products to promote"
            className="pl-9 rounded-full h-11"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {PROMOTE_SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition ${
                sort === s.key ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card overflow-hidden animate-pulse">
              <div className="aspect-square bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted rounded" />
                <div className="h-3 w-2/3 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !products?.length ? (
        <div className="px-4 pt-10 text-center text-sm text-muted-foreground">
          No products are open for promotion yet. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 pt-4">
          {products.map((p) => {
            const per = commissionPerUnit(p);
            return (
              <Link
                key={p.id}
                to={`/promote/product/${p.id}`}
                className="rounded-2xl border bg-card overflow-hidden hover:shadow-lg transition group"
              >
                <div className="aspect-square bg-muted overflow-hidden">
                  <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="text-xs font-semibold line-clamp-2 leading-snug">{p.title}</p>
                  <p className="text-sm font-extrabold">{money(p.price)}</p>
                  <p className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">
                    <TrendingUp className="w-3 h-3" /> Earn {money(per)} per sale
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
