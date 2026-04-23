-- Add payment-tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- Add a new value to the order_status enum if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'awaiting_payment'
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'awaiting_payment' BEFORE 'placed';
  END IF;
END$$;

-- Helpful index for webhook lookups
CREATE INDEX IF NOT EXISTS orders_payment_reference_idx
  ON public.orders (payment_reference)
  WHERE payment_reference IS NOT NULL;