// deno-lint-ignore-file no-explicit-any
// Tapson WhatsApp Agent — invoked by waapi-inbound after the sender is matched
// to a PUBSTORE user (or anonymous). Uses Lovable AI Gateway with tool calls.
import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp, APP_BRAND, APP_BASE_URL } from "../_shared/whatsapp.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const MODEL = "google/gemini-3-flash-preview";
const json = { ...corsHeaders, "Content-Type": "application/json" };

// ---------- Command-based fallback (no AI required) ----------
// Works when LOVABLE_API_KEY is missing or the AI gateway is unavailable
// (rate limit / credits exhausted). Parses simple keywords and runs the
// same tool functions used by the AI agent.
function fmtMoney(n: any) {
  const v = Number(n || 0);
  return isFinite(v) ? `$${v.toFixed(2)}` : "$0.00";
}

function helpText(signedIn: boolean): string {
  const acct = signedIn
    ? `• orders — your recent orders\n• wallet — your balance\n• cart — open your cart\n• ride <pickup> to <dropoff> — request a ride\n`
    : `• Sign in: ${APP_BASE_URL}/auth (needed for cart, orders, wallet, rides)\n`;
  return `Hi! I'm Tapson on ${APP_BRAND}.\n\nTry:\n• find <keyword>  e.g. find wireless earbuds\n• product <id>\n• add <product_id> [qty]\n• services <city>\n• stays <city>\n• properties <city>\n${acct}• help — this menu\n\nOpen the app: ${APP_BASE_URL}`;
}

function renderList(title: string, items: any[], render: (x: any) => string): string {
  if (!items?.length) return `${title}: no results. Browse: ${APP_BASE_URL}`;
  return `${title}:\n` + items.slice(0, 6).map((it, i) => `${i + 1}. ${render(it)}`).join("\n");
}

async function runWithoutAI(body: string, userId: string | null): Promise<string> {
  const text = body.trim();
  const lower = text.toLowerCase();
  const signedIn = !!userId;

  // Greetings / help
  if (/^(hi|hello|hey|start|menu|help|\?|h)\b/.test(lower) || lower.length < 2) {
    return helpText(signedIn);
  }

  // wallet
  if (/^wallet\b|^balance\b/.test(lower)) {
    const r = await runTool("wallet_balance", {}, userId);
    if (r?.error) return `${r.error}\n${APP_BASE_URL}/wallet`;
    return `Wallet 💰\nPersonal: ${fmtMoney(r.personal_balance)}\nSales: ${fmtMoney(r.sales_balance)}\n\n${APP_BASE_URL}/wallet`;
  }

  // orders
  if (/^orders?\b/.test(lower)) {
    const r = await runTool("recent_orders", { limit: 5 }, userId);
    if (r?.error) return `${r.error}\n${APP_BASE_URL}/orders`;
    return renderList("Recent orders", r, (o: any) => `#${o.ref} — ${fmtMoney(o.total)} — ${o.status}`) + `\n\n${APP_BASE_URL}/orders`;
  }

  // cart
  if (/^cart\b|^checkout\b/.test(lower)) {
    return `Open your cart: ${APP_BASE_URL}/cart`;
  }

  // add <product_id> [qty]
  const addM = text.match(/^add\s+([a-f0-9-]{6,})(?:\s+(\d+))?/i);
  if (addM) {
    const r = await runTool("add_to_cart", { product_id: addM[1], quantity: addM[2] ? Number(addM[2]) : 1 }, userId);
    if (r?.error) return `${r.error}`;
    return `✅ Added ${r.quantity} × ${r.title}\nSubtotal: ${fmtMoney(r.subtotal)}\nCheckout: ${r.checkout_link}`;
  }

  // product <id>
  const prodM = text.match(/^product\s+([a-f0-9-]{6,})/i);
  if (prodM) {
    const r = await runTool("get_product", { id: prodM[1] }, userId);
    if (r?.error) return r.error;
    return `${r.title}\nPrice: ${fmtMoney(r.price)}\n${r.description ? r.description.slice(0, 200) + "\n" : ""}${r.link}`;
  }

  // ride <pickup> to <dropoff>
  const rideM = text.match(/^ride\s+(.+?)\s+to\s+(.+)/i);
  if (rideM) {
    const r = await runTool("create_ride_request",
      { pickup_address: rideM[1].trim(), dropoff_address: rideM[2].trim() }, userId);
    if (r?.error) return `${r.error}\n${r.hint || APP_BASE_URL + "/rides"}`;
    return `🚗 Ride requested!\nTrack: ${r.link}`;
  }

  // services / stays / properties
  const svcM = text.match(/^services?\s*(.*)/i);
  if (svcM) {
    const r = await runTool("search_services", { city: svcM[1] || undefined, limit: 5 }, userId);
    return renderList("Services", r, (s: any) => `${s.name} — ${s.category || ""} ${s.city ? "("+s.city+")" : ""} ${s.rate_per_hour ? "— "+fmtMoney(s.rate_per_hour)+"/hr" : ""}`) + `\n\n${APP_BASE_URL}/services`;
  }
  const stayM = text.match(/^stays?\s*(.*)/i);
  if (stayM) {
    const r = await runTool("search_stays", { city: stayM[1] || undefined, limit: 5 }, userId);
    return renderList("Stays", r, (s: any) => `${s.title} (${s.city || "?"}) — ${fmtMoney(s.price_per_night)}/night`) + `\n\n${APP_BASE_URL}/stays`;
  }
  const propM = text.match(/^propert(?:y|ies)\s*(.*)/i);
  if (propM) {
    const r = await runTool("search_properties", { city: propM[1] || undefined, limit: 5 }, userId);
    return renderList("Properties", r, (p: any) => `${p.title} (${p.city || "?"}) — ${fmtMoney(p.price)} ${p.kind || ""}`) + `\n\n${APP_BASE_URL}/properties`;
  }

  // find / search <query>
  const findM = text.match(/^(?:find|search|look for|show)\s+(.+)/i);
  const query = findM ? findM[1] : text;
  const r = await runTool("search_products", { query, limit: 6 }, userId);
  if (Array.isArray(r) && r.length) {
    return renderList(`Results for "${query}"`, r, (p: any) => `${p.title} — ${fmtMoney(p.price)}\n   ${p.link}\n   (add ${p.id})`) +
      `\n\nMore on ${APP_BASE_URL}`;
  }
  return `No matches for "${query}". Browse all on ${APP_BASE_URL}\n\nType "help" for commands.`;
}

