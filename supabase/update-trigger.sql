-- Update Trigger to Handle Doctor Specialties
-- Run this in Supabase SQL Editor

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

  -- If role is doctor, create doctor record with specialty
  IF NEW.raw_user_meta_data->>'role' = 'doctor' THEN
    INSERT INTO public.doctors (user_id, specialty, is_available)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'specialty', 'General Practice'), 
      true
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
