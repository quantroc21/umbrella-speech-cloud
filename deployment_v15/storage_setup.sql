-- STORAGE SETUP FOR VOICE CLONING
-- Run this in your Supabase SQL Editor

-- 1. Create the 'references' bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('references', 'references', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable Row Level Security
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow Authenticated Users to Upload
-- Context: Users can only upload if the file path starts with their User ID
CREATE POLICY "Users can upload their own references"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'references' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Policy: Allow Users to Read/Download their own files
CREATE POLICY "Users can view their own references"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'references' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Policy: Allow Public Read (Optional, if you want public audio previews)
-- Use this if your audio player needs to access via public URL without a signed token
-- CREATE POLICY "Public can view references"
-- ON storage.objects FOR SELECT
-- TO public
-- USING (bucket_id = 'references');
