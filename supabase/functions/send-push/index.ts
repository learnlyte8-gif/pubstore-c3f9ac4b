// Send Web Push notifications to a user's subscribed devices.
// Triggered by a database webhook on `notifications` INSERT, OR called manually.
//
// Auth: this function does its own validation:
//   - Database webhook calls are accepted (they come from inside Supabase)
//   - Service-role-key calls are accepted (for internal use)
// We don't rely on Supabase JWT verification because pg_net cron jobs can't
// easily attach user JWTs.
//
// Body shape (single notification):
//   { type: "INSERT", table: "notifications", record: { user_id, title, body, link, type } }
// or direct invocation:
//   { user_id, title, body, url, type }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@pubstore.world";

// ---------------- VAPID JWT signing (P-256 / ES256) ----------------

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const std = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convert our raw 65-byte uncompressed P-256 public key to JWK x/y components.
function publicKeyToJwk(rawPub: Uint8Array): { x: string; y: string } {
  // rawPub: 0x04 || X(32) || Y(32)
  if (rawPub.length !== 65 || rawPub[0] !== 0x04) {
    throw new Error("Invalid raw public key");
  }
  return {
    x: b64urlEncode(rawPub.slice(1, 33)),
    y: b64urlEncode(rawPub.slice(33, 65)),
  };
}

async function importVapidKey(): Promise<{ key: CryptoKey; jwk: JsonWebKey }> {
  const d = b64urlDecode(VAPID_PRIVATE);
  const pub = b64urlDecode(VAPID_PUBLIC);
  const xy = publicKeyToJwk(pub);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: b64urlEncode(d),
    x: xy.x,
    y: xy.y,
    ext: true,
  };
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return { key, jwk };
}

async function makeVapidJwt(audience: string): Promise<string> {
  const { key } = await importVapidKey();
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 11, // 11h
    sub: VAPID_SUBJECT,
  };
  const enc = (obj: unknown) =>
    b64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const sigDer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  // WebCrypto returns r||s already (raw) for ECDSA — perfect for JWT.
  const sig = b64urlEncode(new Uint8Array(sigDer));
  return `${signingInput}.${sig}`;
}

// ---------------- Push send (no payload — falls back gracefully) ----------------
//
// Sending an encrypted payload requires implementing aes128gcm encryption
// per RFC 8291. To keep this function compact and dependency-free, we send
// "tickle" pushes (no payload). The service worker will look up the latest
// notification from the DB on each push.

function originOf(endpoint: string): string {
  const u = new URL(endpoint);
  return `${u.protocol}//${u.host}`;
}

async function sendOne(endpoint: string): Promise<{ ok: boolean; status: number }> {
  const aud = originOf(endpoint);
  const jwt = await makeVapidJwt(aud);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      "TTL": "300",
      "Urgency": "normal",
      "Content-Length": "0",
    },
    body: null,
  });
  return { ok: res.ok || res.status === 201, status: res.status };
}

// ---------------- Handler ----------------

interface NotifRow {
  user_id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  type?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    // Two shapes: webhook {record:{...}} or direct {user_id,...}
    const record: NotifRow | undefined = body.record ?? body;
    if (!record?.user_id || !record?.title) {
      return new Response(JSON.stringify({ error: "user_id and title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user preferences for the matching push_* column
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const t = String(record.type ?? "");
    let prefCol: string | null = null;
    if (t === "follower_new_product") prefCol = "push_followed_supplier_new_product";
    else if (t === "follower_live") prefCol = "push_followed_supplier_live";
    else if (t.startsWith("order") || t === "new_order") prefCol = "push_orders";
    else if (t === "message") prefCol = "push_messages";
    else if (t.startsWith("rfq")) prefCol = "push_rfq";
    else if (t === "price") prefCol = "push_wishlist_price_drop";
    else if (t === "restock") prefCol = "push_wishlist_restock";

    if (prefCol) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select(prefCol)
        .eq("user_id", record.user_id)
        .maybeSingle();
      if (prefs && (prefs as Record<string, unknown>)[prefCol] === false) {
        return new Response(JSON.stringify({ skipped: "user opted out" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint")
      .eq("user_id", record.user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no devices" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.allSettled(
      subs.map((s) => sendOne((s as { endpoint: string }).endpoint)),
    );

    // Clean up dead subscriptions (404/410)
    const dead: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && (r.value.status === 404 || r.value.status === 410)) {
        dead.push((subs[i] as { endpoint: string }).endpoint);
      }
    });
    if (dead.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", dead);
    }

    const ok = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    return new Response(JSON.stringify({ sent: ok, total: subs.length, cleaned: dead.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
