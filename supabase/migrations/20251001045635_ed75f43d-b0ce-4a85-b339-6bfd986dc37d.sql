-- Create ohlcv_last_6_months table for stock data
CREATE TABLE IF NOT EXISTS public.ohlcv_last_6_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  open DECIMAL(20, 6) NOT NULL,
  high DECIMAL(20, 6) NOT NULL,
  low DECIMAL(20, 6) NOT NULL,
  close DECIMAL(20, 6) NOT NULL,
  volume BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(symbol, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol ON public.ohlcv_last_6_months(symbol);
CREATE INDEX IF NOT EXISTS idx_ohlcv_date ON public.ohlcv_last_6_months(date);
CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_date ON public.ohlcv_last_6_months(symbol, date);

-- Enable RLS
ALTER TABLE public.ohlcv_last_6_months ENABLE ROW LEVEL SECURITY;

-- Create policies - allow authenticated users to read stock data
CREATE POLICY "Authenticated users can read stock data"
  ON public.ohlcv_last_6_months
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert/update data (for data import)
CREATE POLICY "Service role can manage stock data"
  ON public.ohlcv_last_6_months
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);