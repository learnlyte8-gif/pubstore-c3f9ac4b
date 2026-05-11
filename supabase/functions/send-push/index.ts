// Send Web Push notifications to a user's subscribed devices.
// Triggered by a database trigger on `notifications` INSERT, OR called manually.
//
// Sends encrypted payloads using the `web-push` library, so the title/body/link
// arrive with the push event itself — meaning notifications render correctly
// on locked devices and when the browser is fully closed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Public key is shipped to clients too — safe to hardcode here.
const VAPID_PUBLIC =
  "BM2jhYequ4m17iXGvIwWan_q_unCX4HRRsm2na7ATM24dRfXxfPFaSqeTm1baEHl0QqIXBTQJ8_6jXVWHIrHnlQ";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@pubstore.world";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface NotifRow {
  user_id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  type?: string | null;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const record: NotifRow | undefined = body.record ?? body;

    if (!record?.user_id || !record?.title) {
      return new Response(JSON.stringify({ error: "user_id and title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Honor per-type opt-outs
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
      .select("endpoint, p256dh, auth")
      .eq("user_id", record.user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no devices" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payload the service worker will receive
    const payload = JSON.stringify({
      title: record.title,
      body: record.body ?? "",
      url: record.link ?? "/home",
      tag: t || undefined,
      data: { type: t || undefined },
    });

    const results = await Promise.allSettled(
      (subs as SubRow[]).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 300, urgency: "normal" },
        ),
      ),
    );

    // Clean up dead subscriptions (404/410)
    const dead: string[] = [];
    let okCount = 0;
    const errors: Array<{ endpoint: string; status?: number; message?: string; body?: string }> = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        okCount++;
      } else {
        const err = r.reason as { statusCode?: number; body?: string; message?: string };
        const endpoint = (subs as SubRow[])[i].endpoint;
        errors.push({ endpoint: endpoint.slice(0, 60), status: err?.statusCode, message: err?.message, body: err?.body });
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead.push(endpoint);
        }
      }
    });
    if (errors.length) console.error("push failures", JSON.stringify(errors));
    if (dead.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", dead);
    }

    return new Response(
      JSON.stringify({ sent: okCount, total: subs.length, cleaned: dead.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
