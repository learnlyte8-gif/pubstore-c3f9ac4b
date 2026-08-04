import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const MODEL = 'text-embedding-3-small';

function productText(product: any) {
  return [product.title, product.category_slug, ...(product.use_cases ?? []), ...(product.features ?? []), ...(product.target_audience ?? []), product.description].filter(Boolean).join('\n');
}

async function embed(input: string | string[]) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  const response = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, input }) });
  if (!response.ok) throw new Error(`Embedding request failed: ${response.status}`);
  const body = await response.json();
  return body.data.map((item: { embedding: number[] }) => item.embedding) as number[][];
}

import { chargeAiCredits } from '../_shared/ai-credits.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const body = await req.json();
    const isBackfill = body.action === 'backfill';
    let user: { id: string } | null = null;
    if (isBackfill) {
      if (token !== key) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    } else {
      const { data, error: authError } = await admin.auth.getUser(token);
      if (authError || !data.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      user = data.user;
    }
    if (isBackfill) {
      const limit = Math.max(1, Math.min(Number(body.limit) || 50, 100));
      const { data: products, error } = await admin.from('products').select('id,title,category_slug,description,use_cases,features,target_audience').is('search_embedding', null).order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      if (!products?.length) return new Response(JSON.stringify({ embedded: 0, remaining: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const vectors = await embed(products.map(productText));
      const updates = products.map((product, index) => admin.from('products').update({ search_embedding: JSON.stringify(vectors[index]), embedding_updated_at: new Date().toISOString() }).eq('id', product.id));
      const results = await Promise.all(updates);
      const failed = results.filter((result) => result.error).length;
      const { count } = await admin.from('products').select('*', { count: 'exact', head: true }).is('search_embedding', null);
      return new Response(JSON.stringify({ embedded: products.length - failed, failed, remaining: count ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (body.action === 'embed-product') {
      const { data: product, error } = await admin.from('products').select('id,supplier_id,title,category_slug,description,use_cases,features,target_audience,suppliers!inner(owner_id)').eq('id', body.productId).single();
      if (error || !product || (product as any).suppliers.owner_id !== user!.id) return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: corsHeaders });
      const [vector] = await embed(productText(product));
      const { error: updateError } = await admin.from('products').update({ search_embedding: JSON.stringify(vector), embedding_updated_at: new Date().toISOString() }).eq('id', product.id);
      if (updateError) throw updateError;
      return new Response(JSON.stringify({ embedded: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const charge = await chargeAiCredits(req, 'semantic_search');
    if (!charge.ok) {
      return new Response(JSON.stringify(charge.body), { status: charge.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const query = String(body.query ?? '').trim();
    if (query.length < 2) return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const [vector] = await embed(query);
    const { data, error } = await admin.rpc('search_products_semantic', { search_query: query, query_embedding: JSON.stringify(vector), result_limit: Math.min(Number(body.limit) || 80, 100) });
    if (error) throw error;
    return new Response(JSON.stringify({ results: data ?? [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message ?? 'Semantic search failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
