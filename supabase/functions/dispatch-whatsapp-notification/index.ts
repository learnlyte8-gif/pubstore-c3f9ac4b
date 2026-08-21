// deno-lint-ignore-file no-explicit-any
import { createClient } from "@supabase/supabase-js";
import {
  sendWhatsApp,
  sendWhatsAppImage,
  firstImageUrl,
  normalizePhoneE164,
  buildRefTag,
  APP_BRAND,
  APP_BASE_URL,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

type Recipient = {
  user_id: string;
  category: "orders" | "sales" | "inquiries" | "general";
};

async function recipientPhone(r: Recipient): Promise<{ phone: string; sandboxJoined: boolean } | null> {
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("phone").eq("user_id", r.user_id).maybeSingle(),
    admin.from("notification_preferences").select(
      "whatsapp_enabled, whatsapp_orders, whatsapp_sales, whatsapp_inquiries, whatsapp_sandbox_joined",
    ).eq("user_id", r.user_id).maybeSingle(),
  ]);
  const phone = normalizePhoneE164(profile?.phone);
  if (!phone) return null;

  // No preferences row yet → treat a saved phone number as opted-in so every
  // user gets WhatsApp updates out of the box (they can turn it off in Settings).
  if (!prefs) return { phone, sandboxJoined: false };

  if (!prefs.whatsapp_enabled) return null;
  const catOk =
    r.category === "general" ||
    (r.category === "orders" && prefs.whatsapp_orders) ||
    (r.category === "sales" && prefs.whatsapp_sales) ||
    (r.category === "inquiries" && prefs.whatsapp_inquiries);
  if (!catOk) return null;
  return { phone, sandboxJoined: !!prefs.whatsapp_sandbox_joined };
}


async function logSend(opts: {
  user_id: string | null;
  event: string;
  entity_id: string | null;
  to_phone: string;
  body: string | null;
  ref_tag: string | null;
  result:
    | { kind: "sent"; sid: string }
    | { kind: "failed"; error: string }
    | { kind: "skipped"; reason: string };
}) {
  await admin.from("whatsapp_send_log").insert({
    user_id: opts.user_id,
    event: opts.event,
    entity_id: opts.entity_id,
    to_phone: opts.to_phone,
    body: opts.body,
    ref_tag: opts.ref_tag,
    status: opts.result.kind,
    twilio_sid: opts.result.kind === "sent" ? opts.result.sid : null,
    error: opts.result.kind === "failed" ? opts.result.error : null,
  });
}

async function deliver(opts: {
  user_id: string;
  event: string;
  entity_id: string;
  category: Recipient["category"];
  refKind: string;
  body: string;
}) {
  const recip = await recipientPhone({ user_id: opts.user_id, category: opts.category });
  if (!recip) return;
  const ref = buildRefTag(opts.refKind, opts.entity_id);
  const fullBody = `${opts.body}\n\n${ref}`;
  const result = await sendWhatsApp(recip.phone, fullBody);
  await logSend({
    user_id: opts.user_id,
    event: opts.event,
    entity_id: opts.entity_id,
    to_phone: recip.phone,
    body: fullBody,
    ref_tag: ref,
    result: result.ok
      ? { kind: "sent", sid: result.sid }
      : { kind: "failed", error: `${result.code ?? ""} ${result.error}`.trim() },
  });
}

// ---------- event renderers ----------

async function handleOrderPlaced(orderId: string) {
  const { data: o } = await admin
    .from("orders")
    .select("id, buyer_id, supplier_id, total, ref_code")
    .eq("id", orderId).maybeSingle();
  if (!o) return;
  const body =
    `🛒 ${APP_BRAND} — Order ${o.ref_code || o.id.slice(0, 8)} confirmed\n` +
    `Total: $${Number(o.total ?? 0).toFixed(2)}\n` +
    `Track: ${APP_BASE_URL}/orders\n` +
    `Reply here to talk to the seller.`;
  await deliver({
    user_id: o.buyer_id, event: "order_placed", entity_id: o.id,
    category: "orders", refKind: "order", body,
  });
}

