DROP POLICY IF EXISTS "admins_can_manage_access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "admins_can_read_all_roles" ON public.user_roles;
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);

REVOKE ALL ON public.access_requests FROM anon, authenticated;
REVOKE ALL ON public.user_roles FROM anon, authenticated;
GRANT ALL ON public.access_requests TO service_role;
GRANT ALL ON public.user_roles TO service_role;

CREATE POLICY "access_requests_no_direct_access" ON public.access_requests
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "user_roles_no_direct_access" ON public.user_roles
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);