# 🔧 Fix "Could not find patient profile" Error

## What Happened?
When you signed up, the system created your **auth account** but didn't create a **patient record** in the database. The voice booking feature needs this patient record to work.

## EASIEST FIX - Run This SQL First! ⚡

You're getting 404 errors because the database won't let you create patient records. **Run this SQL first**, then the app will work automatically.

### Quick Fix SQL (30 seconds):

1. **Go to Supabase Dashboard**: https://supabase.com
2. **Click "SQL Editor"** (left sidebar)
3. **Click "+ New Query"**
4. **Copy and paste this**:

```sql
-- Allow users to create their own patient records
DROP POLICY IF EXISTS "Users can insert their own patient record" ON public.patients;

CREATE POLICY "Users can insert their own patient record"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own patient record
DROP POLICY IF EXISTS "Users can view their own patient record" ON public.patients;

CREATE POLICY "Users can view their own patient record"
ON public.patients
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

5. **Click "Run"**
6. **Refresh your browser** at http://localhost:3000
7. **It should now work automatically!** ✅

---

## If You Still Get Errors (Advanced Fix)

This creates the missing database trigger AND fixes all existing accounts.

#### Steps:

1. **Go to Supabase Dashboard**
   - Open https://supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click **"SQL Editor"** in the left sidebar
   - Click **"+ New Query"**

3. **Copy and Paste This SQL**

```sql
-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for duplicate email
  IF EXISTS (SELECT 1 FROM public.users WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'An account with email % already exists', NEW.email;
  END IF;

  -- Create user profile
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );

  -- Create patient record if role is patient
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'patient' THEN
    INSERT INTO public.patients (user_id)
    VALUES (NEW.id);
  END IF;

  -- Create doctor record if role is doctor
  IF NEW.raw_user_meta_data->>'role' = 'doctor' THEN
    INSERT INTO public.doctors (user_id, specialty, is_available)
    VALUES (NEW.id, 'General Practice', true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Fix existing users (creates missing patient records)
INSERT INTO public.patients (user_id)
SELECT u.id
FROM public.users u
LEFT JOIN public.patients p ON p.user_id = u.id
WHERE u.role = 'patient' AND p.id IS NULL;
```

4. **Click "Run"** (or press Ctrl+Enter)

5. **Verify it worked**

Run this query to see all patients:

```sql
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
```

You should see your account listed with a `patient_id`. ✅

---

## What This Does

1. **Creates database trigger** - Automatically creates patient/doctor records when users sign up
2. **Fixes existing accounts** - Creates patient records for anyone who signed up before the trigger existed
3. **Prevents duplicates** - Ensures you can't create multiple accounts with the same email

## After Running the Fix

1. Go back to http://localhost:3000
2. Refresh the page
3. Try the voice booking feature
4. It should work now! 🎉

## Still Having Issues?

Check the browser console (F12) for error messages and let me know what you see.
