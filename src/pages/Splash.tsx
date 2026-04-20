import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/pubstore-logo.png";
import ShoppingBackdrop from "@/components/ShoppingBackdrop";

export default function Splash() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setExiting(true);
      const { data } = await supabase.auth.getSession();
      let dest = "/auth";
      if (data.session) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("profile_completed")
          .eq("user_id", data.session.user.id)
          .maybeSingle();
        dest = prof?.profile_completed ? "/home" : "/onboarding";
      }
      setTimeout(() => navigate(dest, { replace: true }), 300);
    }, 2200);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-animated-ig overflow-hidden transition-opacity duration-300 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <ShoppingBackdrop variant="light" opacity={0.22} />
      <div className="relative flex-1" />

      <div className="relative flex flex-col items-center gap-5 animate-splash-in">
        <div className="bg-white/15 backdrop-blur-xl rounded-3xl p-5 shadow-2xl animate-splash-pulse">
          <img
            src={logo}
            alt="PUBSTORE logo"
            width={96}
            height={96}
            className="w-24 h-24 object-contain"
          />
        </div>
        <h1 className="text-white text-5xl font-brand drop-shadow-lg tracking-wide">
          PUBSTORE
        </h1>
      </div>

      <div className="relative pb-12 flex flex-col items-center gap-2 animate-splash-in">
        <p className="text-white/80 text-xs uppercase tracking-[0.3em]">from</p>
        <p className="text-white font-semibold text-sm">PUBSTORE Inc.</p>
      </div>
    </main>
  );
}
