import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase as sb } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const fmt = (n: number) => `$${n.toFixed(2)}`;

type Phase = "loading" | "pending" | "paid" | "failed";

const MAX_ATTEMPTS = 12;
const POLL_MS = 2500;

export default function PaymentStatus() {
  const [params] = useSearchParams();

  // ✅ Only use merchantReference (correct identifier)
  const merchantReference = params.get("merchantReference") || params.get("reference") || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [amount, setAmount] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>("");
  const [attempts, setAttempts] = useState(0);

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (!merchantReference) {
      setPhase("failed");
      setStatusText("Missing merchantReference");
      return;
    }

    const terminalFail = new Set(["FAILED", "CANCELLED", "DECLINED"]);

    const poll = async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelledRef.current) return;

        setAttempts(i + 1);

        try {
          const { data, error } = await sb.functions.invoke("pesepay-status", {
            body: {
              reference: merchantReference, // ✅ keep it simple
            },
          });

          if (error) throw error;

          console.log("🔍 FULL DATA:", data); // DEBUG

          const status = String(data?.status ?? "").toUpperCase();
          setStatusText(status || "PENDING");
          setAmount(Number(data?.amount || 0));

          // ✅ FIX: use status, NOT data.paid
          if (status === "SUCCESS") {
            setPhase("paid");
            sessionStorage.removeItem("pubstore.pesepay.return");
            return;
          }

          if (terminalFail.has(status)) {
            setPhase("failed");
            sessionStorage.removeItem("pubstore.pesepay.return");
            return;
          }

          setPhase("pending");
        } catch (e: any) {
          console.error(e);
          setStatusText(e?.message ?? "Network error");
        }

        await new Promise((r) => setTimeout(r, POLL_MS));
      }

      // timeout → still pending
      setPhase((p) => (p === "loading" ? "pending" : p));
    };

    poll();

    return () => {
      cancelledRef.current = true;
    };
  }, [merchantReference]);

  return (
    <div className="container max-w-lg mx-auto py-10 px-4">
      <Card className="p-8 text-center space-y-5">
        {phase === "loading" && (
          <>
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h1 className="text-2xl font-semibold">Checking payment…</h1>
            <p className="text-sm text-muted-foreground">Reference {merchantReference}</p>
          </>
        )}

        {phase === "pending" && (
          <>
            <Clock className="h-12 w-12 mx-auto text-amber-500" />
            <h1 className="text-2xl font-semibold">Still confirming</h1>
            <p className="text-sm text-muted-foreground">
              Pesepay is processing your payment. Attempt {attempts} of {MAX_ATTEMPTS}.
            </p>
            <p className="text-xs text-muted-foreground">Status: {statusText || "PENDING"}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry now
            </Button>
          </>
        )}

        {phase === "paid" && (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <h1 className="text-2xl font-semibold">Payment successful 🎉</h1>
            {amount > 0 && (
              <p className="text-base">
                Added <strong>{fmt(amount)}</strong> to your wallet.
              </p>
            )}
            <p className="text-xs text-muted-foreground">Reference {merchantReference}</p>
            <Button asChild>
              <Link to="/wallet">Go to wallet</Link>
            </Button>
          </>
        )}

        {phase === "failed" && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h1 className="text-2xl font-semibold">Payment {statusText.toLowerCase() || "failed"}</h1>
            <p className="text-sm text-muted-foreground">Reference {merchantReference}</p>
            <div className="flex gap-2 justify-center">
              <Button asChild variant="outline">
                <Link to="/wallet">Back to wallet</Link>
              </Button>
              <Button asChild>
                <Link to="/wallet">Try again</Link>
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
