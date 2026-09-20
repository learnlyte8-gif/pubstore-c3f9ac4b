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

/**
 * Unified candidate for AI re-ranking across ALL verticals.
 * `kind` tells the client which table/vertical this row came from.
 */
type Candidate = {
  id: string; // prefixed id, e.g. "p:uuid", "s:uuid"
  kind: string;
  title: string;
  category: string | null;
  description: string | null;
  price: number | null;
  row: any;
};

/**
 * AI re-ranking pass (Gemini via the Lovable AI Gateway) — reads the shopper's
 * request plus compact candidate cards from ALL verticals and returns an
 * ordered array of candidate IDs that best satisfy the intent (max 30).
 */
async function aiRerank(query: string, candidates: Candidate[]): Promise<string[] | null> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) return null;
  if (candidates.length === 0) return [];

  const cards = candidates.slice(0, 50).map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    category: c.category ?? '',
    price: c.price != null ? Number(c.price) : null,
    description: String(c.description ?? '').replace(/\s+/g, ' ').slice(0, 120),
  }));

  const prompt = `You are a shopping assistant helping a user find what they need across a marketplace.

User searched: ${JSON.stringify(query)}

Here are ${cards.length} candidates from different parts of the marketplace (products, suppliers, services, vehicles, stays, properties, etc.):
${JSON.stringify(cards)}

Rank these candidates by how well they match what the user is looking for. Consider:
- How closely the title matches the user's intent
- Whether the kind/category is relevant to the query
- Whether the description confirms it's what the user wants
- Price relevance if the query mentions a budget

Return a JSON array of candidate IDs (strings) in order from best to worst match.
Keep ALL candidates that are reasonably relevant — only drop ones that are clearly unrelated to the query.
Maximum 30 items.
Output ONLY the JSON array, e.g. ["p:id1","s:id2","sv:id3"] — no prose, no markdown, no explanation.`;

  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Lovable-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: RANK_MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: 'You rank marketplace listings for a shopper. Reply with a JSON array of IDs only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!resp.ok) {
      console.error('AI ranking failed:', resp.status, await resp.text());
      return null;
    }
    const body = await resp.json();
    const text = String(body?.choices?.[0]?.message?.content ?? '');
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const ids = JSON.parse(match[0]);
    if (!Array.isArray(ids)) return null;
    return ids.filter((x: any) => typeof x === 'string').slice(0, 30);
  } catch (e) {
    console.error('AI ranking error:', e);
    return null;
  }
}

