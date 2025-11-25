# How to Add Multiple Doctors

To fix the "Doctor not found" error, you need to have doctors in your database with the correct specialties.

## Option 1: Sign Up New Doctors (Recommended)

I have updated the Signup page to support Doctor specialties.

**IMPORTANT: Run this first!**
1. Go to your **Supabase Dashboard** > **SQL Editor**.
2. Copy and run the code from `supabase/add-specialty-column.sql` to ensure the database has the `specialty` field.
3. Copy and run the code from `supabase/update-trigger.sql` to enable saving the specialty during signup.

**Then create accounts:**
1. Go to the **Sign Up** page (`/signup`).
2. Select **"I am a: Doctor"**.
3. A new **"Specialty"** dropdown will appear.
4. Fill in the details (e.g., "Dr. Smith", "Cardiologist") and sign up.
5. Repeat this for as many doctors as you need (use different emails like `doctor1@test.com`, `doctor2@test.com`).

## Option 2: Fix Existing Doctors

If you already created doctor accounts but they are all "General Practice" or have no specialty:

1. Go to your **Supabase Dashboard** > **SQL Editor**.
2. Copy and run the code from `supabase/update-trigger.sql` to ensure future signups work correctly.
3. Copy and run the code from `supabase/fix-existing-doctors.sql` to update your existing doctors with different specialties.

## Option 3: Manual Entry (Advanced)

You can manually insert doctors in the Supabase Dashboard:

1. Go to **Authentication** > **Users** and create a new user.
2. Go to **Table Editor** > **public.users** and find the new user. Update their `role` to `doctor` and `full_name` to "Dr. Name".
3. Go to **Table Editor** > **public.doctors**.
4. Insert a new row:
   - `user_id`: Select the user ID from the dropdown.
   - `specialty`: Enter "Cardiologist", "Dentist", etc.
   - `is_available`: `TRUE`

## Troubleshooting

If you still get "Doctor not found":
- Ensure the doctor's `specialty` in the database matches what you are saying (e.g., "Cardiologist").
- Ensure the doctor's `full_name` in the `users` table starts with "Dr." if you are asking for "Dr. Smith".
