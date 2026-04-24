CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'leave', 'holiday');
CREATE TYPE public.message_language AS ENUM ('english', 'hindi');
CREATE TYPE public.notification_type AS ENUM ('attendance', 'result');
CREATE TYPE public.notification_send_mode AS ENUM ('auto', 'manual');
CREATE TYPE public.notification_delivery_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
CREATE TYPE public.import_source_type AS ENUM ('excel_upload', 'google_sheet');
CREATE TYPE public.import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.result_file_type AS ENUM ('pdf');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.school_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name TEXT NOT NULL CHECK (class_name IN ('9', '10', '11', '12')),
  section TEXT,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_name, section, academic_year)
);

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  admission_number TEXT,
  parent_name TEXT,
  parent_phone TEXT NOT NULL,
  whatsapp_phone TEXT,
  preferred_language public.message_language NOT NULL DEFAULT 'english',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, roll_number)
);

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status public.attendance_status NOT NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  marked_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);

CREATE TABLE public.excel_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.school_classes(id) ON DELETE SET NULL,
  source_type public.import_source_type NOT NULL,
  source_name TEXT NOT NULL,
  storage_path TEXT,
  spreadsheet_id TEXT,
  worksheet_name TEXT,
  status public.import_status NOT NULL DEFAULT 'pending',
  rows_imported INTEGER NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.result_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  exam_name TEXT NOT NULL,
  file_type public.result_file_type NOT NULL DEFAULT 'pdf',
  storage_path TEXT NOT NULL,
  send_to_parent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_record_id UUID REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  result_upload_id UUID REFERENCES public.result_uploads(id) ON DELETE CASCADE,
  notification_type public.notification_type NOT NULL,
  send_mode public.notification_send_mode NOT NULL DEFAULT 'manual',
  message_language public.message_language NOT NULL DEFAULT 'english',
  recipient_phone TEXT NOT NULL,
  message_body TEXT,
  delivery_status public.notification_delivery_status NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    attendance_record_id IS NOT NULL
    OR result_upload_id IS NOT NULL
  )
);

CREATE INDEX idx_students_class_id ON public.students(class_id);
CREATE INDEX idx_attendance_records_class_date ON public.attendance_records(class_id, attendance_date);
CREATE INDEX idx_attendance_records_student_date ON public.attendance_records(student_id, attendance_date);
CREATE INDEX idx_result_uploads_class_id ON public.result_uploads(class_id);
CREATE INDEX idx_notification_events_student_id ON public.notification_events(student_id);
CREATE INDEX idx_notification_events_delivery_status ON public.notification_events(delivery_status);

CREATE OR REPLACE VIEW public.attendance_analytics AS
SELECT
  s.id AS student_id,
  s.full_name,
  s.roll_number,
  sc.id AS class_id,
  sc.class_name,
  sc.section,
  COUNT(*) FILTER (WHERE ar.status <> 'holiday') AS working_days,
  COUNT(*) FILTER (WHERE ar.status = 'present') AS present_days,
  COUNT(*) FILTER (WHERE ar.status = 'absent') AS absent_days,
  COUNT(*) FILTER (WHERE ar.status = 'leave') AS leave_days,
  ROUND(
    CASE
      WHEN COUNT(*) FILTER (WHERE ar.status <> 'holiday') = 0 THEN 0
      ELSE (
        COUNT(*) FILTER (WHERE ar.status = 'present')::numeric
        / COUNT(*) FILTER (WHERE ar.status <> 'holiday')::numeric
      ) * 100
    END,
    2
  ) AS attendance_percentage,
  CASE
    WHEN COUNT(*) FILTER (WHERE ar.status <> 'holiday') = 0 THEN false
    ELSE (
      (COUNT(*) FILTER (WHERE ar.status = 'present')::numeric
      / COUNT(*) FILTER (WHERE ar.status <> 'holiday')::numeric) * 100
    ) < 75
  END AS below_75_percent
FROM public.students s
JOIN public.school_classes sc ON sc.id = s.class_id
LEFT JOIN public.attendance_records ar ON ar.student_id = s.id
GROUP BY s.id, s.full_name, s.roll_number, sc.id, sc.class_name, sc.section;

ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can view classes"
ON public.school_classes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can create classes"
ON public.school_classes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can update classes"
ON public.school_classes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated staff can delete classes"
ON public.school_classes
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can view students"
ON public.students
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can create students"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can update students"
ON public.students
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated staff can delete students"
ON public.students
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can view attendance"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can create attendance"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can update attendance"
ON public.attendance_records
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated staff can delete attendance"
ON public.attendance_records
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can view imports"
ON public.excel_imports
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can create imports"
ON public.excel_imports
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can update imports"
ON public.excel_imports
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated staff can delete imports"
ON public.excel_imports
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can view results"
ON public.result_uploads
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can create results"
ON public.result_uploads
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can update results"
ON public.result_uploads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated staff can delete results"
ON public.result_uploads
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can view notifications"
ON public.notification_events
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can create notifications"
ON public.notification_events
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can update notifications"
ON public.notification_events
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated staff can delete notifications"
ON public.notification_events
FOR DELETE
TO authenticated
USING (true);

CREATE TRIGGER update_school_classes_updated_at
BEFORE UPDATE ON public.school_classes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_excel_imports_updated_at
BEFORE UPDATE ON public.excel_imports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_result_uploads_updated_at
BEFORE UPDATE ON public.result_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_events_updated_at
BEFORE UPDATE ON public.notification_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-imports', 'attendance-imports', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-results', 'student-results', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated staff can view attendance import files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'attendance-imports');

CREATE POLICY "Authenticated staff can upload attendance import files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attendance-imports');

CREATE POLICY "Authenticated staff can update attendance import files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'attendance-imports')
WITH CHECK (bucket_id = 'attendance-imports');

CREATE POLICY "Authenticated staff can delete attendance import files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'attendance-imports');

CREATE POLICY "Authenticated staff can view result files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'student-results');

CREATE POLICY "Authenticated staff can upload result files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-results');

CREATE POLICY "Authenticated staff can update result files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'student-results')
WITH CHECK (bucket_id = 'student-results');

CREATE POLICY "Authenticated staff can delete result files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'student-results');