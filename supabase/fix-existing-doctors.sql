-- Fix Existing Doctors
-- Run this in Supabase SQL Editor to assign specialties to existing doctors

-- Update doctors who have 'General Practice' or null to something more specific
-- This helps with testing the voice booking feature

UPDATE public.doctors
SET specialty = 'Cardiologist'
WHERE id IN (SELECT id FROM public.doctors LIMIT 1);

UPDATE public.doctors
SET specialty = 'Dermatologist'
WHERE id IN (SELECT id FROM public.doctors OFFSET 1 LIMIT 1);

UPDATE public.doctors
SET specialty = 'Pediatrician'
WHERE id IN (SELECT id FROM public.doctors OFFSET 2 LIMIT 1);

UPDATE public.doctors
SET specialty = 'Neurologist'
WHERE id IN (SELECT id FROM public.doctors OFFSET 3 LIMIT 1);

-- Verify the changes
SELECT 
  d.id,
  u.full_name,
  d.specialty
FROM public.doctors d
JOIN public.users u ON u.id = d.user_id;
