import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X, Send, Loader2, Eraser, ShieldCheck, Award, Star, ShoppingBag, Radio, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { PRODUCTS, SUPPLIERS, CATEGORIES, getProduct, getSupplier } from "@/data/products";
import { useShop } from "@/store/shop";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "tapson_chat_v1";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tapson-chat`;

const QUICK_PROMPTS = [
  "Find a verified supplier for 500 wireless earbuds",
  "Compare top electronics suppliers",
  "Help me write an RFQ for cotton t-shirts",
  "Show me today's best deals",
];

function buildContext(): string {
  const cats = CATEGORIES.map((c) => c.name).join(", ");
  const verified = SUPPLIERS.filter((s) => s.verified).length;
  const gold = SUPPLIERS.filter((s) => s.gold).length;
  const sampleProducts = PRODUCTS.slice(0, 24)
    .map(
      (p) =>
        `- ${p.title} (id:${p.id}) — $${p.price} · MOQ ${p.moq} ${p.unit} · ${p.category} · supplier:${p.supplierId} · rating:${p.rating}`
    )
    .join("\n");
  const allSuppliers = SUPPLIERS
    .map(
      (s) =>
        `- ${s.name} (id:${s.id}) — ${s.country} · ${s.rating}★ · ${s.responseRate}% resp · ${
          s.verified ? "Verified" : ""
        } ${s.gold ? "Gold" : ""}`
    )
    .join("\n");
  return `Categories: ${cats}
Total products: ${PRODUCTS.length} | Suppliers: ${SUPPLIERS.length} (${verified} verified, ${gold} gold)

Products (use these IDs in ::product[ID] tokens):
${sampleProducts}

Suppliers (use these IDs in ::supplier[ID] and ::live[ID] tokens):
${allSuppliers}`;
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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, context: buildContext() }),
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
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Tapson"
        className="fixed bottom-20 right-4 z-40 lg:bottom-6 group"
      >
        <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
        <span className="relative flex items-center gap-2 h-12 pl-3 pr-4 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-elevated hover:shadow-pop transition-all hover:scale-105">
          <span className="w-7 h-7 rounded-full bg-background/25 flex items-center justify-center backdrop-blur">
            <Sparkles className="w-4 h-4" strokeWidth={2.4} />
          </span>
          <span className="text-sm font-bold tracking-tight">Ask Tapson</span>
        </span>
      </button>

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
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center mr-2 shrink-0 shadow-soft">
          <Sparkles className="w-3.5 h-3.5" />
        </span>
      )}
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-soft ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none text-foreground prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0 prose-strong:text-foreground prose-headings:text-foreground prose-headings:text-sm prose-headings:font-bold">
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
              {linkifyRoutes(msg.content)}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
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
      }[path] ?? path;
    return `[${label}](${path})`;
  });
}
