
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS manual_payment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_payment_number text,
  ADD COLUMN IF NOT EXISTS manual_payment_name text,
  ADD COLUMN IF NOT EXISTS manual_payment_instructions text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS manual_payment_reference text,
  ADD COLUMN IF NOT EXISTS manual_payment_note text,
  ADD COLUMN IF NOT EXISTS manual_payment_submitted_at timestamptz;
