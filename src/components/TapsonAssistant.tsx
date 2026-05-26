import { useEffect, useRef, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { Link } from "react-router-dom";
import { Sparkles, X, Send, Loader2, Eraser, ShieldCheck, Award, Star, ShoppingBag, Radio, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProducts,
  fetchSuppliers,
  fetchCategories,
  fetchProduct,
  fetchSupplier,
  type Product,
  type Supplier,
} from "@/data/products";
import { useShop } from "@/store/shop";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "tapson_chat_v1";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tapson-chat`;

const QUICK_PROMPTS = [
  "Find a verified supplier for 500 wireless earbuds",
  "Compare top suppliers near me",
  "Help me write an RFQ for cotton t-shirts",
  "Show me today's best deals",
];

async function buildLiveContext(): Promise<string> {
  const [cats, products, suppliers, liveStreamsRes, services, properties, finance, vehicles, stays, industrial, news] = await Promise.all([
    fetchCategories(),
    fetchProducts({ limit: 25, sortBy: "sold" }),
    fetchSuppliers({ limit: 20 }),
    supabase.from("live_streams").select("id,title,supplier_id,viewer_count").eq("status", "live").limit(6),
    supabase.from("service_providers").select("id,display_name,category,city,country,hourly_rate,currency,rating").eq("active", true).limit(15),
    supabase.from("properties").select("id,title,property_kind,listing_type,city,country,price,currency,bedrooms").eq("active", true).limit(15),
    supabase.from("finance_products").select("id,title,kind,provider_name,country,min_amount,max_amount,interest_rate,currency").eq("active", true).limit(10),
    supabase.from("vehicles").select("id,title,kind,make,model,city,country,price,currency").eq("active", true).limit(12),
    supabase.from("stays").select("id,title,kind,city,country,price_per_night,currency,rating").eq("active", true).limit(12),
    supabase.from("industrial_listings").select("id,title,category,country,price,currency").eq("active", true).limit(10),
    supabase.from("news_articles").select("id,title,slug,category").limit(8),
  ]);

  const verified = suppliers.filter((s) => s.verified).length;
  const gold = suppliers.filter((s) => s.gold).length;

  const productLines = products.map((p) => `- ${p.title} (id:${p.id}) — $${p.price} · MOQ ${p.moq} ${p.unit} · ${p.category || "general"} · supplier:${p.supplierId} · ${p.rating}★ · sold ${p.sold}${p.dealEndsAt ? " · DEAL" : ""}`).join("\n");
  const supplierLines = suppliers.map((s) => `- ${s.name} (id:${s.id}) — ${s.country || "—"} · ${s.rating}★ · ${s.responseRate}% resp · ${s.verified ? "Verified " : ""}${s.gold ? "Gold " : ""}${s.tradeAssurance ? "TradeAssured" : ""}`.trim()).join("\n");
  const liveLines = (liveStreamsRes.data ?? []).map((l: any) => `- ${l.title} (supplier:${l.supplier_id}) · ${l.viewer_count} viewers`).join("\n");
  const serviceLines = (services.data ?? []).map((s: any) => `- ${s.display_name} · ${s.category} · ${s.city ?? ""} ${s.country ?? ""} · ${s.hourly_rate ? `${s.currency || "$"}${s.hourly_rate}/hr` : "—"} · ${s.rating ?? 0}★`).join("\n");
  const propLines = (properties.data ?? []).map((p: any) => `- ${p.title} · ${p.property_kind}/${p.listing_type} · ${p.city ?? ""} ${p.country ?? ""} · ${p.currency || "$"}${p.price}${p.bedrooms ? ` · ${p.bedrooms}bd` : ""}`).join("\n");
  const finLines = (finance.data ?? []).map((f: any) => `- ${f.title} (${f.kind}) · ${f.provider_name ?? ""} · ${f.currency || "$"}${f.min_amount}–${f.max_amount}${f.interest_rate ? ` · ${f.interest_rate}%` : ""}`).join("\n");
  const vehLines = (vehicles.data ?? []).map((v: any) => `- ${v.title} · ${v.kind} ${v.make ?? ""} ${v.model ?? ""} · ${v.city ?? ""} · ${v.currency || "$"}${v.price}`).join("\n");
  const stayLines = (stays.data ?? []).map((s: any) => `- ${s.title} · ${s.kind} · ${s.city ?? ""} ${s.country ?? ""} · ${s.currency || "$"}${s.price_per_night}/night · ${s.rating ?? 0}★`).join("\n");
  const indLines = (industrial.data ?? []).map((i: any) => `- ${i.title} · ${i.category} · ${i.country ?? ""} · ${i.currency || "$"}${i.price ?? "—"}`).join("\n");
  const newsLines = (news.data ?? []).map((n: any) => `- ${n.title} · ${n.category ?? ""} (/news/${n.slug})`).join("\n");

  return `Categories: ${cats.map((c) => c.name).join(", ")}
Marketplace: ${products.length} products | ${suppliers.length} suppliers (${verified} verified, ${gold} gold)

REAL Products (use IDs in ::product[ID]):
${productLines || "(none)"}

REAL Suppliers (use IDs in ::supplier[ID] and ::live[ID]):
${supplierLines || "(none)"}

Live streams now:
${liveLines || "(none)"}

SERVICES (/services):
${serviceLines || "(none)"}

PROPERTIES (/properties):
${propLines || "(none)"}

FINANCE (/finance):
${finLines || "(none)"}

VEHICLES (/auto):
${vehLines || "(none)"}

STAYS (/stays):
${stayLines || "(none)"}

INDUSTRIAL (/industrial):
${indLines || "(none)"}

NEWS (/news):
${newsLines || "(none)"}`;
}

export default function TapsonAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* noop */
    }
    return [];
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      /* noop */
    }
  }, [messages]);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("tapson:open", openHandler);
    return () => window.removeEventListener("tapson:open", openHandler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);
    }
  }, [open, messages]);

  const send = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: userText }];
    setMessages(next);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        return [...prev, { role: "assistant", content: acc }];
      });
    };

    try {
      const context = await buildLiveContext().catch(() => "");
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, context }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        if (resp.status === 429) toast.error("Tapson is busy", { description: "Please wait a moment." });
        else if (resp.status === 402)
          toast.error("AI credits exhausted", { description: "Please add credits to continue." });
        else toast.error("Tapson hit a snag", { description: "Try again in a moment." });
        setMessages(next);
        setLoading(false);
        return;
      }
      if (!resp.body) throw new Error("No stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) upsert(delta);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error(e);
        toast.error("Connection lost");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const clear = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      {/* Floating FAB removed — trigger now lives in the top bar */}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-2xl h-[88dvh] bg-background rounded-t-3xl shadow-elevated flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
              <div className="relative">
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center shadow-card">
                  <Sparkles className="w-5 h-5" />
                </span>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight">Tapson</p>
                <p className="text-[10px] text-muted-foreground">AI shopping assistant · Online</p>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={clear}
                  aria-label="Clear chat"
                  className="p-2 rounded-full hover:bg-muted transition"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-2 rounded-full hover:bg-muted transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center text-center py-6">
                  <span className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/50 text-primary-foreground flex items-center justify-center shadow-pop mb-3">
                    <Sparkles className="w-8 h-8" />
                  </span>
                  <h3 className="text-base font-bold">Hi, I'm Tapson 👋</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    Your AI sourcing partner. Ask me about products, suppliers, RFQs, orders — anything on PUBSTORE.
                  </p>
                  <div className="grid grid-cols-1 gap-2 mt-5 w-full">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="text-left text-xs px-3 py-2.5 rounded-xl bg-card border border-border shadow-soft hover:shadow-card hover:border-primary/40 transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => <MessageBubble key={i} msg={m} />)
              )}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CircleSpinner size={14} />
                  Tapson is thinking…
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="px-3 py-3 border-t border-border bg-card safe-bottom">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Ask anything about PUBSTORE…"
                  className="flex-1 resize-none bg-muted rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 max-h-32"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  aria-label="Send"
                  className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-card disabled:opacity-40 disabled:shadow-none transition"
                >
                  {loading ? <CircleSpinner size={16} /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[9.5px] text-muted-foreground text-center mt-1.5">
                Tapson can make mistakes. Verify important details with the supplier.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm leading-relaxed shadow-soft">
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  // Split assistant content into text + rich card blocks
  const blocks = parseBlocks(msg.content);

  return (
    <div className="flex gap-2 items-start">
      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center shrink-0 shadow-soft">
        <Sparkles className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0 space-y-2">
        {blocks.map((b, i) => {
          if (b.type === "text") {
            if (!b.text.trim()) return null;
            return (
              <div
                key={i}
                className="rounded-2xl rounded-bl-sm bg-card border border-border shadow-soft px-3.5 py-2 text-sm leading-relaxed prose prose-sm max-w-none text-foreground prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0 prose-strong:text-foreground prose-headings:text-foreground prose-headings:text-sm prose-headings:font-bold"
              >
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => {
                      if (href?.startsWith("/")) {
                        return (
                          <Link to={href} className="text-primary font-semibold underline">
                            {children}
                          </Link>
                        );
                      }
                      return (
                        <a href={href} className="text-primary font-semibold underline" target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {linkifyRoutes(b.text)}
                </ReactMarkdown>
              </div>
            );
          }
          if (b.type === "product") return <TapsonProductCard key={i} id={b.id} />;
          if (b.type === "supplier") return <TapsonSupplierCard key={i} id={b.id} />;
          if (b.type === "live") return <TapsonLiveCard key={i} id={b.id} />;
          if (b.type === "cta") return <TapsonCTA key={i} to={b.to} label={b.label} />;
          return null;
        })}
      </div>
    </div>
  );
}

type Block =
  | { type: "text"; text: string }
  | { type: "product"; id: string }
  | { type: "supplier"; id: string }
  | { type: "live"; id: string }
  | { type: "cta"; to: string; label: string };

function parseBlocks(content: string): Block[] {
  const re = /::(product|supplier|live)\[([a-z0-9_-]+)\]|::cta\[([^|\]]+)\|([^\]]+)\]/gi;
  const blocks: Block[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) blocks.push({ type: "text", text: content.slice(last, m.index) });
    if (m[1]) {
      const kind = m[1].toLowerCase() as "product" | "supplier" | "live";
      blocks.push({ type: kind, id: m[2] });
    } else if (m[3]) {
      blocks.push({ type: "cta", to: m[3].trim(), label: m[4].trim() });
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) blocks.push({ type: "text", text: content.slice(last) });
  return blocks.length ? blocks : [{ type: "text", text: content }];
}

function TapsonProductCard({ id }: { id: string }) {
  const { data: p } = useQuery({ queryKey: ["tapson-product", id], queryFn: () => fetchProduct(id) });
  const { data: s } = useQuery({
    queryKey: ["tapson-product-supplier", p?.supplierId],
    queryFn: () => fetchSupplier(p!.supplierId),
    enabled: !!p?.supplierId,
  });
  const { addToCart } = useShop();
  if (!p) return null;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden animate-fade-in">
      <div className="flex">
        <Link to={`/product/${p.id}`} className="shrink-0">
          <img src={p.image} alt="" className="w-24 h-24 object-cover" />
        </Link>
        <div className="flex-1 min-w-0 p-2.5">
          <Link to={`/product/${p.id}`} className="text-xs font-bold leading-snug line-clamp-2">
            {p.title}
          </Link>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {p.rating} · {p.sold.toLocaleString()} sold
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div>
              <p className="text-sm font-bold leading-none">${p.price}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                MOQ {p.moq} {p.unit}
              </p>
            </div>
            <button
              onClick={() => {
                addToCart(p.id, p.moq);
                toast.success("Added to cart");
              }}
              className="px-2.5 h-7 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center gap-1 shadow-soft"
            >
              <ShoppingBag className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
      </div>
      {s && (
        <Link
          to={`/supplier/${s.id}`}
          className="flex items-center gap-2 px-2.5 py-1.5 border-t border-border bg-muted/40 text-[10px]"
        >
          <img src={s.logo} alt="" className="w-4 h-4 rounded-full object-cover" />
          <span className="font-semibold truncate">{s.name}</span>
          {s.verified && <ShieldCheck className="w-3 h-3 text-primary" />}
          {s.gold && <Award className="w-3 h-3 text-amber-600" />}
          <span className="ml-auto text-muted-foreground">{s.country}</span>
        </Link>
      )}
    </div>
  );
}

function TapsonSupplierCard({ id }: { id: string }) {
  const { data: s } = useQuery({ queryKey: ["tapson-supplier", id], queryFn: () => fetchSupplier(id) });
  if (!s) return null;
  return (
    <Link
      to={`/supplier/${s.id}`}
      className="block rounded-2xl border border-border bg-card shadow-card overflow-hidden animate-fade-in"
    >
      <div className="relative h-16">
        <img src={s.banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/60 to-transparent" />
      </div>
      <div className="px-3 pb-3 -mt-6 relative">
        <img src={s.logo} alt="" className="w-12 h-12 rounded-xl object-cover ring-4 ring-card" />
        <div className="mt-1.5 flex items-center gap-1">
          <p className="text-sm font-bold truncate">{s.name}</p>
          {s.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
          {s.gold && <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {s.country} · {s.yearsActive}y · {s.responseRate}% response
        </p>
        <div className="flex items-center gap-3 mt-2 text-[10px]">
          <span className="flex items-center gap-1 font-semibold">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {s.rating.toFixed(1)}
          </span>
          <span className="text-muted-foreground">On-time {s.onTimeDelivery}%</span>
          <span className="ml-auto text-primary font-bold inline-flex items-center gap-0.5">
            View <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function TapsonLiveCard({ id }: { id: string }) {
  const { data: s } = useQuery({ queryKey: ["tapson-live-supplier", id], queryFn: () => fetchSupplier(id) });
  const { data: prods = [] } = useQuery({
    queryKey: ["tapson-live-products", id],
    queryFn: () => fetchProducts({ supplierId: id, limit: 1 }),
  });
  if (!s) return null;
  const thumb = prods[0]?.image ?? s.banner;
  return (
    <Link
      to={`/live/live-${s.id}`}
      className="block relative rounded-2xl overflow-hidden shadow-card animate-fade-in aspect-[16/9]"
    >
      <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-transparent to-foreground/30" />
      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center gap-1 animate-pulse">
        <Radio className="w-2.5 h-2.5" /> LIVE
      </span>
      <div className="absolute bottom-2 inset-x-2 text-background">
        <p className="text-xs font-bold leading-tight">{s.name} is live</p>
        <p className="text-[10px] opacity-90">Tap to join the stream →</p>
      </div>
    </Link>
  );
}

function TapsonCTA({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-card hover:shadow-elevated transition animate-fade-in"
    >
      {label} <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  );
}

// Convert [/route] tokens into markdown links so they render as clickable
function linkifyRoutes(text: string): string {
  return text.replace(/\[(\/[a-z0-9/_-]+)\]/gi, (_m, path: string) => {
    const label =
      {
        "/rfq": "Request a Quote",
        "/compare": "Compare suppliers",
        "/orders": "My orders",
        "/notifications": "Notifications",
        "/wishlist": "Wishlist",
        "/cart": "Cart",
        "/messages": "Messages",
        "/categories": "Categories",
        "/home": "Home",
        "/account": "Account",
        "/live": "Watch live streams",
      }[path] ?? path;
    return `[${label}](${path})`;
  });
}
