import { supabase } from "@/integrations/supabase/client";

const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Headers for calling an AI edge function.
 * AI functions meter credits per signed-in user, so the Authorization header
 * MUST carry the user's access token — the publishable key resolves to no user
 * and the function replies 401 `auth_required`.
 */
export async function aiFunctionHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    apikey: ANON,
    Authorization: `Bearer ${token ?? ANON}`,
    ...extra,
  };
}
