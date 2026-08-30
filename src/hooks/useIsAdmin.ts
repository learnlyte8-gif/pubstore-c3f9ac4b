import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "pubstore.isAdmin";

function cachedFor(userId: string | null): boolean {
  if (!userId) return false;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { userId: string; isAdmin: boolean };
    return parsed.userId === userId && !!parsed.isAdmin;
  } catch {
    return false;
  }
}

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
        try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
        setIsAdmin(false);
        setReady(true);
        return;
      }

      // Show the cached answer immediately so the entry doesn't flicker away.
      if (!cancelled && cachedFor(userId)) {
        setIsAdmin(true);
        setReady(true);
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
        setReady(true);
        return;
      }

      const admin = !!data;
      setIsAdmin(admin);
      setReady(true);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ userId, isAdmin: admin }));
      } catch { /* ignore */ }
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
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
