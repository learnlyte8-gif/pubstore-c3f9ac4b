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
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be under 72 characters" });
const codeSchema = z.string().trim().regex(/^\d{6,8}$/, { message: "Enter the code from your email" });
const phoneDigitsSchema = z.string().regex(/^\d{6,15}$/, { message: "Enter a valid phone number" });

type Step = "credentials" | "code";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirect") || "/home";
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    const isExternalOAuth = redirectTo.startsWith("/.lovable/oauth/");
    const routeForSession = async (uid: string) => {
      // For external OAuth consent flows, always return to the consent URL
      // so the authorization can be completed. Skip onboarding gating.
      if (isExternalOAuth) {
        window.location.href = redirectTo;
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("user_id", uid)
        .maybeSingle();
      if (!data?.profile_completed) {
        navigate("/onboarding?redirect=" + encodeURIComponent(redirectTo), { replace: true });
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

  const buildMetadata = (phoneE164?: string) => {
    const metadata: Record<string, unknown> = {};
    if (name.trim()) metadata.display_name = name.trim();
    if (phoneE164) {
      metadata.phone = phoneE164;
      metadata.phone_country = country.iso2;
    }
    return metadata;
  };

  /** Sends the emailed verification code (OTP). Uses signInWithOtp, which is the
   *  channel that actually delivers a numeric code for this project. */
  const sendCode = async (targetEmail: string, phoneE164?: string) => {
    const metadata = buildMetadata(phoneE164);
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: true,
        data: Object.keys(metadata).length ? metadata : undefined,
      },
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Verification code sent — check your email");
    setStep("code");
    setResendIn(45);
    return true;
  };


  /** Step 1 — password first: sign in if the account exists, otherwise sign up
   *  with the password and send an email verification code. */
  const submitCredentials = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return toast.error(parsedEmail.error.issues[0].message);
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) return toast.error(parsedPassword.error.issues[0].message);

    const phoneDigits = phone.replace(/\D/g, "");
    let phoneE164: string | undefined;
    if (phoneDigits) {
      const phoneOk = phoneDigitsSchema.safeParse(phoneDigits);
      if (!phoneOk.success) return toast.error(phoneOk.error.issues[0].message);
      phoneE164 = toE164(country.dial, phoneDigits);
    }

    setLoading(true);
    try {
      // Existing account → straight in.
      const signIn = await supabase.auth.signInWithPassword({
        email: parsedEmail.data,
        password: parsedPassword.data,
      });
      if (!signIn.error) {
        if (phoneE164 && signIn.data.user?.id) {
          await supabase
            .from("profiles")
            .upsert({ user_id: signIn.data.user.id, phone: phoneE164 }, { onConflict: "user_id" });
        }
        toast.success("Welcome back 👋");
        return;
      }

      const msg = signIn.error.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        const { error } = await supabase.auth.resend({ type: "signup", email: parsedEmail.data });
        if (error) return toast.error(error.message);
        toast.success("Verification code sent — check your email");
        setStep("code");
        setResendIn(45);
        return;
      }
      if (!msg.includes("invalid login credentials")) {
        return toast.error(signIn.error.message);
      }

      // New account → create it with the chosen password.
      const metadata = buildMetadata(phoneE164);
      const { data, error } = await supabase.auth.signUp({
        email: parsedEmail.data,
        password: parsedPassword.data,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectTo.startsWith("/") ? redirectTo : "/home"}`,
          data: Object.keys(metadata).length ? metadata : undefined,
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          return toast.error("Wrong password for this email — try again or reset it.");
        }
        return toast.error(error.message);
      }
      if (data.session) {
        toast.success("Welcome to PUBSTORE 🎉");
        return;
      }
      toast.success("Verification code sent — check your email");
      setStep("code");
      setResendIn(45);
    } finally {
      setLoading(false);
    }
  };

  /** Step 2 — email verification code confirms the new account. */
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = codeSchema.safeParse(code);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      const { data: verifyData, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: parsed.data,
        type: "email",
      });
      if (error) {
        return toast.error(error.message.includes("expired") ? "Code expired — request a new one" : "Invalid code");
      }

      // Persist phone for both new and returning users (handle_new_user only fires on create)
      const phoneDigits = phone.replace(/\D/g, "");
      const uid = verifyData?.user?.id;
      if (uid && phoneDigits) {
        const phoneE164 = toE164(country.dial, phoneDigits);
        await supabase
          .from("profiles")
          .upsert({ user_id: uid, phone: phoneE164 }, { onConflict: "user_id" });
      }

      toast.success("Welcome to PUBSTORE 🎉");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (resendIn > 0 || loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) return toast.error(error.message);
      toast.success("New code sent");
      setResendIn(45);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async () => {
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return toast.error("Enter your email first");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) return toast.error(error.message);
      toast.success("Password reset link sent to your email");
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

        {step === "credentials" ? (
          <form onSubmit={submitCredentials} className="space-y-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
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
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="h-12 bg-input border-border text-sm rounded-md pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <PhoneInput
              country={country}
              onCountryChange={setCountry}
              value={phone}
              onChange={setPhone}
              placeholder="Phone number (optional)"
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-lg disabled:opacity-60"
            >
              {loading ? <CircleSpinner size={20} /> : "Continue"}
            </Button>
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={forgotPassword}
                disabled={loading}
                className="text-xs text-primary font-medium disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              New here? We'll create your account and email you a verification code.
            </p>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
            <p className="text-xs text-muted-foreground text-center mb-2">
              Verification code sent to <span className="font-semibold text-foreground">{email}</span>
            </p>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="Verification code"
              className="h-12 bg-input border-border text-center text-lg tracking-[0.5em] font-bold rounded-md"
            />
            <Button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full h-12 mt-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-lg disabled:opacity-60"
            >
              {loading ? <CircleSpinner size={20} /> : "Verify & continue"}
            </Button>
            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => { setStep("credentials"); setCode(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Change email
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || loading}
                onClick={resendCode}
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
          <Link to="/terms" className="text-foreground/80 underline-offset-2 hover:underline">Terms</Link> and{" "}
          <Link to="/privacy-policy" className="text-foreground/80 underline-offset-2 hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
