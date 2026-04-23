import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current auth user id (or null for guests) and a `requireAuth`
 * helper that, when called, either resolves to the uid or redirects the user
 * to the sign-in screen with a friendly toast and an optional redirect target.
 */
export function useAuthUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { userId, ready };
}

export function useRequireAuth() {
  const navigate = useNavigate();
  const { userId } = useAuthUser();

  const requireAuth = useCallback(
    (opts?: { message?: string; redirectTo?: string }) => {
      if (userId) return userId;
      toast.message(opts?.message ?? "Sign in to continue", {
        description: "Create a free account or log in to keep going.",
      });
      const redirect = opts?.redirectTo ?? window.location.pathname + window.location.search;
      navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
      return null;
    },
    [userId, navigate],
  );

  return { userId, requireAuth };
}
