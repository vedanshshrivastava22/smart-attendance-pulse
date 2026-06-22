-- =====================================================================
-- 1. Move RLS helper SECURITY DEFINER functions out of the API schema
--    Policies reference these by OID, so moving schemas keeps RLS working.
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA app_private;

CREATE OR REPLACE FUNCTION public.can_manage_school_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT app_private.has_role(_user_id, 'admin')
      OR app_private.has_role(_user_id, 'moderator')
$$;

ALTER FUNCTION public.can_manage_school_data(uuid) SET SCHEMA app_private;

REVOKE EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_private.can_manage_school_data(uuid) FROM PUBLIC, anon;

-- =====================================================================
-- 2. Re-affirm role-restricted reads on sensitive tables using the
--    relocated helper (defense in depth; confirms no USING(true) remains)
-- =====================================================================
DROP POLICY IF EXISTS "Staff view exam_results" ON public.exam_results;
CREATE POLICY "Staff view exam_results"
ON public.exam_results FOR SELECT TO authenticated
USING (app_private.can_manage_school_data(auth.uid()));

DROP POLICY IF EXISTS "Staff can view notifications" ON public.notification_events;
CREATE POLICY "Staff can view notifications"
ON public.notification_events FOR SELECT TO authenticated
USING (app_private.can_manage_school_data(auth.uid()));

DROP POLICY IF EXISTS "Staff can view students" ON public.students;
CREATE POLICY "Staff can view students"
ON public.students FOR SELECT TO authenticated
USING (app_private.can_manage_school_data(auth.uid()));