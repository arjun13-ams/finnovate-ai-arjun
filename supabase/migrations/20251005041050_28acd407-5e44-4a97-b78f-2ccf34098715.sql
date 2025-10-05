create policy "No public access to kv_cache"
  on public.kv_cache
  for select
  using (false);