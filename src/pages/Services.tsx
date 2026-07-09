import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wrench, Star, MapPin, Phone, MessageCircle, Zap, Book, Scissors, Sparkles as SparklesIcon, Camera, PaintBucket, Cog, Palette } from "lucide-react";
import { fetchServiceProviders, fetchServiceRequests, SERVICE_CATEGORIES } from "@/data/newVerticals";
import EmptyState from "@/components/EmptyState";
import BackButton from "@/components/BackButton";
import BnbVerticalScreen from "@/components/bnb/BnbVerticalScreen";

type Tab = "find" | "tasks" | "post";

const CATEGORY_ICONS: Record<string, any> = {
  plumber: Wrench, electrician: Zap, mechanic: Cog, tutor: Book,
  tailor: Scissors, hairdresser: Scissors, cleaner: SparklesIcon,
  painter: PaintBucket, tiler: PaintBucket, photographer: Camera,
  designer: Palette, marketing: SparklesIcon, other: Wrench,
};

const BNB_SERVICE_CATS = [
  { slug: "all", label: "All pros", icon: SparklesIcon },
  ...SERVICE_CATEGORIES.map((c) => ({
    slug: c.slug,
    label: c.label,
    icon: CATEGORY_ICONS[c.slug] ?? Wrench,
  })),
];

export default function Services() {
  const [tab, setTab] = useState<Tab>("find");

  const { data: requests = [] } = useQuery({
    queryKey: ["service-requests"],
    queryFn: () => fetchServiceRequests({ status: "open", limit: 30 }),
  });

  return (
    <div className="pb-8 min-h-screen bg-background">
      <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-[hsl(var(--bnb-card-border))]">
        <BackButton iconOnly />
        <span className="w-10 h-10 rounded-2xl bg-[hsl(var(--bnb-rausch))]/10 text-[hsl(var(--bnb-rausch))] flex items-center justify-center">
          <Wrench className="w-5 h-5" />
        </span>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Local services</h1>
          <p className="text-[11px] text-[hsl(var(--bnb-foggy))]">Verified plumbers, electricians, tutors & more.</p>
        </div>
        <div className="flex bg-muted rounded-full p-1">
          {(["find", "tasks", "post"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 h-8 rounded-full text-[11px] font-bold transition ${tab === t ? "bg-foreground text-background" : "text-[hsl(var(--bnb-foggy))]"}`}
            >
              {t === "find" ? "Find" : t === "tasks" ? "Tasks" : "Post"}
            </button>
          ))}
        </div>
      </div>

      {tab === "find" && (
        <BnbVerticalScreen
          queryKey={["bnb-services"]}
          fetcher={(cat) => fetchServiceProviders({ category: cat === "all" ? undefined : cat, limit: 60 })}
          categories={BNB_SERVICE_CATS}
          units="none"
          saveKind="service"
          wherePlaceholder="Search pros, cities or skills"
          emptyLabel="No providers in this category yet"
          toListing={(p) => ({
            id: p.id,
            title: p.display_name,
            location: [p.city, p.country].filter(Boolean).join(", ") || null,
            subtitle: `${p.category}${p.subcategory ? ` · ${p.subcategory}` : ""}`,
            images: [p.cover, ...(p.gallery ?? [])].filter(Boolean) as string[],
            priceLabel: p.hourly_rate ? `$${p.hourly_rate} / hr` : "Contact for quote",
            rating: p.rating,
            badge: p.verified ? "Verified" : null,
            href: `/services`,
          })}
        />
      )}

      {tab === "tasks" && (
        <div className="px-4 mt-4">
          {requests.length === 0 ? (
            <EmptyState title="No open tasks" description="Open tasks posted by users will appear here." />
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="bg-card border rounded-2xl p-3 shadow-bnb">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm leading-tight">{r.title}</p>
                    {r.budget && <span className="text-xs font-bold tabular-nums shrink-0">${r.budget}</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground capitalize">{r.category}</p>
                  {r.description && <p className="text-xs mt-1 line-clamp-2">{r.description}</p>}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                    {r.city && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {r.city}</span>}
                    {r.deadline && <span>· by {new Date(r.deadline).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "post" && <PostTaskForm onPosted={() => setTab("tasks")} />}
    </div>
  );
}


function PostTaskForm({ onPosted }: { onPosted: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("plumber");
  const [budget, setBudget] = useState("");
  const [city, setCity] = useState("");
  const [deadline, setDeadline] = useState("");
  const [media, setMedia] = useState<{ images: string[]; video: string | null }>({ images: [], video: null });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error("Add a title"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in first"); setBusy(false); return; }
    const { error } = await supabase.from("service_requests").insert({
      buyer_id: user.id,
      title: title.trim(),
      description: description || null,
      category,
      budget: budget ? Number(budget) : null,
      city: city || null,
      deadline: deadline || null,
      gallery: media.images,
      video_url: media.video,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Task posted — providers will bid soon");
    setTitle(""); setDescription(""); setBudget(""); setCity(""); setDeadline(""); setMedia({ images: [], video: null });
    onPosted();
  };

  return (
    <div className="px-4 mt-4 space-y-3">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fix leaking kitchen sink" className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
          {SERVICE_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Budget ($)</label>
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1" />
        </div>
      </div>
      <MediaUpload
        images={media.images}
        video={media.video}
        onChange={setMedia}
        folder="service-requests"
        bucket="restaurant-media"
        label="Attach photos / video (optional)"
        hint="Show the issue · up to 6 photos · 1 video (60 MB)"
      />
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deadline</label>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1" />
      </div>
      <Button onClick={submit} disabled={busy} className="w-full h-12">
        <Plus className="w-4 h-4 mr-2" /> {busy ? "Posting…" : "Post task"}
      </Button>
    </div>
  );
}