/** Fetch non-product candidates via ilike text matching across every vertical. */
async function fetchNonProductCandidates(admin: any, query: string): Promise<Candidate[]> {
  const ilike = `%${query.replace(/[%_]/g, '\\$&')}%`;
  const results: Candidate[] = [];

  const queries: Promise<void>[] = [
    admin.from('suppliers').select('id,name,about,country,logo,verified,rating').is('mirror_of', null).or(`name.ilike.${ilike},about.ilike.${ilike}`).limit(10)
      .then(({ data }: any) => { for (const s of data ?? []) results.push({ id: `s:${s.id}`, kind: 'supplier', title: s.name, category: 'supplier store', description: s.about, price: null, row: s }); }),

    admin.from('service_providers').select('id,display_name,bio,category,subcategory,skills,city,country,cover,rating,jobs_completed,hourly_rate,currency').eq('active', true).or(`display_name.ilike.${ilike},bio.ilike.${ilike},category.ilike.${ilike}`).limit(10)
      .then(({ data }: any) => { for (const s of data ?? []) results.push({ id: `sv:${s.id}`, kind: 'service', title: s.display_name, category: s.category, description: s.bio, price: s.hourly_rate ? Number(s.hourly_rate) : null, row: s }); }),

    admin.from('properties').select('id,title,description,property_kind,listing_type,city,country,price,currency,cover,bedrooms,baths,featured,views').eq('active', true).or(`title.ilike.${ilike},description.ilike.${ilike}`).limit(10)
      .then(({ data }: any) => { for (const p of data ?? []) results.push({ id: `pr:${p.id}`, kind: 'property', title: p.title, category: p.property_kind, description: p.description, price: p.price ? Number(p.price) : null, row: p }); }),

    admin.from('finance_products').select('id,title,kind,description,provider_name,country,city,cover,min_amount,max_amount,interest_rate,currency,featured').eq('active', true).or(`title.ilike.${ilike},description.ilike.${ilike},provider_name.ilike.${ilike}`).limit(8)
      .then(({ data }: any) => { for (const f of data ?? []) results.push({ id: `fn:${f.id}`, kind: 'finance', title: f.title, category: f.kind, description: [f.provider_name, f.description].filter(Boolean).join(' · '), price: f.min_amount ? Number(f.min_amount) : null, row: f }); }),

    admin.from('vehicles').select('id,title,description,kind,make,model,city,country,price,currency,cover').eq('active', true).or(`title.ilike.${ilike},description.ilike.${ilike},make.ilike.${ilike},model.ilike.${ilike}`).limit(10)
      .then(({ data }: any) => { for (const v of data ?? []) results.push({ id: `vh:${v.id}`, kind: 'vehicle', title: v.title, category: [v.kind, v.make, v.model].filter(Boolean).join(' '), description: v.description, price: v.price ? Number(v.price) : null, row: v }); }),

    admin.from('stays').select('id,title,description,kind,city,country,price_per_night,currency,cover,rating,review_count,superhost').eq('active', true).or(`title.ilike.${ilike},description.ilike.${ilike}`).limit(10)
      .then(({ data }: any) => { for (const s of data ?? []) results.push({ id: `st:${s.id}`, kind: 'stay', title: s.title, category: s.kind, description: s.description, price: s.price_per_night ? Number(s.price_per_night) : null, row: s }); }),

    admin.from('industrial_listings').select('id,title,description,category,subcategory,country,price,currency,cover').eq('active', true).or(`title.ilike.${ilike},description.ilike.${ilike}`).limit(8)
      .then(({ data }: any) => { for (const i of data ?? []) results.push({ id: `in:${i.id}`, kind: 'industrial', title: i.title, category: i.category, description: i.description, price: i.price ? Number(i.price) : null, row: i }); }),

    admin.from('news_articles').select('id,title,dek,slug,category,cover,tags,read_minutes').or(`title.ilike.${ilike},dek.ilike.${ilike}`).limit(8)
      .then(({ data }: any) => { for (const n of data ?? []) results.push({ id: `nw:${n.id}`, kind: 'news', title: n.title, category: n.category, description: n.dek, price: null, row: n }); }),

    admin.from('profiles').select('user_id,display_name,username,avatar_url,bio').or(`display_name.ilike.${ilike},username.ilike.${ilike},bio.ilike.${ilike}`).limit(8)
      .then(({ data }: any) => { for (const u of data ?? []) { const name = u.display_name || u.username; if (name) results.push({ id: `u:${u.user_id}`, kind: 'user', title: name, category: 'user profile', description: u.bio, price: null, row: u }); } }),

    admin.from('restaurants').select('id,name,cuisine,description,cover,city,country,rating,review_count,price_level,active,featured').eq('active', true).or(`name.ilike.${ilike},cuisine.ilike.${ilike},description.ilike.${ilike}`).limit(8)
      .then(({ data }: any) => { for (const r of data ?? []) results.push({ id: `rs:${r.id}`, kind: 'restaurant', title: r.name, category: r.cuisine, description: r.description, price: r.price_level ? Number(r.price_level) : null, row: r }); }),

    admin.from('live_streams').select('id,title,supplier_id,viewer_count,status').or(`title.ilike.${ilike}`).limit(5)
      .then(({ data }: any) => { for (const l of data ?? []) { if (l.title) results.push({ id: `lv:${l.id}`, kind: 'live', title: l.title, category: 'live stream', description: `${l.viewer_count ?? 0} watching`, price: null, row: l }); } }),

    admin.from('rides').select('id,pickup_address,dropoff_address,rider_offer,vehicle_class,status,currency').in('status', ['searching', 'offered', 'scheduled']).or(`pickup_address.ilike.${ilike},dropoff_address.ilike.${ilike}`).limit(5)
      .then(({ data }: any) => { for (const r of data ?? []) { const title = `${r.pickup_address ?? 'Pickup'} → ${r.dropoff_address ?? 'Destination'}`; results.push({ id: `rd:${r.id}`, kind: 'ride', title, category: r.vehicle_class, description: `${r.pickup_address ?? ''} to ${r.dropoff_address ?? ''}`, price: r.rider_offer ? Number(r.rider_offer) : null, row: r }); } }),
  ];

  await Promise.allSettled(queries);
  return results;
}

