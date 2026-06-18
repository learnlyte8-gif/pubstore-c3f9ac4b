import { useEffect, useMemo, useRef, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Check, X, Store, ShoppingBag, ArrowRight, ArrowLeft, Sparkles, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import logo from "@/assets/pubstore-logo.png";
import ShoppingBackdrop from "@/components/ShoppingBackdrop";
import { guestInterests, guestOnboarded, guestVerticals } from "@/lib/guest";
import { VERTICALS, type VerticalSlug } from "@/data/verticalsCatalog";

type Role = "supplier" | "buyer";

const INTERESTS = [
  "Fashion", "Electronics", "Beauty", "Home", "Sports", "Books",
  "Toys", "Groceries", "Art", "Handmade", "Jewelry", "Footwear",
  "Health", "Pets", "Auto", "Garden",
];

const usernameSchema = z
  .string()
  .trim()
  .min(3, "At least 3 characters")
  .max(20, "Max 20 characters")
  .regex(/^[a-z0-9_.]+$/, "Lowercase letters, numbers, _ or . only");

const finalSchema = z.object({
  role: z.enum(["supplier", "buyer"]),
  username: usernameSchema,
  address: z.string().trim().min(5, "Address required").max(200),
  contact: z
    .string()
    .trim()
    .min(7, "Contact required")
    .max(30)
    .regex(/^[+0-9 ()\-]+$/, "Only digits, spaces, +, -, ()"),
  interests: z.array(z.string()).min(1, "Pick at least one interest").max(8, "Max 8"),
  verticals: z.array(z.string()).min(1, "Pick at least one service"),
});

export default function Onboarding() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [role, setRole] = useState<Role | null>(null);
  const [username, setUsername] = useState("");
  const [verticals, setVerticals] = useState<string[]>(() => guestVerticals.get());
  const [interests, setInterests] = useState<string[]>(() => guestInterests.get());
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");

  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<null | boolean>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Auth detection (no gate). Skip if a signed-in user already completed onboarding.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
      if (session) {
        const { data } = await supabase
          .from("profiles")
          .select("profile_completed,interests,verticals")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if ((data as any)?.profile_completed) navigate("/home", { replace: true });
        if (data?.interests?.length) setInterests(data.interests);
        if ((data as any)?.verticals?.length) setVerticals((data as any).verticals);
      }
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Live username availability — only relevant for signed-in users
  useEffect(() => {
    if (!userId) return;
    setAvailable(null);
    setUsernameError(null);
    if (!username) return;
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      setUsernameError(parsed.error.issues[0].message);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setChecking(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", parsed.data)
        .maybeSingle();
      setChecking(false);
      if (error) return;
      setAvailable(!data);
    }, 400);
  }, [username, userId]);

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : prev.length >= 8 ? prev : [...prev, item]
    );
  };

  const toggleVertical = (slug: string) => {
    setVerticals((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));
  };

  // Guests: 2 steps (verticals → interests). Authed: 5-step flow.
  const guestStep = !userId;
  const totalSteps = guestStep ? 2 : 5;
  // Step indices (authed): 0 role · 1 username · 2 verticals · 3 interests · 4 address
  // Step indices (guest):  0 verticals · 1 interests

  const canNext = useMemo(() => {
    if (guestStep) {
      if (step === 0) return verticals.length > 0;
      if (step === 1) return interests.length > 0;
      return false;
    }
    if (step === 0) return role !== null;
    if (step === 1) return available === true && !checking && !usernameError;
    if (step === 2) return verticals.length > 0;
    if (step === 3) return interests.length > 0;
    if (step === 4) return address.trim().length >= 5 && /^[+0-9 ()\-]+$/.test(contact) && contact.trim().length >= 7;
    return false;
  }, [guestStep, step, role, available, checking, usernameError, verticals, interests, address, contact]);

  const finishGuest = () => {
    guestInterests.set(interests);
    guestVerticals.set(verticals);
    guestOnboarded.set(true);
    toast.success("All set 🎉", { description: "Your feed is personalized." });
    navigate("/home", { replace: true });
  };

  const handleSubmit = async () => {
    if (!userId || !role) return;
    const parsed = finalSchema.safeParse({ role, username, address, contact, interests, verticals });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    try {
      const { error: profErr } = await (supabase.from("profiles") as any)
        .update({
          username: parsed.data.username,
          address: parsed.data.address,
          contact: parsed.data.contact,
          interests: parsed.data.interests,
          verticals: parsed.data.verticals,
          profile_completed: true,
        })
        .eq("user_id", userId);
      if (profErr) {
        if ((profErr as any).code === "23505") return toast.error("Username already taken");
        throw profErr;
      }

      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: parsed.data.role });
      if (roleErr) throw roleErr;

      toast.success("Profile created 🎉");
      navigate("/home", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSubmitting(false);
    }
  };

  const lastStep = totalSteps - 1;
  const next = () => {
    if (step < lastStep) setStep(step + 1);
    else if (guestStep) finishGuest();
    else handleSubmit();
  };
  const back = () => {
    if (step > 0) setStep(step - 1);
    else navigate("/home");
  };

  if (!authChecked) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-background">
        <CircleSpinner size={24} className="text-muted-foreground" />
      </main>
    );
  }

  const showRole       = !guestStep && step === 0;
  const showUsername   = !guestStep && step === 1;
  const showVerticals  = (guestStep && step === 0) || (!guestStep && step === 2);
  const showInterests  = (guestStep && step === 1) || (!guestStep && step === 3);
  const showAddress    = !guestStep && step === 4;

  return (
    <main className="relative min-h-[100dvh] bg-background flex flex-col px-6 py-8 overflow-hidden">
      <ShoppingBackdrop variant="dark" opacity={0.05} />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-6">
        <button onClick={back} aria-label="Back" className="p-2 -ml-2 text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src={logo} alt="" width={24} height={24} className="w-6 h-6" />
          <span className="font-brand text-lg tracking-wide">PUBSTORE</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {step + 1}/{totalSteps}
        </span>
      </div>

      {/* Progress */}
      <div className="relative h-1 bg-muted rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-foreground transition-all duration-500"
          style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
        />
      </div>

      <div className="relative flex-1 max-w-md w-full mx-auto flex flex-col">
        {showRole && (
          <section className="animate-fade-up">
            <h1 className="text-2xl font-bold mb-1">Welcome 👋</h1>
            <p className="text-sm text-muted-foreground mb-6">How will you use PUBSTORE?</p>
            <div className="space-y-3">
              <RoleCard
                active={role === "buyer"}
                onClick={() => setRole("buyer")}
                icon={<ShoppingBag className="w-6 h-6" />}
                title="I'm a Buyer"
                desc="Discover and shop unique products from creators."
              />
              <RoleCard
                active={role === "supplier"}
                onClick={() => setRole("supplier")}
                icon={<Store className="w-6 h-6" />}
                title="I'm a Supplier"
                desc="Sell your products and grow your store."
              />
            </div>
          </section>
        )}

        {showUsername && (
          <section className="animate-fade-up">
            <h1 className="text-2xl font-bold mb-1">Pick a username</h1>
            <p className="text-sm text-muted-foreground mb-6">This is how people will find you.</p>
            <Label htmlFor="username" className="text-xs uppercase tracking-wide text-muted-foreground">Username</Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="yourname"
                autoComplete="off"
                className="h-12 pl-7 pr-10 bg-input border-border text-base rounded-md"
                maxLength={20}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <CircleSpinner size={16} className="text-muted-foreground" />}
                {!checking && available === true && <Check className="w-4 h-4 text-primary" />}
                {!checking && available === false && <X className="w-4 h-4 text-destructive" />}
              </span>
            </div>
            <p className="mt-2 text-xs min-h-4">
              {usernameError ? (
                <span className="text-destructive">{usernameError}</span>
              ) : available === false ? (
                <span className="text-destructive">Username already taken</span>
              ) : available === true ? (
                <span className="text-primary">@{username} is available</span>
              ) : (
                <span className="text-muted-foreground">3–20 chars · lowercase, numbers, _ or .</span>
              )}
            </p>
          </section>
        )}

        {showVerticals && (
          <section className="animate-fade-up">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Personalize
              </span>
            </div>
            <h1 className="text-2xl font-bold mb-1">
              {role === "supplier" ? "What do you provide?" : "What are you looking for?"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {role === "supplier"
                ? "Pick the services your store will offer — we'll unlock just those tools in MyStore."
                : "Pick the services you want in your feed — marketplace, food, agro, stays, jobs and more."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {VERTICALS.map((v) => {
                const active = verticals.includes(v.slug);
                const Icon = v.icon;
                return (
                  <button
                    key={v.slug}
                    type="button"
                    onClick={() => toggleVertical(v.slug)}
                    className={`text-left p-3 rounded-xl border transition flex items-start gap-2.5 ${
                      active
                        ? "bg-foreground/[0.04] border-foreground"
                        : "bg-transparent border-border hover:border-foreground/40"
                    }`}
                  >
                    <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                      active ? "bg-foreground text-background" : "bg-muted text-foreground"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight truncate">{v.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{v.hint}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {verticals.length} selected · you can change this anytime in Settings
            </p>
          </section>
        )}

        {showInterests && (
          <section className="animate-fade-up">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Interests
              </span>
            </div>
            <h1 className="text-2xl font-bold mb-1">What are you into?</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Pick up to 8 — we'll fine-tune the product feed.
            </p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((item) => {
                const active = interests.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleInterest(item)}
                    className={`px-4 py-2 rounded-full text-sm border transition ${
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{interests.length}/8 selected</p>

            {guestStep && (
              <button
                type="button"
                onClick={() => {
                  guestVerticals.set(verticals);
                  guestOnboarded.set(true);
                  navigate("/home", { replace: true });
                }}
                className="mt-6 text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Skip for now
              </button>
            )}
          </section>
        )}

        {showAddress && (
          <section className="animate-fade-up space-y-5">
            <div>
              <h1 className="text-2xl font-bold mb-1">Almost done</h1>
              <p className="text-sm text-muted-foreground">Where can we reach and ship to you?</p>
            </div>
            <div>
              <Label htmlFor="address" className="text-xs uppercase tracking-wide text-muted-foreground">Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, country"
                className="mt-2 bg-input border-border min-h-[88px] rounded-md"
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="contact" className="text-xs uppercase tracking-wide text-muted-foreground">Contact number</Label>
              <Input
                id="contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="+1 555 123 4567"
                inputMode="tel"
                autoComplete="tel"
                className="mt-2 h-12 bg-input border-border rounded-md"
                maxLength={30}
              />
            </div>
          </section>
        )}

        <div className="mt-auto pt-8">
          <Button
            onClick={next}
            disabled={!canNext || submitting}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-lg disabled:opacity-50"
          >
            {submitting ? (
              <CircleSpinner size={20} />
            ) : step === lastStep ? (
              guestStep ? (
                <span className="inline-flex items-center gap-2">Start exploring <ArrowRight className="w-4 h-4" /></span>
              ) : (
                "Finish"
              )
            ) : (
              <span className="inline-flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></span>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition flex items-start gap-4 ${
        active
          ? "border-foreground bg-foreground/[0.04]"
          : "border-border hover:border-foreground/40"
      }`}
    >
      <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${
        active ? "bg-foreground text-background" : "bg-muted text-foreground"
      }`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-base">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
        active ? "border-foreground bg-foreground" : "border-border"
      }`}>
        {active && <Check className="w-3 h-3 text-background" />}
      </div>
    </button>
  );
}
