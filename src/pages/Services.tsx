import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Wrench, Star, MapPin, Phone, MessageCircle, Plus, Briefcase, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchServiceProviders, fetchServiceRequests, SERVICE_CATEGORIES } from "@/data/newVerticals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import MediaUpload from "@/components/MediaUpload";
import BackButton from "@/components/BackButton";

type Tab = "find" | "tasks" | "post";

export default function Services() {
  const [tab, setTab] = useState<Tab>("find");
  const [category, setCategory] = useState<string>("");

  const { data: providers = [] } = useQuery({
    queryKey: ["service-providers", category],
    queryFn: () => fetchServiceProviders({ category: category || undefined, limit: 60 }),
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["service-requests"],
    queryFn: () => fetchServiceRequests({ status: "open", limit: 30 }),
  });

  return (
    <div className="pb-8">
      <header className="px-4 pt-4 pb-3 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 text-white">
        <div className="flex items-center gap-2">
          <BackButton iconOnly className="bg-white/15 backdrop-blur text-white hover:bg-white/25" />
          <span className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Local services</h1>
            <p className="text-[11px] opacity-90">Plumbers, electricians, tutors, freelancers — verified & rated.</p>
          </div>
        </div>

        <div className="mt-3 flex bg-white/15 backdrop-blur rounded-full p-1">
          {(["find", "tasks", "post"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-9 rounded-full text-xs font-bold transition ${tab === t ? "bg-white text-foreground" : "text-white/90"}`}
            >
              {t === "find" ? "Find pros" : t === "tasks" ? "Open tasks" : "Post a task"}
            </button>
          ))}
        </div>
      </header>

      {tab === "find" && (
        <div className="px-4 mt-4">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
            <button
              onClick={() => setCategory("")}
              className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold border ${category === "" ? "bg-foreground text-background" : "bg-card"}`}
            >All</button>
            {SERVICE_CATEGORIES.map((c) => (
              <button
                key={c.slug}
                onClick={() => setCategory(c.slug)}
                className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold border ${category === c.slug ? "bg-foreground text-background" : "bg-card"}`}
              >{c.label}</button>
            ))}
          </div>

          {providers.length === 0 ? (
            <EmptyState title="No providers yet" description="Be the first to register your service in this category." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {providers.map((p) => (
                <div key={p.id} className="bg-card border rounded-2xl p-3 shadow-card flex gap-3">
                  <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0">
                    {p.cover && <img src={p.cover} alt={p.display_name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-sm leading-tight truncate">{p.display_name}</p>
                      <span className="text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {p.rating.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground capitalize">{p.category}{p.subcategory ? ` · ${p.subcategory}` : ""}</p>
                    {(p.city || p.country) && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" />{p.city}{p.country ? `, ${p.country}` : ""}
                      </p>
                    )}
                    {p.hourly_rate && (
                      <p className="text-xs font-bold mt-1">${p.hourly_rate}/hr</p>
                    )}
                    <div className="flex gap-1 mt-1.5">
                      {p.phone && <a href={`tel:${p.phone}`} className="px-2 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> Call</a>}
                      {p.whatsapp && <a href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener" className="px-2 h-7 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1"><MessageCircle className="w-2.5 h-2.5" /> WhatsApp</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <div className="px-4 mt-4">
          {requests.length === 0 ? (
            <EmptyState title="No open tasks" description="Open tasks posted by users will appear here." />
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="bg-card border rounded-2xl p-3 shadow-card">
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