async function handleOrderNewSale(orderId: string) {
  const { data: o } = await admin
    .from("orders")
    .select("id, supplier_id, total, ref_code, buyer_id")
    .eq("id", orderId).maybeSingle();
  if (!o) return;
  const { data: s } = await admin.from("suppliers").select("owner_id, name")
    .eq("id", o.supplier_id).maybeSingle();
  if (!s?.owner_id) return;
  const body =
    `💰 ${APP_BRAND} — New sale!\n` +
    `Order ${o.ref_code || o.id.slice(0, 8)} · $${Number(o.total ?? 0).toFixed(2)}\n` +
    `Open: ${APP_BASE_URL}/store/actions?section=orders&id=${o.id}\n` +
    `Reply here to message the buyer.`;
  await deliver({
    user_id: s.owner_id, event: "order_new_sale", entity_id: o.id,
    category: "sales", refKind: "order", body,
  });
}

async function handleOrderStatus(orderId: string) {
  const { data: o } = await admin
    .from("orders").select("id, buyer_id, status, ref_code")
    .eq("id", orderId).maybeSingle();
  if (!o) return;
  const body =
    `📦 ${APP_BRAND} — Order ${o.ref_code || o.id.slice(0, 8)} is now ${o.status}\n` +
    `Open: ${APP_BASE_URL}/orders`;
  await deliver({
    user_id: o.buyer_id, event: "order_status", entity_id: o.id,
    category: "orders", refKind: "order", body,
  });
}

async function handleInquiryNew(inqId: string) {
  const { data: i } = await admin
    .from("product_inquiries")
    .select("id, supplier_id, product_title, message, buyer_id")
    .eq("id", inqId).maybeSingle();
  if (!i) return;
  const { data: s } = await admin.from("suppliers").select("owner_id")
    .eq("id", i.supplier_id).maybeSingle();
  if (!s?.owner_id) return;
  const body =
    `📨 ${APP_BRAND} — New inquiry\n` +
    `Product: ${i.product_title || "—"}\n` +
    `"${(i.message || "").slice(0, 140)}"\n` +
    `Approve or decline: ${APP_BASE_URL}/store/actions?section=inquiries&id=${i.id}\n` +
    `Reply here to chat with the buyer.`;
  await deliver({
    user_id: s.owner_id, event: "inquiry_new", entity_id: i.id,
    category: "inquiries", refKind: "inquiry", body,
  });
}

async function handleInquiryDecision(inqId: string) {
  const { data: i } = await admin
    .from("product_inquiries")
    .select("id, buyer_id, product_id, product_title, status")
    .eq("id", inqId).maybeSingle();
  if (!i) return;
  const approved = i.status === "approved";
  const body = approved
    ? `✅ ${APP_BRAND} — Inquiry approved\n${i.product_title || "Your inquiry"} is unlocked.\nOrder now: ${APP_BASE_URL}/product/${i.product_id}`
    : `❌ ${APP_BRAND} — Inquiry declined\nThe supplier declined "${i.product_title || "your inquiry"}".`;
  await deliver({
    user_id: i.buyer_id, event: "inquiry_decision", entity_id: i.id,
    category: "inquiries", refKind: "inquiry", body,
  });
}

async function handlePropertyInquiryNew(inqId: string) {
  const { data: i } = await admin
    .from("property_inquiries")
    .select("id, property_id, inquirer_name, message")
    .eq("id", inqId).maybeSingle();
  if (!i) return;
  const { data: p } = await admin.from("properties")
    .select("owner_user_id, title").eq("id", i.property_id).maybeSingle();
  if (!p?.owner_user_id) return;
  const body =
    `🏠 ${APP_BRAND} — New property inquiry\n` +
    `${p.title || "Your listing"}\n` +
    `From: ${i.inquirer_name || "A guest"}\n` +
    `"${(i.message || "").slice(0, 140)}"\n` +
    `Open: ${APP_BASE_URL}/store/actions?section=properties&id=${i.id}`;
  await deliver({
    user_id: p.owner_user_id, event: "property_inquiry_new", entity_id: i.id,
    category: "inquiries", refKind: "property_inquiry", body,
  });
}

async function handleFinanceApplicationNew(appId: string) {
  const { data: a } = await admin
    .from("finance_applications")
    .select("id, product_id, applicant_name, amount_requested")
    .eq("id", appId).maybeSingle();
  if (!a) return;
  const { data: p } = await admin.from("finance_products")
    .select("owner_user_id, title").eq("id", a.product_id).maybeSingle();
  if (!p?.owner_user_id) return;
  const body =
    `💼 ${APP_BRAND} — New finance application\n` +
    `${p.title || "Your product"}\n` +
    `From: ${a.applicant_name || "An applicant"}` +
    (a.amount_requested ? ` · $${Number(a.amount_requested).toLocaleString()}` : "") + `\n` +
    `Review: ${APP_BASE_URL}/store/actions?section=finance&id=${a.id}`;
  await deliver({
    user_id: p.owner_user_id, event: "finance_application_new", entity_id: a.id,
    category: "inquiries", refKind: "finance_app", body,
  });
}

