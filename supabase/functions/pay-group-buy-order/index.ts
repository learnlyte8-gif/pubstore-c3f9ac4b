import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) => {
  if (status >= 400) console.error('[pay-group-buy-order]', status, JSON.stringify(body));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey || !anonKey) {
      return json({ error: 'Payment service is not configured' }, 500);
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401);
    const userId = authData.user.id;

    // User-scoped client: place_group_buy_order relies on auth.uid()
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    if (!groupId) return json({ error: 'groupId is required' }, 400);

    // 1. Verify the caller owns the group buy
    const { data: gb, error: gbErr } = await admin
      .from('group_buys')
      .select('id, owner_id, product_id, supplier_id, status, title')
      .eq('id', groupId)
      .maybeSingle();
    if (gbErr || !gb) return json({ error: 'Group buy not found' }, 404);
    if (gb.owner_id !== userId) return json({ error: 'Only the group owner can place the order' }, 403);
    if (!['open', 'locked'].includes(String(gb.status))) {
      return json({ error: `Group buy is already ${gb.status}` }, 400);
    }

    // 2. Members + product must exist before we create the order
    const { data: members } = await admin
      .from('group_buy_members')
      .select('user_id, qty')
      .eq('group_id', groupId);
    if (!members || members.length === 0) return json({ error: 'No members in this group buy' }, 400);

    const totalQty = members.reduce((s: number, m: any) => s + Number(m.qty ?? 0), 0);
    if (totalQty <= 0) return json({ error: 'Total quantity is zero' }, 400);

    // 3. Create the pooled order via the RPC (runs as the owner)
    const { data: order, error: orderErr } = await asUser.rpc('place_group_buy_order', { _group_id: groupId });
    if (orderErr) {
      console.error('[pay-group-buy-order] place_group_buy_order failed', JSON.stringify(orderErr));
      return json({ error: orderErr.message }, 400);
    }
    if (!order?.id) return json({ error: 'Failed to create order' }, 500);

    const orderId: string = order.id;
    const orderTotal = Number(order.total ?? 0);

    // 4. Split the order total across members by pledged quantity and debit wallets.
    //    All-or-nothing, exactly like pay-order: a single failed debit rolls the
    //    whole collection back so escrow is never partially funded.
    const results: Array<{ user_id: string; qty: number; share: number; status: string; error?: string }> = [];
    const collected: Array<{ user_id: string; share: number }> = [];
    let totalCollected = 0;
    let failure: { user_id: string; error: string } | null = null;

    for (const m of members as any[]) {
      const qty = Number(m.qty ?? 0);
      const share = Math.round(((qty / totalQty) * orderTotal) * 100) / 100;
      if (share <= 0) {
        results.push({ user_id: m.user_id, qty, share, status: 'skipped' });
        continue;
      }
      const { error: txErr } = await admin.rpc('apply_wallet_transaction', {
        _user_id: m.user_id,
        _kind: 'purchase',
        _amount: -share,
        _description: `Group buy "${gb.title ?? 'order'}" — ${qty} unit(s)`,
        _reference: orderId,
        _account: 'personal',
      });
      if (txErr) {
        failure = { user_id: m.user_id, error: txErr.message };
        results.push({ user_id: m.user_id, qty, share, status: 'failed', error: txErr.message });
        break;
      }
      collected.push({ user_id: m.user_id, share });
      totalCollected += share;
      results.push({ user_id: m.user_id, qty, share, status: 'paid' });
    }

    if (failure) {
      // Roll back every debit that already went through, then cancel the order.
      for (const c of collected) {
        const { error: rbErr } = await admin.rpc('apply_wallet_transaction', {
          _user_id: c.user_id,
          _kind: 'refund',
          _amount: c.share,
          _description: `Group buy payment reversed — "${gb.title ?? 'order'}"`,
          _reference: orderId,
          _account: 'personal',
        });
        if (rbErr) console.error('[pay-group-buy-order] rollback failed', c.user_id, rbErr.message);
      }
      await admin.from('orders').update({ status: 'cancelled', payment_status: 'pending' }).eq('id', orderId);
      await admin.from('group_buys').update({ status: 'open' }).eq('id', groupId);
      return json(
        {
          error: 'One or more members could not pay their share, so no one was charged.',
          detail: failure.error,
          members: results,
        },
        400,
      );
    }

    // 5. Funds fully collected -> hold in escrow (mirrors pay_order_with_wallet)
    const escrowAmount = Math.round(totalCollected * 100) / 100;
    await admin
      .from('orders')
      .update({
        status: 'placed',
        payment_method: 'wallet',
        payment_status: 'paid',
        payment_reference: `group_buy:${groupId}`,
        escrow_status: 'held',
        escrow_amount: escrowAmount,
      })
      .eq('id', orderId);

    await admin.from('group_buys').update({ status: 'fulfilled' }).eq('id', groupId);

    // Notify the seller that funds are held, same wording as single-buyer orders
    const { data: sup } = await admin.from('suppliers').select('owner_id').eq('id', gb.supplier_id).maybeSingle();
    if (sup?.owner_id) {
      await admin.from('notifications').insert({
        user_id: sup.owner_id,
        type: 'payment_received',
        title: 'Order paid (funds held)',
        body: `Group buy paid $${escrowAmount.toFixed(2)}. Funds are held in escrow until delivery is confirmed.`,
        link: '/store/orders',
      });
    }

    return json({
      ok: true,
      orderId,
      orderTotal,
      totalCollected: escrowAmount,
      allPaid: true,
      members: results,
    });
  } catch (error: any) {
    console.error('[pay-group-buy-order] unhandled', error);
    return json({ error: error?.message ?? 'Unable to process group buy payment' }, 500);
  }
});
