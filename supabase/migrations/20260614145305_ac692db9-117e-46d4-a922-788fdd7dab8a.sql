ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_bids;
ALTER TABLE public.logistics_requests REPLICA IDENTITY FULL;
ALTER TABLE public.logistics_bids REPLICA IDENTITY FULL;