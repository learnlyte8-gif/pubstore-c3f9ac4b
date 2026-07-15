create extension if not exists pg_trgm;

alter table public.products
  add column if not exists use_cases text[] not null default '{}',
  add column if not exists target_audience text[] not null default '{}',
  add column if not exists features text[] not null default '{}',
  add column if not exists search_vector tsvector;

create or replace function public.products_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.category_slug, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.use_cases, ' '), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.features, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.target_audience, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'C');
  return new;
end;
$$;

drop trigger if exists products_search_vector_trg on public.products;
create trigger products_search_vector_trg
  before insert or update of title, category_slug, description, use_cases, features, target_audience
  on public.products
  for each row execute function public.products_search_vector_update();

update public.products set title = title;

create index if not exists products_search_vector_idx on public.products using gin (search_vector);
create index if not exists products_title_trgm_idx on public.products using gin (lower(title) gin_trgm_ops);
create index if not exists products_description_trgm_idx on public.products using gin (lower(coalesce(description, '')) gin_trgm_ops);

create or replace function public.search_products(
  search_query text,
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
set search_path = public
as $$
  with input as (
    select
      trim(search_query) as raw,
      websearch_to_tsquery('simple', trim(search_query)) as tsq
  ), ranked as (
    select
      p.*,
      (
        ts_rank_cd(p.search_vector, input.tsq) * 8 +
        similarity(lower(p.title), lower(input.raw)) * 6 +
        similarity(lower(coalesce(p.description, '')), lower(input.raw)) * 1.5 +
        case when lower(p.title) = lower(input.raw) then 12 else 0 end +
        case when lower(p.title) like lower(input.raw) || '%' then 6 else 0 end +
        ln(coalesce(p.sold, 0) + 1) * 0.35 +
        coalesce(p.rating, 0) * 0.18 +
        case when p.free_shipping then 0.25 else 0 end
      )::real as rank_score
    from public.products p
    cross join input
    where p.active = true
      and input.raw <> ''
      and (
        p.search_vector @@ input.tsq
        or similarity(lower(p.title), lower(input.raw)) > 0.18
        or similarity(lower(coalesce(p.description, '')), lower(input.raw)) > 0.12
      )
  )
  select id, title, description, category_slug, badge, price, image, rating, review_count, sold,
    free_shipping, moq, lead_time, ready_to_ship, supplier_id, rank_score as score
  from ranked
  order by rank_score desc, sold desc nulls last, rating desc nulls last
  limit greatest(1, least(result_limit, 100));
$$;

grant execute on function public.search_products(text, integer) to anon, authenticated;