# 🏥 Healthcare Booking System - Voice-Powered Appointment Platform

A complete healthcare management system with voice-powered appointment booking, role-based dashboards, and real-time database integration.

## 🌟 Features

### Voice Booking System
- 🎤 **Speech-to-Text**: Real-time audio transcription using Groq Whisper API
- 🧠 **Intelligent Extraction**: AI-powered appointment data extraction using Groq Llama 3.3 70B
- 📅 **Smart Scheduling**: Automatic date/time parsing with conflict detection
- ✅ **Database Integration**: Direct appointment creation in Supabase

### Role-Based Dashboards

#### 👤 Patient Dashboard
- View upcoming and past appointments
- Quick stats (upcoming, past, total appointments)
- Voice booking integration
- Appointment status tracking
- Real-time updates

#### 👨‍⚕️ Doctor Dashboard
- Today's appointment overview
- Filter appointments (Today, Upcoming, Pending, All)
- Confirm/Cancel appointment requests
- Complete appointments
- Mark no-shows
- Patient contact information

#### 👑 Admin Dashboard
- System-wide overview
- Total appointments, doctors, patients statistics
- View all appointments
- Manage doctors and patients
- Tabbed interface (Overview, Appointments, Doctors, Patients)

### Authentication System
- Email/password authentication via Supabase
- Role-based access control (Patient, Doctor, Admin)
- Protected routes with automatic redirection
- Session management

### Database & Security
- PostgreSQL database via Supabase
- Row-Level Security (RLS) policies
- Automatic notifications for new appointments
- Referential integrity with foreign keys

## 🚀 Tech Stack

- **Frontend**: Next.js 16.0.3 (Pages Router)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI/ML**: 
  - Groq Whisper (speech transcription)
  - Groq Llama 3.3 70B (data extraction)
- **Styling**: CSS Modules
- **APIs**: Axios, FormData

## 📦 Installation

### Prerequisites
- Node.js 18+ installed
- Supabase account
- Groq API key

### Step 1: Clone & Install Dependencies

```bash
cd booking
npm install
```

### Step 2: Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Groq API (Free Tier)
GROQ_API_KEY=your_groq_api_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Get API Keys:**
- **Groq**: Sign up at https://console.groq.com → Create API Key
- **Supabase**: Create project at https://supabase.com → Settings → API

### Step 3: Database Setup

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/schema.sql`
4. Paste and run in SQL Editor

This creates:
- `users` table with role field
- `doctors` table with specialty and license
- `patients` table
- `appointments` table with booking details
- `doctor_availability` table
- `notifications` table
- Row-Level Security policies
- Automatic triggers

### Step 4: Create Test Users

#### Create a Test Doctor
1. Go to Supabase Dashboard → Authentication → Users
2. Click **Add User**
   - Email: `doctor@test.com`
   - Password: `password123`
3. Go to SQL Editor and run:

```sql
-- Insert into users table
INSERT INTO users (id, email, full_name, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'doctor@test.com'),
  'doctor@test.com',
  'Dr. John Smith',
  'doctor'
);

-- Insert into doctors table
INSERT INTO doctors (user_id, specialty, license_number)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'doctor@test.com'),
  'Cardiology',
  'MD-12345'
);
```

#### Create a Test Patient
You can use the signup page to create a patient account, or run in SQL Editor:

```sql
-- Insert into users table
INSERT INTO users (id, email, full_name, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'patient@test.com'),
  'patient@test.com',
  'Jane Doe',
  'patient'
);

