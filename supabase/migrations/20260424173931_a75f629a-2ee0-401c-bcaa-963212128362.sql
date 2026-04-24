CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated staff can create classes" ON public.school_classes;
DROP POLICY IF EXISTS "Authenticated staff can update classes" ON public.school_classes;
DROP POLICY IF EXISTS "Authenticated staff can delete classes" ON public.school_classes;
DROP POLICY IF EXISTS "Authenticated staff can create students" ON public.students;
DROP POLICY IF EXISTS "Authenticated staff can update students" ON public.students;
DROP POLICY IF EXISTS "Authenticated staff can delete students" ON public.students;
DROP POLICY IF EXISTS "Authenticated staff can create attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Authenticated staff can update attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Authenticated staff can delete attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Authenticated staff can create imports" ON public.excel_imports;
DROP POLICY IF EXISTS "Authenticated staff can update imports" ON public.excel_imports;
DROP POLICY IF EXISTS "Authenticated staff can delete imports" ON public.excel_imports;
DROP POLICY IF EXISTS "Authenticated staff can create results" ON public.result_uploads;
DROP POLICY IF EXISTS "Authenticated staff can update results" ON public.result_uploads;
DROP POLICY IF EXISTS "Authenticated staff can delete results" ON public.result_uploads;
DROP POLICY IF EXISTS "Authenticated staff can create notifications" ON public.notification_events;
DROP POLICY IF EXISTS "Authenticated staff can update notifications" ON public.notification_events;
DROP POLICY IF EXISTS "Authenticated staff can delete notifications" ON public.notification_events;
DROP POLICY IF EXISTS "Authenticated staff can upload attendance import files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated staff can update attendance import files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated staff can delete attendance import files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated staff can upload result files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated staff can update result files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated staff can delete result files" ON storage.objects;

CREATE POLICY "Staff can create classes"
ON public.school_classes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can update classes"
ON public.school_classes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can delete classes"
ON public.school_classes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can create students"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can update students"
ON public.students
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can delete students"
ON public.students
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can create attendance"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can update attendance"
ON public.attendance_records
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can delete attendance"
ON public.attendance_records
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can create imports"
ON public.excel_imports
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can update imports"
ON public.excel_imports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can delete imports"
ON public.excel_imports
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can create results"
ON public.result_uploads
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can update results"
ON public.result_uploads
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can delete results"
ON public.result_uploads
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can create notifications"
ON public.notification_events
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can update notifications"
ON public.notification_events
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can delete notifications"
ON public.notification_events
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff can upload attendance import files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attendance-imports'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Staff can update attendance import files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attendance-imports'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
)
WITH CHECK (
  bucket_id = 'attendance-imports'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Staff can delete attendance import files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attendance-imports'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Staff can upload result files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-results'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Staff can update result files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-results'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
)
WITH CHECK (
  bucket_id = 'student-results'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

CREATE POLICY "Staff can delete result files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-results'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

ALTER VIEW public.attendance_analytics SET (security_invoker = true);