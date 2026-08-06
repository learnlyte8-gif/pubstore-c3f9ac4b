revoke execute on function public.activate_scheduled_rides() from public, anon, authenticated;
grant execute on function public.activate_scheduled_rides() to postgres, service_role;