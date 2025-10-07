-- Ensure unique key for kv_cache upserts and keep updated_at fresh
DO $$ BEGIN
  -- Add unique constraint on key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'kv_cache_key_unique'
  ) THEN
    ALTER TABLE public.kv_cache
    ADD CONSTRAINT kv_cache_key_unique UNIQUE (key);
  END IF;
END $$;

-- Create/update trigger to maintain updated_at on updates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kv_cache_updated_at'
  ) THEN
    CREATE TRIGGER trg_kv_cache_updated_at
    BEFORE UPDATE ON public.kv_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;