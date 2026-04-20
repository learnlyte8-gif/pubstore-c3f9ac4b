import { useMemo, useState } from "react";
import { Search, Send, ShieldCheck, Paperclip, ArrowLeft } from "lucide-react";
import { SUPPLIERS, PRODUCTS } from "@/data/products";

type Msg = { id: string; from: "me" | "them"; text: string; time: string };

const initialThreads: Record<string, Msg[]> = {
  s1: [
    { id: "1", from: "them", text: "Hi! Thanks for your interest in our wireless earbuds. How can we help?", time: "10:24" },
    { id: "2", from: "me", text: "Hello, I'd like a quote for 500 units with custom packaging.", time: "10:26" },
    { id: "3", from: "them", text: "Sure — for 500 units we offer $21.50/pair. Custom box adds $0.80/unit. Lead time is 18 days.", time: "10:28" },
  ],
  s2: [
    { id: "1", from: "them", text: "Welcome to Lumière Apparel. Our linen shirt MOQ is 10 pieces.", time: "Yesterday" },
  ],
  s4: [
    { id: "1", from: "me", text: "Do you ship samples to Kenya?", time: "Mon" },
    { id: "2", from: "them", text: "Yes, sample fee is $15 + DHL shipping. Refunded on first order.", time: "Mon" },
  ],
};

const lastMessage = (msgs: Msg[]) => msgs[msgs.length - 1];

export default function Messages() {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");

  const list = useMemo(
    () =>
      SUPPLIERS.filter((s) => threads[s.id]).filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase())
      ),
    [threads, search]
  );

  const active = activeId ? SUPPLIERS.find((s) => s.id === activeId) : null;
  const activeMsgs = activeId ? threads[activeId] ?? [] : [];
  const activeProduct = activeId ? PRODUCTS.find((p) => p.supplierId === activeId) : null;

  const send = () => {
    if (!draft.trim() || !activeId) return;
    const msg: Msg = {
      id: Date.now().toString(),
      from: "me",
      text: draft.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setThreads((t) => ({ ...t, [activeId]: [...(t[activeId] ?? []), msg] }));
    setDraft("");
    setTimeout(() => {
      const reply: Msg = {
        id: Date.now().toString() + "r",
        from: "them",
        text: "Thanks for your message — we'll get back within our response time.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setThreads((t) => ({ ...t, [activeId]: [...(t[activeId] ?? []), reply] }));
    }, 1200);
  };

  if (active) {
    return (
      <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)] lg:h-[calc(100dvh-3.5rem)]">
        <div className="px-3 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2">
          <button onClick={() => setActiveId(null)} aria-label="Back" className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={active.logo} alt="" className="w-9 h-9 rounded-full object-cover shadow-soft" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate flex items-center gap-1">
              {active.name}
              {active.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
            </p>
            <p className="text-[11px] text-muted-foreground">Responds {active.responseTime} · {active.responseRate}%</p>
          </div>
        </div>

        {activeProduct && (
          <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center gap-2">
            <img src={activeProduct.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
            <p className="text-xs flex-1 line-clamp-1">{activeProduct.title}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-muted/20">
          {activeMsgs.map((m) => (
            <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm shadow-card ${
                  m.from === "me"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card text-foreground rounded-bl-sm"
                }`}
              >
                <p>{m.text}</p>
                <p className={`text-[10px] mt-0.5 ${m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {m.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-3 py-2.5 border-t border-border bg-card shadow-elevated flex items-center gap-2 safe-bottom">
          <button aria-label="Attach" className="p-2 rounded-full hover:bg-muted">
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Write a message..."
            className="flex-1 h-10 px-4 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40 shadow-soft"
          />
          <button
            onClick={send}
            aria-label="Send"
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-pop"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 border-b border-border bg-card shadow-soft">
        <h1 className="text-xl font-bold mb-3">Messages</h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full h-10 pl-9 pr-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40 shadow-soft"
          />
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-16">No conversations yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((s) => {
            const last = lastMessage(threads[s.id] ?? []);
            return (
              <li key={s.id}>
                <button
                  onClick={() => setActiveId(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition text-left"
                >
                  <img src={s.logo} alt="" className="w-12 h-12 rounded-full object-cover shadow-soft shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate flex items-center gap-1">
                        {s.name}
                        {s.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{last?.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{last?.text}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
