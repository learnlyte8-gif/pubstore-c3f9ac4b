import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, ShieldCheck, MessageCircle } from "lucide-react";
import { SUPPLIERS, PRODUCTS } from "@/data/products";

type Story = {
  supplierId: string;
  productId: string;
  headline: string;
};

const STORIES: Story[] = [
  { supplierId: "s1", productId: "p1", headline: "New ANC earbuds — 40% off launch" },
  { supplierId: "s2", productId: "p2", headline: "Spring blazer drop just landed" },
  { supplierId: "s3", productId: "p12", headline: "Restocked: Air Fryer 5L" },
  { supplierId: "s4", productId: "p5", headline: "Vit C serum — 5k orders this week" },
  { supplierId: "s5", productId: "p13", headline: "Yoga mat eco range expanded" },
  { supplierId: "s1", productId: "p9", headline: "Hot-swap keyboard, OEM ready" },
  { supplierId: "s2", productId: "p14", headline: "Sneakers SS26 preview" },
];

export default function SupplierStories() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto scrollbar-none px-4 mt-3 pb-1">
        {STORIES.map((st, i) => {
          const sup = SUPPLIERS.find((s) => s.id === st.supplierId);
          if (!sup) return null;
          return (
            <button
              key={i}
              onClick={() => setOpenIdx(i)}
              className="shrink-0 flex flex-col items-center gap-1 w-16"
            >
              <span className="ring-story p-[2px] rounded-full">
                <span className="block bg-background p-[2px] rounded-full">
                  <img
                    src={sup.logo}
                    alt={sup.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </span>
              </span>
              <span className="text-[10px] leading-tight text-center line-clamp-1 w-full">
                {sup.name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {openIdx !== null && (
        <StoryViewer
          stories={STORIES}
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
  const sup = SUPPLIERS.find((s) => s.id === story.supplierId);
  const prod = PRODUCTS.find((p) => p.id === story.productId);
  if (!sup || !prod) return null;

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
          <img src={sup.logo} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/40" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate flex items-center gap-1">
              {sup.name}
              {sup.verified && <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" />}
            </p>
            <p className="text-white/70 text-[10px]">{sup.country}</p>
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

        <img src={prod.image} alt={prod.title} className="absolute inset-0 w-full h-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />

        <div className="absolute bottom-0 left-0 right-0 p-4 text-white z-10">
          <p className="text-[10px] uppercase tracking-wider opacity-80">Story</p>
          <h2 className="text-lg font-bold leading-tight mt-1">{story.headline}</h2>
          <Link
            to={`/product/${prod.id}`}
            onClick={onClose}
            className="mt-2 flex items-center gap-2 bg-white/15 backdrop-blur rounded-xl p-2"
          >
            <img src={prod.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-xs line-clamp-2 leading-snug">{prod.title}</p>
              <p className="text-sm font-bold">${prod.price.toFixed(2)}</p>
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
