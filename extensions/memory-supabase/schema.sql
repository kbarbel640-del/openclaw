-- OpenClaw Memory (Supabase) schema
-- Default embedding dimension below is 1536 (text-embedding-3-small).
-- If you use text-embedding-3-large, change vector(1536) -> vector(3072).

create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.openclaw_memories (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  text text not null,
  category text not null default 'other',
  importance double precision not null default 0.7,
  embedding vector(1536) not null,
  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (importance >= 0 and importance <= 1),
  check (category in ('preference', 'fact', 'decision', 'entity', 'other'))
);

create index if not exists idx_openclaw_memories_agent_created
  on public.openclaw_memories (agent_id, created_at desc);

create index if not exists idx_openclaw_memories_embedding
  on public.openclaw_memories
  using hnsw (embedding vector_cosine_ops);

create or replace function public.openclaw_store_memory(
  match_agent_id text,
  memory_text text,
  memory_category text,
  memory_importance double precision,
  memory_embedding text,
  memory_source_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.openclaw_memories (
    agent_id,
    text,
    category,
    importance,
    embedding,
    source_path
  )
  values (
    match_agent_id,
    memory_text,
    coalesce(nullif(memory_category, ''), 'other'),
    coalesce(memory_importance, 0.7),
    memory_embedding::vector,
    nullif(memory_source_path, '')
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.openclaw_match_memories(
  query_embedding text,
  match_agent_id text,
  match_count integer default 5,
  min_similarity double precision default 0.3
)
returns table (
  id uuid,
  text text,
  category text,
  importance double precision,
  created_at timestamptz,
  similarity double precision,
  path text,
  start_line integer,
  end_line integer,
  snippet text
)
language sql
security definer
set search_path = public
as $$
  select
    m.id,
    m.text,
    m.category,
    m.importance,
    m.created_at,
    (1 - (m.embedding <=> query_embedding::vector)) as similarity,
    coalesce(m.source_path, 'supabase/' || m.id::text || '.md') as path,
    1 as start_line,
    1 as end_line,
    m.text as snippet
  from public.openclaw_memories m
  where m.agent_id = match_agent_id
    and (1 - (m.embedding <=> query_embedding::vector)) >= min_similarity
  order by m.embedding <=> query_embedding::vector
  limit greatest(1, least(match_count, 20));
$$;

create or replace function public.openclaw_get_memory(
  match_agent_id text,
  memory_id uuid
)
returns table (
  id uuid,
  text text,
  category text,
  importance double precision,
  created_at timestamptz,
  path text,
  start_line integer,
  end_line integer
)
language sql
security definer
set search_path = public
as $$
  select
    m.id,
    m.text,
    m.category,
    m.importance,
    m.created_at,
    coalesce(m.source_path, 'supabase/' || m.id::text || '.md') as path,
    1 as start_line,
    1 as end_line
  from public.openclaw_memories m
  where m.agent_id = match_agent_id
    and m.id = memory_id
  limit 1;
$$;

create or replace function public.openclaw_forget_memory(
  match_agent_id text,
  memory_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  delete from public.openclaw_memories
  where agent_id = match_agent_id
    and id = memory_id;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

create or replace function public.openclaw_memory_count(
  match_agent_id text
)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.openclaw_memories
  where agent_id = match_agent_id;
$$;

grant execute on function public.openclaw_store_memory(text, text, text, double precision, text, text) to service_role;
grant execute on function public.openclaw_match_memories(text, text, integer, double precision) to service_role;
grant execute on function public.openclaw_get_memory(text, uuid) to service_role;
grant execute on function public.openclaw_forget_memory(text, uuid) to service_role;
grant execute on function public.openclaw_memory_count(text) to service_role;

