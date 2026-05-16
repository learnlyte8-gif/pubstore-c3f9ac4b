import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sb = supabase as any;

type QuoteMsg = {
  id: string;
  quote_id: string;
  sender_id: string;
  body: string | null;
  proposed_price: number | null;
  proposed_moq: number | null;
  proposed_packaging: string | null;
  proposed_lead_time: string | null;
  created_at: string;
};

export default function QuoteNegotiation({ quoteId, currentUserId }: { quoteId: string; currentUserId: string | null }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<QuoteMsg[]>([]);
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("");
  const [moq, setMoq] = useState("");
  const [packaging, setPackaging] = useState("");
  const [leadTime, setLeadTime] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const { data } = await sb.from("quote_messages")
      .select("*").eq("quote_id", quoteId)
      .order("created_at", { ascending: true });
    setMsgs((data ?? []) as QuoteMsg[]);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 50);
  };

  useEffect(() => {
    if (!open) return;
    load();
    const ch = supabase.channel(`qmsg-${quoteId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quote_messages", filter: `quote_id=eq.${quoteId}` },
        (p) => { setMsgs((arr) => [...arr, p.new as QuoteMsg]); setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 50); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, quoteId]);

  const send = async () => {
    if (!currentUserId) return toast.error("Sign in to negotiate");
    if (!body.trim() && !price && !moq && !packaging && !leadTime) return;
    setSending(true);
    const { error } = await sb.from("quote_messages").insert({
      quote_id: quoteId, sender_id: currentUserId,
      body: body.trim() || null,
      proposed_price: price ? Number(price) : null,
      proposed_moq: moq ? Number(moq) : null,
      proposed_packaging: packaging.trim() || null,
      proposed_lead_time: leadTime.trim() || null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody(""); setPrice(""); setMoq(""); setPackaging(""); setLeadTime("");
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full h-9 mt-2 rounded-full bg-muted text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-muted/70">
        <MessageSquare className="w-3.5 h-3.5" /> Negotiate price · MOQ · packaging
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-border bg-background">
      <div ref={scrollRef} className="max-h-60 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 && <p className="text-[11px] text-center text-muted-foreground">Start the conversation — propose a price, MOQ or packaging change.</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.body && <p>{m.body}</p>}
                {(m.proposed_price != null || m.proposed_moq != null || m.proposed_packaging || m.proposed_lead_time) && (
                  <div className={`mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] ${mine ? "opacity-90" : "text-muted-foreground"}`}>
                    {m.proposed_price != null && <div>Price: <b>${Number(m.proposed_price).toFixed(2)}</b></div>}
                    {m.proposed_moq != null && <div>MOQ: <b>{m.proposed_moq}</b></div>}
                    {m.proposed_packaging && <div className="col-span-2">Packaging: <b>{m.proposed_packaging}</b></div>}
                    {m.proposed_lead_time && <div className="col-span-2">Lead time: <b>{m.proposed_lead_time}</b></div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border p-2 space-y-1.5">
        <textarea
          rows={2} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="w-full p-2 rounded-md bg-muted text-xs resize-none"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0} step="0.01" placeholder="Counter price"
            className="h-8 px-2 rounded-md bg-muted text-xs" />
          <input value={moq} onChange={(e) => setMoq(e.target.value)} type="number" min={0} placeholder="Counter MOQ"
            className="h-8 px-2 rounded-md bg-muted text-xs" />
          <input value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder="Packaging"
            className="h-8 px-2 rounded-md bg-muted text-xs" />
          <input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="Lead time"
            className="h-8 px-2 rounded-md bg-muted text-xs" />
        </div>
        <button onClick={send} disabled={sending}
          className="w-full h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Send proposal</>}
        </button>
      </div>
    </div>
  );
}
