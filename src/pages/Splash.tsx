import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { guestOnboarded } from "@/lib/guest";
import logo from "@/assets/pubstore-logo.png";

export default function Splash() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      let dest = "/home";
      if (data.session) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("profile_completed")
          .eq("user_id", data.session.user.id)
          .maybeSingle();
        dest = prof?.profile_completed ? "/home" : "/onboarding";
      } else {
        dest = guestOnboarded.get() ? "/home" : "/onboarding";
      }
      setExiting(true);
      setTimeout(() => navigate(dest, { replace: true }), 280);
    }, 1600);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main
      className={`fixed inset-0 z-50 bg-background flex flex-col items-center justify-center transition-opacity duration-300 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Centered brand mark */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-splash-in">
        <img
          src={logo}
          alt="PUBSTORE"
          width={96}
          height={96}
          className="w-24 h-24 object-contain"
        />
        <h1 className="font-brand text-[28px] tracking-[0.18em] text-foreground">
          PUBSTORE
        </h1>
      </div>

      {/* Footer signature — WhatsApp style */}
      <div className="pb-8 flex flex-col items-center gap-1.5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">
          from
        </p>
        <p className="text-[13px] font-semibold tracking-tight text-foreground/80">
          PUBSTORE Inc.
        </p>
      </div>
    </main>
  );
}
