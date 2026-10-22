import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async (attempt = 0): Promise<void> => {
      // Prefer the locally hydrated session — getUser() can fail on cold loads
      // or transient network errors, which previously hid the admin entry.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      if (!userId) {
        if (cancelled) return;
        // Session may still be hydrating from storage on first paint.
        if (attempt < 3) {
          setTimeout(() => { if (!cancelled) check(attempt + 1); }, 300 * (attempt + 1));
          return;
        }
        setIsAdmin(false);
        setReady(true);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // Network/RLS hiccup: retry rather than silently downgrading to non-admin.
        if (attempt < 3) {
          setTimeout(() => { if (!cancelled) check(attempt + 1); }, 500 * (attempt + 1));
          return;
        }
        setIsAdmin(false);
        setReady(true);
        return;
      }

      const admin = !!data;
      setIsAdmin(admin);
      setReady(true);
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setIsAdmin(false);
        setReady(true);
        return;
      }
      check();
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return { isAdmin, ready };
}
