// Shared WhatsApp helpers — waapi.app (https://waapi.app)
// Sends through the user's paired WhatsApp Web instance.

export const APP_BRAND = "PUBSTORE";
export const APP_BASE_URL = "https://pubstore.app";

export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (digits.length < 8 || digits.length > 15) return null;
    return "+" + digits;
  }
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

function toWaapiChatId(value: string): string {
  if (value.includes("@")) return value;
  return `${value.replace(/\D/g, "")}@c.us`;
}

// wasenderapi.com expects a plain E.164 phone (or a raw JID like
// "263771234567@s.whatsapp.net" / group "...@g.us").
function toWasenderTo(value: string): string {
  const v = String(value);
  if (/@(?:g\.us|s\.whatsapp\.net|lid)$/i.test(v)) return v;
  if (v.includes("@")) {
    // waapi-style "<digits>@c.us"
    const digits = v.split("@")[0].replace(/\D/g, "");
    return "+" + digits;
  }
  const digits = v.replace(/\D/g, "");
  return "+" + digits;
}

// Preferred provider: wasenderapi.com
// POST https://wasenderapi.com/api/send-message  { to, text }
async function sendViaWasender(toE164: string, body: string): Promise<WhatsAppSendResult> {
  const token = Deno.env.get("WASENDER_API_KEY")!;
  const baseUrl = Deno.env.get("WASENDER_BASE_URL") || "https://wasenderapi.com";
  const to = toWasenderTo(toE164);

  const res = await fetch(`${baseUrl}/api/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ to, text: body }),
  });

  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not json */ }

  if (!res.ok || data?.success === false) {
    return {
      ok: false,
      status: res.status,
      error: data?.message || data?.error || text || `HTTP ${res.status}`,
    };
  }
  const sid = String(data?.data?.msgId ?? data?.data?.messageId ?? data?.msgId ?? "");
  return { ok: true, sid };
}

// waapi.app endpoint: POST /api/v1/instances/{id}/client/action/send-message
// Body: { chatId: "<digits>@c.us", message: "..." }
async function sendViaWaapi(toE164: string, body: string): Promise<WhatsAppSendResult> {
  const token = Deno.env.get("WAAPI_ACCESS_TOKEN");
  const instanceId = Deno.env.get("WAAPI_INSTANCE_ID");
  const baseUrl = Deno.env.get("WAAPI_BASE_URL") || "https://waapi.app";
  if (!token) return { ok: false, status: 500, error: "WAAPI_ACCESS_TOKEN not configured" };
  if (!instanceId) return { ok: false, status: 500, error: "WAAPI_INSTANCE_ID not configured" };

  // Accept either a raw waapi chatId ("12345@c.us" / "12345@lid" / "12345@g.us")
  // or an E.164 phone. LIDs cannot be converted to phone numbers, so we must
  // reply to the same chatId we received the message from.
  const trialTarget = Deno.env.get("WAAPI_TRIAL_NUMBER")?.trim();
  const chatId = trialTarget ? toWaapiChatId(trialTarget) : toWaapiChatId(toE164);

  const url = `${baseUrl}/api/v1/instances/${instanceId}/client/action/send-message`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ chatId, message: body }),
  });

  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not json */ }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.message || data?.error || text || `HTTP ${res.status}`,
    };
  }
  const sid = data?.data?.messageId || data?.data?.id?._serialized || data?.messageId || "";
  return { ok: true, sid };
}

export async function sendWhatsApp(toE164: string, body: string): Promise<WhatsAppSendResult> {
  if (Deno.env.get("WASENDER_API_KEY")) return await sendViaWasender(toE164, body);
  return await sendViaWaapi(toE164, body);
}

// ---------- Media (images) ----------
function isHttpUrl(u: string | null | undefined): boolean {
  return !!u && /^https?:\/\//i.test(String(u).trim());
}

async function sendImageViaWasender(toE164: string, imageUrl: string, caption?: string): Promise<WhatsAppSendResult> {
  const token = Deno.env.get("WASENDER_API_KEY")!;
  const baseUrl = Deno.env.get("WASENDER_BASE_URL") || "https://wasenderapi.com";
  const res = await fetch(`${baseUrl}/api/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ to: toWasenderTo(toE164), imageUrl, text: caption || "" }),
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok || data?.success === false) {
    return { ok: false, status: res.status, error: data?.message || data?.error || text || `HTTP ${res.status}` };
  }
  const sid = String(data?.data?.msgId ?? data?.data?.messageId ?? data?.msgId ?? "");
  return { ok: true, sid };
}

async function sendImageViaWaapi(toE164: string, imageUrl: string, caption?: string): Promise<WhatsAppSendResult> {
  const token = Deno.env.get("WAAPI_ACCESS_TOKEN");
  const instanceId = Deno.env.get("WAAPI_INSTANCE_ID");
  const baseUrl = Deno.env.get("WAAPI_BASE_URL") || "https://waapi.app";
  if (!token) return { ok: false, status: 500, error: "WAAPI_ACCESS_TOKEN not configured" };
  if (!instanceId) return { ok: false, status: 500, error: "WAAPI_INSTANCE_ID not configured" };

  const trialTarget = Deno.env.get("WAAPI_TRIAL_NUMBER")?.trim();
  const chatId = trialTarget ? toWaapiChatId(trialTarget) : toWaapiChatId(toE164);

  const res = await fetch(`${baseUrl}/api/v1/instances/${instanceId}/client/action/send-media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ chatId, mediaUrl: imageUrl, mediaCaption: caption || "" }),
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) {
    return { ok: false, status: res.status, error: data?.message || data?.error || text || `HTTP ${res.status}` };
  }
  const sid = data?.data?.messageId || data?.data?.id?._serialized || data?.messageId || "";
  return { ok: true, sid };
}

/** Send a single image with an optional caption. */
export async function sendWhatsAppImage(
  toE164: string,
  imageUrl: string,
  caption?: string,
): Promise<WhatsAppSendResult> {
  if (!isHttpUrl(imageUrl)) return { ok: false, status: 400, error: "invalid image url" };
  const url = String(imageUrl).trim();
  if (Deno.env.get("WASENDER_API_KEY")) return await sendImageViaWasender(toE164, url, caption);
  return await sendImageViaWaapi(toE164, url, caption);
}

/** Send up to `max` images sequentially. Returns per-item results. */
export async function sendWhatsAppImages(
  toE164: string,
  items: Array<{ url: string; caption?: string }>,
  max = 4,
): Promise<WhatsAppSendResult[]> {
  const out: WhatsAppSendResult[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (out.length >= max) break;
    const url = String(it?.url || "").trim();
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(await sendWhatsAppImage(toE164, url, it.caption));
  }
  return out;
}

/** Pick the first usable http(s) image URL out of a text/JSON/array-ish field. */
export function firstImageUrl(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const u = firstImageUrl(v);
      if (u) return u;
    }
    return null;
  }
  const s = String(value).trim();
  if (!s) return null;
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      return firstImageUrl(Array.isArray(parsed) ? parsed : Object.values(parsed));
    } catch { /* fall through */ }
  }
  for (const part of s.split(/[\s,]+/)) {
    if (isHttpUrl(part)) return part.replace(/[),.]+$/, "");
  }
  return null;
}