-- Insert into patients table
INSERT INTO patients (user_id, phone_number, date_of_birth)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'patient@test.com'),
  '+1234567890',
  '1990-01-01'
);
```

### Step 5: Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## 🎯 Usage Guide

### For Patients

1. **Signup**: Go to http://localhost:3000/signup
   - Choose "Patient" role
   - Enter your details
   
2. **Voice Booking**: 
   - Go to home page
   - Click "Start Recording"
   - Say: *"I want to book an appointment with Dr. Smith for tomorrow at 2 PM"*
   - Click "Stop Recording"
   - System will transcribe, extract data, and book automatically

3. **View Appointments**: Go to http://localhost:3000/patient/dashboard
   - See upcoming appointments
   - View past appointments
   - Check appointment status

### For Doctors

1. **Login**: http://localhost:3000/login
   - Email: `doctor@test.com`
   - Password: `password123`

2. **Dashboard**: Automatically redirected to http://localhost:3000/doctor/dashboard
   - View today's appointments
   - Filter appointments (Today, Upcoming, Pending, All)
   - Confirm/Cancel pending requests
   - Mark appointments as completed or no-show

### For Admins

1. **Create Admin User**: Run in Supabase SQL Editor:

```sql
INSERT INTO users (id, email, full_name, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@test.com'),
  'admin@test.com',
  'Admin User',
  'admin'
);
```

2. **Dashboard**: http://localhost:3000/admin/dashboard
   - View system statistics
   - Manage all appointments
   - View all doctors and patients
   - Access complete system data

## 📁 Project Structure

```
booking/
├── pages/
│   ├── _app.js                    # App wrapper with AuthProvider
│   ├── index.js                   # Voice booking interface
│   ├── login.js                   # Login page
│   ├── signup.js                  # Signup page
│   ├── api/
│   │   ├── transcribe.js         # Groq Whisper transcription
│   │   ├── interpret.js          # Groq Llama data extraction
│   │   └── book.js               # Appointment booking with Supabase
│   ├── patient/
│   │   └── dashboard.js          # Patient dashboard
│   ├── doctor/
│   │   └── dashboard.js          # Doctor dashboard
│   └── admin/
│       └── dashboard.js          # Admin dashboard
├── contexts/
│   └── AuthContext.js            # Authentication context
├── lib/
│   ├── supabase.js               # Supabase client config
│   └── withAuth.js               # Route protection HOCs
├── styles/
│   ├── Home.module.css           # Voice booking styles
│   ├── Auth.module.css           # Login/Signup styles
│   └── Dashboard.module.css      # Dashboard styles
├── supabase/
│   └── schema.sql                # Database schema
└── .env.local                    # Environment variables
```

## 🔐 Security Features

- **Row-Level Security (RLS)**: Patients can only see their own data
- **Role-Based Access Control**: Routes protected by user role
- **Secure Password Storage**: Passwords hashed with bcrypt
- **Protected API Routes**: Server-side validation
- **Session Management**: Automatic session handling with Supabase

## 🐛 Troubleshooting

### "Doctor not found" Error
- Ensure you've created doctor users in Supabase
- Check that the doctor has entries in both `users` and `doctors` tables
- Voice input should mention doctor name or specialty that matches database

### Authentication Issues
- Verify all Supabase environment variables are correct
- Run the schema.sql file if tables don't exist
- Check Supabase dashboard for user creation errors

### Voice Recording Not Working
- Grant microphone permissions in browser
- Check browser console for errors
- Ensure HTTPS (or localhost) for microphone access

### Groq API Errors
- Verify GROQ_API_KEY is set correctly
- Check API quota at https://console.groq.com
- Free tier has rate limits (14,400 requests/day for Whisper)

## 📝 API Endpoints

### POST `/api/transcribe`
- **Input**: FormData with audio file
- **Output**: `{ text: string }`
- **Uses**: Groq Whisper API

### POST `/api/interpret`
- **Input**: `{ text: string }`
- **Output**: `{ doctor, speciality, date, time, intent, confidence }`
- **Uses**: Groq Llama 3.3 70B

### POST `/api/book`
- **Input**: `{ doctor, speciality, date, time, patientId }`
- **Output**: `{ success, bookingId, message, appointment }`
- **Uses**: Supabase database
