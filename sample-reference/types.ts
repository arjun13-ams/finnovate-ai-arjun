export interface StockData {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ParsedCondition {
  category: number;
  indicator?: string;
  window?: number;
  op?: string;
  value?: number | [number, number];
  ma_type?: string;
  benchmark?: string;
  reference?: string;
  pattern_type?: string;
  direction?: string;
  screener?: string;
  timeframe?: string;
  operator?: 'and' | 'or';
  subConditions?: ParsedCondition[];
}

export interface ParsedFilter {
  category: number;
  conditions: ParsedCondition[];
  confidence: 'high' | 'medium' | 'low';
  parser: 'regex' | 'llm';
  llmFallback?: string;
  modelUsed?: string | null;
  modelsAttempted?: string[];
}

export interface FilteredStock extends StockData {
  indicator_value: number;
  indicator_name: string;
  window?: number;
}

export interface ScreenerResult {
  success: boolean;
  stocks: FilteredStock[];
  totalMatched: number;
  parsedQuery: ParsedFilter;
  error?: string;
}

export type OperatorType = '>' | '>=' | '<' | '<=' | '==' | 'between' | 'crossed_above' | 'crossed_below' | 'proximity_within';

export type MAType = 'sma' | 'ema' | 'wma' | 'hma' | 'rma' | 'dema' | 'tema' | 'kama' | 'zlma' | 'fwma' | 'hilo';

export type PatternType =
  | 'bullish_engulfing'
  | 'bearish_engulfing'
  | 'doji'
  | 'hammer'
  | 'nr7'
  | 'inside_bar'
  | 'outside_bar';

export type TimeframeType = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'ytd';
