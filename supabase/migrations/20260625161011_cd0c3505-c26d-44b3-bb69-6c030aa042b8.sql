-- 1. Fix: SECURITY DEFINER function executable by signed-in users (linter 0029)
-- Move the privileged logic into the non-exposed app_private schema (DEFINER),
-- and make the public RPC a thin SECURITY INVOKER wrapper so the exposed API
-- schema no longer contains a signed-in-callable SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION app_private.ensure_staff_profile(_full_name text DEFAULT NULL::text, _phone text DEFAULT NULL::text)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_role public.app_role;
  assigned_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    auth.uid(),
    NULLIF(trim(COALESCE(_full_name, '')), ''),
    NULLIF(trim(COALESCE(_phone, '')), '')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = COALESCE(NULLIF(trim(COALESCE(_full_name, '')), ''), public.profiles.full_name),
    phone = COALESCE(NULLIF(trim(COALESCE(_phone, '')), ''), public.profiles.phone),
    updated_at = now();

  SELECT role INTO current_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END
  LIMIT 1;

  IF current_role IS NOT NULL THEN
    RETURN current_role;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN assigned_role;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.ensure_staff_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.ensure_staff_profile(text, text) TO authenticated;

-- Public wrapper is now SECURITY INVOKER (no longer flagged); it delegates the
-- privileged work to the app_private DEFINER function.
CREATE OR REPLACE FUNCTION public.ensure_staff_profile(_full_name text DEFAULT NULL::text, _phone text DEFAULT NULL::text)
RETURNS app_role
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN app_private.ensure_staff_profile(_full_name, _phone);
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_staff_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_staff_profile(text, text) TO authenticated;

-- 2. Fix: attendance-imports SELECT policy missing role check
DROP POLICY IF EXISTS "Authenticated staff can view attendance import files" ON storage.objects;
CREATE POLICY "Authenticated staff can view attendance import files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-imports'
  AND app_private.can_manage_school_data(auth.uid())
);

-- 3. Fix: student-results SELECT policy missing role check
DROP POLICY IF EXISTS "Authenticated staff can view result files" ON storage.objects;
CREATE POLICY "Authenticated staff can view result files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-results'
  AND app_private.can_manage_school_data(auth.uid())
);