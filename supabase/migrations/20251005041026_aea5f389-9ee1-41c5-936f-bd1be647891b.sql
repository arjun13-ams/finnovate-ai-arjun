-- Create KV cache table for function-level caching
create table if not exists public.kv_cache (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Enable RLS (service role in functions bypasses RLS)
alter table public.kv_cache enable row level security;

-- Use existing timestamp update function for updated_at
create trigger update_kv_cache_updated_at
before update on public.kv_cache
for each row execute function public.update_updated_at_column();

-- Create LLM usage logging table
create table if not exists public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_query text not null,
  parsed_query jsonb,
  model_used text,
  confidence text,
  parser_type text,
  success boolean default false,
  attempt_count int default 0,
  created_at timestamptz not null default now()
);

-- Enable RLS and add policies so users may read their own logs
alter table public.llm_usage enable row level security;

create policy "Users can view their own llm usage"
  on public.llm_usage
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own llm usage"
  on public.llm_usage
  for insert
  with check (auth.uid() = user_id);

-- Helpful indexes
create index if not exists idx_llm_usage_user_id on public.llm_usage(user_id);
create index if not exists idx_llm_usage_created_at on public.llm_usage(created_at);