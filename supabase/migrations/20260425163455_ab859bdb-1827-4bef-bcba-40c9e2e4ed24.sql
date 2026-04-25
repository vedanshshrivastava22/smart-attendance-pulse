CREATE OR REPLACE FUNCTION public.ensure_staff_profile(_full_name text DEFAULT NULL, _phone text DEFAULT NULL)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    assigned_role := 'moderator';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN assigned_role;
END;
$$;

CREATE TYPE public.payroll_status AS ENUM ('draft', 'paid', 'hold');

CREATE TABLE public.salary_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payroll_month DATE NOT NULL,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) GENERATED ALWAYS AS (base_salary + allowances - deductions) STORED,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  paid_on DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_profile_id, payroll_month)
);

ALTER TABLE public.salary_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all payroll and staff can view own payroll"
ON public.salary_payroll
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = salary_payroll.staff_profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can create payroll"
ON public.salary_payroll
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payroll"
ON public.salary_payroll
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payroll"
ON public.salary_payroll
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_salary_payroll_staff_profile_id ON public.salary_payroll(staff_profile_id);
CREATE INDEX idx_salary_payroll_month ON public.salary_payroll(payroll_month);

CREATE TRIGGER update_salary_payroll_updated_at
BEFORE UPDATE ON public.salary_payroll
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();