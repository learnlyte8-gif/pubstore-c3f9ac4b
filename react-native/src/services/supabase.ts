import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

const TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;

const isTransient = (err: unknown) => {
  const msg = String((err as Error)?.message ?? err ?? '');
  return (
    msg.includes('Network request failed') ||
    msg.includes('timeout') ||
    msg.includes('Aborted') ||
    msg.includes('The request timed out') ||
    msg.includes('connection') ||
    msg.includes('TLS')
  );
};

/**
 * React Native's fetch (whatwg-fetch over NSURLSession) throws a bare
 * "Network request failed" for DNS hiccups, cold-start radio wake-ups, ATS
 * rejections and dropped TLS handshakes alike. On iOS this most often shows up
 * as the very first auth call failing right after app launch, which makes the
 * whole app look offline. We retry transient failures with backoff and add an
 * explicit timeout so a hung socket can't stall the UI forever.
 */
const resilientFetch: typeof fetch = async (input, init) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      return await fetch(input as RequestInfo, {
        ...(init ?? {}),
        signal: controller.signal,
        // Never let iOS serve a stale/failed cached response for API calls.
        cache: 'no-store',
      } as RequestInit);
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS || !isTransient(err)) break;
      await new Promise((r) => setTimeout(r, 400 * attempt * attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  if (__DEV__) {
    const url = typeof input === 'string' ? input : (input as Request)?.url;
    // eslint-disable-next-line no-console
    console.warn('[supabase] request failed after retries:', url, lastError);
  }
  throw lastError;
};

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as unknown as Storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: resilientFetch,
    headers: { 'X-Client-Info': `${ENV.APP_NAME}/${ENV.APP_VERSION}` },
  },
});

/** Quick reachability probe — useful for an offline banner or debug screen. */
export async function checkBackendReachable(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await resilientFetch(`${ENV.SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: ENV.SUPABASE_ANON_KEY },
    });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: String((err as Error)?.message ?? err) };
  }
}
