import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { trackPromotionClick } from "@/lib/promote";

/** /x/:code — records the promoter click, then sends the visitor to the product. */
export default function PromoteRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) return navigate("/home", { replace: true });
      try {
        const res = await trackPromotionClick(code, params.get("s") ?? undefined);
        if (cancelled) return;
        if (res?.product_id) navigate(`/product/${res.product_id}`, { replace: true });
        else navigate("/home", { replace: true });
      } catch {
        if (!cancelled) navigate("/home", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [code, navigate, params]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin" />
      <p className="text-sm">Opening the product…</p>
    </div>
  );
}
