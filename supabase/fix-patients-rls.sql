-- Fix RLS recursion on patients table
-- This script drops existing policies and creates simple, non-recursive ones

alter table public.patients enable row level security;

-- Drop potentially problematic policies
drop policy if exists "Users can view their own patient profile" on public.patients;
drop policy if exists "Users can update their own patient profile" on public.patients;
drop policy if exists "Users can insert their own patient profile" on public.patients;
drop policy if exists "Public can view patients" on public.patients;

-- Create simple policies based on user_id
create policy "Users can view their own patient profile"
  on public.patients for select
  using (auth.uid() = user_id);

create policy "Users can update their own patient profile"
  on public.patients for update
  using (auth.uid() = user_id);

create policy "Users can insert their own patient profile"
  on public.patients for insert
  with check (auth.uid() = user_id);
