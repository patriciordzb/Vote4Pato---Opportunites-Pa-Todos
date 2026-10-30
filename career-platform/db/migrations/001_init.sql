-- SHPE 2026 Career Intelligence Command Center — core schema.
-- Runs unchanged on PostgreSQL 15+ (Supabase) and on the embedded PGlite engine.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default 'Owner',
  email text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Professional profile (one per user). `data` holds the approved, structured
-- profile; `preferences` holds career + eligibility settings the user controls.
-- ---------------------------------------------------------------------------
create table if not exists professional_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists linkedin_connections (
  user_id uuid primary key references users(id) on delete cascade,
  linkedin_sub text not null,
  name text,
  given_name text,
  family_name text,
  email text,
  email_verified boolean,
  picture_url text,
  locale text,
  scopes text,
  access_token_enc text,          -- AES-256-GCM, never sent to the browser
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('resume','linkedin_pdf','poster','portfolio','publication','other')),
  filename text not null check (length(filename) between 1 and 255),
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null,
  content bytea not null,
  extracted_text text,
  analysis jsonb,
  review_status text not null default 'pending' check (review_status in ('pending','applied','dismissed')),
  created_at timestamptz not null default now(),
  unique (user_id, sha256)
);

-- ---------------------------------------------------------------------------
-- Research / evidence sources. Every factual company, recruiter and job record
-- points back to at least one of these.
-- ---------------------------------------------------------------------------
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text not null,
  publisher text,
  source_type text not null check (source_type in
    ('official_shpe','company_official','news','university','third_party','user_provided')),
  accessed_at date not null,
  access_note text
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  industry text not null,
  industries text[] not null default '{}',
  headquarters text,
  website text,
  domain text,
  careers_url text,
  linkedin_url text,
  description text,
  size text,
  presence text,
  products text[] not null default '{}',
  tech_tags jsonb not null default '{}'::jsonb,       -- {taxonomyKey: {weight, context}}
  engineering_areas text[] not null default '{}',
  recent_developments jsonb not null default '[]'::jsonb,
  technical_challenges text[] not null default '{}',
  eligibility_notes text,
  profile_verification text not null default 'unverified'
    check (profile_verification in ('verified','partially_verified','unverified','ai_analysis')),
  profile_source_id uuid references sources(id) on delete set null,
  created_by text not null default 'seed' check (created_by in ('seed','import','user')),
  last_verified_at date,
  updated_at timestamptz not null default now()
);

create table if not exists convention_participation (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  event_year integer not null check (event_year between 2020 and 2100),
  role text not null check (role in ('sponsor','exhibitor','ipc_partner','event_partner','academic_partner','historical')),
  tier text,
  booth_number text,
  booth_location text,
  activities text[] not null default '{}',
  verification text not null check (verification in ('verified','partially_verified','unverified')),
  evidence text not null,
  source_id uuid references sources(id) on delete set null,
  verified_at date not null,
  unique (company_id, event_year, role)
);

create table if not exists recruiters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  full_name text not null check (length(full_name) between 2 and 120),
  title text,
  linkedin_url text check (linkedin_url is null or linkedin_url ~ '^https://([a-z]+\.)?linkedin\.com/'),
  specialization text,
  engineering_focus text,
  background text,
  attendance_status text not null default 'unverified'
    check (attendance_status in ('confirmed','potential','unverified')),
  created_by text not null default 'user' check (created_by in ('import','user')),
  created_at timestamptz not null default now(),
  unique (company_id, full_name)
);

create table if not exists recruiter_evidence (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  kind text not null check (kind in ('attendance','role','other')),
  evidence text not null,
  source_id uuid references sources(id) on delete set null,
  verified_at date not null default current_date
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  requisition_id text,
  location text,
  employment_type text not null check (employment_type in ('internship','co_op','full_time','part_time','research','development_program','other')),
  description text,
  qualifications text[] not null default '{}',
  skills text[] not null default '{}',
  salary text,
  deadline date,
  posted_at date,
  apply_url text,
  listing_status text not null default 'unknown' check (listing_status in ('open','closed','unknown')),
  verification text not null check (verification in ('verified','partially_verified','unverified')),
  source_id uuid references sources(id) on delete set null,
  last_checked_at date,
  created_by text not null default 'seed' check (created_by in ('seed','import','user')),
  created_at timestamptz not null default now(),
  unique (company_id, title, requisition_id)
);

create table if not exists job_eligibility (
  job_id uuid primary key references jobs(id) on delete cascade,
  citizenship_required boolean,
  us_person_required boolean,
  clearance_required boolean,
  sponsorship text not null default 'unknown' check (sponsorship in ('offered','not_offered','unknown')),
  note text,
  evidence text,
  source_id uuid references sources(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- User-owned records
-- ---------------------------------------------------------------------------
create table if not exists compatibility_assessments (
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  confidence text not null check (confidence in ('high','medium','low')),
  breakdown jsonb not null,
  eligibility jsonb not null,
  profile_version integer not null,
  computed_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table if not exists company_tracking (
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  saved boolean not null default false,
  status text not null default 'none' check (status in
    ('none','want_to_meet','high_priority','visited_booth','met_recruiter','connected_linkedin','applied','follow_up_needed','interview_scheduled','offer_received')),
  visit_order integer,
  visited_at timestamptz,
  mutual_connections text,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table if not exists recruiter_contacts (
  user_id uuid not null references users(id) on delete cascade,
  recruiter_id uuid not null references recruiters(id) on delete cascade,
  saved boolean not null default false,
  status text not null default 'none' check (status in
    ('none','want_to_meet','high_priority','visited_booth','met_recruiter','connected_linkedin','applied','follow_up_needed','interview_scheduled','offer_received')),
  contact_email text,
  contact_phone text,
  mutual_connections text,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, recruiter_id)
);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  recruiter_id uuid references recruiters(id) on delete set null,
  kind text not null check (kind in ('booth_visit','conversation','linkedin','email','interview','info_session','other')),
  occurred_at timestamptz not null default now(),
  summary text not null check (length(summary) between 1 and 5000),
  opportunities_discussed text,
  impressions text,
  created_at timestamptz not null default now()
);

create table if not exists outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  recruiter_id uuid references recruiters(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  kind text not null,
  body text not null,
  generated_by text not null check (generated_by in ('template','ai','user')),
  created_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  company_id uuid not null references companies(id) on delete cascade,
  recruiter_id uuid references recruiters(id) on delete set null,
  title text not null,
  url text,
  status text not null default 'saved' check (status in ('saved','preparing','applied','interviewing','offer','rejected','withdrawn')),
  applied_at date,
  notes text,
  updated_at timestamptz not null default now()
);
create unique index if not exists applications_user_job on applications(user_id, job_id) where job_id is not null;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  recruiter_id uuid references recruiters(id) on delete set null,
  application_id uuid references applications(id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  due_at date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  entity_type text not null check (entity_type in ('company','recruiter','job','general')),
  entity_id uuid,
  body text not null check (length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('assistant','mock_interview')),
  company_id uuid references companies(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists data_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  kind text not null,
  filename text,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_participation_company on convention_participation(company_id);
create index if not exists idx_recruiters_company on recruiters(company_id);
create index if not exists idx_jobs_company on jobs(company_id);
create index if not exists idx_interactions_user on interactions(user_id, occurred_at desc);
create index if not exists idx_tasks_user on tasks(user_id, done, due_at);
create index if not exists idx_documents_user on documents(user_id, created_at desc);
