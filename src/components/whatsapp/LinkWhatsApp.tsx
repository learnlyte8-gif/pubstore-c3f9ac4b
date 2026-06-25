import { useState } from "react";
import { Copy, MessageCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LinkWhatsApp() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("create_whatsapp_link_code");
      if (error) throw error;
      setCode(String(data));
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate code");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  return (
    <div className="px-4 py-3.5 space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
          <MessageCircle className="w-4.5 h-4.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            Chat with Tapson on WhatsApp <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </p>
          <p className="text-[11px] text-muted-foreground">
            Browse, order, get rides & manage your account from WhatsApp.
          </p>
        </div>
      </div>

      {!code ? (
        <Button size="sm" onClick={generate} disabled={loading} className="w-full">
          {loading ? "Generating…" : "Get my link code"}
        </Button>
      ) : (
        <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Your code</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-2xl font-bold tracking-widest tabular-nums text-center bg-background rounded-lg py-2 border">
              {code}
            </div>
            <button onClick={copyCode} className="w-10 h-10 rounded-lg bg-background border flex items-center justify-center hover:bg-muted">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Open WhatsApp and send this code to the PUBSTORE number you've been chatting with.
            Expires in 20 minutes. Once linked, just talk to Tapson normally.
          </p>
          <Button variant="ghost" size="sm" onClick={generate} className="w-full text-xs">
            Generate new code
          </Button>
        </div>
      )}
    </div>
  );
}
