-- ============================================================
-- Riverside CRM / Sales Follow-Up Module
-- Designed to sit alongside the existing Riverside ATS schema
-- on the same Supabase project. Run in order: 01, 02, 03.
-- ============================================================

-- ---------- 1. TEAM MEMBERS (extends Supabase auth.users) ----------
create table if not exists public.team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('CEO','Overseas Director','Manager','Partner-Sales','Marketing Executive','Other')),
  base_location text,                 -- e.g. 'Lahore, PK' / 'Saudi Arabia'
  email text,
  phone text,
  whatsapp text,
  created_at timestamptz default now()
);

-- ---------- 2. CLIENTS ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text,
  designation text,
  email text,
  phone text,
  whatsapp text,
  country text,
  sector text,                        -- construction, hospitality, oil & gas, etc.
  client_type text not null check (client_type in ('past','present','potential')) default 'potential',
  source text,                        -- referral, exhibition, cold outreach, inbound
  assigned_to uuid references public.team_members(id),
  rating int check (rating between 1 and 5),   -- potential value / priority
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_clients_type on public.clients(client_type);
create index if not exists idx_clients_assigned on public.clients(assigned_to);

-- ---------- 3. INTERACTIONS (the contact log / follow-up history) ----------
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  team_member_id uuid references public.team_members(id),
  interaction_type text not null check (interaction_type in ('call','email','whatsapp','in_person_visit','meeting','other')),
  interaction_date timestamptz not null default now(),
  summary text,                       -- what was discussed
  feedback text,                      -- client's response/feedback
  outcome text check (outcome in ('positive','neutral','negative','no_response','closed_won','closed_lost')),
  next_followup_date date,            -- KEY field driving reminders
  next_followup_notes text,
  created_at timestamptz default now()
);

create index if not exists idx_interactions_client on public.interactions(client_id);
create index if not exists idx_interactions_followup on public.interactions(next_followup_date);
create index if not exists idx_interactions_member on public.interactions(team_member_id);

-- ---------- 4. CAMPAIGNS (bulk emails: revival, informational, opportunity alerts) ----------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_type text not null check (campaign_type in ('past_client_revival','potential_outreach','informational','opportunity_alert')),
  subject text,
  body_html text,
  target_client_type text check (target_client_type in ('past','present','potential','all')),
  target_sector text,                 -- optional filter
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','cancelled')),
  created_by uuid references public.team_members(id),
  created_at timestamptz default now()
);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text default 'pending' check (status in ('pending','sent','failed','opened')),
  sent_at timestamptz,
  unique(campaign_id, client_id)
);

-- ---------- 5. INTERNAL ALERTS (what powers "alert all of us") ----------
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid references public.team_members(id),
  client_id uuid references public.clients(id),
  alert_type text check (alert_type in ('followup_due','followup_overdue','campaign_sent','client_assigned')),
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_alerts_member on public.alerts(team_member_id, is_read);

-- ---------- 6. ROW LEVEL SECURITY ----------
alter table public.clients enable row level security;
alter table public.interactions enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.alerts enable row level security;
alter table public.team_members enable row level security;

-- All authenticated internal staff can see everything (small team, shared visibility).
-- Tighten later with per-role policies if needed (e.g. Amna can't delete clients).
create policy "internal staff full read" on public.clients for select using (auth.role() = 'authenticated');
create policy "internal staff write" on public.clients for insert with check (auth.role() = 'authenticated');
create policy "internal staff update" on public.clients for update using (auth.role() = 'authenticated');

create policy "internal staff full read" on public.interactions for select using (auth.role() = 'authenticated');
create policy "internal staff write" on public.interactions for insert with check (auth.role() = 'authenticated');
create policy "internal staff update" on public.interactions for update using (auth.role() = 'authenticated');

create policy "internal staff full read" on public.campaigns for select using (auth.role() = 'authenticated');
create policy "internal staff write" on public.campaigns for insert with check (auth.role() = 'authenticated');
create policy "internal staff update" on public.campaigns for update using (auth.role() = 'authenticated');

create policy "internal staff full read" on public.campaign_recipients for select using (auth.role() = 'authenticated');
create policy "internal staff write" on public.campaign_recipients for all using (auth.role() = 'authenticated');

create policy "members see own alerts" on public.alerts for select using (team_member_id = auth.uid() or auth.role() = 'authenticated');
create policy "system writes alerts" on public.alerts for insert with check (true);
create policy "members update own alerts" on public.alerts for update using (team_member_id = auth.uid());

create policy "internal staff read team" on public.team_members for select using (auth.role() = 'authenticated');
