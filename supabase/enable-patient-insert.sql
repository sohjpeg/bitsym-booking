-- Enable users to create their own patient records
-- Run this in Supabase SQL Editor

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can insert their own patient record" ON public.patients;

-- Create policy to allow authenticated users to insert their own patient record
CREATE POLICY "Users can insert their own patient record"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also make sure users can read their own patient record
DROP POLICY IF EXISTS "Users can view their own patient record" ON public.patients;

CREATE POLICY "Users can view their own patient record"
ON public.patients
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'patients'
ORDER BY policyname;
