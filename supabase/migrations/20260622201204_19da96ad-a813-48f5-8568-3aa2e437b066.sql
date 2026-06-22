-- payslip-logos: owner-scoped read (bucket is now private)
DROP POLICY IF EXISTS "Public read payslip logos" ON storage.objects;

CREATE POLICY "Owners read own payslip logos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payslip-logos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Remove broad public listing on the remaining public buckets.
-- Files still load through their direct public object URLs.
DROP POLICY IF EXISTS "Public read teacher images" ON storage.objects;
DROP POLICY IF EXISTS "Public read branding" ON storage.objects;