async function handleRfqSubmitted(rfqId: string) {
  const { data: r } = await admin
    .from("rfqs").select("id, buyer_id, title, qty, unit")
    .eq("id", rfqId).maybeSingle();
  if (!r) return;
  const body =
    `📝 ${APP_BRAND} — RFQ posted\n` +
    `${r.title}${r.qty ? ` · ${r.qty} ${r.unit || ""}` : ""}\n` +
    `We'll WhatsApp you when suppliers quote.\n` +
    `Open: ${APP_BASE_URL}/rfq`;
  await deliver({
    user_id: r.buyer_id, event: "rfq_submitted", entity_id: r.id,
    category: "inquiries", refKind: "rfq", body,
  });
}

// ---------- Generic: every in-app notification → WhatsApp ----------
// Any notification row inserted anywhere in the app (rides, jobs, chats, live,
// bookings, wallet, verifications, group buys, …) is mirrored to WhatsApp.
// Types already covered by a dedicated renderer above are skipped so users
// never get the same update twice.
const COVERED_TYPE_PREFIXES = [
  "order", "sale", "inquiry", "rfq", "property_inquiry", "finance_application",
];

function categoryForType(type: string): Recipient["category"] {
  if (/^order|delivery|shipping|payment|refund|escrow/.test(type)) return "orders";
  if (/^sale|payout|commission/.test(type)) return "sales";
  if (/inquiry|quote|bid|application/.test(type)) return "inquiries";
  return "general";
}

function emojiForType(type: string): string {
  if (/message|chat/.test(type)) return "💬";
  if (/order|delivery|shipping/.test(type)) return "📦";
  if (/payment|wallet|payout|refund/.test(type)) return "💰";
  if (/ride|trip|driver/.test(type)) return "🚗";
  if (/job|application/.test(type)) return "💼";
  if (/live/.test(type)) return "🔴";
  if (/booking|reservation|stay/.test(type)) return "🏠";
  if (/verification/.test(type)) return "🛡️";
  if (/group_buy/.test(type)) return "👥";
  return "🔔";
}

async function handleGenericNotification(notificationId: string) {
  const { data: n } = await admin
    .from("notifications")
    .select("id, user_id, type, title, body, link")
    .eq("id", notificationId).maybeSingle();
  if (!n?.user_id) return;

  const type = String(n.type || "");
  if (COVERED_TYPE_PREFIXES.some((p) => type.startsWith(p))) return;

  // Idempotency — pg_net retries / duplicate triggers must not double-send.
  const { data: already } = await admin.from("whatsapp_send_log")
    .select("id").eq("event", "notification").eq("entity_id", n.id).limit(1).maybeSingle();
  if (already) return;

  const link = n.link
    ? (String(n.link).startsWith("http") ? String(n.link) : `${APP_BASE_URL}${n.link}`)
    : APP_BASE_URL;
  const body =
    `${emojiForType(type)} ${APP_BRAND} — ${n.title || "Update"}\n` +
    (n.body ? `${String(n.body).slice(0, 300)}\n` : "") +
    `Open: ${link}`;

  await deliver({
    user_id: n.user_id, event: "notification", entity_id: n.id,
    category: categoryForType(type), refKind: "notification", body,
  });
}


// ---------- HTTP handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { event, entity_id } = await req.json();
    if (!event || !entity_id) {
      return new Response(JSON.stringify({ error: "event and entity_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (event) {
      case "order_placed":           await handleOrderPlaced(entity_id); break;
      case "order_new_sale":         await handleOrderNewSale(entity_id); break;
      case "order_status":           await handleOrderStatus(entity_id); break;
      case "inquiry_new":            await handleInquiryNew(entity_id); break;
      case "inquiry_decision":       await handleInquiryDecision(entity_id); break;
      case "property_inquiry_new":   await handlePropertyInquiryNew(entity_id); break;
      case "finance_application_new": await handleFinanceApplicationNew(entity_id); break;
      case "rfq_submitted":          await handleRfqSubmitted(entity_id); break;
      case "generic_notification":   await handleGenericNotification(entity_id); break;
      default:
        return new Response(JSON.stringify({ error: `unknown event ${event}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("dispatch-whatsapp-notification error", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
