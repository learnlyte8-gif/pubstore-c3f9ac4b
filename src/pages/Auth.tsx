import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/pubstore-logo.png";
import ShoppingBackdrop from "@/components/ShoppingBackdrop";

const signInSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email" }).max(255),
  password: z.string().min(6, { message: "At least 6 characters" }).max(72),
});
const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(1, { message: "Name is required" }).max(100),
});

type Mode = "signin" | "signup";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirect") || "/home";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ name, email, password });
        if (!parsed.success) return toast.error(parsed.error.issues[0].message);
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: { display_name: parsed.data.name },
          },
        });
        if (error) {
          return toast.error(
            error.message.includes("already") ? "Account already exists. Sign in instead." : error.message
          );
        }
        toast.success("Welcome to PUBSTORE 🎉");
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) return toast.error(parsed.error.issues[0].message);
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          return toast.error(error.message.includes("Invalid") ? "Wrong email or password" : error.message);
        }
        toast.success("Welcome back");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/home`,
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
        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-10 animate-fade-up">
          <img src={logo} alt="PUBSTORE" width={72} height={72} className="w-18 h-18 mb-4" />
          <h1 className="font-brand text-5xl text-foreground tracking-wide">PUBSTORE</h1>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
          {mode === "signup" && (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              autoComplete="name"
              className="h-12 bg-input border-border text-sm rounded-md"
            />
          )}
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Phone number, username or email"
            autoComplete="email"
            className="h-12 bg-input border-border text-sm rounded-md"
          />
          <div className="relative">
            <Input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="h-12 bg-input border-border text-sm rounded-md pr-14"
            />
            {password.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground text-sm font-semibold"
              >
                {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || oauthLoading}
            className="w-full h-12 mt-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-lg disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "signin" ? "Log in" : "Sign up"}
          </Button>

          {mode === "signin" && (
            <div className="text-center pt-2">
              <button type="button" className="text-xs text-primary font-medium">
                Forgot password?
              </button>
            </div>
          )}
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted-foreground uppercase">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={oauthLoading || loading}
          className="w-full h-12 flex items-center justify-center gap-3 text-sm font-semibold text-primary hover:opacity-80 transition-opacity animate-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          {oauthLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>
      </div>

      {/* Bottom switch card — Instagram style */}
      <div className="relative w-full max-w-sm mt-8">
        <div className="border border-border rounded-md py-4 text-center text-sm animate-fade-up" style={{ animationDelay: "200ms" }}>
          {mode === "signin" ? (
            <>
              Don't have an account?{" "}
              <button onClick={() => setMode("signup")} className="text-primary font-semibold">
                Sign up
              </button>
            </>
          ) : (
            <>
              Have an account?{" "}
              <button onClick={() => setMode("signin")} className="text-primary font-semibold">
                Log in
              </button>
            </>
          )}
        </div>

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
