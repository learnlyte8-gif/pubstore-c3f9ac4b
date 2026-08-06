alter table public.rides
  add column if not exists scheduled_at timestamptz,
  add column if not exists is_carpool boolean not null default false,
  add column if not exists seats_requested int not null default 1,
  add column if not exists max_passengers int;

create index if not exists idx_rides_scheduled_status
  on public.rides (scheduled_at, status)
  where scheduled_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rides'
  ) then
    alter publication supabase_realtime add table public.rides;
  end if;
end
$$;

create or replace function public.find_carpool_matches(
  _ride_id uuid,
  _pickup_radius_km double precision default 1.5,
  _dropoff_radius_km double precision default 1.5,
  _time_window_minutes int default 15
)
returns table(
  ride_id uuid,
  rider_id uuid,
  pickup_address text,
  dropoff_address text,
  distance_km double precision,
  scheduled_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      r.id, r.rider_id, r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng,
      r.scheduled_at, r.pickup_address, r.dropoff_address, r.distance_km, r.vehicle_class
    from public.rides r
    where r.id = _ride_id and r.is_carpool = true
  )
  select
    r.id as ride_id,
    r.rider_id,
    r.pickup_address,
    r.dropoff_address,
    r.distance_km::double precision,
    r.scheduled_at
  from public.rides r
  cross join base b
  where r.id <> b.id
    and r.is_carpool = true
    and r.status = 'scheduled'
    and r.vehicle_class = b.vehicle_class
    and (
      6371 * acos(least(1, greatest(-1,
        cos(radians(b.pickup_lat)) * cos(radians(r.pickup_lat)) *
        cos(radians(r.pickup_lng) - radians(b.pickup_lng)) +
        sin(radians(b.pickup_lat)) * sin(radians(r.pickup_lat))
      )))
    ) <= _pickup_radius_km
    and (
      6371 * acos(least(1, greatest(-1,
        cos(radians(b.dropoff_lat)) * cos(radians(r.dropoff_lat)) *
        cos(radians(r.dropoff_lng) - radians(b.dropoff_lng)) +
        sin(radians(b.dropoff_lat)) * sin(radians(r.dropoff_lat))
      )))
    ) <= _dropoff_radius_km
    and abs(extract(epoch from (r.scheduled_at - b.scheduled_at))) / 60 <= _time_window_minutes
  order by r.scheduled_at
  limit 10;
$$;

grant execute on function public.find_carpool_matches(uuid, double precision, double precision, int) to authenticated;

create extension if not exists pg_cron with schema extensions;

create or replace function public.activate_scheduled_rides()
returns void
language sql
security definer
set search_path = public
as $$
  update public.rides
  set status = 'searching'
  where status = 'scheduled'
    and scheduled_at is not null
    and scheduled_at <= now();
$$;

select cron.unschedule('activate-scheduled-rides')
where exists (select 1 from cron.job where jobname = 'activate-scheduled-rides');

select cron.schedule(
  'activate-scheduled-rides',
  '*/1 * * * *',
  'select public.activate_scheduled_rides();'
);