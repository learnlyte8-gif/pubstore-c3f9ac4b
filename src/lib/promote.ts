import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

const VISITOR_KEY = "pubstore.visitor.id";
const PENDING_CLAIM_KEY = "pubstore.promote.pendingClaim";

/** Stable anonymous visitor id used to attribute a promoter link before sign-in. */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `v_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return `v_${Date.now()}`;
  }
}

export const markPendingClaim = () => {
  try { localStorage.setItem(PENDING_CLAIM_KEY, "1"); } catch { /* ignore */ }
};

/**
 * Attach a promoter link clicked before sign-in to the now signed-in account,
 * so the commission survives sign-up, cart abandonment and later returns.
 */
export async function claimPromoterAttribution() {
  try {
    if (!localStorage.getItem(PENDING_CLAIM_KEY)) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await sb.rpc("promote_claim_attribution", { _visitor_id: getVisitorId() });
    localStorage.removeItem(PENDING_CLAIM_KEY);
  } catch { /* attribution is best-effort */ }
}

/** Record a click on a promoter short link. Works for signed-out visitors too. */
export async function trackPromotionClick(code: string, source?: string) {
  const { data, error } = await sb.rpc("track_promotion_click", {
    _code: code,
    _visitor_id: getVisitorId(),
    _source: source ?? null,
    _landing_page: typeof window !== "undefined" ? window.location.pathname : null,
    _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  if (error) throw error;
  markPendingClaim();
  return (data ?? {}) as { found?: boolean; product_id?: string | null; code?: string };
}

export const promoteOrigin = () =>
  typeof window !== "undefined" ? window.location.origin : "https://pubstore.app";

export const shareUrlForCode = (code: string) => `${promoteOrigin()}/x/${code}`;

export const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

/** Share copy built only from verified product data, so prices can't be faked. */
export function shareMessage(opts: {
  title: string;
  price: number;
  originalPrice?: number | null;
  url: string;
}) {
  const discount =
    opts.originalPrice && opts.originalPrice > opts.price
      ? ` (was ${money(opts.originalPrice)})`
      : "";
  return [
    `${opts.title}`,
    `Only ${money(opts.price)}${discount} on PUBSTORE.`,
    `Order here: ${opts.url}`,
  ].join("\n");
}

export type ShareChannel = "whatsapp" | "facebook" | "x" | "telegram" | "copy";

export function channelShareUrl(channel: ShareChannel, text: string, url: string): string | null {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  switch (channel) {
    case "whatsapp": return `https://wa.me/?text=${t}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x": return `https://twitter.com/intent/tweet?text=${t}`;
    case "telegram": return `https://t.me/share/url?url=${u}&text=${encodeURIComponent(text)}`;
    default: return null;
  }
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
