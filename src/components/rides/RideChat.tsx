import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRideMessages } from "@/hooks/useRides";

export default function RideChat({
  rideId,
  myUserId,
  counterpartName,
}: {
  rideId: string;
  myUserId: string;
  counterpartName: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const messages = useRideMessages(rideId);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    await supabase.from("ride_messages").insert({ ride_id: rideId, sender_id: myUserId, body: text });
    setBody("");
    setSending(false);
  };

  const unread = messages.filter((m) => m.sender_id !== myUserId).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chat with driver"
        className="relative w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center shadow-elevated"
      >
        <MessageCircle className="w-4 h-4" />
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={() => setOpen(false)}>
          <div
            className="w-full sm:max-w-md bg-card border-t sm:border sm:rounded-3xl shadow-elevated max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">In-trip chat</p>
                <p className="font-bold text-sm">{counterpartName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-6">Say hi 👋 — messages are end-of-trip only.</p>
              )}
              {messages.map((m) => {
                const mine = m.sender_id === myUserId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {m.body}
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={send} className="p-2 border-t flex items-center gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 h-10 px-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
