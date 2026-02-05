-- OpenClaw Cloud SQL Schema (Draft v0.1)

create table if not exists orgs (
  id uuid primary key,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists users (
  id uuid primary key,
  org_id uuid references orgs(id),
  email text unique,
  created_at timestamptz default now()
);

create table if not exists agents (
  id uuid primary key,
  org_id uuid references orgs(id),
  agent_key text not null, -- e.g., "main"
  config jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key,
  org_id uuid references orgs(id),
  session_key text not null,
  agent_key text not null,
  provider text,
  model text,
  state jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists session_events (
  id bigserial primary key,
  session_id uuid references sessions(id),
  event jsonb not null,
  created_at timestamptz default now()
);

create table if not exists memory_items (
  id uuid primary key,
  org_id uuid references orgs(id),
  agent_key text not null,
  content jsonb not null,
  tags text[] default array[]::text[],
  created_at timestamptz default now()
);

create table if not exists cron_jobs (
  id uuid primary key,
  org_id uuid references orgs(id),
  agent_key text not null,
  schedule text not null,
  payload jsonb not null,
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists auth_profiles (
  id uuid primary key,
  org_id uuid references orgs(id),
  provider text not null,
  profile_id text not null,
  credential jsonb not null, -- encrypted
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider, profile_id)
);

create table if not exists audit_logs (
  id bigserial primary key,
  org_id uuid references orgs(id),
  actor text not null,
  action text not null,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_sessions_session_key on sessions(session_key);
create index if not exists idx_session_events_session_id on session_events(session_id);
create index if not exists idx_memory_items_agent_key on memory_items(agent_key);
create index if not exists idx_cron_jobs_agent_key on cron_jobs(agent_key);
