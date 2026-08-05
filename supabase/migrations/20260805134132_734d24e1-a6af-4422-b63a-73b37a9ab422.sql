-- Auto-generate a reference so no insert path can violate the NOT NULL constraint
ALTER TABLE public.withdrawal_requests
  ALTER COLUMN reference SET DEFAULT ('WTH-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

UPDATE public.withdrawal_requests
SET reference = 'WTH-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
WHERE reference IS NULL;

-- Drop the stale overload that ignored the account (personal/sales) choice
DROP FUNCTION IF EXISTS public.request_wallet_withdrawal(numeric, text, text, text, text);