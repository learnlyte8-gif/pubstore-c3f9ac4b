import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a user id guaranteed to be backed by a *valid, non-expired* access
 * token, refreshing the session when it's stale.
 *
 * Storage uploads fail with the opaque "new row violates row-level security
 * policy" error whenever the request carries an expired (or missing) JWT —
 * PostgREST/storage then evaluates policies as `anon`, so `auth.uid()` is null
 * and every `uid/...` folder policy denies the write. Calling this first turns
 * that into a clear, actionable state.
 */
export async function ensureUploadIdentity(): Promise<
  { userId: string; error?: undefined } | { userId?: undefined; error: string }
> {
  let { data: { session } } = await supabase.auth.getSession();

  const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
  const stale = !session || expiresAt - Date.now() < 60_000; // refresh within 60s of expiry

  if (stale) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) session = data.session;
  }

  if (!session?.access_token || !session.user?.id) {
    return { error: "Your session expired — please sign in again to upload." };
  }

  return { userId: session.user.id };
}
