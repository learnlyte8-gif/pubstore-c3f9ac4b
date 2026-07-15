create extension if not exists vector with schema extensions;

alter table public.products
  add column if not exists search_embedding extensions.vector(1536),
  add column if not exists embedding_updated_at timestamptz;

create index if not exists products_search_embedding_idx
  on public.products using hnsw (search_embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create or replace function public.search_products_semantic(
  search_query text,
  query_embedding extensions.vector(1536),
  result_limit integer default 60
)
returns table (
  id uuid,
  title text,
  description text,
  category_slug text,
  badge text,
  price numeric,
  image text,
  rating numeric,
  review_count integer,
  sold integer,
  free_shipping boolean,
  moq integer,
  lead_time text,
  ready_to_ship boolean,
  supplier_id uuid,
  score real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with input as (
    select trim(search_query) as raw, websearch_to_tsquery('simple', trim(search_query)) as tsq
  ), ranked as (
    select p.*,
      (
        ts_rank_cd(p.search_vector, input.tsq) * 5 +
        similarity(lower(p.title), lower(input.raw)) * 3 +
        similarity(lower(coalesce(p.description, '')), lower(input.raw)) +
        coalesce(1 - (p.search_embedding <=> query_embedding), 0) * 7 +
        case when lower(p.title) = lower(input.raw) then 10 else 0 end +
        case when lower(p.title) like lower(input.raw) || '%' then 4 else 0 end +
        ln(coalesce(p.sold, 0) + 1) * 0.35 +
        coalesce(p.rating, 0) * 0.18 +
        case when p.free_shipping then 0.25 else 0 end
      )::real as rank_score
    from public.products p
    cross join input
    where p.active = true and input.raw <> ''
      and (
        p.search_vector @@ input.tsq
        or similarity(lower(p.title), lower(input.raw)) > 0.18
        or similarity(lower(coalesce(p.description, '')), lower(input.raw)) > 0.12
        or (p.search_embedding is not null and 1 - (p.search_embedding <=> query_embedding) > 0.28)
      )
  )
  select id, title, description, category_slug, badge, price, image, rating, review_count, sold,
    free_shipping, moq, lead_time, ready_to_ship, supplier_id, rank_score as score
  from ranked
  order by rank_score desc, sold desc nulls last, rating desc nulls last
  limit greatest(1, least(result_limit, 100));
$$;

grant execute on function public.search_products_semantic(text, extensions.vector, integer) to anon, authenticated;