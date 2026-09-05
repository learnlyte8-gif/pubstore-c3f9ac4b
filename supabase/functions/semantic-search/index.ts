import { createClient } from 'npm:@supabase/supabase-js@2';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBED_MODEL = 'openai/text-embedding-3-small';
const DIMS = 1536; // must match products.search_embedding
const RANK_MODEL = 'google/gemini-3.6-flash';

function productText(product: any) {
  return [
    product.title,
    product.category_slug,
    ...(product.use_cases ?? []),
    ...(product.features ?? []),
    ...(product.target_audience ?? []),
    product.description,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 6000);
}

/** Embeddings via the Lovable AI Gateway (no user-supplied API key needed). */
async function embed(input: string | string[]): Promise<number[][]> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY is not configured');
  const res = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: { 'Lovable-API-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input, dimensions: DIMS }),
  });
  if (!res.ok) throw new Error(`Embedding request failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  const rows = (body.data ?? []).sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
  return rows.map((item: { embedding: number[] }) => item.embedding);
}

async function rankWithAi(query: string, candidates: any[]): Promise<any[]> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY is not configured');

  const compact = candidates.slice(0, 35).map((product) => ({
    id: product.id,
    title: product.title,
    category: product.category_slug,
    description: String(product.description ?? '').replace(/\s+/g, ' ').slice(0, 320),
  }));
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: RANK_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You rank marketplace products for a shopper. Return only a JSON array of product IDs, best match first. Include only products that genuinely satisfy the shopper intent. Do not include weak, incidental, accessory, or unrelated matches. Return at most 24 IDs and [] when none qualify.',
        },
        {
          role: 'user',
          content: `Shopper request: ${JSON.stringify(query)}\nCandidates: ${JSON.stringify(compact)}`,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`AI ranking failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const text = String(payload?.choices?.[0]?.message?.content ?? '').trim();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AI ranking returned no product list');
  const ids = JSON.parse(match[0]);
  if (!Array.isArray(ids)) throw new Error('AI ranking returned an invalid product list');

  const byId = new Map(candidates.map((product) => [product.id, product]));
  return ids
    .filter((id): id is string => typeof id === 'string' && byId.has(id))
    .map((id) => byId.get(id))
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? 'search';
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';

    // ---- backfill: service role, shared secret, or platform admin ----
    if (action === 'backfill') {
      let allowed = token === serviceKey;
      if (!allowed) {
        const secret = Deno.env.get('EMBEDDING_BACKFILL_SECRET');
        allowed = !!secret && req.headers.get('x-backfill-secret') === secret;
      }
      if (!allowed && token) {
        const { data: userData } = await admin.auth.getUser(token);
        if (userData?.user) {
          const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
          allowed = isAdmin === true;
        }
      }
      if (!allowed) return json({ error: 'Unauthorized' }, 401);

      const limit = Math.max(1, Math.min(Number(body.limit) || 50, 100));
      const { data: products, error } = await admin
        .from('products')
        .select('id,title,category_slug,description,use_cases,features,target_audience')
        .is('search_embedding', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      if (!products?.length) return json({ embedded: 0, remaining: 0 });

      const vectors = await embed(products.map(productText));
      const results = await Promise.all(
        products.map((product, index) =>
          admin
            .from('products')
            .update({
              search_embedding: JSON.stringify(vectors[index]),
              embedding_updated_at: new Date().toISOString(),
            })
            .eq('id', product.id),
        ),
      );
      const failed = results.filter((r) => r.error).length;
      const { count } = await admin
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('search_embedding', null);
      return json({ embedded: products.length - failed, failed, remaining: count ?? 0 });
    }

    // ---- embed a single owned product ----
    if (action === 'embed-product') {
      const { data: userData, error: authError } = await admin.auth.getUser(token);
      if (authError || !userData.user) return json({ error: 'Unauthorized' }, 401);
      const { data: product, error } = await admin
        .from('products')
        .select('id,supplier_id,title,category_slug,description,use_cases,features,target_audience,suppliers!inner(owner_id)')
        .eq('id', body.productId)
        .single();
      if (error || !product || (product as any).suppliers.owner_id !== userData.user.id) {
        return json({ error: 'Product not found' }, 404);
      }
      const [vector] = await embed(productText(product));
      const { error: updateError } = await admin
        .from('products')
        .update({ search_embedding: JSON.stringify(vector), embedding_updated_at: new Date().toISOString() })
        .eq('id', product.id);
      if (updateError) throw updateError;
      return json({ embedded: true });
    }

    // ---- search: open to shoppers (guests included) ----
    const query = String(body.query ?? '').trim();
    if (query.length < 2) return json({ results: [], source: 'empty' });
    const limit = Math.min(Number(body.limit) || 60, 100);

    // Ordinary catalog search is free for everyone — it is the primary way shoppers
    // browse, so it must never consume a signed-in user's AI credits.



    try {
      const [vector] = await embed(query);
      const { data, error } = await admin.rpc('search_products_semantic', {
        search_query: query,
        query_embedding: JSON.stringify(vector),
        result_limit: limit,
      });
      if (error) throw error;
      const candidates = data ?? [];
      if (!candidates.length) return json({ results: [], source: 'ai-ranked' });
      try {
        const ranked = await rankWithAi(query, candidates);
        return json({ results: ranked, source: 'ai-ranked' });
      } catch (rankError) {
        console.error('AI ranking error:', rankError);
        return json({ results: candidates, source: 'semantic' });
      }
    } catch (semanticError) {
      // Never fail the shopper's search: fall back to trigram/keyword search.
      const { data, error } = await admin.rpc('search_products', {
        search_query: query,
        result_limit: limit,
      });
      if (error) throw error;
      return json({
        results: data ?? [],
        source: 'keyword',
        note: String((semanticError as Error)?.message ?? semanticError),
      });
    }
  } catch (error: any) {
    return json({ error: error.message ?? 'Semantic search failed' }, 500);
  }
});
