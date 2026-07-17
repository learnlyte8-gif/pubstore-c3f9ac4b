
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.personalized_feed(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.personalized_feed(uuid, integer, integer) FROM anon, PUBLIC;

DROP POLICY IF EXISTS "Product images list (auth)" ON storage.objects;
DROP POLICY IF EXISTS "Service media list (auth)" ON storage.objects;
DROP POLICY IF EXISTS "Job media list (auth)" ON storage.objects;
DROP POLICY IF EXISTS "Supplier certs list (auth)" ON storage.objects;
DROP POLICY IF EXISTS "RFQ attachments list (auth)" ON storage.objects;
DROP POLICY IF EXISTS "Inspection reports list (auth)" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant media list (auth)" ON storage.objects;
