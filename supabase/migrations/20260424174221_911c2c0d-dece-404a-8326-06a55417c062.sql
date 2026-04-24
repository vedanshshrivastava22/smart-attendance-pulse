CREATE OR REPLACE FUNCTION public.can_manage_school_data(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (SELECT 1 FROM public.user_roles)
    OR public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'moderator')
$$;

DROP POLICY IF EXISTS "Staff can create classes" ON public.school_classes;
DROP POLICY IF EXISTS "Staff can update classes" ON public.school_classes;
DROP POLICY IF EXISTS "Staff can delete classes" ON public.school_classes;
DROP POLICY IF EXISTS "Staff can create students" ON public.students;
DROP POLICY IF EXISTS "Staff can update students" ON public.students;
DROP POLICY IF EXISTS "Staff can delete students" ON public.students;
DROP POLICY IF EXISTS "Staff can create attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Staff can update attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Staff can delete attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Staff can create imports" ON public.excel_imports;
DROP POLICY IF EXISTS "Staff can update imports" ON public.excel_imports;
DROP POLICY IF EXISTS "Staff can delete imports" ON public.excel_imports;
DROP POLICY IF EXISTS "Staff can create results" ON public.result_uploads;
DROP POLICY IF EXISTS "Staff can update results" ON public.result_uploads;
DROP POLICY IF EXISTS "Staff can delete results" ON public.result_uploads;
DROP POLICY IF EXISTS "Staff can create notifications" ON public.notification_events;
DROP POLICY IF EXISTS "Staff can update notifications" ON public.notification_events;
DROP POLICY IF EXISTS "Staff can delete notifications" ON public.notification_events;
DROP POLICY IF EXISTS "Staff can upload attendance import files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update attendance import files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete attendance import files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload result files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update result files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete result files" ON storage.objects;

CREATE POLICY "Staff can create classes"
ON public.school_classes
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can update classes"
ON public.school_classes
FOR UPDATE
TO authenticated
USING (public.can_manage_school_data(auth.uid()))
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can delete classes"
ON public.school_classes
FOR DELETE
TO authenticated
USING (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can create students"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can update students"
ON public.students
FOR UPDATE
TO authenticated
USING (public.can_manage_school_data(auth.uid()))
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can delete students"
ON public.students
FOR DELETE
TO authenticated
USING (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can create attendance"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can update attendance"
ON public.attendance_records
FOR UPDATE
TO authenticated
USING (public.can_manage_school_data(auth.uid()))
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can delete attendance"
ON public.attendance_records
FOR DELETE
TO authenticated
USING (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can create imports"
ON public.excel_imports
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can update imports"
ON public.excel_imports
FOR UPDATE
TO authenticated
USING (public.can_manage_school_data(auth.uid()))
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can delete imports"
ON public.excel_imports
FOR DELETE
TO authenticated
USING (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can create results"
ON public.result_uploads
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can update results"
ON public.result_uploads
FOR UPDATE
TO authenticated
USING (public.can_manage_school_data(auth.uid()))
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can delete results"
ON public.result_uploads
FOR DELETE
TO authenticated
USING (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can create notifications"
ON public.notification_events
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can update notifications"
ON public.notification_events
FOR UPDATE
TO authenticated
USING (public.can_manage_school_data(auth.uid()))
WITH CHECK (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can delete notifications"
ON public.notification_events
FOR DELETE
TO authenticated
USING (public.can_manage_school_data(auth.uid()));

CREATE POLICY "Staff can upload attendance import files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attendance-imports'
  AND public.can_manage_school_data(auth.uid())
);

CREATE POLICY "Staff can update attendance import files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attendance-imports'
  AND public.can_manage_school_data(auth.uid())
)
WITH CHECK (
  bucket_id = 'attendance-imports'
  AND public.can_manage_school_data(auth.uid())
);

CREATE POLICY "Staff can delete attendance import files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attendance-imports'
  AND public.can_manage_school_data(auth.uid())
);

CREATE POLICY "Staff can upload result files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-results'
  AND public.can_manage_school_data(auth.uid())
);

CREATE POLICY "Staff can update result files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-results'
  AND public.can_manage_school_data(auth.uid())
)
WITH CHECK (
  bucket_id = 'student-results'
  AND public.can_manage_school_data(auth.uid())
);

CREATE POLICY "Staff can delete result files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-results'
  AND public.can_manage_school_data(auth.uid())
);