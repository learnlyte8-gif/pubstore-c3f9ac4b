import { useEffect, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/pubstore-logo.png";
import ShoppingBackdrop from "@/components/ShoppingBackdrop";

const emailSchema = z.string().trim().email({ message: "Enter a valid email" }).max(255);
const codeSchema = z.string().trim().regex(/^\d{6}$/, { message: "Enter the 6-digit code" });

type Step = "email" | "code";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirect") || "/home";
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    const routeForSession = async (uid: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("user_id", uid)
        .maybeSingle();
      if (!data?.profile_completed) {
        navigate("/onboarding", { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setTimeout(() => routeForSession(session.user.id), 0);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) routeForSession(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, redirectTo]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/home`,
          data: name.trim() ? { display_name: name.trim() } : undefined,
        },
      });
      if (error) return toast.error(error.message);
      toast.success("Code sent — check your email");
      setStep("code");
      setResendIn(45);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = codeSchema.safeParse(code);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: parsed.data,
        type: "email",
      });
      if (error) {
        return toast.error(error.message.includes("expired") ? "Code expired — request a new one" : "Invalid code");
      }
      toast.success("Welcome to PUBSTORE 🎉");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}${redirectTo}`,
      });
      if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <main className="relative min-h-[100dvh] bg-background flex flex-col items-center justify-between px-6 py-10 sm:py-14 overflow-hidden">
      <ShoppingBackdrop variant="dark" opacity={0.07} />
      <div className="relative w-full max-w-sm flex-1 flex flex-col justify-center">
        <div className="flex flex-col items-center mb-10 animate-fade-up">
          <img src={logo} alt="PUBSTORE" width={72} height={72} className="w-18 h-18 mb-4" />
          <h1 className="font-brand text-5xl text-foreground tracking-wide">PUBSTORE</h1>
        </div>

        <button
          type="button"
          onClick={() => navigate("/home")}
          className="mb-6 mx-auto block text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Continue browsing as guest
        </button>

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name (optional)"
              autoComplete="name"
              className="h-12 bg-input border-border text-sm rounded-md"
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className="h-12 bg-input border-border text-sm rounded-md"
            />
            <Button
              type="submit"
              disabled={loading || oauthLoading}
              className="w-full h-12 mt-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-lg disabled:opacity-60"
            >
              {loading ? <CircleSpinner size={20} /> : "Send code"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center pt-2">
              We'll email you a 6-digit code — no password needed.
            </p>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
            <p className="text-xs text-muted-foreground text-center mb-2">
              Code sent to <span className="font-semibold text-foreground">{email}</span>
            </p>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="h-12 bg-input border-border text-center text-lg tracking-[0.5em] font-bold rounded-md"
            />
            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full h-12 mt-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-lg disabled:opacity-60"
            >
              {loading ? <CircleSpinner size={20} /> : "Verify & continue"}
            </Button>
            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Change email
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || loading}
                onClick={() => sendCode()}
                className="text-primary font-medium disabled:opacity-50"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center gap-4 my-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted-foreground uppercase">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={oauthLoading || loading}
          className="w-full h-12 flex items-center justify-center gap-3 text-sm font-semibold text-primary hover:opacity-80 transition-opacity animate-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          {oauthLoading ? (
            <CircleSpinner size={20} />
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>
      </div>

      <div className="relative w-full max-w-sm mt-8">
        <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
          By continuing, you agree to PUBSTORE's{" "}
          <Link to="#" className="text-foreground/80 underline-offset-2 hover:underline">Terms</Link> and{" "}
          <Link to="#" className="text-foreground/80 underline-offset-2 hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-7.4 0-.5-.05-.9-.13-1.3H12z" />
    </svg>
  );
}
