REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;

DROP POLICY IF EXISTS "Roles are viewable by everyone" ON public.user_roles;
CREATE POLICY "Signed-in users can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);