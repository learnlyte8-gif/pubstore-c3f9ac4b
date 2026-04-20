import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--gradient-radial-gold)" }}
      />
      <div className="relative max-w-5xl mx-auto px-6 py-10 flex flex-col min-h-screen">
        <header className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="font-display text-xl tracking-wider text-gold-gradient">MAISON</span>
            <span className="font-display text-xl tracking-[0.3em]">NOIR</span>
          </Link>
          {session ? (
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
              className="border-border hover:border-primary/60"
            >
              Sign out
            </Button>
          ) : (
            <Button onClick={() => navigate("/auth")} className="bg-gold-gradient text-primary-foreground shadow-luxe-sm">
              Sign in
            </Button>
          )}
        </header>

        <section className="flex-1 flex flex-col items-center justify-center text-center animate-fade-up">
          <p className="text-xs uppercase tracking-[0.3em] text-primary/80 mb-6">Coming soon</p>
          <h1 className="font-display text-5xl sm:text-7xl leading-[1.05] max-w-3xl">
            An e‑commerce experience, <em className="text-gold-gradient not-italic">reimagined.</em>
          </h1>
          <p className="text-muted-foreground max-w-lg mt-6 leading-relaxed">
            {session
              ? `Welcome back${session.user.email ? `, ${session.user.email}` : ""}. Your storefront awaits.`
              : "Authentication is live. Continue building your storefront, catalog, cart, and checkout."}
          </p>
        </section>
      </div>
    </main>
  );
};

export default Index;
