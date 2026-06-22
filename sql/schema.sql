-- ════════════════════════════════════════════════════════════════
-- RIVERSIDE ATS — DATABASE SCHEMA FOR SUPABASE
-- Paste this entire file into Supabase SQL Editor and click RUN
-- ════════════════════════════════════════════════════════════════

-- 1. STAFF PROFILES (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('admin','manager','staff')) default 'staff',
  assigned_clients text[] default '{}',  -- for managers: which job_order client names they can see (empty = all)
  created_at timestamp with time zone default now()
);

-- 2. JOB ORDERS (client demands)
create table public.job_orders (
  id uuid default gen_random_uuid() primary key,
  ref text not null,
  client text not null,
  country text default 'Saudi Arabia',
  city text,
  position text not null,
  vacancies int default 1,
  salary text,
  deadline date,
  status text default 'Open' check (status in ('Open','Filled','Closed')),
  contact text,
  notes text,
  created_at timestamp with time zone default now(),
  created_by uuid references public.profiles(id)
);

-- 3. CANDIDATES (the CV databank + ATS pipeline combined)
create table public.candidates (
  id uuid default gen_random_uuid() primary key,

  -- basic CV-databank info (every candidate, used or not)
  name text not null,
  father_name text,
  cnic text,
  phone text,
  email text,
  trade text,
  experience text,
  education text,
  nationality text default 'Pakistani',
  passport text,
  passport_expiry date,
  photo_url text,
  cv_url text,
  date_of_birth date,
  source text,                 -- how the CV was sourced (walk-in, referral, agent, etc.)
  databank_notes text,         -- general remarks independent of any job

  -- ATS / job assignment (null jobId = sitting in databank, unassigned)
  job_id uuid references public.job_orders(id) on delete set null,
  stage text default 'databank' check (stage in (
    'databank','shortlist','interview','offer','contract',
    'evisa','visaauth','visano','visaissue',
    'medical','tradetest',
    'ppsubmit','ppdispatch','ppreceived','stamping',
    'beoe','flight','deployed','rejected'
  )),

  -- process fields (in the sequence you specified)
  offer_letter text,             -- Yes/No/Pending
  contract text,
  electronic_no text,            -- Muqeem/MOFA
  visa_auth_date date,
  visa_no text,
  visa_issue_date date,
  medical_status text,
  medical_date date,
  medical_expiry date,           -- NEW: for expiry alerts
  trade_test_status text,
  trade_test_date date,
  pp_sub_status text,
  pp_sub_date date,
  pp_dispatch_date date,
  pp_received_date date,
  stamping_date date,
  beoe_status text,
  beoe_permission_no text,
  beoe_registration_no text,
  beoe_fee_paid text,
  flight_date date,
  objection text,
  remarks text,

  added_date date default current_date,
  created_by uuid references public.profiles(id),
  updated_at timestamp with time zone default now()
);

-- 4. ACTIVITY LOG
create table public.activity_log (
  id uuid default gen_random_uuid() primary key,
  message text not null,
  candidate_id uuid references public.candidates(id) on delete set null,
  job_id uuid references public.job_orders(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default now()
);

-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (controls who can see/edit what)
-- ════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.job_orders enable row level security;
alter table public.candidates enable row level security;
alter table public.activity_log enable row level security;

-- Everyone logged in can read their own profile + see all profiles (for staff list)
create policy "profiles_select" on public.profiles for select using (auth.uid() is not null);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Job orders: all logged-in staff can view; admin/manager can insert/update/delete
create policy "job_orders_select" on public.job_orders for select using (auth.uid() is not null);
create policy "job_orders_insert" on public.job_orders for insert with check (auth.uid() is not null);
create policy "job_orders_update" on public.job_orders for update using (auth.uid() is not null);
create policy "job_orders_delete" on public.job_orders for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'))
);

-- Candidates: all logged-in staff can view/insert/update; only admin can delete
create policy "candidates_select" on public.candidates for select using (auth.uid() is not null);
create policy "candidates_insert" on public.candidates for insert with check (auth.uid() is not null);
create policy "candidates_update" on public.candidates for update using (auth.uid() is not null);
create policy "candidates_delete" on public.candidates for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Activity log: everyone can read & insert, no one updates/deletes
create policy "activity_select" on public.activity_log for select using (auth.uid() is not null);
create policy "activity_insert" on public.activity_log for insert with check (auth.uid() is not null);

-- ════════════════════════════════════════════════════════════════
-- AUTO-CREATE PROFILE WHEN A NEW USER SIGNS UP
-- ════════════════════════════════════════════════════════════════
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS (for CV files and candidate photos)
-- Run these, then also create the buckets manually in Storage tab
-- (Supabase UI: Storage > New Bucket > name "cvs", set to Public)
-- (Supabase UI: Storage > New Bucket > name "photos", set to Public)
-- ════════════════════════════════════════════════════════════════
