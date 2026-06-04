-- 1. Remove bootstrap bypass from can_manage_school_data
CREATE OR REPLACE FUNCTION public.can_manage_school_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'moderator')
$function$;

-- 2. New signups no longer auto-become moderators. First account (no admin yet) becomes admin; others get a basic 'user' role.
CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigned_role public.app_role;
  meta_full_name TEXT;
  meta_phone TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;

  meta_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1));
  meta_phone := NEW.raw_user_meta_data ->> 'phone';

  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, meta_full_name, meta_phone)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 3. ensure_staff_profile: same policy - first user admin, others basic 'user'
CREATE OR REPLACE FUNCTION public.ensure_staff_profile(_full_name text DEFAULT NULL::text, _phone text DEFAULT NULL::text)
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

-- 4. Restrict SELECT policies that were USING(true) to staff/admins only
DROP POLICY IF EXISTS "Authenticated staff can view students" ON public.students;
CREATE POLICY "Staff can view students" ON public.students
  FOR SELECT TO authenticated
  USING (public.can_manage_school_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated staff can view attendance" ON public.attendance_records;
CREATE POLICY "Staff can view attendance" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (public.can_manage_school_data(auth.uid()));

DROP POLICY IF EXISTS "Staff view exam_results" ON public.exam_results;
CREATE POLICY "Staff view exam_results" ON public.exam_results
  FOR SELECT TO authenticated
  USING (public.can_manage_school_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated staff can view results" ON public.result_uploads;
CREATE POLICY "Staff can view results" ON public.result_uploads
  FOR SELECT TO authenticated
  USING (public.can_manage_school_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated staff can view notifications" ON public.notification_events;
CREATE POLICY "Staff can view notifications" ON public.notification_events
  FOR SELECT TO authenticated
  USING (public.can_manage_school_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated staff can view classes" ON public.school_classes;
CREATE POLICY "Staff can view classes" ON public.school_classes
  FOR SELECT TO authenticated
  USING (public.can_manage_school_data(auth.uid()));

DROP POLICY IF EXISTS "Authenticated staff can view imports" ON public.excel_imports;
CREATE POLICY "Staff can view imports" ON public.excel_imports
  FOR SELECT TO authenticated
  USING (public.can_manage_school_data(auth.uid()));

DROP POLICY IF EXISTS "Staff view teachers" ON public.teachers;
CREATE POLICY "Staff view teachers" ON public.teachers
  FOR SELECT TO authenticated
  USING (public.can_manage_school_data(auth.uid()));