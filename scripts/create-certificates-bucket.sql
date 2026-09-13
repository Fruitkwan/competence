-- Supabase Storage bucket for certificates
-- Run this in Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload certificates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'certificates');

-- Allow authenticated users to read
CREATE POLICY "Anyone can read certificates"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'certificates');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own certificates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'certificates');
