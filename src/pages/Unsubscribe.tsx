import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "validating" | "ready" | "done" | "already" | "invalid" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("validating");
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_ANON },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setState("invalid"); return; }
        if (data.already_unsubscribed) { setEmail(data.email ?? null); setState("already"); return; }
        setEmail(data.email ?? null);
        setState("ready");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) setState("error"); else setState("done");
    } catch { setState("error"); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-xs font-bold tracking-[0.2em] text-primary">PUBSTORE</div>
          <h1 className="mt-2 text-2xl font-extrabold">Email preferences</h1>
        </div>
        {state === "validating" && <p className="text-center text-sm text-muted-foreground">Checking your link…</p>}
        {state === "ready" && (
          <>
            <p className="text-center text-sm text-muted-foreground">
              Unsubscribe {email ? <strong className="text-foreground">{email}</strong> : "this address"} from PUBSTORE emails?
            </p>
            <button onClick={confirm} disabled={busy} className="mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? "Unsubscribing…" : "Confirm unsubscribe"}
            </button>
            <Link to="/" className="mt-3 block text-center text-xs text-muted-foreground">Cancel</Link>
          </>
        )}
        {state === "done" && (
          <>
            <p className="text-center text-sm">You're unsubscribed. We won't email you again.</p>
            <Link to="/" className="mt-6 block text-center text-sm font-semibold text-primary">Back to PUBSTORE</Link>
          </>
        )}
        {state === "already" && (
          <>
            <p className="text-center text-sm">{email ?? "This address"} is already unsubscribed.</p>
            <Link to="/" className="mt-6 block text-center text-sm font-semibold text-primary">Back to PUBSTORE</Link>
          </>
        )}
        {state === "invalid" && <p className="text-center text-sm text-destructive">This unsubscribe link is invalid or has expired.</p>}
        {state === "error" && <p className="text-center text-sm text-destructive">Something went wrong. Please try again.</p>}
      </div>
    </div>
  );
}
