-- Fix Patient Records and Create Database Trigger
-- Run this in Supabase SQL Editor

-- STEP 1: Create the trigger function that automatically creates user profiles
-- This runs whenever a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if email already exists in public.users
  IF EXISTS (SELECT 1 FROM public.users WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'An account with email % already exists', NEW.email;
  END IF;

  -- Create user profile in public.users table
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );

  -- If role is patient, create patient record
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'patient' THEN
    INSERT INTO public.patients (user_id)
    VALUES (NEW.id);
  END IF;

  -- If role is doctor, create doctor record
  IF NEW.raw_user_meta_data->>'role' = 'doctor' THEN
    INSERT INTO public.doctors (user_id, specialty, is_available)
    VALUES (NEW.id, 'General Practice', true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 2: Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 3: Fix existing users who don't have patient records
-- This creates patient records for any user with role='patient' who doesn't have one
INSERT INTO public.patients (user_id)
SELECT u.id
FROM public.users u
LEFT JOIN public.patients p ON p.user_id = u.id
WHERE u.role = 'patient' AND p.id IS NULL;

-- STEP 4: Verify the fix worked
-- This should show all patients with their user info
SELECT 
  p.id as patient_id,
  p.user_id,
  u.email,
  u.full_name,
  u.role,
  u.created_at
FROM public.patients p
JOIN public.users u ON u.id = p.user_id
ORDER BY u.created_at DESC;

-- If you see your account here, you're all set! ✅
