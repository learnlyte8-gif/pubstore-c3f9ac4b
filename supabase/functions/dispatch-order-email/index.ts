// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function getEmail(userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId)
  return data?.user?.email ?? null
}

async function getDisplayName(userId: string): Promise<string | null> {
  const { data } = await admin.from('profiles').select('display_name, username').eq('user_id', userId).maybeSingle()
  return data?.display_name ?? data?.username ?? null
}

async function buildItems(orderId: string) {
  const { data: rows } = await admin
    .from('order_items')
    .select('product_id, qty, unit_price, products(title, image, gallery)')
    .eq('order_id', orderId)
  return (rows ?? []).map((r: any) => {
    const p = r.products ?? {}
    const img = p.image || (Array.isArray(p.gallery) ? p.gallery[0] : null)
    return {
      title: p.title ?? 'Item',
      image: img ?? undefined,
      price: Number(r.unit_price ?? 0),
      qty: Number(r.qty ?? 1),
      url: r.product_id ? `https://pubstore.app/product/${r.product_id}` : undefined,
    }
  })
}

async function buildRecommended(buyerId: string) {
  const { data } = await admin.rpc('personalized_feed', { _user_id: buyerId, _limit: 3 }).select()
  let ids: string[] = (data ?? []).map((r: any) => r.product_id)
  if (!ids.length) {
    const { data: pop } = await admin.from('products').select('id').eq('active', true).order('sold', { ascending: false }).limit(3)
    ids = (pop ?? []).map((p: any) => p.id)
  }
  if (!ids.length) return []
  const { data: prods } = await admin.from('products').select('id,title,image,gallery,price').in('id', ids)
  return (prods ?? []).map((p: any) => ({
    title: p.title,
    image: p.image || (Array.isArray(p.gallery) ? p.gallery[0] : undefined),
    price: Number(p.price ?? 0),
    url: `https://pubstore.app/product/${p.id}`,
  }))
}

async function sendEmail(templateName: string, recipientEmail: string, idempotencyKey: string, templateData: any) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
    },
    body: JSON.stringify({ templateName, recipientEmail, idempotencyKey, templateData }),
  })
  if (!resp.ok) {
    console.error('send-transactional-email failed', resp.status, await resp.text())
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const event = String(body.event ?? '')
    const orderId = String(body.order_id ?? body.id ?? '')
    if (!orderId) return new Response(JSON.stringify({ error: 'order_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: order } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle()
    if (!order) return new Response(JSON.stringify({ error: 'order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const items = await buildItems(orderId)
    const buyerEmail = await getEmail(order.buyer_id)
    const buyerName = await getDisplayName(order.buyer_id)

    if (event === 'order_created') {
      // Invoice to buyer
      if (buyerEmail) {
        const recommended = await buildRecommended(order.buyer_id)
        await sendEmail('order-confirmation', buyerEmail, `order-confirm-${orderId}`, {
          buyerName, refCode: order.ref_code, orderId,
          total: Number(order.total ?? 0),
          subtotal: Number(order.subtotal ?? order.total ?? 0),
          shipping: order.shipping != null ? Number(order.shipping) : undefined,
          currency: order.currency ?? 'USD',
          items,
          shippingAddress: order.shipping_address ?? undefined,
          recommended,
        })
      }
      // Seller notification
      const { data: supplier } = await admin.from('suppliers').select('owner_id, name').eq('id', order.supplier_id).maybeSingle()
      if (supplier?.owner_id) {
        const sellerEmail = await getEmail(supplier.owner_id)
        const sellerName = await getDisplayName(supplier.owner_id)
        if (sellerEmail) {
          await sendEmail('new-sale', sellerEmail, `new-sale-${orderId}`, {
            sellerName, refCode: order.ref_code, buyerName,
            total: Number(order.total ?? 0),
            currency: order.currency ?? 'USD',
            items,
            shippingAddress: order.shipping_address ?? undefined,
          })
        }
      }
    } else if (event === 'order_status') {
      const status = String(body.status ?? order.status ?? '')
      if (buyerEmail && status) {
        const recommended = ['delivered', 'shipped'].includes(status) ? await buildRecommended(order.buyer_id) : []
        await sendEmail('order-status-update', buyerEmail, `order-status-${orderId}-${status}`, {
          buyerName, refCode: order.ref_code, status, items, recommended,
        })
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
