# 🗄️ Supabase Setup Guide

Complete setup instructions for your healthcare appointment booking system with authentication and database.

## 📋 Prerequisites

- Supabase account (free tier works!)
- Node.js 18+ installed
- Your booking project folder

## 🚀 Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"New Project"**
3. Fill in:
   - **Project Name**: `booking-system` (or any name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
4. Click **"Create new project"**
5. Wait 2-3 minutes for setup

## 🔑 Step 2: Get API Keys

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGc... (long string)
service_role key: eyJhbGc... (different long string) - KEEP SECRET!
```

3. Open `.env.local` in your project
4. Replace the placeholder values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key...
```

## 💾 Step 3: Create Database Schema

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"+ New Query"**
3. Open the file `supabase/schema.sql` in your project
4. Copy ALL the contents
5. Paste into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. You should see: ✅ Success. No rows returned

### What this creates:
- ✅ Users table (with patient/doctor/admin roles)
- ✅ Doctors table (profiles, specialties)
- ✅ Patients table (medical history)
- ✅ Appointments table (bookings)
- ✅ Notifications table
- ✅ Doctor availability schedules
- ✅ Row-Level Security (RLS) policies
- ✅ Automatic triggers and functions

## 👤 Step 4: Create Test Users

### Option A: Using Supabase UI (Recommended for first user)

1. Go to **Authentication** → **Users** in Supabase
2. Click **"Add user"** → **"Create new user"**
3. Fill in:
   - **Email**: your-email@example.com
   - **Password**: create a password
   - **Auto Confirm User**: ✅ Check this
4. Click **"Create user"**
5. **Copy the User ID** (UUID) that appears

### Option B: Using SQL (for multiple users)

```sql
-- Go to SQL Editor and run this for each user you want to create
-- Replace email and password with actual values

-- Create an admin user
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@example.com',
  crypt('admin123', gen_salt('bf')), -- Password: admin123
  NOW(),
  NOW(),
  NOW()
) RETURNING id;

-- After creating the auth user, add to public.users
-- Replace 'uuid-from-above' with the ID returned above
INSERT INTO public.users (id, email, full_name, role) VALUES
('uuid-from-above', 'admin@example.com', 'Admin User', 'admin');
```

## 👨‍⚕️ Step 5: Create Sample Doctors

```sql
-- Go to SQL Editor and run this
-- First, create doctor users in auth.users (use Step 4 method)
-- Then add them to public.users with role='doctor'
-- Finally, create doctor profiles:

-- Example: Dr. Sarah Johnson (Cardiologist)
INSERT INTO public.doctors (
  user_id, 
  specialty, 
  license_number,
  years_of_experience, 
  consultation_fee,
  bio
) VALUES (
  'uuid-of-doctor-user', -- Replace with actual doctor user ID
  'Cardiologist',
  'MD-12345',
  15,
  150.00,
  'Experienced cardiologist specializing in heart disease prevention and treatment.'
);

-- Add availability (Monday-Friday, 9 AM - 5 PM)
INSERT INTO public.doctor_availability (doctor_id, day_of_week, start_time, end_time) 
SELECT 
  id,
  day,
  '09:00'::time,
  '17:00'::time
FROM public.doctors, 
     generate_series(1, 5) AS day -- 1=Mon, 5=Fri
WHERE specialty = 'Cardiologist';
```

### Quick Setup: Create Multiple Doctors

```sql
-- Run this to create 3 sample doctors quickly
-- Make sure to create their auth users first!

WITH doctor_users AS (
  -- Replace these UUIDs with actual user IDs from auth.users
  SELECT * FROM (VALUES
    ('uuid-1', 'Dr. Sarah Johnson', 'Cardiologist', 15),
    ('uuid-2', 'Dr. Michael Smith', 'General Practitioner', 10),
    ('uuid-3', 'Dr. Emily Brown', 'Dermatologist', 8)
  ) AS t(user_id, full_name, specialty, years)
)
INSERT INTO public.doctors (user_id, specialty, years_of_experience, consultation_fee)
SELECT user_id, specialty, years, 100.00 FROM doctor_users;

-- Add default availability for all doctors
INSERT INTO public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
SELECT 
  d.id,
  day,
  '09:00'::time,
  '17:00'::time
FROM public.doctors d
CROSS JOIN generate_series(1, 5) AS day;
```

## ✅ Step 6: Verify Setup

### Check Tables Exist

```sql
-- Run in SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- ✅ appointments
- ✅ doctor_availability
- ✅ doctors
- ✅ notifications
- ✅ patients
- ✅ users

### Check RLS is Enabled

```sql
-- Run in SQL Editor
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

All tables should show `rowsecurity = true`

### Check Sample Data

```sql
-- View doctors
SELECT u.full_name, d.specialty, d.is_available
FROM public.doctors d
JOIN public.users u ON u.id = d.user_id;

-- View doctor availability
SELECT 
  u.full_name,
  d.specialty,
  da.day_of_week,
  da.start_time,
  da.end_time
FROM public.doctor_availability da
JOIN public.doctors d ON d.id = da.doctor_id
JOIN public.users u ON u.id = d.user_id
ORDER BY u.full_name, da.day_of_week;
```

## 🔒 Step 7: Test Authentication

1. Restart your Next.js dev server:
   ```bash
   npm run dev
   ```

2. Try logging in with the test user you created

3. Check Supabase **Authentication** → **Users** to see active sessions

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- ❌ Check `.env.local` has all 3 variables
- ❌ Check no extra spaces in values
- ❌ Restart dev server after changes

### "RLS policy violation"
- ❌ Make sure RLS is enabled (Step 6)
- ❌ User must be authenticated
- ❌ User role must match policy

### "Doctor not found"
- ❌ Create auth user first
- ❌ Add to public.users with correct role
- ❌ Then create doctor profile

### "Cannot insert into appointments"
- ❌ Patient profile must exist first
- ❌ Doctor must exist and be available
- ❌ User must be logged in

## 📊 Database Structure Summary

```
auth.users (Supabase managed)
    ↓
public.users (role: patient/doctor/admin)
    ↓                    ↓
public.patients      public.doctors
    ↓                    ↓
    ↓         public.doctor_availability
    ↓                    ↓
    └────── public.appointments ──────┘
                ↓
        public.notifications
```

## 🎯 Next Steps

After completing setup:

1. ✅ Environment variables configured
2. ✅ Database schema created
3. ✅ Sample doctors added
4. ✅ RLS policies active
5. ✅ Ready to build authentication!

Continue to **authentication implementation** next!

## 🆘 Need Help?

- Supabase Docs: https://supabase.com/docs
- Check Supabase logs: **Logs** → **Explorer**
- Test queries in SQL Editor
- Check Row-Level Security policies

---

**Status after this step:** Database ready, API keys configured ✅

**Next:** Build authentication system with login/signup pages
