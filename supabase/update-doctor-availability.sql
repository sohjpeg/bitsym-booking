-- Ensure doctor_availability table has the correct structure
-- This table stores the recurring weekly schedule for doctors

drop table if exists public.doctor_availability cascade;

create table public.doctor_availability (
  id uuid default gen_random_uuid() primary key,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  day_of_week text not null, -- 'Monday', 'Tuesday', etc.
  start_time time not null,
  end_time time not null,
  slot_duration interval default '30 minutes',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent overlapping schedules for the same doctor on the same day
  constraint unique_doctor_day unique (doctor_id, day_of_week)
);

-- Enable RLS
alter table public.doctor_availability enable row level security;

-- Policies
drop policy if exists "Public can view doctor availability" on public.doctor_availability;
create policy "Public can view doctor availability"
  on public.doctor_availability for select
  using (true);

drop policy if exists "Doctors can manage their own availability" on public.doctor_availability;
create policy "Doctors can manage their own availability"
  on public.doctor_availability for all
  using (auth.uid() in (select user_id from public.doctors where id = doctor_availability.doctor_id));

-- Insert sample schedule for existing doctors (if table was empty)
insert into public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
select id, 'Monday', '09:00', '17:00' from public.doctors
on conflict do nothing;

insert into public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
select id, 'Tuesday', '09:00', '17:00' from public.doctors
on conflict do nothing;

insert into public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
select id, 'Wednesday', '09:00', '17:00' from public.doctors
on conflict do nothing;

insert into public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
select id, 'Thursday', '09:00', '17:00' from public.doctors
on conflict do nothing;

insert into public.doctor_availability (doctor_id, day_of_week, start_time, end_time)
select id, 'Friday', '09:00', '17:00' from public.doctors
on conflict do nothing;
