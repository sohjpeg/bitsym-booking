-- Fix Signup Error and Update Trigger
-- Run this in Supabase SQL Editor

-- 1. Ensure doctors table has specialty column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doctors' AND column_name = 'specialty') THEN
        ALTER TABLE public.doctors ADD COLUMN specialty text DEFAULT 'General Practice';
    END IF;
END $$;

-- 2. Create or Replace the Trigger Function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle stale data: If email exists in public.users but we are creating a new auth user,
  -- it means the public.users record is an orphan or from a previous failed attempt.
  -- We should update it to link to the new user, or delete and recreate.
  
  IF EXISTS (SELECT 1 FROM public.users WHERE email = NEW.email) THEN
    -- Delete related records first to avoid FK violations
    DELETE FROM public.patients WHERE user_id IN (SELECT id FROM public.users WHERE email = NEW.email);
    DELETE FROM public.doctors WHERE user_id IN (SELECT id FROM public.users WHERE email = NEW.email);
    DELETE FROM public.users WHERE email = NEW.email;
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
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- If role is doctor, create doctor record with specialty
  IF NEW.raw_user_meta_data->>'role' = 'doctor' THEN
    INSERT INTO public.doctors (user_id, specialty, is_available)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'specialty', 'General Practice'), 
      true
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error (optional, if you have a logs table)
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    -- Re-raise the error so the auth user creation fails and we know about it
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
