import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import heroImage from "@/assets/auth-hero.jpg";

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
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/", { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ name, email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: parsed.data.name },
          },
        });
        if (error) {
          toast.error(error.message.includes("already") ? "Account already exists. Sign in instead." : error.message);
          return;
        }
        toast.success("Welcome aboard ✨");
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          toast.error(error.message.includes("Invalid") ? "Wrong email or password" : error.message);
          return;
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
        redirect_uri: `${window.location.origin}/`,
      });
      if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background grid lg:grid-cols-[1.05fr_1fr] overflow-hidden">
      {/* Hero / Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <img
          src={heroImage}
          alt="Luxury fashion editorial with golden silk on deep black background"
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          width={1080}
          height={1600}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/20 to-background/80" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-radial-gold)" }} />

        <div className="relative animate-fade-up">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="font-display text-2xl tracking-wider text-gold-gradient">MAISON</span>
            <span className="font-display text-2xl tracking-[0.3em] text-foreground/90">NOIR</span>
          </Link>
        </div>

        <div className="relative space-y-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="h-px w-16 bg-gold-gradient" />
          <h1 className="font-display text-5xl xl:text-6xl leading-[1.05] text-foreground max-w-md">
            Where rare objects find <em className="text-gold-gradient not-italic">discerning hands.</em>
          </h1>
          <p className="text-foreground/70 max-w-sm leading-relaxed">
            Curated luxury, atelier‑grade craftsmanship, and pieces released in editions of one.
          </p>
          <div className="flex items-center gap-6 pt-4 text-xs uppercase tracking-[0.25em] text-foreground/50">
            <span>Est. MMXXV</span>
            <span className="h-px w-8 bg-foreground/30" />
            <span>Members Only</span>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <section className="relative flex items-center justify-center px-6 py-12 sm:px-12 bg-card">
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{ background: "var(--gradient-radial-gold)" }}
        />
        <div className="relative w-full max-w-md animate-fade-up">
          {/* Mobile brand */}
          <Link to="/" className="lg:hidden mb-10 inline-flex items-center gap-2">
            <span className="font-display text-xl tracking-wider text-gold-gradient">MAISON</span>
            <span className="font-display text-xl tracking-[0.3em]">NOIR</span>
          </Link>

          <div className="space-y-2 mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80">
              {mode === "signin" ? "Welcome back" : "Join the maison"}
            </p>
            <h2 className="font-display text-4xl sm:text-5xl leading-tight">
              {mode === "signin" ? "Sign in to continue." : "Create your account."}
            </h2>
            <p className="text-sm text-muted-foreground pt-2">
              {mode === "signin" ? "New here?" : "Already a member?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-primary hover:text-primary-glow underline-offset-4 hover:underline transition-colors"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>

          {/* Google */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={oauthLoading || loading}
            className="w-full h-12 bg-transparent border-border hover:border-primary/60 hover:bg-secondary text-foreground transition-all duration-300"
          >
            {oauthLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <GoogleIcon />
                <span className="ml-3 font-medium">Continue with Google</span>
              </>
            )}
          </Button>

          <div className="flex items-center gap-4 my-8">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-5">
            {mode === "signup" && (
              <Field
                id="name"
                label="Full name"
                icon={<User className="h-4 w-4" />}
                value={name}
                onChange={setName}
                placeholder="Sofia Laurent"
                autoComplete="name"
              />
            )}

            <Field
              id="email"
              type="email"
              label="Email"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={setEmail}
              placeholder="you@maison.com"
              autoComplete="email"
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Password
                </Label>
                {mode === "signin" && (
                  <button type="button" className="text-xs text-primary/80 hover:text-primary transition-colors">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="h-12 pl-11 pr-11 bg-input border-border focus:border-primary/60 focus-visible:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || oauthLoading}
              className="group w-full h-12 mt-2 bg-gold-gradient text-primary-foreground hover:opacity-95 shadow-luxe-sm hover:shadow-luxe transition-all duration-500 font-medium tracking-wide relative overflow-hidden"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="relative z-10 flex items-center gap-2">
                  {mode === "signin" ? "Sign in" : "Create account"}
                  <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
                </span>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground/80 text-center pt-4 leading-relaxed">
              By continuing you agree to our{" "}
              <a href="#" className="underline underline-offset-2 hover:text-foreground">Terms</a> and{" "}
              <a href="#" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</a>.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({
  id,
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </Label>
      <div className="relative group">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
          {icon}
        </span>
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 pl-11 bg-input border-border focus:border-primary/60 focus-visible:ring-primary/20 transition-all"
        />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-7.4 0-.5-.05-.9-.13-1.3H12z"/>
      <path fill="#34A853" d="M3.9 7.5l3 2.2C7.7 7.7 9.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 8.3 2.5 5.1 4.6 3.9 7.5z" opacity="0"/>
    </svg>
  );
}
