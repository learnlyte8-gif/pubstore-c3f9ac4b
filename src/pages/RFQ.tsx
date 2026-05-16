import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText, Plus, Send, ShieldCheck, Clock, Inbox, Star, Package, Globe2, X, CheckCircle2, Paperclip, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, useMySupplier } from "@/hooks/useCatalog";
import QuoteNegotiation from "@/components/marketplace/QuoteNegotiation";

type Quote = {
  id: string;
  rfq_id: string;
  supplier_id: string;
  price_per_unit: number;
  lead_time: string | null;
  moq: number | null;
  notes: string | null;
  created_at: string;
  supplier?: { id: string; name: string; logo: string | null; country: string | null; verified: boolean | null; rating: number | null };
};

type RFQ = {
  id: string;
  buyer_id: string;
  title: string;
  category: string | null;
  qty: number;
  unit: string | null;
  target_price: number | null;
  ship_to: string | null;
  details: string | null;
  status: "open" | "closed";
  created_at: string;
  attachments: string[] | null;
  quotes: Quote[];
};

type Mode = "mine" | "browse";

export default function RFQ() {
  const [tab, setTab] = useState<"inbox" | "new" | "browse">("inbox");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [browseRfqs, setBrowseRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { data: mySupplier } = useMySupplier();

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) { setLoading(false); return; }

    const [{ data: mine }, { data: all }] = await Promise.all([
      supabase.from("rfqs").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("rfqs").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(50),
    ]);

    const allIds = [...(mine ?? []), ...(all ?? [])].map((r) => r.id);
    let quotesByRfq = new Map<string, Quote[]>();
    if (allIds.length) {
      const { data: qs } = await supabase
        .from("quotes")
        .select("*")
        .in("rfq_id", allIds);
      const supIds = Array.from(new Set((qs ?? []).map((q) => q.supplier_id)));
      const { data: sups } = supIds.length
        ? await supabase.from("suppliers").select("id,name,logo,country,verified,rating").in("id", supIds)
        : { data: [] as Quote["supplier"][] };
      const supMap = new Map((sups ?? []).map((s) => [s!.id, s as Quote["supplier"]]));
      (qs ?? []).forEach((q) => {
        const enriched = { ...q, supplier: supMap.get(q.supplier_id) } as Quote;
        const arr = quotesByRfq.get(q.rfq_id) ?? [];
        arr.push(enriched);
        quotesByRfq.set(q.rfq_id, arr);
      });
    }
    type RfqRow = Omit<RFQ, "quotes">;
    const attach = (r: RfqRow): RFQ => ({ ...r, quotes: quotesByRfq.get(r.id) ?? [] });
    setRfqs(((mine ?? []) as unknown as RfqRow[]).map(attach));
    setBrowseRfqs(((all ?? []) as unknown as RfqRow[]).filter((r) => r.buyer_id !== user.id).map(attach));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Realtime: refresh on RFQ or quote changes
  useEffect(() => {
    const ch = supabase
      .channel("rfq-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "rfqs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const open = openId ? [...rfqs, ...browseRfqs].find((r) => r.id === openId) : null;
  if (open) return <RFQDetail rfq={open} userId={userId} mySupplierId={mySupplier?.id ?? null} onBack={() => setOpenId(null)} onChanged={load} />;

  const handleSubmit = async (payload: Pick<RFQ, "title" | "category" | "qty" | "unit" | "target_price" | "ship_to" | "details" | "attachments">) => {
    if (!userId) return;
    const { error } = await supabase.from("rfqs").insert({ ...payload, buyer_id: userId });
    if (error) return toast.error("Could not post RFQ", { description: error.message });
    toast.success("RFQ posted", { description: "Verified suppliers will respond shortly." });
    setTab("inbox");
    load();
  };

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-2 bg-card shadow-soft border-b border-border">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Request for Quotation
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Post once, get quotes from verified suppliers.
        </p>
        <div className="flex gap-1 mt-3 border-b border-border -mb-2">
          <TabBtn active={tab === "inbox"} onClick={() => setTab("inbox")}>
            <Inbox className="w-3.5 h-3.5 mr-1" /> My RFQs ({rfqs.length})
          </TabBtn>
          <TabBtn active={tab === "new"} onClick={() => setTab("new")}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New
          </TabBtn>
          {mySupplier && (
            <TabBtn active={tab === "browse"} onClick={() => setTab("browse")}>
              <Globe2 className="w-3.5 h-3.5 mr-1" /> Browse ({browseRfqs.length})
            </TabBtn>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-16">Loading…</p>
      ) : tab === "inbox" ? (
        <RFQList items={rfqs} mode="mine" onOpen={setOpenId} />
      ) : tab === "browse" ? (
        <RFQList items={browseRfqs} mode="browse" onOpen={setOpenId} />
      ) : (
        <RFQForm onSubmit={handleSubmit} onCancel={() => setTab("inbox")} />
      )}
    </div>
  );
}

function RFQList({ items, mode, onOpen }: { items: RFQ[]; mode: Mode; onOpen: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="text-sm font-bold mt-2">{mode === "mine" ? "No RFQs yet" : "No open RFQs"}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {mode === "mine" ? "Post one to get quotes from verified suppliers." : "Check back soon."}
        </p>
      </div>
    );
  }
  return (
    <ul className="px-4 mt-3 space-y-3">
      {items.map((r) => (
        <li key={r.id}>
          <button onClick={() => onOpen(r.id)} className="w-full text-left rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-tight flex-1">{r.title}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === "open" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                {r.status === "open" ? "Open" : "Closed"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {r.qty.toLocaleString()} {r.unit}</span>
              {r.target_price != null && <span>Target ${Number(r.target_price).toFixed(2)}</span>}
              {r.ship_to && <span className="flex items-center gap-1"><Globe2 className="w-3 h-3" /> {r.ship_to}</span>}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              <span className="font-semibold text-primary">{r.quotes.length} quote{r.quotes.length === 1 ? "" : "s"}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 h-9 text-xs font-semibold border-b-2 transition flex items-center ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function RFQForm({
  onSubmit, onCancel,
}: {
  onSubmit: (rfq: { title: string; category: string; qty: number; unit: string; target_price: number; ship_to: string; details: string; attachments: string[] }) => void;
  onCancel: () => void;
}) {
  const { data: categories = [] } = useCategories();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [qty, setQty] = useState(100);
  const [unit, setUnit] = useState("piece");
  const [targetPrice, setTargetPrice] = useState(0);
  const [shipTo, setShipTo] = useState("");
  const [details, setDetails] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  

  useEffect(() => { if (!category && categories[0]) setCategory(categories[0].id); }, [categories, category]);

  const uploadFiles = async (files: FileList) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sign in to attach files");
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} is over 8 MB`); continue; }
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("rfq-attachments").upload(path, file, { upsert: false });
      if (error) { toast.error("Upload failed", { description: error.message }); continue; }
      const { data: pub } = supabase.storage.from("rfq-attachments").getPublicUrl(path);
      urls.push(pub.publicUrl);
    }
    setAttachments((a) => [...a, ...urls]);
    setUploading(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !shipTo || qty < 1) return toast.error("Fill product, quantity and shipping destination.");
    onSubmit({ title, category, qty, unit, target_price: targetPrice, ship_to: shipTo, details, attachments });
  };

  return (
    <form onSubmit={submit} className="px-4 mt-4 space-y-3 pb-4">
      <Field label="Product name *">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Custom branded power banks 10000mAh" className="w-full h-10 px-3 rounded-lg bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40" />
      </Field>
      <Field label="Category">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Quantity *"><input type="number" min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 0)} className="w-full h-10 px-3 rounded-lg bg-muted text-sm" /></Field>
        <Field label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-muted text-sm">
            {["piece", "pair", "set", "pack", "box", "kg"].map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Target $"><input type="number" min={0} step={0.01} value={targetPrice} onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)} className="w-full h-10 px-3 rounded-lg bg-muted text-sm" /></Field>
      </div>
      <Field label="Ship to *"><input value={shipTo} onChange={(e) => setShipTo(e.target.value)} placeholder="City, Country" className="w-full h-10 px-3 rounded-lg bg-muted text-sm" /></Field>
      <Field label="Details"><textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} placeholder="Materials, packaging, certifications…" className="w-full p-3 rounded-lg bg-muted text-sm resize-none" /></Field>

      <Field label="Reference photos / spec sheets">
        <div className="space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((u, i) => (
                <div key={u} className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border">
                  {/\.(png|jpe?g|webp|gif)$/i.test(u)
                    ? <img src={u} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Paperclip className="w-4 h-4 text-muted-foreground" /></div>}
                  <button type="button" aria-label="Remove"
                    onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-muted text-xs font-semibold cursor-pointer hover:bg-muted/70">
            <ImageIcon className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Add files"}
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              disabled={uploading}
              onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
        </div>
      </Field>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 h-11 rounded-full bg-muted text-foreground text-sm font-semibold">Cancel</button>
        <button type="submit" disabled={uploading} className="flex-1 h-11 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-pop flex items-center justify-center gap-1.5 disabled:opacity-50">
          <Send className="w-4 h-4" /> Post RFQ
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function RFQDetail({ rfq, userId, mySupplierId, onBack, onChanged }: { rfq: RFQ; userId: string | null; mySupplierId: string | null; onBack: () => void; onChanged: () => void }) {
  const isOwner = rfq.buyer_id === userId;
  const canQuote = !!mySupplierId && !isOwner && rfq.status === "open" && !rfq.quotes.some((q) => q.supplier_id === mySupplierId);

  return (
    <div className="pb-8">
      <div className="px-3 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted" aria-label="Back"><X className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{rfq.title}</p>
          <p className="text-[10px] text-muted-foreground">Posted {new Date(rfq.created_at).toLocaleDateString()}</p>
        </div>
        {isOwner && rfq.status === "open" && (
          <button
            onClick={async () => {
              await supabase.from("rfqs").update({ status: "closed" }).eq("id", rfq.id);
              toast.success("RFQ closed");
              onChanged();
            }}
            className="text-[11px] font-bold text-destructive px-2 h-8"
          >Close</button>
        )}
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-card border border-border shadow-card p-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Detail label="Quantity" value={`${rfq.qty.toLocaleString()} ${rfq.unit ?? ""}`} />
            <Detail label="Target price" value={rfq.target_price != null ? `$${Number(rfq.target_price).toFixed(2)}` : "—"} />
            <Detail label="Ship to" value={rfq.ship_to ?? "—"} />
            <Detail label="Category" value={rfq.category ?? "—"} />
          </div>
          {rfq.details && <p className="mt-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{rfq.details}</p>}
          {rfq.attachments && rfq.attachments.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1"><Paperclip className="w-3 h-3" /> Attachments</p>
              <div className="flex flex-wrap gap-2">
                {rfq.attachments.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border">
                    {/\.(png|jpe?g|webp|gif)$/i.test(u)
                      ? <img src={u} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Paperclip className="w-4 h-4 text-muted-foreground" /></div>}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {canQuote && <QuoteForm rfqId={rfq.id} supplierId={mySupplierId!} buyerId={rfq.buyer_id} onPosted={onChanged} />}

        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">Quotes received ({rfq.quotes.length})</h3>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Live</span>
        </div>

        <ul className="mt-2 space-y-3">
          {rfq.quotes.length === 0 && (
            <li className="rounded-2xl bg-muted/40 p-6 text-center text-xs text-muted-foreground">Waiting for supplier quotes…</li>
          )}
          {rfq.quotes.map((q) => {
            const sup = q.supplier;
            const savings = rfq.target_price && rfq.target_price > 0 ? ((Number(rfq.target_price) - Number(q.price_per_unit)) / Number(rfq.target_price)) * 100 : 0;
            return (
              <li key={q.id} className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
                <div className="p-3 flex items-center gap-2.5 border-b border-border">
                  {sup?.logo && <img src={sup.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1">
                      {sup?.name ?? "Supplier"}
                      {sup?.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {sup?.country && <span>{sup.country}</span>}
                      {sup?.rating != null && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-500 text-amber-500" />{Number(sup.rating).toFixed(1)}</span>}
                    </div>
                  </div>
                  {sup && <Link to={`/supplier/${sup.id}`} className="text-[10px] font-semibold text-primary">View</Link>}
                </div>
                <div className="p-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-base font-bold text-destructive">${Number(q.price_per_unit).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">per {rfq.unit ?? "unit"}</p>
                  </div>
                  <div>
                    <p className="text-base font-bold">{q.lead_time ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">lead time</p>
                  </div>
                  <div>
                    <p className="text-base font-bold">{q.moq ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">MOQ</p>
                  </div>
                </div>
                {savings > 0 && (
                  <div className="px-3 pb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> {savings.toFixed(0)}% under target
                    </span>
                  </div>
                )}
                {q.notes && <p className="px-3 pb-2 text-[11px] text-muted-foreground leading-relaxed">{q.notes}</p>}
                {sup && (
                  <div className="p-3 border-t border-border bg-muted/20 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Link to={`/messages?supplier=${sup.id}`} className="h-9 rounded-full bg-card border border-border text-xs font-semibold flex items-center justify-center">Message</Link>
                      <button
                        onClick={async () => {
                          if (!isOwner) return toast.error("Only the RFQ owner can accept");
                          await supabase.from("rfqs").update({ status: "closed" }).eq("id", rfq.id);
                          toast.success("Quote accepted · RFQ closed");
                          onChanged();
                        }}
                        className="h-9 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center"
                      >
                        Accept quote
                      </button>
                    </div>
                    <QuoteNegotiation quoteId={q.id} currentUserId={userId} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function QuoteForm({ rfqId, supplierId, buyerId, onPosted }: { rfqId: string; supplierId: string; buyerId: string; onPosted: () => void }) {
  const [price, setPrice] = useState(0);
  const [leadTime, setLeadTime] = useState("");
  const [moq, setMoq] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (price <= 0) return toast.error("Enter a price");
    setSubmitting(true);
    const { error } = await supabase.from("quotes").insert({
      rfq_id: rfqId, supplier_id: supplierId,
      price_per_unit: price, lead_time: leadTime || null, moq: moq || null, notes: notes || null,
    });
    if (error) { toast.error("Could not submit quote", { description: error.message }); setSubmitting(false); return; }
    await supabase.from("notifications").insert({
      user_id: buyerId, type: "rfq_quote", title: "New quote received",
      body: `A supplier sent you a quote at $${price.toFixed(2)}`, link: "/rfq",
    });
    toast.success("Quote submitted");
    setPrice(0); setLeadTime(""); setMoq(0); setNotes(""); setSubmitting(false);
    onPosted();
  };

  return (
    <form onSubmit={submit} className="mt-3 rounded-2xl bg-card border border-primary/30 shadow-card p-4 space-y-3">
      <p className="text-sm font-bold text-primary">Submit a quote</p>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Price *"><input type="number" min={0} step={0.01} value={price || ""} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} className="w-full h-10 px-3 rounded-lg bg-muted text-sm" /></Field>
        <Field label="Lead time"><input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="20 days" className="w-full h-10 px-3 rounded-lg bg-muted text-sm" /></Field>
        <Field label="MOQ"><input type="number" min={0} value={moq || ""} onChange={(e) => setMoq(parseInt(e.target.value) || 0)} className="w-full h-10 px-3 rounded-lg bg-muted text-sm" /></Field>
      </div>
      <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full p-3 rounded-lg bg-muted text-sm resize-none" /></Field>
      <button disabled={submitting} type="submit" className="w-full h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5">
        <Send className="w-4 h-4" /> {submitting ? "Submitting…" : "Send quote"}
      </button>
    </form>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}
