-- Create llm_usage table for analytics
CREATE TABLE IF NOT EXISTS public.llm_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_query TEXT NOT NULL,
  parsed_query JSONB,
  model_used TEXT,
  attempt_count INTEGER DEFAULT 0,
  confidence TEXT,
  parser_type TEXT,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own llm usage"
ON public.llm_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can insert own llm usage"
ON public.llm_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON public.llm_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON public.llm_usage(created_at DESC);