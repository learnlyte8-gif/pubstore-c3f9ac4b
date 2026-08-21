// deno-lint-ignore-file no-explicit-any
// Tapson WhatsApp Agent — invoked by waapi-inbound after the sender is matched
// to a PUBSTORE user (or anonymous). Uses Lovable AI Gateway with tool calls.
import { createClient } from "@supabase/supabase-js";
import {
  sendWhatsApp,
  sendWhatsAppImages,
  firstImageUrl,
  APP_BRAND,
  APP_BASE_URL,
} from "../_shared/whatsapp.ts";
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
  return `Hi! I'm Tapson on ${APP_BRAND}.\n\nTry:\n• find <keyword>  e.g. find wireless earbuds\n• product <id>\n• add <product_id> [qty]\n• store <name> — a supplier/store profile\n• services <city>\n• stays <city>\n• properties <city>\n${acct}• help — this menu\n\nOpen the app: ${APP_BASE_URL}`;
}

function renderList(title: string, items: any[], render: (x: any) => string): string {
  if (!items?.length) return `${title}: no results. Browse: ${APP_BASE_URL}`;
  return `${title}:\n` + items.slice(0, 6).map((it, i) => `${i + 1}. ${render(it)}`).join("\n");
}

function productLine(p: any): string {
  const facts: string[] = [];
  if (p.store?.name) facts.push(p.store.name + (p.store.verified ? " ✅" : ""));
  if (p.rating) facts.push(`★ ${Number(p.rating).toFixed(1)}${p.review_count ? ` (${p.review_count})` : ""}`);
  if (p.sold) facts.push(`${p.sold} sold`);
  if (p.moq) facts.push(`MOQ ${p.moq}${p.unit ? " " + p.unit : ""}`);
  if (p.ship_from) facts.push(`from ${p.ship_from}`);
  if (p.free_shipping) facts.push("free shipping");
  const was = p.original_price && Number(p.original_price) > Number(p.price)
    ? ` (was ${fmtMoney(p.original_price)})` : "";
  return `${p.title} — ${fmtMoney(p.price)}${was}\n   ${facts.join(" • ")}\n   ${p.link}\n   (add ${p.id})`;
}

