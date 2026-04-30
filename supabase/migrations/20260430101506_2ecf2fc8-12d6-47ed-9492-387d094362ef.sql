create table if not exists public.payment_status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  purpose text not null,
  merchant_reference text not null,
  gateway_reference text,
  status text not null,
  amount numeric,
  currency text not null default 'USD',
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.payment_status_history enable row level security;

create unique index if not exists payment_status_history_step_uniq
  on public.payment_status_history (provider, merchant_reference, status);

create index if not exists payment_status_history_user_created_idx
  on public.payment_status_history (user_id, created_at desc);

create index if not exists payment_status_history_reference_idx
  on public.payment_status_history (merchant_reference, gateway_reference);

create policy "Users read own payment status history"
on public.payment_status_history
for select
using (auth.uid() = user_id);

create policy "Users insert own payment status history"
on public.payment_status_history
for insert
with check (auth.uid() = user_id);
