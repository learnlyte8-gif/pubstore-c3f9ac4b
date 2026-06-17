import { useEffect, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/pubstore-logo.png";
import ShoppingBackdrop from "@/components/ShoppingBackdrop";
import { PhoneInput, DEFAULT_COUNTRY, toE164, type Country } from "@/components/PhoneInput";

const emailSchema = z.string().trim().email({ message: "Enter a valid email" }).max(255);
const codeSchema = z.string().trim().regex(/^\d{8}$/, { message: "Enter the 8-digit code" });
const phoneDigitsSchema = z.string().regex(/^\d{6,15}$/, { message: "Enter a valid phone number" });

type Step = "email" | "code";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirect") || "/home";
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
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

    const phoneDigits = phone.replace(/\D/g, "");
    let phoneE164: string | undefined;
    if (phoneDigits) {
      const phoneOk = phoneDigitsSchema.safeParse(phoneDigits);
      if (!phoneOk.success) return toast.error(phoneOk.error.issues[0].message);
      phoneE164 = toE164(country.dial, phoneDigits);
    }

    setLoading(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (name.trim()) metadata.display_name = name.trim();
      if (phoneE164) {
        metadata.phone = phoneE164;
        metadata.phone_country = country.iso2;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/home`,
          data: Object.keys(metadata).length ? metadata : undefined,
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
              disabled={loading}
              className="w-full h-12 mt-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-lg disabled:opacity-60"
            >
              {loading ? <CircleSpinner size={20} /> : "Send code"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center pt-2">
              We'll email you a 8-digit code — no password needed.
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
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="8-digit code"
              className="h-12 bg-input border-border text-center text-lg tracking-[0.5em] font-bold rounded-md"
            />
            <Button
              type="submit"
              disabled={loading || code.length !== 8}
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

