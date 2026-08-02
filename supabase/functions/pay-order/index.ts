import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) => {
  if (status >= 400) console.error('[pay-order]', status, JSON.stringify(body));
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
    if (!url || !anonKey) {
      return json({ error: 'Payment service is not configured' }, 500);
    }

    // User-scoped client: the RPC is SECURITY DEFINER and authorizes the buyer
    // internally via auth.uid(), so the call must carry the user's JWT.
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    if (!orderId) return json({ error: 'orderId is required' }, 400);

    const { data, error } = await client.rpc('pay_order_with_wallet', {
      _order_id: orderId,
    });
    if (error) {
      console.error('[pay-order] rpc failed', JSON.stringify(error));
      return json({ error: error.message }, 400);
    }

    return json({ ok: true, transaction: data });
  } catch (error: any) {
    return json({ error: error.message ?? 'Unable to settle order payment' }, 500);
  }
});