const SYSTEM_PROMPT = `You are Tapson, the AI assistant for ${APP_BRAND} (a global B2B/B2C marketplace) on WhatsApp.

You can help users:
- Browse & search products, services, stays, properties, rides, jobs
- Add things to cart and send them a checkout link to complete payment in the app (wallet only)
- Check their wallet balance, recent orders
- Get deep links into any PUBSTORE section

CRITICAL RULES:
- Keep replies SHORT — WhatsApp users expect concise messages (1-3 short paragraphs max, plus a link).
- Plain text only. No markdown headers, no tables. Use line breaks and emojis sparingly.
- ALWAYS include a clickable ${APP_BASE_URL} deep link when recommending a product, ride, service, etc.
- Use the provided tools when the user asks about real PUBSTORE data — never invent products, prices, or orders.
- If the user is not signed in (no user_id in context), tell them to sign in at ${APP_BASE_URL}/auth before performing account actions like adding to cart, viewing orders, or wallet.
- When you add to cart, tell the user clearly: item added, total, and send the cart link. They confirm payment in the app from their wallet.
- If a tool fails, apologize briefly and give them the manual deep link instead.
- Be warm, helpful, and decisive. Don't ask many follow-up questions — make a best guess and act.`;

// ---------- Tool definitions ----------
const tools: any[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search PUBSTORE products by query/category. Returns up to 6 results.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search" },
          category: { type: "string", description: "Category slug like electronics, fashion, hardware, food" },
          max_price: { type: "number" },
          limit: { type: "integer", default: 6 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product",
      description: "Get details for one product by id.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Add a product to the signed-in user's cart. Returns checkout link.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          quantity: { type: "integer", default: 1 },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wallet_balance",
      description: "Get the signed-in user's wallet balance.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "recent_orders",
      description: "List the signed-in user's most recent orders.",
      parameters: { type: "object", properties: { limit: { type: "integer", default: 5 } } },
    },
  },
  {
    type: "function",
    function: {
      name: "search_services",
      description: "Search local service providers (plumbers, tutors, cleaners, etc).",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string" }, city: { type: "string" }, limit: { type: "integer", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_stays",
      description: "Search hotels, BnBs, short-stays.",
      parameters: { type: "object", properties: { city: { type: "string" }, limit: { type: "integer", default: 5 } } },
    },
  },
  {
    type: "function",
    function: {
      name: "search_properties",
      description: "Search properties for rent/sale.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" }, kind: { type: "string", description: "rent | sale | short_stay" },
          max_price: { type: "number" }, limit: { type: "integer", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_ride_request",
      description: "Create a ride request for the signed-in user. Returns deep link to track and pay.",
      parameters: {
        type: "object",
        properties: {
          pickup_address: { type: "string" }, dropoff_address: { type: "string" }, notes: { type: "string" },
        },
        required: ["pickup_address", "dropoff_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_link",
      description: "Return a PUBSTORE deep link for a given path, e.g. /cart, /orders, /rides.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
];

// ---------- Tool implementations ----------
async function runTool(name: string, args: any, userId: string | null): Promise<any> {
  try {
    switch (name) {
      case "search_products": {
        let q = admin.from("products")
          .select("id, title, price, image, category_slug, supplier_id")
          .eq("active", true).limit(Math.min(args.limit || 6, 10));
        if (args.query) q = q.ilike("title", `%${args.query}%`);
        if (args.category) q = q.eq("category_slug", args.category);
        if (args.max_price) q = q.lte("price", args.max_price);
        const { data } = await q;
        return (data || []).map((p: any) => ({
          id: p.id, title: p.title, price: p.price, category: p.category_slug,
          link: `${APP_BASE_URL}/product/${p.id}`,
        }));
      }
      case "get_product": {
        const { data } = await admin.from("products")
          .select("id, title, price, description, image, supplier_id, sold, rating")
          .eq("id", args.id).maybeSingle();
        if (!data) return { error: "Product not found" };
        return { ...data, link: `${APP_BASE_URL}/product/${data.id}` };
      }
      case "add_to_cart": {
        if (!userId) return { error: "Sign in first at " + APP_BASE_URL + "/auth" };
        const qty = Math.max(1, Math.min(args.quantity || 1, 99));
        const { data: prod } = await admin.from("products").select("id, title, price")
          .eq("id", args.product_id).maybeSingle();
        if (!prod) return { error: "Product not found" };
        const { error } = await admin.from("cart_items").insert({
          user_id: userId, product_id: args.product_id, quantity: qty,
        });
        if (error) return { error: error.message };
        return {
          ok: true, title: prod.title, quantity: qty,
          subtotal: Number(prod.price) * qty,
          checkout_link: `${APP_BASE_URL}/cart`,
        };
      }
      case "wallet_balance": {
        if (!userId) return { error: "Sign in first" };
        const { data } = await admin.from("wallets")
          .select("personal_balance, sales_balance").eq("user_id", userId).maybeSingle();
        return data || { personal_balance: 0, sales_balance: 0 };
      }
      case "recent_orders": {
        if (!userId) return { error: "Sign in first" };
        const { data } = await admin.from("orders")
          .select("id, ref_code, total, status, created_at")
          .eq("buyer_id", userId).order("created_at", { ascending: false })
          .limit(Math.min(args.limit || 5, 10));
        return (data || []).map((o: any) => ({
          ref: o.ref_code || o.id.slice(0, 8), total: o.total, status: o.status,
          link: `${APP_BASE_URL}/orders`,
        }));
      }
      case "search_services": {
        let q = admin.from("service_providers")
          .select("id, name, category, city, rate_per_hour, rating").limit(args.limit || 5);
        if (args.category) q = q.ilike("category", `%${args.category}%`);
        if (args.city) q = q.ilike("city", `%${args.city}%`);
        const { data } = await q;
        return (data || []).map((s: any) => ({ ...s, link: `${APP_BASE_URL}/services` }));
      }
      case "search_stays": {
        let q = admin.from("stays").select("id, title, city, price_per_night").limit(args.limit || 5);
        if (args.city) q = q.ilike("city", `%${args.city}%`);
        const { data } = await q;
        return (data || []).map((s: any) => ({ ...s, link: `${APP_BASE_URL}/stays` }));
      }
      case "search_properties": {
        let q = admin.from("properties").select("id, title, city, price, kind").limit(args.limit || 5);
        if (args.city) q = q.ilike("city", `%${args.city}%`);
        if (args.kind) q = q.eq("kind", args.kind);
        if (args.max_price) q = q.lte("price", args.max_price);
        const { data } = await q;
        return (data || []).map((p: any) => ({ ...p, link: `${APP_BASE_URL}/properties` }));
      }
      case "create_ride_request": {
        if (!userId) return { error: "Sign in first" };
        const { data, error } = await admin.from("rides").insert({
          rider_id: userId,
          pickup_address: args.pickup_address,
          dest_address: args.dropoff_address,
          notes: args.notes || null,
          status: "requested",
        }).select("id").single();
        if (error) return { error: error.message, hint: "Open " + APP_BASE_URL + "/rides to book manually" };
        return { ok: true, ride_id: data.id, link: `${APP_BASE_URL}/rides` };
      }
      case "deep_link":
        return { link: `${APP_BASE_URL}${args.path.startsWith("/") ? args.path : "/" + args.path}` };
      default:
        return { error: "unknown tool" };
    }
  } catch (e: any) {
    return { error: e?.message || "tool failed" };
  }
}

async function callModel(messages: any[]) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: "auto" }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("AI gateway", r.status, t);
    throw new Error(`AI gateway ${r.status}`);
  }
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone, body, user_id } = await req.json();
    if (!phone || !body) return new Response(JSON.stringify({ error: "phone+body required" }), { status: 400, headers: json });

    // Load/create thread
    const { data: thread } = await admin.from("tapson_wa_threads")
      .select("messages").eq("phone", phone).maybeSingle();
    const prev: any[] = Array.isArray(thread?.messages) ? thread!.messages : [];

    const userCtx = user_id
      ? `Signed-in user_id: ${user_id}. You can perform account actions.`
      : `Anonymous WhatsApp user. They must sign in at ${APP_BASE_URL}/auth for account actions.`;

    const messages: any[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nContext: ${userCtx}` },
      ...prev.slice(-12),
      { role: "user", content: body },
    ];

    // Tool loop (max 4 hops) — fall back to command parser if AI unavailable
    let finalText = "";
    let usedFallback = false;
    const aiAvailable = !!LOVABLE_API_KEY;

    if (aiAvailable) {
      try {
        for (let hop = 0; hop < 4; hop++) {
          const resp = await callModel(messages);
          const choice = resp.choices?.[0];
          const msg = choice?.message;
          if (!msg) { finalText = ""; break; }
          messages.push(msg);
          const toolCalls = msg.tool_calls;
          if (!toolCalls || toolCalls.length === 0) {
            finalText = String(msg.content || "").trim();
            break;
          }
          for (const tc of toolCalls) {
            let args: any = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
            const result = await runTool(tc.function.name, args, user_id || null);
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }
        }
      } catch (e) {
        console.warn("AI unavailable, using command fallback:", (e as any)?.message);
        usedFallback = true;
      }
    } else {
      usedFallback = true;
    }

    if (!finalText) {
      usedFallback = true;
      finalText = await runWithoutAI(body, user_id || null);
    }

    // Persist thread (keep last 20 messages incl tool messages compressed)
    const trimmed = messages
      .filter((m) => m.role !== "system")
      .slice(-20);
    await admin.from("tapson_wa_threads").upsert({
      phone, user_id: user_id || null,
      messages: trimmed,
      updated_at: new Date().toISOString(),
    }, { onConflict: "phone" });

    // Send WhatsApp reply
    const sendResult = await sendWhatsApp(phone, finalText.slice(0, 3500));
    await admin.from("whatsapp_send_log").insert({
      user_id: user_id || null,
      event: "tapson_reply",
      to_phone: phone,
      body: finalText,
      status: sendResult.ok ? "sent" : "failed",
      twilio_sid: sendResult.ok ? sendResult.sid : null,
      error: !sendResult.ok ? sendResult.error : null,
    });

    return new Response(JSON.stringify({ ok: true, reply: finalText }), { headers: json });
  } catch (e: any) {
    console.error("tapson-whatsapp", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), { status: 500, headers: json });
  }
});
