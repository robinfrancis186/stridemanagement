create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  source_type text not null default 'OTHER',
  priority text not null default 'P2',
  tech_level text not null default 'LOW',
  disability_types jsonb not null default '[]'::jsonb,
  therapy_domains jsonb not null default '[]'::jsonb,
  market_price numeric,
  stride_target_price numeric,
  gap_flags jsonb not null default '[]'::jsonb,
  current_state text not null default 'S1',
  path_assignment text,
  revision_number integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.state_transitions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  from_state text not null,
  to_state text not null,
  transitioned_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.phase_feedbacks (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  from_state text not null,
  to_state text not null,
  phase_notes text,
  blockers_resolved jsonb,
  key_decisions jsonb,
  phase_specific_data jsonb,
  submitted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.doe_records (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  testing_protocol text,
  sample_size integer,
  sample_size_justification text,
  baseline_data jsonb,
  beneficiary_profiles jsonb,
  pre_test_data jsonb,
  post_test_data jsonb,
  improvement_metrics jsonb,
  statistical_analysis jsonb,
  results_summary text,
  beneficiary_feedback text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.committee_reviews (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  reviewer_id uuid references auth.users (id) on delete set null,
  user_need_score numeric,
  technical_feasibility_score numeric,
  doe_results_score numeric,
  cost_effectiveness_score numeric,
  safety_score numeric,
  weighted_total numeric,
  feedback_text text,
  recommendation text,
  conditions text,
  created_at timestamptz not null default now()
);

create table if not exists public.committee_decisions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  decision text not null,
  revision_instructions text,
  conditions text,
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.designathon_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'active',
  requirement_id uuid references public.requirements (id) on delete set null,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.designathon_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.designathon_events (id) on delete cascade,
  requirement_id uuid references public.requirements (id) on delete set null,
  team_name text not null,
  members jsonb not null default '[]'::jsonb,
  submission_url text,
  score numeric,
  is_winner boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  read boolean not null default false,
  requirement_id uuid references public.requirements (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.requirement_versions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  changed_by uuid references auth.users (id) on delete set null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.requirement_files (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  file_type text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_requirements_state on public.requirements (current_state);
create index if not exists idx_requirements_created_at on public.requirements (created_at desc);
create index if not exists idx_state_transitions_requirement on public.state_transitions (requirement_id, created_at desc);
create index if not exists idx_phase_feedbacks_requirement on public.phase_feedbacks (requirement_id, created_at desc);
create index if not exists idx_doe_records_requirement on public.doe_records (requirement_id, created_at desc);
create index if not exists idx_committee_reviews_requirement on public.committee_reviews (requirement_id, created_at desc);
create index if not exists idx_committee_decisions_requirement on public.committee_decisions (requirement_id, created_at desc);
create index if not exists idx_designathon_teams_event on public.designathon_teams (event_id, created_at asc);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_requirement_files_requirement on public.requirement_files (requirement_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, user_id, email, full_name)
  values (
    new.id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();

  insert into public.user_roles (id, user_id, role)
  values (
    new.id,
    new.id,
    case
      when not exists (select 1 from public.user_roles) then 'coe_admin'
      else 'member'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.requirements enable row level security;
alter table public.state_transitions enable row level security;
alter table public.phase_feedbacks enable row level security;
alter table public.doe_records enable row level security;
alter table public.committee_reviews enable row level security;
alter table public.committee_decisions enable row level security;
alter table public.designathon_events enable row level security;
alter table public.designathon_teams enable row level security;
alter table public.notifications enable row level security;
alter table public.requirement_versions enable row level security;
alter table public.requirement_files enable row level security;

drop policy if exists "authenticated users can manage profiles" on public.profiles;
create policy "authenticated users can manage profiles"
on public.profiles
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage roles" on public.user_roles;
create policy "authenticated users can manage roles"
on public.user_roles
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage requirements" on public.requirements;
create policy "authenticated users can manage requirements"
on public.requirements
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage transitions" on public.state_transitions;
create policy "authenticated users can manage transitions"
on public.state_transitions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage phase feedbacks" on public.phase_feedbacks;
create policy "authenticated users can manage phase feedbacks"
on public.phase_feedbacks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage doe records" on public.doe_records;
create policy "authenticated users can manage doe records"
on public.doe_records
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage committee reviews" on public.committee_reviews;
create policy "authenticated users can manage committee reviews"
on public.committee_reviews
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage committee decisions" on public.committee_decisions;
create policy "authenticated users can manage committee decisions"
on public.committee_decisions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage designathon events" on public.designathon_events;
create policy "authenticated users can manage designathon events"
on public.designathon_events
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage designathon teams" on public.designathon_teams;
create policy "authenticated users can manage designathon teams"
on public.designathon_teams
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage notifications" on public.notifications;
create policy "authenticated users can manage notifications"
on public.notifications
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage versions" on public.requirement_versions;
create policy "authenticated users can manage versions"
on public.requirement_versions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can manage files" on public.requirement_files;
create policy "authenticated users can manage files"
on public.requirement_files
for all
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('requirement-files', 'requirement-files', false)
on conflict (id) do nothing;

drop policy if exists "authenticated users can view requirement files" on storage.objects;
create policy "authenticated users can view requirement files"
on storage.objects
for select
to authenticated
using (bucket_id = 'requirement-files');

drop policy if exists "authenticated users can upload requirement files" on storage.objects;
create policy "authenticated users can upload requirement files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'requirement-files');

drop policy if exists "authenticated users can update requirement files" on storage.objects;
create policy "authenticated users can update requirement files"
on storage.objects
for update
to authenticated
using (bucket_id = 'requirement-files')
with check (bucket_id = 'requirement-files');

drop policy if exists "authenticated users can delete requirement files" on storage.objects;
create policy "authenticated users can delete requirement files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'requirement-files');
