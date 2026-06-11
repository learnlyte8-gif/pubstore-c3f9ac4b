import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wand2, Lock, Crown, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchMySupplier, fetchProducts, type Product } from "@/data/products";
import CircleSpinner from "@/components/CircleSpinner";

const FREE_TRIALS = 3;
const AD_FEE = 2;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function AddAdDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const { data: adInfo } = useQuery({
    queryKey: ["my-supplier-ad-info", supplier?.id],
    queryFn: async () => {
      if (!supplier?.id) return null;
      const { data } = await supabase
        .from("suppliers")
        .select("ad_credits_used, ad_pro")
        .eq("id", supplier.id)
        .maybeSingle();
      return data;
    },
    enabled: !!supplier && open,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["my-products", supplier?.id],
    queryFn: () => (supplier ? fetchProducts({ supplierId: supplier.id }) : Promise.resolve([])),
    enabled: !!supplier && open,
  });

  const used = adInfo?.ad_credits_used ?? 0;
  const isPro = !!adInfo?.ad_pro;
  const remainingFree = Math.max(0, FREE_TRIALS - used);
  const needsPayment = !isPro && remainingFree === 0;


  const [picked, setPicked] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const close = () => {
    if (working) return;
    setPicked(null);
    onOpenChange(false);
  };

  const generate = async () => {
    if (!picked) return;
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("generate-ad", {
      body: { productId: picked },
    });
    setWorking(false);
    if (error || data?.error) {
      const msg = (data as any)?.error || error?.message || "Could not generate ad";
      toast.error(msg);
      return;
    }
    toast.success(
      data?.paid
        ? `Ad created — $${data.fee} charged to your wallet`
        : `Ad created — ${data?.remaining_free} free ${data?.remaining_free === 1 ? "trial" : "trials"} left`,
    );
    qc.invalidateQueries({ queryKey: ["my-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["my-supplier"] });
    qc.invalidateQueries({ queryKey: ["my-supplier-ad-info"] });

    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Create AI Ad
          </DialogTitle>
          <DialogDescription>
            Pick a product. AI will rewrite its title and description to convert better, and
            promote it as a Reel in the home feed.
          </DialogDescription>
        </DialogHeader>

        {/* Trial / payment banner */}
        <div
          className={`rounded-xl px-3 py-2.5 text-sm border ${
            needsPayment
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "border-primary/30 bg-primary/5 text-primary"
          }`}
        >
          {isPro ? (
            <span className="flex items-center gap-2 font-bold">
              <Crown className="w-4 h-4" /> Pro — unlimited ads
            </span>
          ) : needsPayment ? (
            <span className="flex items-center gap-2 font-medium">
              <Lock className="w-4 h-4" /> Free trials used. ${AD_FEE} will be charged from your wallet.
            </span>
          ) : (
            <span className="flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4" /> {remainingFree} of {FREE_TRIALS} free trials left
            </span>
          )}
        </div>

        {/* Product picker */}
        <div className="max-h-[40vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              You don't have any products yet.
            </p>
          ) : (
            products.map((p: Product) => {
              const isPicked = picked === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPicked(p.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl border text-left transition ${
                    isPicked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <img
                    src={p.image}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      ${p.price.toFixed(2)}
                      {p.adHasReel && (
                        <span className="ml-2 inline-flex items-center gap-1 text-primary">
                          <Sparkles className="w-3 h-3" /> Has ad
                        </span>
                      )}
                    </p>
                  </div>
                  {isPicked && (
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={close} disabled={working} className="flex-1">
            Cancel
          </Button>
          <Button onClick={generate} disabled={!picked || working} className="flex-1">
            {working ? (
              <>
                <CircleSpinner size={16} /> <span className="ml-2">Generating…</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-1.5" />
                {needsPayment ? `Generate ($${AD_FEE})` : "Generate"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
