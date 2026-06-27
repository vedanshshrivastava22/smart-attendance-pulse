ALTER TABLE public.app_branding
  ADD COLUMN IF NOT EXISTS footer_description text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS footer_links jsonb NOT NULL DEFAULT '[]'::jsonb;