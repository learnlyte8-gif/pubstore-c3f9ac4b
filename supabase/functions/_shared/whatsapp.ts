// Shared WhatsApp helpers for Twilio sandbox sending.
// Uses the Lovable connector gateway so no raw Twilio secrets are needed.

export const TWILIO_SANDBOX_FROM = "whatsapp:+14155238886";
export const TWILIO_SANDBOX_JOIN_NUMBER = "+1 415 523 8886";
export const APP_BRAND = "PUBSTORE";
export const APP_BASE_URL = "https://pubstore.app";

export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  // Strip everything except digits and leading +
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) {
    // Already E.164-ish
    const digits = cleaned.slice(1);
    if (digits.length < 8 || digits.length > 15) return null;
    return "+" + digits;
  }
  // No plus → assume already includes country code, prepend +
  if (cleaned.length < 8 || cleaned.length > 15) return null;
  return "+" + cleaned;
}

export function buildRefTag(kind: string, id: string): string {
  return `[ref:${kind}_${id}]`;
}

export function parseRefTag(body: string | null | undefined): { kind: string; id: string } | null {
  if (!body) return null;
  const m = body.match(/\[ref:([a-z_]+)_([0-9a-f-]+)\]/i);
  if (!m) return null;
  return { kind: m[1], id: m[2] };
}

export type WhatsAppSendResult =
  | { ok: true; sid: string }
  | { ok: false; status: number; error: string; code?: number };

export async function sendWhatsApp(toE164: string, body: string): Promise<WhatsAppSendResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!LOVABLE_API_KEY) return { ok: false, status: 500, error: "LOVABLE_API_KEY not configured" };
  if (!TWILIO_API_KEY) return { ok: false, status: 500, error: "TWILIO_API_KEY not configured" };

  const params = new URLSearchParams({
    From: TWILIO_SANDBOX_FROM,
    To: `whatsapp:${toE164}`,
    Body: body,
  });

  const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not json */ }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.message || text || `HTTP ${res.status}`,
      code: data?.code,
    };
  }
  return { ok: true, sid: data?.sid ?? "" };
}
