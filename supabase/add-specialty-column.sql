-- Add Specialty Column to Doctors Table
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doctors' AND column_name = 'specialty') THEN
        ALTER TABLE public.doctors ADD COLUMN specialty text DEFAULT 'General Practice';
    END IF;
END $$;

-- Verify the column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'doctors' AND column_name = 'specialty';
