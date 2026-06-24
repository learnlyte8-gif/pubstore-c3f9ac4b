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

// waapi.app endpoint: POST /api/v1/instances/{id}/client/action/send-message
// Body: { chatId: "<digits>@c.us", message: "..." }
export async function sendWhatsApp(toE164: string, body: string): Promise<WhatsAppSendResult> {
  const token = Deno.env.get("WAAPI_ACCESS_TOKEN");
  const instanceId = Deno.env.get("WAAPI_INSTANCE_ID");
  const baseUrl = Deno.env.get("WAAPI_BASE_URL") || "https://waapi.app";
  if (!token) return { ok: false, status: 500, error: "WAAPI_ACCESS_TOKEN not configured" };
  if (!instanceId) return { ok: false, status: 500, error: "WAAPI_INSTANCE_ID not configured" };

  const digits = toE164.replace(/\D/g, "");
  const chatId = `${digits}@c.us`;

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