async function runWithoutAI(body: string, userId: string | null, media: MediaItem[] = []): Promise<string> {
  const text = body.trim();
  const lower = text.toLowerCase();
  const signedIn = !!userId;

  // Greetings / help
  if (/^(hi|hello|hey|start|menu|help|\?|h)\b/.test(lower) || lower.length < 2) {
    return helpText(signedIn);
  }

  // wallet
  if (/^wallet\b|^balance\b/.test(lower)) {
    const r = await runTool("wallet_balance", {}, userId, media);
    if (r?.error) return `${r.error}\n${APP_BASE_URL}/wallet`;
    return `Wallet 💰\nPersonal: ${fmtMoney(r.personal_balance)}\nSales: ${fmtMoney(r.sales_balance)}\n\n${APP_BASE_URL}/wallet`;
  }

  // orders
  if (/^orders?\b/.test(lower)) {
    const r = await runTool("recent_orders", { limit: 5 }, userId, media);
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
    const r = await runTool("add_to_cart", { product_id: addM[1], quantity: addM[2] ? Number(addM[2]) : 1 }, userId, media);
    if (r?.error) return `${r.error}`;
    return `✅ Added ${r.quantity} × ${r.title}\nUnit price: ${fmtMoney(r.unit_price)}\nSubtotal: ${fmtMoney(r.subtotal)}\nCheckout (pay from wallet): ${r.checkout_link}`;
  }

  // product <id>
  const prodM = text.match(/^product\s+([a-f0-9-]{6,})/i);
  if (prodM) {
    const r = await runTool("get_product", { id: prodM[1] }, userId, media);
    if (r?.error) return r.error;
    const bits: string[] = [r.title, `Price: ${fmtMoney(r.price)}${r.original_price && Number(r.original_price) > Number(r.price) ? ` (was ${fmtMoney(r.original_price)})` : ""}`];
    if (r.store?.name) bits.push(`Store: ${r.store.name}${r.store.verified ? " ✅" : ""}${r.store.city ? ` — ${r.store.city}` : ""}`);
    if (r.rating) bits.push(`Rating: ★ ${Number(r.rating).toFixed(1)}${r.review_count ? ` (${r.review_count} reviews)` : ""}${r.sold ? ` • ${r.sold} sold` : ""}`);
    if (r.moq) bits.push(`MOQ: ${r.moq}${r.unit ? " " + r.unit : ""}`);
    if (r.lead_time || r.ready_to_ship) bits.push(`Delivery: ${r.ready_to_ship ? "ready to ship" : ""}${r.lead_time ? `${r.ready_to_ship ? " • " : ""}${r.lead_time}` : ""}`);
    if (r.free_shipping) bits.push("Free shipping ✅");
    if (r.description) bits.push(`\n${String(r.description).slice(0, 400)}`);
    bits.push(`\n${r.link}\nReply "add ${r.id}" to add it to your cart.`);
    return bits.join("\n");
  }

  // ride <pickup> to <dropoff>
  const rideM = text.match(/^ride\s+(.+?)\s+to\s+(.+)/i);
  if (rideM) {
    const r = await runTool("create_ride_request",
      { pickup_address: rideM[1].trim(), dropoff_address: rideM[2].trim() }, userId, media);
    if (r?.error) return `${r.error}\n${r.hint || APP_BASE_URL + "/rides"}`;
    return `🚗 Ride requested!\nPickup: ${rideM[1].trim()}\nDrop-off: ${rideM[2].trim()}\nTrack & pay: ${r.link}`;
  }

  // store / supplier <name>
  const storeM = text.match(/^(?:store|shop|supplier)s?\s*(.*)/i);
  if (storeM) {
    const r = await runTool("search_suppliers", { query: storeM[1] || undefined, limit: 5 }, userId, media);
    return renderList("Stores", r, (s: any) =>
      `${s.name}${s.verified ? " ✅" : ""}\n   ${[s.city, s.country].filter(Boolean).join(", ")}${s.rating ? ` • ★ ${Number(s.rating).toFixed(1)}` : ""}${s.years_active ? ` • ${s.years_active}y active` : ""}\n   ${s.link}`)
      + `\n\nBrowse all: ${APP_BASE_URL}`;
  }

  // services / stays / properties
  const svcM = text.match(/^services?\s*(.*)/i);
  if (svcM) {
    const r = await runTool("search_services", { city: svcM[1] || undefined, limit: 5 }, userId, media);
    return renderList("Services", r, (s: any) => `${s.name} — ${s.category || ""} ${s.city ? "("+s.city+")" : ""} ${s.rate_per_hour ? "— "+fmtMoney(s.rate_per_hour)+"/hr" : ""}${s.rating ? ` • ★ ${Number(s.rating).toFixed(1)}` : ""}`) + `\n\n${APP_BASE_URL}/services`;
  }
  const stayM = text.match(/^stays?\s*(.*)/i);
  if (stayM) {
    const r = await runTool("search_stays", { city: stayM[1] || undefined, limit: 5 }, userId, media);
    return renderList("Stays", r, (s: any) => `${s.title} (${s.city || "?"}) — ${fmtMoney(s.price_per_night)}/night`) + `\n\n${APP_BASE_URL}/stays`;
  }
  const propM = text.match(/^propert(?:y|ies)\s*(.*)/i);
  if (propM) {
    const r = await runTool("search_properties", { city: propM[1] || undefined, limit: 5 }, userId, media);
    return renderList("Properties", r, (p: any) => `${p.title} (${p.city || "?"}) — ${fmtMoney(p.price)} ${p.kind || ""}`) + `\n\n${APP_BASE_URL}/properties`;
  }

  // find / search <query>
  const findM = text.match(/^(?:find|search|look for|show)\s+(.+)/i);
  const query = findM ? findM[1] : text;
  const r = await runTool("search_products", { query, limit: 5 }, userId, media);
  if (Array.isArray(r) && r.length) {
    return renderList(`Results for "${query}"`, r, productLine) +
      `\n\nReply "product <id>" for full details or "add <id>" to buy.\nMore on ${APP_BASE_URL}`;
  }
  return `No matches for "${query}". Browse all on ${APP_BASE_URL}\n\nType "help" for commands.`;
}


