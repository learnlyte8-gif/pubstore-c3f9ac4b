 # Architecture rules

- Account roles are a set of rows in protected `public.user_roles`; read all roles for account displays and validate admin access against the server, never browser storage, so supplier and admin privileges coexist safely.