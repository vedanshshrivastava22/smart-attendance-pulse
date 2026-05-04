-- Branding (single shared row)
CREATE TABLE public.app_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL DEFAULT 'Smart Attendance',
  tagline TEXT NOT NULL DEFAULT 'A delightful command center for teachers, admins, and parents.',
  logo_url TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view branding" ON public.app_branding FOR SELECT USING (true);
CREATE POLICY "Admins manage branding insert" ON public.app_branding FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage branding update" ON public.app_branding FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage branding delete" ON public.app_branding FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_app_branding_updated BEFORE UPDATE ON public.app_branding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_branding (organization_name, tagline) VALUES ('Smart Attendance', 'A delightful command center for teachers, admins, and parents.');

-- Teachers
CREATE SEQUENCE IF NOT EXISTS public.teacher_code_seq START 1;
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_code TEXT NOT NULL UNIQUE DEFAULT ('TCH-' || LPAD(nextval('public.teacher_code_seq')::text, 4, '0')),
  full_name TEXT NOT NULL,
  age INTEGER,
  position TEXT,
  classes_taught TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view teachers" ON public.teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert teachers" ON public.teachers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update teachers" ON public.teachers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete teachers" ON public.teachers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_teachers_updated BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Exam results
CREATE TABLE public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  class_id UUID NOT NULL,
  exam_name TEXT NOT NULL,
  exam_date DATE,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_max NUMERIC NOT NULL DEFAULT 0,
  total_obtained NUMERIC NOT NULL DEFAULT 0,
  overall_grade TEXT,
  feedback TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view exam_results" ON public.exam_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert exam_results" ON public.exam_results FOR INSERT TO authenticated WITH CHECK (public.can_manage_school_data(auth.uid()));
CREATE POLICY "Staff update exam_results" ON public.exam_results FOR UPDATE TO authenticated USING (public.can_manage_school_data(auth.uid())) WITH CHECK (public.can_manage_school_data(auth.uid()));
CREATE POLICY "Staff delete exam_results" ON public.exam_results FOR DELETE TO authenticated USING (public.can_manage_school_data(auth.uid()));
CREATE TRIGGER trg_exam_results_updated BEFORE UPDATE ON public.exam_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('teacher-images', 'teacher-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('branding-assets', 'branding-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read teacher images" ON storage.objects FOR SELECT USING (bucket_id = 'teacher-images');
CREATE POLICY "Admins upload teacher images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'teacher-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update teacher images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'teacher-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete teacher images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'teacher-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding-assets');
CREATE POLICY "Admins upload branding" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update branding" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete branding" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding-assets' AND public.has_role(auth.uid(), 'admin'));