const SYSTEM_PROMPT = `You are Tapson, the AI assistant for ${APP_BRAND} (a global B2B/B2C marketplace) on WhatsApp.

You can help users:
- Browse & search products, suppliers/stores, services, stays, properties, rides, jobs
- Add things to cart and send them a checkout link to complete payment in the app (wallet only)
- Check their wallet balance, recent orders
- Get deep links into any PUBSTORE section

ANSWER STYLE — detailed but scannable:
- Plain text only (WhatsApp). No markdown headers, no tables, no bold syntax. Use line breaks, "•" bullets and numbered lists.
- Be PRECISE with real data from tools: exact title, exact price with currency, availability/stock, MOQ, rating and units sold, city/location, supplier/store name, and the deep link. Never round or guess a number.
- For a list, show up to 5 items, each as: "1. <title> — <price>" then an indented line with the key facts (store, rating, city, stock) and the link, and "(add <product_id>)" so they can reply "add <id>".
- For a single product/service/stay, give a short structured brief: price (and original price/discount if any), what it is (2-3 lines from the description, in your own words), key specs, delivery/availability, store + rating, then the link and how to buy ("reply: add <id>").
- End with one clear next step (e.g. "Reply 'add <id> 2' to put 2 in your cart", or a deep link).
- Images: the system automatically sends the photos of the products/stores/listings you mention, so refer to them naturally ("photos above") — never paste raw image URLs into your text.

CRITICAL RULES:
- Use the provided tools when the user asks about real PUBSTORE data — never invent products, prices, stock or orders. If a field is missing, say "not listed" instead of guessing.
- ALWAYS include a clickable ${APP_BASE_URL} deep link when recommending a product, store, ride, service, etc.
- If the user is not signed in (no user_id in context), tell them to sign in at ${APP_BASE_URL}/auth before performing account actions like adding to cart, viewing orders, or wallet.
- When you add to cart, confirm clearly: item, qty, line total, and the cart link. They confirm payment in the app from their wallet.
- If a tool fails, apologise in one line and give the manual deep link instead.
- Be warm, helpful and decisive. Don't ask many follow-up questions — make a best guess and act.`;


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
      description: "Get full details for one product by id (price, description, specs, MOQ, lead time, supplier, rating). Use before recommending a specific item.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_suppliers",
      description: "Search PUBSTORE suppliers/stores by name, category, city or country. Returns store profiles with logo, rating and verification.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }, city: { type: "string" }, country: { type: "string" },
          verified_only: { type: "boolean" }, limit: { type: "integer", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_supplier",
      description: "Get one supplier/store profile plus a few of its products, by supplier id or slug.",
      parameters: { type: "object", properties: { id: { type: "string" }, slug: { type: "string" } } },
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
export type MediaItem = { url: string; caption?: string };

async function supplierNames(ids: string[]): Promise<Record<string, any>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  const { data } = await admin.from("suppliers")
    .select("id, name, city, country, rating, verified, logo").in("id", uniq);
  const map: Record<string, any> = {};
  for (const s of data || []) map[s.id] = s;
  return map;
}

