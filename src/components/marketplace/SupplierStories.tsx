import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, ShieldCheck, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type StorySupplier = {
  id: string;
  name: string;
  logo: string | null;
  country: string | null;
  verified: boolean | null;
};

type StoryProduct = {
  id: string;
  title: string;
  image: string | null;
  price: number;
  created_at: string;
};

type Story = {
  supplier: StorySupplier;
  product: StoryProduct;
  headline: string;
};

async function fetchStories(): Promise<Story[]> {
  // Pull verified suppliers first (fall back to all if none verified yet)
  const { data: verified } = await supabase
    .from("suppliers")
    .select("id,name,logo,country,verified")
    .eq("verified", true)
    .limit(20);

  let suppliers: StorySupplier[] = verified ?? [];
  if (suppliers.length === 0) {
    const { data: any } = await supabase
      .from("suppliers")
      .select("id,name,logo,country,verified")
      .limit(20);
    suppliers = any ?? [];
  }
  if (suppliers.length === 0) return [];

  const ids = suppliers.map((s) => s.id);
  const { data: products } = await supabase
    .from("products")
    .select("id,title,image,price,created_at,supplier_id")
    .in("supplier_id", ids)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const latestBySupplier = new Map<string, StoryProduct & { supplier_id: string }>();
  (products ?? []).forEach((p: any) => {
    if (!latestBySupplier.has(p.supplier_id)) latestBySupplier.set(p.supplier_id, p);
  });

  return suppliers
    .filter((s) => latestBySupplier.has(s.id))
    .map((s) => {
      const p = latestBySupplier.get(s.id)!;
      const ageMs = Date.now() - new Date(p.created_at).getTime();
      const isNew = ageMs < 1000 * 60 * 60 * 24 * 7;
      const headline = isNew ? `Just listed: ${p.title}` : `Featured: ${p.title}`;
      return { supplier: s, product: p, headline };
    });
}

export default function SupplierStories() {
  const { data: stories = [] } = useQuery({ queryKey: ["supplier-stories"], queryFn: fetchStories });
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (stories.length === 0) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto scrollbar-none px-4 mt-3 pb-1">
        {stories.map((st, i) => (
          <button
            key={st.supplier.id}
            onClick={() => setOpenIdx(i)}
            className="shrink-0 flex flex-col items-center gap-1 w-16"
          >
            <span className="ring-story p-[2px] rounded-full">
              <span className="block bg-background p-[2px] rounded-full">
                {st.supplier.logo ? (
                  <img
                    src={st.supplier.logo}
                    alt={st.supplier.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {st.supplier.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
            </span>
            <span className="text-[10px] leading-tight text-center line-clamp-1 w-full">
              {st.supplier.name.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {openIdx !== null && (
        <StoryViewer
          stories={stories}
          startIdx={openIdx}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </>
  );
}

function StoryViewer({
  stories,
  startIdx,
  onClose,
}: {
  stories: Story[];
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (idx < stories.length - 1) {
            setIdx(idx + 1);
            return 0;
          }
          onClose();
          return 100;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(t);
  }, [idx, stories.length, onClose]);

  const story = stories[idx];
  if (!story) return null;
  const { supplier: sup, product: prod } = story;

  const prev = () => idx > 0 && (setIdx(idx - 1), setProgress(0));
  const next = () =>
    idx < stories.length - 1 ? (setIdx(idx + 1), setProgress(0)) : onClose();

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="relative w-full h-full max-w-md mx-auto">
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-7 left-3 right-3 flex items-center gap-2 z-10">
          {sup.logo && (
            <img src={sup.logo} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/40" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate flex items-center gap-1">
              {sup.name}
              {sup.verified && <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" />}
            </p>
            {sup.country && <p className="text-white/70 text-[10px]">{sup.country}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={prev}
          aria-label="Previous"
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10 flex items-center justify-start pl-2 text-white/0 hover:text-white/70"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={next}
          aria-label="Next"
          className="absolute right-0 top-0 bottom-0 w-1/3 z-10 flex items-center justify-end pr-2 text-white/0 hover:text-white/70"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {prod.image && (
          <img src={prod.image} alt={prod.title} className="absolute inset-0 w-full h-full object-cover opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />

        <div className="absolute bottom-0 left-0 right-0 p-4 text-white z-10">
          <p className="text-[10px] uppercase tracking-wider opacity-80">Story</p>
          <h2 className="text-lg font-bold leading-tight mt-1">{story.headline}</h2>
          <Link
            to={`/product/${prod.id}`}
            onClick={onClose}
            className="mt-2 flex items-center gap-2 bg-white/15 backdrop-blur rounded-xl p-2"
          >
            {prod.image && (
              <img src={prod.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs line-clamp-2 leading-snug">{prod.title}</p>
              <p className="text-sm font-bold">${Number(prod.price).toFixed(2)}</p>
            </div>
            <span className="text-[10px] font-bold bg-white text-foreground px-2 py-1 rounded-full">
              View
            </span>
          </Link>
          <Link
            to={`/supplier/${sup.id}`}
            onClick={onClose}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-full"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Visit storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
