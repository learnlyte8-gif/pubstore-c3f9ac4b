GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
GRANT SELECT, INSERT, DELETE, UPDATE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT SELECT ON public.weekly_digest_log TO authenticated;
GRANT ALL ON public.weekly_digest_log TO service_role;