/** Normalize a non-product candidate row into a result object for the client. */
function candidateToResult(c: Candidate): any {
  const r = c.row;
  switch (c.kind) {
    case 'supplier':
      return { id: c.id, kind: 'supplier', title: r.name, description: r.about, category_slug: 'suppliers', badge: r.verified ? 'Verified' : null, price: null, image: r.logo, rating: Number(r.rating ?? 0), review_count: 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, supplier_id: r.id, country: r.country, verified: !!r.verified, href: `/supplier/${r.id}` };
    case 'service':
      return { id: c.id, kind: 'service', title: r.display_name, description: r.bio, category_slug: r.category, badge: null, price: r.hourly_rate ? Number(r.hourly_rate) : null, image: r.cover, rating: Number(r.rating ?? 0), review_count: r.jobs_completed ?? 0, sold: r.jobs_completed ?? 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, city: r.city, country: r.country, href: `/services?provider=${r.id}` };
    case 'property':
      return { id: c.id, kind: 'property', title: r.title, description: r.description, category_slug: r.property_kind, badge: null, price: Number(r.price ?? 0), image: r.cover, rating: r.featured ? 5 : 4, review_count: r.views ?? 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, city: r.city, country: r.country, href: `/properties?id=${r.id}` };
    case 'finance':
      return { id: c.id, kind: 'finance', title: r.title, description: r.description, category_slug: r.kind, badge: null, price: r.min_amount ? Number(r.min_amount) : null, image: r.cover, rating: r.featured ? 5 : 4, review_count: 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, country: r.country, city: r.city, href: `/finance?id=${r.id}` };
    case 'vehicle':
      return { id: c.id, kind: 'vehicle', title: r.title, description: r.description, category_slug: [r.kind, r.make, r.model].filter(Boolean).join(' '), badge: null, price: Number(r.price ?? 0), image: r.cover, rating: 4.5, review_count: 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, city: r.city, country: r.country, href: `/auto?id=${r.id}` };
    case 'stay':
      return { id: c.id, kind: 'stay', title: r.title, description: r.description, category_slug: r.kind, badge: null, price: Number(r.price_per_night ?? 0), image: r.cover, rating: Number(r.rating ?? 4.5), review_count: r.review_count ?? 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, city: r.city, country: r.country, href: `/stays?id=${r.id}` };
    case 'industrial':
      return { id: c.id, kind: 'industrial', title: r.title, description: r.description, category_slug: r.category, badge: null, price: r.price ? Number(r.price) : null, image: r.cover, rating: 4.5, review_count: 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, country: r.country, href: `/industrial?id=${r.id}` };
    case 'news':
      return { id: c.id, kind: 'news', title: r.title, description: r.dek, category_slug: r.category, badge: null, price: null, image: r.cover, rating: 4, review_count: r.read_minutes ?? 3, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, href: `/news/${r.slug}` };
    case 'user':
      return { id: c.id, kind: 'user', title: r.display_name || r.username, description: r.bio, category_slug: 'user', badge: null, price: null, image: r.avatar_url, rating: 0, review_count: 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, href: `/u/${r.user_id}` };
    case 'restaurant':
      return { id: c.id, kind: 'restaurant', title: r.name, description: r.description, category_slug: r.cuisine, badge: null, price: r.price_level ? Number(r.price_level) : null, image: r.cover, rating: Number(r.rating ?? 0), review_count: r.review_count ?? 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, city: r.city, country: r.country, href: `/restaurants/${r.id}` };
    case 'live':
      return { id: c.id, kind: 'live', title: r.title, description: `${r.viewer_count ?? 0} watching`, category_slug: 'live', badge: null, price: null, image: null, rating: 0, review_count: r.viewer_count ?? 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, href: `/live/${r.id}` };
    case 'ride':
      return { id: c.id, kind: 'ride', title: `${r.pickup_address ?? 'Pickup'} → ${r.dropoff_address ?? 'Destination'}`, description: `${r.pickup_address ?? ''} to ${r.dropoff_address ?? ''}`, category_slug: r.vehicle_class, badge: null, price: r.rider_offer ? Number(r.rider_offer) : null, image: null, rating: 0, review_count: 0, sold: 0, free_shipping: false, moq: null, lead_time: null, ready_to_ship: false, href: `/rides` };
    default:
      return null;
  }
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

    // ---- universal search: open to shoppers (guests included), never charged ----
    const query = String(body.query ?? '').trim().slice(0, 120);
    if (query.length < 2) return json({ results: [], source: 'empty' });
    const limit = Math.min(Number(body.limit) || 60, 100);

    // 1. Semantic embedding + vector match for PRODUCTS
    let semanticResults: any[] = [];
    let embeddingOk = false;
    try {
      const [vector] = await embed(query);
      embeddingOk = true;
      const { data, error } = await admin.rpc('search_products_semantic', {
        search_query: query,
        query_embedding: JSON.stringify(vector),
        result_limit: Math.min(limit, 60),
      });
      if (error) throw error;
      semanticResults = data ?? [];
    } catch (e) {
      console.error('semantic stage failed:', e);
    }

    // 1b. If the semantic/embedding stage produced no products, fall back to the
    // trigram keyword RPC so catalog products are never silently dropped just
    // because some non-product row happened to match.
    let productsFromKeyword = false;
    if (semanticResults.length === 0) {
      try {
        const { data: kwData, error: kwErr } = await admin.rpc('search_products', {
          search_query: query,
          result_limit: Math.min(limit, 60),
        });
        if (kwErr) throw kwErr;
        semanticResults = kwData ?? [];
        productsFromKeyword = semanticResults.length > 0;
      } catch (e) {
        console.error('keyword product fallback failed:', e);
      }
    }

    // 2. Non-product candidates via text matching (all verticals)
    const nonProductCandidates = await fetchNonProductCandidates(admin, query);

    // 3. Unified candidate list
    const productCandidates: Candidate[] = semanticResults.slice(0, 35).map((p: any) => ({
      id: `p:${p.id}`,
      kind: 'product',
      title: p.title,
      category: p.category_slug ?? null,
      description: p.description ?? null,
      price: p.price ?? null,
      row: p,
    }));
    const allCandidates = [...productCandidates, ...nonProductCandidates];

    // 4. AI re-ranking across ALL verticals
    if (allCandidates.length > 0) {
      const rerankedIds = await aiRerank(query, allCandidates);

      if (rerankedIds && rerankedIds.length > 0) {
        const byId = new Map(allCandidates.map((c) => [c.id, c]));
        const ordered: any[] = [];
        for (const id of rerankedIds) {
          const c = byId.get(id);
          if (!c) continue;
          if (c.kind === 'product') ordered.push({ ...c.row, id: c.id, kind: 'product' });
          else {
            const result = candidateToResult(c);
            if (result) ordered.push(result);
          }
        }
        if (ordered.length > 0) return json({ results: ordered, source: 'ai-ranked' });
      }

      const fallbackResults: any[] = [
        ...semanticResults.map((p: any) => ({ ...p, id: `p:${p.id}`, kind: 'product' })),
        ...nonProductCandidates.map((c) => candidateToResult(c)).filter(Boolean),
      ];
      if (fallbackResults.length > 0) {
        return json({ results: fallbackResults, source: embeddingOk && !productsFromKeyword ? 'semantic' : 'keyword' });
      }
    }

    // 5. Final fallback: trigram/keyword RPC for products
    const { data: keywordData, error: keywordError } = await admin.rpc('search_products', {
      search_query: query,
      result_limit: limit,
    });
    if (keywordError) throw keywordError;
    const keywordResults = ((keywordData ?? []) as any[]).map((p: any) => ({ ...p, id: `p:${p.id}`, kind: 'product' }));
    return json({
      results: [...keywordResults, ...nonProductCandidates.map((c) => candidateToResult(c)).filter(Boolean)],
      source: 'keyword',
    });
  } catch (error: any) {
    return json({ error: error.message ?? 'Semantic search failed' }, 500);
  }
});
