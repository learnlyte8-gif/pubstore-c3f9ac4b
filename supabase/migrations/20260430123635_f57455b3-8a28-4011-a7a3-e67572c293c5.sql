ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS trade_type TEXT NOT NULL DEFAULT 'both'
  CHECK (trade_type IN ('retail','wholesale','both'));

CREATE INDEX IF NOT EXISTS idx_suppliers_trade_type ON public.suppliers(trade_type);
CREATE INDEX IF NOT EXISTS idx_products_moq ON public.products(moq);