async function runTool(
  name: string,
  args: any,
  userId: string | null,
  media: MediaItem[] = [],
): Promise<any> {
  const pushMedia = (value: unknown, caption?: string) => {
    const url = firstImageUrl(value);
    if (url) media.push({ url, caption });
  };
  try {
    switch (name) {
      case "search_products": {
        let q = admin.from("products")
          .select("id, title, price, original_price, image, gallery, category_slug, supplier_id, rating, review_count, sold, moq, unit, lead_time, ready_to_ship, free_shipping, ship_from")
          .eq("active", true).limit(Math.min(args.limit || 6, 10));
        if (args.query) q = q.ilike("title", `%${args.query}%`);
        if (args.category) q = q.eq("category_slug", args.category);
        if (args.max_price) q = q.lte("price", args.max_price);
        const { data } = await q;
        const sup = await supplierNames((data || []).map((p: any) => p.supplier_id));
        return (data || []).map((p: any) => {
          const s = sup[p.supplier_id];
          pushMedia(p.image ?? p.gallery, `${p.title} — $${Number(p.price || 0).toFixed(2)}\n${APP_BASE_URL}/product/${p.id}`);
          return {
            id: p.id, title: p.title, price: p.price, original_price: p.original_price,
            category: p.category_slug, rating: p.rating, review_count: p.review_count, sold: p.sold,
            moq: p.moq, unit: p.unit, lead_time: p.lead_time, ready_to_ship: p.ready_to_ship,
            free_shipping: p.free_shipping, ship_from: p.ship_from,
            store: s ? { id: s.id, name: s.name, city: s.city, country: s.country, rating: s.rating, verified: s.verified } : null,
            link: `${APP_BASE_URL}/product/${p.id}`,
          };
        });
      }
      case "get_product": {
        const { data } = await admin.from("products")
          .select("id, title, price, original_price, description, image, gallery, video_url, specs, features, use_cases, category_slug, supplier_id, sold, rating, review_count, moq, unit, lead_time, lead_time_days, ready_to_ship, free_shipping, ship_from, badge")
          .eq("id", args.id).maybeSingle();
        if (!data) return { error: "Product not found" };
        const sup = await supplierNames([data.supplier_id]);
        const s = sup[data.supplier_id];
        pushMedia(data.image ?? data.gallery, `${data.title} — $${Number(data.price || 0).toFixed(2)}\n${APP_BASE_URL}/product/${data.id}`);
        const gal = Array.isArray(data.gallery) ? data.gallery.slice(0, 2) : [];
        for (const g of gal) pushMedia(g);
        return {
          ...data, image: undefined, gallery: undefined,
          store: s ? { id: s.id, name: s.name, city: s.city, country: s.country, rating: s.rating, verified: s.verified } : null,
          link: `${APP_BASE_URL}/product/${data.id}`,
        };
      }
      case "search_suppliers": {
        let q = admin.from("suppliers")
          .select("id, name, slug, logo, city, country, rating, verified, gold, about, categories, years_active, response_rate, on_time_delivery, trade_assurance")
          .limit(Math.min(args.limit || 5, 8));
        if (args.query) q = q.ilike("name", `%${args.query}%`);
        if (args.city) q = q.ilike("city", `%${args.city}%`);
        if (args.country) q = q.ilike("country", `%${args.country}%`);
        if (args.verified_only) q = q.eq("verified", true);
        const { data } = await q;
        return (data || []).map((s: any) => {
          const link = `${APP_BASE_URL}/supplier/${s.slug || s.id}`;
          pushMedia(s.logo, `${s.name}${s.city ? " — " + s.city : ""}\n${link}`);
          return { ...s, logo: undefined, link };
        });
      }
      case "get_supplier": {
        let q = admin.from("suppliers")
          .select("id, name, slug, logo, banner, city, country, location_address, rating, verified, gold, about, categories, years_active, response_rate, response_time, on_time_delivery, trade_assurance, website");
        q = args.id ? q.eq("id", args.id) : q.eq("slug", args.slug);
        const { data } = await q.maybeSingle();
        if (!data) return { error: "Store not found" };
        const link = `${APP_BASE_URL}/supplier/${data.slug || data.id}`;
        pushMedia(data.logo, `${data.name}\n${link}`);
        const { data: prods } = await admin.from("products")
          .select("id, title, price, image").eq("supplier_id", data.id).eq("active", true).limit(4);
        for (const p of prods || []) {
          pushMedia(p.image, `${p.title} — $${Number(p.price || 0).toFixed(2)}\n${APP_BASE_URL}/product/${p.id}`);
        }
        return {
          ...data, logo: undefined, banner: undefined, link,
          products: (prods || []).map((p: any) => ({
            id: p.id, title: p.title, price: p.price, link: `${APP_BASE_URL}/product/${p.id}`,
          })),
        };
      }

      case "add_to_cart": {
        if (!userId) return { error: "Sign in first at " + APP_BASE_URL + "/auth" };
        const qty = Math.max(1, Math.min(args.quantity || 1, 99));
        const { data: prod } = await admin.from("products").select("id, title, price, image, moq, unit")
          .eq("id", args.product_id).maybeSingle();
        if (!prod) return { error: "Product not found" };
        const { error } = await admin.from("cart_items").insert({
          user_id: userId, product_id: args.product_id, quantity: qty,
        });
        if (error) return { error: error.message };
        pushMedia(prod.image, `Added to cart: ${prod.title} × ${qty}\n${APP_BASE_URL}/cart`);
        return {
          ok: true, title: prod.title, quantity: qty, unit_price: prod.price,
          moq: prod.moq, unit: prod.unit,
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
          created_at: o.created_at,
          link: `${APP_BASE_URL}/orders`,
        }));
      }
      case "search_services": {
        let q = admin.from("service_providers")
          .select("id, name, category, city, rate_per_hour, rating, cover").limit(args.limit || 5);
        if (args.category) q = q.ilike("category", `%${args.category}%`);
        if (args.city) q = q.ilike("city", `%${args.city}%`);
        const { data } = await q;
        return (data || []).map((s: any) => {
          pushMedia(s.cover, `${s.name}${s.city ? " — " + s.city : ""}\n${APP_BASE_URL}/services`);
          return { ...s, cover: undefined, link: `${APP_BASE_URL}/services` };
        });
      }
      case "search_stays": {
        let q = admin.from("stays").select("id, title, city, price_per_night, cover").limit(args.limit || 5);
        if (args.city) q = q.ilike("city", `%${args.city}%`);
        const { data } = await q;
        return (data || []).map((s: any) => {
          pushMedia(s.cover, `${s.title}${s.city ? " — " + s.city : ""}\n${APP_BASE_URL}/stays`);
          return { ...s, cover: undefined, link: `${APP_BASE_URL}/stays` };
        });
      }
      case "search_properties": {
        let q = admin.from("properties").select("id, title, city, price, kind, cover").limit(args.limit || 5);
        if (args.city) q = q.ilike("city", `%${args.city}%`);
        if (args.kind) q = q.eq("kind", args.kind);
        if (args.max_price) q = q.lte("price", args.max_price);
        const { data } = await q;
        return (data || []).map((p: any) => {
          pushMedia(p.cover, `${p.title}${p.city ? " — " + p.city : ""}\n${APP_BASE_URL}/properties`);
          return { ...p, cover: undefined, link: `${APP_BASE_URL}/properties` };
        });
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
    const media: MediaItem[] = [];

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
            const result = await runTool(tc.function.name, args, user_id || null, media);
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
      media.length = 0;
      finalText = await runWithoutAI(body, user_id || null, media);
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

    // Strip any raw image URLs the model may have pasted into the text
    finalText = finalText.replace(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif|avif)(\?\S*)?/gi, "").trim();

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

    // Send photos for the items actually mentioned in the reply (max 4)
    let imagesSent = 0;
    if (sendResult.ok && media.length) {
      // Prefer media whose deep link / id appears in the reply text
      const mentioned = media.filter((m) => {
        const link = (m.caption || "").match(/https?:\/\/\S+/)?.[0];
        const id = link?.split("/").pop();
        return !!id && finalText.includes(id);
      });
      const toSend = (mentioned.length ? mentioned : media).slice(0, 4);
      const results = await sendWhatsAppImages(phone, toSend, 4);
      imagesSent = results.filter((r) => r.ok).length;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        await admin.from("whatsapp_send_log").insert({
          user_id: user_id || null,
          event: "tapson_reply_image",
          to_phone: phone,
          body: toSend[i]?.url || "",
          status: r.ok ? "sent" : "failed",
          twilio_sid: r.ok ? r.sid : null,
          error: !r.ok ? r.error : null,
        });
      }
    }


    return new Response(JSON.stringify({ ok: true, reply: finalText }), { headers: json });
  } catch (e: any) {
    console.error("tapson-whatsapp", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), { status: 500, headers: json });
  }
});
