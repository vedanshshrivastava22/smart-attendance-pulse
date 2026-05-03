-- Add PF and ESI to salary_payroll, recompute net_salary
ALTER TABLE public.salary_payroll DROP COLUMN net_salary;
ALTER TABLE public.salary_payroll ADD COLUMN pf numeric NOT NULL DEFAULT 0;
ALTER TABLE public.salary_payroll ADD COLUMN esi numeric NOT NULL DEFAULT 0;
ALTER TABLE public.salary_payroll ADD COLUMN net_salary numeric GENERATED ALWAYS AS ((base_salary + allowances) - (deductions + pf + esi)) STORED;

-- Settings table per user for payslip customization
CREATE TABLE public.payslip_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  organization_name text NOT NULL DEFAULT 'Your School',
  address_line text,
  header_title text NOT NULL DEFAULT 'Salary Payslip',
  header_note text,
  footer_note text,
  signatory_name text,
  logo_url text,
  show_pf boolean NOT NULL DEFAULT true,
  show_esi boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payslip_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payslip settings" ON public.payslip_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own payslip settings" ON public.payslip_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own payslip settings" ON public.payslip_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own payslip settings" ON public.payslip_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_payslip_settings_updated_at BEFORE UPDATE ON public.payslip_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public bucket for payslip logos
INSERT INTO storage.buckets (id, name, public) VALUES ('payslip-logos', 'payslip-logos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read payslip logos" ON storage.objects FOR SELECT USING (bucket_id = 'payslip-logos');
CREATE POLICY "Auth upload payslip logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payslip-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth update own payslip logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'payslip-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth delete own payslip logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payslip-logos' AND auth.uid()::text = (storage.foldername(name))[1]);