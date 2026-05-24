ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_kind_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_kind_check
  CHECK (kind = ANY (ARRAY['topup','purchase','refund','adjustment','transfer_in','transfer_out']));