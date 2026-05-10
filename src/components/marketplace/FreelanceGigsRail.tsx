import { Link } from "react-router-dom";
import { Sparkles, Star, Clock } from "lucide-react";

const MOCK = [
  { id: "g1", title: "I will design a stunning brand logo in 24h", seller: "Tendai M.", rating: 4.9, reviews: 312, price: "$45", cover: "https://images.unsplash.com/photo-1561070791-2526d30994b8?w=600&q=70", level: "Top Rated" },
  { id: "g2", title: "Build a fast Shopify store with your products", seller: "Nia K.", rating: 5.0, reviews: 88, price: "$180", cover: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=70", level: "Pro" },
  { id: "g3", title: "Edit cinematic Reels & TikToks (ready in 12h)", seller: "Bongani D.", rating: 4.8, reviews: 540, price: "$30", cover: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&q=70", level: "Rising" },
  { id: "g4", title: "Translate documents EN ↔ FR ↔ PT", seller: "Amara O.", rating: 4.95, reviews: 210, price: "$15", cover: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=600&q=70", level: "Verified" },
];

export default function FreelanceGigsRail() {
  return (
    <section className="px-4 mt-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-pop">
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2.4} />
          </span>
          <div>
            <h2 className="text-base font-extrabold leading-tight tracking-tight">Freelance gigs</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Hire pros in minutes</p>
          </div>
        </div>
        <Link to="/services" className="text-xs font-bold text-primary">See all</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1 snap-x snap-mandatory">
        {MOCK.map((g) => (
          <Link key={g.id} to="/services" className="shrink-0 w-44 snap-start rounded-2xl border border-border bg-card shadow-card overflow-hidden active:scale-[0.98] transition">
            <div className="relative aspect-square bg-muted">
              <img src={g.cover} alt={g.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-background/90 backdrop-blur text-[9px] font-bold">{g.level}</span>
            </div>
            <div className="p-2.5">
              <p className="text-[11px] text-muted-foreground font-medium truncate">{g.seller}</p>
              <p className="text-xs font-bold leading-snug line-clamp-2 mt-0.5">{g.title}</p>
              <div className="flex items-center gap-1 mt-1.5 text-[10px]">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="font-bold">{g.rating}</span>
                <span className="text-muted-foreground">({g.reviews})</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> From</span>
                <span className="text-sm font-black tracking-tight">{g.price}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
