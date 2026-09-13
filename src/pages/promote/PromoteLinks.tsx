import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Copy, MousePointerClick, ShoppingBag, Coins } from "lucide-react";
import PromoteTabs from "./PromoteTabs";
import { useMyPromotions } from "@/hooks/usePromote";
import { copyToClipboard, money, shareUrlForCode } from "@/lib/promote";

export default function PromoteLinks() {
  const { data: rows, isLoading } = useMyPromotions();

  const copy = async (code: string) => {
    const ok = await copyToClipboard(shareUrlForCode(code));
    toast[ok ? "success" : "error"](ok ? "Link copied" : "Could not copy the link");
  };

  return (
    <div className="pb-24 lg:pb-10">
      <header className="px-4 pt-4 pb-3 space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight">My promotions</h1>
        <PromoteTabs />
      </header>

      {isLoading ? (
        <div className="px-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : !rows?.length ? (
        <div className="px-4 pt-10 text-center text-sm text-muted-foreground space-y-2">
          <p>You haven't shared anything yet.</p>
          <Link to="/promote" className="font-bold text-primary">Find products to promote</Link>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {rows.map((r: any) => (
            <div key={r.id} className="rounded-2xl border bg-card p-3 flex gap-3 items-center">
              <img
                src={r.product?.image ?? "/placeholder.svg"}
                alt={r.product?.title ?? "Product"}
                className="w-14 h-14 rounded-xl object-cover bg-muted"
              />
              <div className="min-w-0 flex-1">
                <Link to={`/promote/product/${r.product_id}`} className="text-sm font-semibold line-clamp-1">
                  {r.product?.title ?? "Product"}
                </Link>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> {r.clicks} clicks</span>
                  <span className="inline-flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {r.orders} orders</span>
                  <span className="inline-flex items-center gap-1 font-bold text-primary"><Coins className="w-3 h-3" /> {money(r.earned)}</span>
                </div>
              </div>
              <button
                onClick={() => copy(r.code)}
                className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-muted"
                aria-label="Copy link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
