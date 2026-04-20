import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Check, X, Store, ShoppingBag, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import logo from "@/assets/pubstore-logo.png";
import ShoppingBackdrop from "@/components/ShoppingBackdrop";

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
});

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [role, setRole] = useState<Role | null>(null);
  const [username, setUsername] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");

  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<null | boolean>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Auth gate + skip if already completed
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session) return navigate("/auth", { replace: true });
      setUserId(session.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data?.profile_completed) navigate("/home", { replace: true });
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Live username availability
  useEffect(() => {
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
  }, [username]);

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : prev.length >= 8 ? prev : [...prev, item]
    );
  };

  const canNext = useMemo(() => {
    if (step === 0) return role !== null;
    if (step === 1) return available === true && !checking && !usernameError;
    if (step === 2) return interests.length > 0;
    if (step === 3) return address.trim().length >= 5 && /^[+0-9 ()\-]+$/.test(contact) && contact.trim().length >= 7;
    return false;
  }, [step, role, available, checking, usernameError, interests, address, contact]);

  const handleSubmit = async () => {
    if (!userId || !role) return;
    const parsed = finalSchema.safeParse({ role, username, address, contact, interests });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    try {
      // Update profile
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          username: parsed.data.username,
          address: parsed.data.address,
          contact: parsed.data.contact,
          interests: parsed.data.interests,
          profile_completed: true,
        })
        .eq("user_id", userId);
      if (profErr) {
        if (profErr.code === "23505") return toast.error("Username already taken");
        throw profErr;
      }

      // Upsert role (replace any prior)
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

  const next = () => (step < 3 ? setStep(step + 1) : handleSubmit());
  const back = () => (step > 0 ? setStep(step - 1) : navigate("/auth"));

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
        <span className="text-xs text-muted-foreground tabular-nums">{step + 1}/4</span>
      </div>

      {/* Progress */}
      <div className="relative h-1 bg-muted rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-foreground transition-all duration-500"
          style={{ width: `${((step + 1) / 4) * 100}%` }}
        />
      </div>

      <div className="relative flex-1 max-w-md w-full mx-auto flex flex-col">
        {step === 0 && (
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

        {step === 1 && (
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
                {checking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
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

        {step === 2 && (
          <section className="animate-fade-up">
            <h1 className="text-2xl font-bold mb-1">Your interests</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Pick up to 8 — we'll personalize your feed.
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
          </section>
        )}

        {step === 3 && (
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
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : step === 3 ? (
              "Finish"
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
