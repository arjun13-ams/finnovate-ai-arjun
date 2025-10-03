import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_SHEETS_ID = '1Abo2NBSA5WavSfQSSo4LTBb9IwcNmGAXgqt42wpJGXo';
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// ============ FREE MODELS FOR OPENROUTER ============
const FREE_MODELS = [
  'x-ai/grok-4-fast:free',
  'z-ai/glm-4.5-air:free',
  'deepseek/deepseek-chat-v3.1:free',
  'meta-llama/llama-4-maverick:free',
  'google/gemini-2.0-flash-exp:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
  'qwen/qwen3-coder:free',
  'moonshotai/kimi-k2:free'
];

// ============ COMPREHENSIVE SYSTEM PROMPT ============
const SYSTEM_PROMPT = `You are a financial-screening compiler.
Your ONLY task is to convert the user's natural-language query into a **strict JSON** that exactly matches the schema below.
The schema is organised into the 11 logical categories (1-11) requested by the product team.

──────────────────────────────────
GLOBAL RULES
──────────────────────────────────
- Output **ONLY** valid JSON.
- All numeric literals must be numbers, not strings.
- Time windows: use integer days, e.g. 14, 21, 50.
- Percentages are decimals: 5 → 0.05.
- All prices assumed to be in the quote currency of the market.
- If an indicator is not explicitly mentioned, omit it.
- If the query is ambiguous, map to the **lowest-numbered** matching category and return "confidence": "low".
- If no category fits, return category "11" and a free-form string under "llmFallback".

──────────────────────────────────
ALLOWED ENUM VALUES
──────────────────────────────────
op: ">", ">=", "<", "<=", "==", "between", "crossed_above", "crossed_below", "proximity_within"
window: 5, 10, 14, 20, 21, 50, 100, 200
ma_type: "sma", "ema", "wma", "hma", "rma", "dema", "tema"
pattern_type: "bullish_engulfing", "bearish_engulfing", "doji", "hammer", "nr7", "inside_bar", "outside_bar"
timeframe: "1d", "1w", "1m", "3m", "6m", "1y", "ytd"
category: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11

──────────────────────────────────
JSON SCHEMA
──────────────────────────────────
{
  "category": 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11,
  "conditions": [ ... ],
  "confidence": "high" | "medium" | "low",
  "llmFallback": string | null
}

──────────────────────────────────
CATEGORY DEFINITIONS
──────────────────────────────────

[1] Indicator Threshold
   conditions: [{ "category": 1, "indicator": <str>, "window": <int>, "op": <op>, "value": <number|[low,high]> }]
   Indicators: rsi, stoch, stochrsi, cci, williams_r, awesome_osc, kdj, ultimate_osc, chande_momentum, roc, money_flow_idx, percentage_price_osc, fisher_transform, tsi, schaff_trend_cycle

[2] Price vs Moving Averages
   conditions: [{ "category": 2, "ma_type": <ma_type>, "window": <int>, "op": "crossed_above"|"crossed_below"|"proximity_within", "value": <number> }]
   MA Types: sma, ema, wma, hma, rma, tema, dema, kama, zlma

[3] Relative Strength vs Index
   conditions: [{ "category": 3, "benchmark": <str>, "window": <int>, "op": <op>, "value": <number> }]

[4] Percent Change from Reference
   conditions: [{ "category": 4, "reference": "1d_low"|"1w_low"|"1m_low"|"52w_low"|"52w_high", "op": <op>, "value": <number> }]

[5] Volume / Volatility
   conditions: [{ "category": 5, "indicator": "volume"|"volume_sma"|"atr"|"bb_width"|"kc_width"|"ui", "window": <int>, "op": <op>, "value": <number> }]

[6] Chart Patterns & Candles
   conditions: [{ "category": 6, "pattern_type": <pattern_type>, "direction": "bullish"|"bearish", "window": <int> }]

[7] Breakouts / Swing Conditions
   conditions: [{ "category": 7, "indicator": "bb_breakout"|"kc_breakout"|"donchian_breakout"|"pivot_break", "direction": "up"|"down", "window": <int> }]

[8] Composite Conditions (AND/OR)
   conditions: [{ "category": 8, "operator": "and"|"or", "subConditions": [ ... ] }]

[9] Special Screeners
   conditions: [{ "category": 9, "screener": "base_breakout"|"squeeze_pro"|"turtle_signal"|"adx_trend", "direction": "long"|"short", "window": <int> }]

[10] Time-Based Filters
   conditions: [{ "category": 10, "timeframe": <timeframe>, "op": <op>, "value": <number> }]

[11] Fallback
   conditions: [ ]
   llmFallback: "free-form explanation"

──────────────────────────────────
EXAMPLES
──────────────────────────────────
User: "RSI above 70"
→ { "category": 1, "conditions": [{"category": 1, "indicator": "rsi", "window": 14, "op": ">", "value": 70 }], "confidence": "high" }

User: "EMA 20 crossed above SMA 50"
→ { "category": 2, "conditions": [{"category": 2, "ma_type": "ema", "window": 20, "op": "crossed_above", "value": 50 }], "confidence": "high" }

User: "Stocks up 15% from 52-week low"
→ { "category": 4, "conditions": [{"category": 4, "reference": "52w_low", "op": ">", "value": 0.15 }], "confidence": "high" }
`;

interface ScreenerCondition {
  category: number;
  indicator?: string;
  window?: number;
  op: string;
  value?: number;
  ma_type?: string;
}

interface ParsedQuery {
  category: number;
  conditions: ScreenerCondition[];
  confidence: string;
  parser: string;
  modelUsed?: string | null;
  llmFallback?: string;
  modelsAttempted?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    const authHeader = req.headers.get('Authorization');
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing screener query:', query);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );

    // Get user ID
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Step 1: Parse query (regex first, then LLM fallback)
    const parsedFilter = await parseQuery(query, userId, supabase);
    console.log('Parsed query:', JSON.stringify(parsedFilter));

    // Step 2: Fetch stock data from Google Sheets (with caching)
    const stockData = await fetchGoogleSheetsDataWithCache();
    console.log(`📊 Loaded ${stockData.length} stock records`);

    // Step 3: Screen stocks based on parsed filter
    const results = await screenStocks(stockData, parsedFilter);
    console.log('Found results:', results.length);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        parsedQuery: parsedFilter,
        totalMatched: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Stock screener error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============ PARSING FUNCTIONS ============

function normalizeOperator(op: string): string {
  const opMap: Record<string, string> = {
    'greater than': '>',
    'more than': '>',
    'above': '>',
    'less than': '<',
    'below': '<',
    'greater than or equal to': '>=',
    'at least': '>=',
    'less than or equal to': '<=',
    'at most': '<=',
    'equal to': '==',
    'equals': '==',
  };
  return opMap[op.toLowerCase().trim()] || op;
}

function parseQueryRegex(text: string): { success: boolean; filter?: ParsedQuery } {
  const lowerText = text.toLowerCase();

  // RSI pattern
  const rsiMatch = /\brsi\s*(?:(\d+))?\s*(>|>=|<|<=|above|below|greater than|less than)\s*(\d+(?:\.\d+)?)/i.exec(lowerText);
  if (rsiMatch) {
    const window = rsiMatch[1] ? parseInt(rsiMatch[1]) : 14;
    const op = normalizeOperator(rsiMatch[2]);
    const value = parseFloat(rsiMatch[3]);
    
    return {
      success: true,
      filter: {
        category: 1,
        conditions: [{ category: 1, indicator: 'rsi', window, op, value }],
        confidence: 'high',
        parser: 'regex',
      },
    };
  }

  // Volume spike pattern
  const volumeMatch = /\bvolume\s+spike\s+(\d+(?:\.\d+)?)\s*[x×]?\s*sma\s+(\d+)/i.exec(lowerText);
  if (volumeMatch) {
    const value = parseFloat(volumeMatch[1]);
    const window = parseInt(volumeMatch[2]);
    
    return {
      success: true,
      filter: {
        category: 5,
        conditions: [{ category: 5, indicator: 'volume_sma', window, op: '>', value }],
        confidence: 'high',
        parser: 'regex',
      },
    };
  }

  // Price vs MA pattern
  const priceMAMatch = /\b(?:price|close)?\s*(crossed\s+above|crossed\s+below|above|below)\s+(sma|ema)\s+(\d+)/i.exec(lowerText);
  if (priceMAMatch) {
    const op = priceMAMatch[1].includes('crossed') 
      ? (priceMAMatch[1].includes('above') ? 'crossed_above' : 'crossed_below')
      : (priceMAMatch[1].includes('above') ? '>' : '<');
    const maType = priceMAMatch[2];
    const window = parseInt(priceMAMatch[3]);
    
    return {
      success: true,
      filter: {
        category: 2,
        conditions: [{ category: 2, ma_type: maType, window, op }],
        confidence: 'high',
        parser: 'regex',
      },
    };
  }

  // CCI pattern
  const cciMatch = /\bcci\s*(?:(\d+))?\s*(>|>=|<|<=|above|below)\s*(-?\d+(?:\.\d+)?)/i.exec(lowerText);
  if (cciMatch) {
    const window = cciMatch[1] ? parseInt(cciMatch[1]) : 20;
    const op = normalizeOperator(cciMatch[2]);
    const value = parseFloat(cciMatch[3]);
    
    return {
      success: true,
      filter: {
        category: 1,
        conditions: [{ category: 1, indicator: 'cci', window, op, value }],
        confidence: 'high',
        parser: 'regex',
      },
    };
  }

  return { success: false };
}

// ============ GOOGLE SHEETS CACHING WITH DENO KV ============

/**
 * Get cached Google Sheets data from Deno KV
 * Returns cached data if it exists and is less than 2 hours old
 */
async function getCachedData(): Promise<string | null> {
  try {
    const kv = await Deno.openKv();
    
    // Get both the CSV data and timestamp
    const [dataEntry, timestampEntry] = await Promise.all([
      kv.get<string>(['stocks_data_csv']),
      kv.get<number>(['stocks_data_csv_timestamp'])
    ]);
    
    if (!dataEntry.value || !timestampEntry.value) {
      console.log('📦 Cache miss: No data found in KV');
      return null;
    }
    
    const cacheAge = Date.now() - timestampEntry.value;
    
    if (cacheAge > CACHE_DURATION) {
      console.log(`📦 Cache expired: Age ${Math.round(cacheAge / 1000 / 60)} minutes`);
      return null;
    }
    
    console.log(`📦 Cache hit: Age ${Math.round(cacheAge / 1000 / 60)} minutes`);
    return dataEntry.value;
  } catch (error) {
    console.error('❌ Cache read error:', error);
    return null;
  }
}

/**
 * Store Google Sheets data in Deno KV cache
 */
async function setCachedData(csvData: string): Promise<void> {
  try {
    const kv = await Deno.openKv();
    const timestamp = Date.now();
    
    // Store both CSV data and timestamp atomically
    await Promise.all([
      kv.set(['stocks_data_csv'], csvData),
      kv.set(['stocks_data_csv_timestamp'], timestamp)
    ]);
    
    console.log('✅ Cache updated successfully');
  } catch (error) {
    console.error('❌ Cache write error:', error);
  }
}

/**
 * Fetch Google Sheets data with caching
 * Checks cache first, fetches from Google Sheets if cache is stale/missing
 */
async function fetchGoogleSheetsDataWithCache(): Promise<any[]> {
  // Try cache first
  const cachedCsv = await getCachedData();
  
  if (cachedCsv) {
    console.log('📊 Using cached Google Sheets data');
    return parseCSV(cachedCsv);
  }
  
  // Cache miss - fetch from Google Sheets
  console.log('📡 Fetching fresh data from Google Sheets...');
  const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_ID}/export?format=csv`;
  const response = await fetch(csvUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheets: ${response.statusText}`);
  }
  
  const csvText = await response.text();
  
  // Update cache asynchronously (don't wait)
  setCachedData(csvText).catch(err => console.error('Cache update failed:', err));
  
  return parseCSV(csvText);
}

// ============ OPENROUTER MULTI-MODEL LLM PARSING ============

/**
 * Try parsing with a single OpenRouter model
 * Returns parsed result or null if parsing failed
 */
async function tryModelWithConfidence(
  apiKey: string,
  query: string,
  model: string
): Promise<ParsedQuery | null> {
  try {
    console.log(`🤖 Trying model: ${model}`);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockscreener.ai',
        'X-Title': 'Stock Screener AI'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query }
        ],
        temperature: 0.0,
        max_tokens: 1000
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Model ${model} failed: ${response.status} - ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error(`❌ Model ${model} returned empty content`);
      return null;
    }
    
    // Try to parse JSON from content
    let parsed: any;
    try {
      // Extract JSON if wrapped in markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error(`❌ Model ${model} returned invalid JSON:`, content);
      return null;
    }
    
    // Validate required fields
    if (!parsed.category || !parsed.conditions || !parsed.confidence) {
      console.error(`❌ Model ${model} returned incomplete schema`);
      return null;
    }
    
    console.log(`✅ Model ${model} parsed successfully with confidence: ${parsed.confidence}`);
    
    return {
      category: parsed.category,
      conditions: parsed.conditions,
      confidence: parsed.confidence,
      llmFallback: parsed.llmFallback || null,
      parser: 'llm',
      modelUsed: model
    };
    
  } catch (error) {
    console.error(`❌ Model ${model} error:`, error);
    return null;
  }
}

/**
 * Parse query using OpenRouter with multi-model fallback
 * Tries each free model until one returns high confidence
 */
async function parseWithLLMs(query: string): Promise<ParsedQuery> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  
  if (!OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not configured');
    return {
      category: 11,
      conditions: [],
      confidence: 'low',
      parser: 'llm',
      llmFallback: 'OPENROUTER_API_KEY not configured',
      modelUsed: null,
      modelsAttempted: []
    };
  }
  
  const modelsAttempted: string[] = [];
  
  // Try each model in sequence
  for (const model of FREE_MODELS) {
    modelsAttempted.push(model);
    
    const result = await tryModelWithConfidence(OPENROUTER_API_KEY, query, model);
    
    if (result && result.confidence === 'high') {
      console.log(`🎯 High confidence achieved with ${model}`);
      return {
        ...result,
        modelsAttempted
      };
    }
  }
  
  // All models failed or returned low/medium confidence
  console.log('⚠️ No model achieved high confidence');
  return {
    category: 11,
    conditions: [],
    confidence: 'low',
    parser: 'llm',
    llmFallback: 'Could not parse query with high confidence after trying all available models',
    modelUsed: null,
    modelsAttempted
  };
}

async function parseQuery(text: string, userId: string | undefined, supabase: any): Promise<ParsedQuery> {
  console.log(`🔍 Parsing query: "${text}"`);
  
  // Try regex first (fast, free, covers ~70% of queries)
  const regexResult = parseQueryRegex(text);
  
  let parsedFilter: ParsedQuery;
  
  if (regexResult.success && regexResult.filter) {
    console.log('✅ Regex parser succeeded');
    parsedFilter = regexResult.filter;
  } else {
    // Fallback to OpenRouter multi-model LLM
    console.log('⚡ Regex failed, trying OpenRouter LLMs...');
    parsedFilter = await parseWithLLMs(text);
  }

  // Track LLM usage if user is authenticated and LLM was used
  if (userId && parsedFilter.parser === 'llm') {
    try {
      const attemptCount = parsedFilter.modelsAttempted?.length || 0;
      
      await supabase.from('llm_usage').insert({
        user_id: userId,
        user_query: text,
        parsed_query: parsedFilter,
        model_used: parsedFilter.modelUsed,
        confidence: parsedFilter.confidence,
        parser_type: parsedFilter.parser,
        success: parsedFilter.category !== 11,
        attempt_count: attemptCount
      });
      
      console.log(`📊 LLM usage tracked: ${attemptCount} models attempted`);
    } catch (error) {
      console.error('❌ Failed to track LLM usage:', error);
    }
  }

  return parsedFilter;
}

// ============ CSV PARSING ============

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const symbolIdx = headers.indexOf('symbol');
  const dateIdx = headers.indexOf('date');
  const openIdx = headers.indexOf('open');
  const highIdx = headers.indexOf('high');
  const lowIdx = headers.indexOf('low');
  const closeIdx = headers.indexOf('close');
  const volumeIdx = headers.indexOf('volume');

  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());

    try {
      const record = {
        symbol: values[symbolIdx] || '',
        date: values[dateIdx] || '',
        open: parseFloat(values[openIdx]) || 0,
        high: parseFloat(values[highIdx]) || 0,
        low: parseFloat(values[lowIdx]) || 0,
        close: parseFloat(values[closeIdx]) || 0,
        volume: parseFloat(values[volumeIdx]) || 0,
      };

      if (record.symbol && record.date) {
        data.push(record);
      }
    } catch (error) {
      console.warn(`Skipping invalid row ${i}`);
    }
  }

  return data;
}

// ============ SCREENING LOGIC ============

async function screenStocks(data: any[], filter: ParsedQuery): Promise<any[]> {
  const grouped = groupBySymbol(data);
  const results: any[] = [];

  for (const [symbol, symbolData] of grouped.entries()) {
    if (symbolData.length < 50) continue;

    const condition = filter.conditions[0];
    if (!condition) continue;

    const result = await applyCondition(symbolData, condition);

    if (result.pass) {
      const lastRow = symbolData[symbolData.length - 1];
      const prevRow = symbolData[symbolData.length - 2];
      const change = prevRow ? ((lastRow.close - prevRow.close) / prevRow.close) * 100 : 0;
      
      results.push({
        symbol: lastRow.symbol,
        close: lastRow.close,
        volume: lastRow.volume,
        change,
        indicator_value: result.value,
        indicator_name: result.indicator,
      });
    }
  }

  return results;
}

function groupBySymbol(data: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();

  for (const row of data) {
    if (!grouped.has(row.symbol)) {
      grouped.set(row.symbol, []);
    }
    grouped.get(row.symbol)!.push(row);
  }

  for (const [, rows] of grouped) {
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return grouped;
}

async function applyCondition(data: any[], cond: ScreenerCondition): Promise<{ pass: boolean; value: number; indicator: string }> {
  if (cond.category === 1) {
    return handleIndicatorThreshold(data, cond);
  } else if (cond.category === 2) {
    return handlePriceVsMA(data, cond);
  } else if (cond.category === 5) {
    return handleVolumeVolatility(data, cond);
  }

  return { pass: false, value: 0, indicator: 'unknown' };
}

function handleIndicatorThreshold(data: any[], cond: ScreenerCondition): { pass: boolean; value: number; indicator: string } {
  const ind = cond.indicator!;
  const win = cond.window || 14;
  const op = cond.op!;
  const targetVal = cond.value || 0;

  try {
    let latest: number;

    if (ind === 'rsi') {
      latest = calculateRSI(data, win);
    } else if (ind === 'cci') {
      latest = calculateCCI(data, win);
    } else {
      return { pass: false, value: 0, indicator: ind };
    }

    const pass = compareValues(latest, op, targetVal);
    return { pass, value: latest, indicator: ind };
  } catch (error) {
    return { pass: false, value: 0, indicator: ind };
  }
}

function handlePriceVsMA(data: any[], cond: ScreenerCondition): { pass: boolean; value: number; indicator: string } {
  const maType = cond.ma_type!;
  const win = cond.window!;
  const op = cond.op!;

  try {
    const closes = data.map(d => d.close);
    const ma = calculateSMAFromValues(closes.slice(-win));
    const price = data[data.length - 1].close;
    const prevPrice = data[data.length - 2]?.close;
    const prevMA = calculateSMAFromValues(closes.slice(-win - 1, -1));

    if (op === 'crossed_above') {
      const pass = prevPrice <= prevMA && price > ma;
      return { pass, value: price, indicator: `${maType}_${win}` };
    } else if (op === 'crossed_below') {
      const pass = prevPrice >= prevMA && price < ma;
      return { pass, value: price, indicator: `${maType}_${win}` };
    } else {
      const pass = op === '>' ? price > ma : price < ma;
      return { pass, value: price, indicator: `${maType}_${win}` };
    }
  } catch (error) {
    return { pass: false, value: 0, indicator: `${maType}_${win}` };
  }
}

function handleVolumeVolatility(data: any[], cond: ScreenerCondition): { pass: boolean; value: number; indicator: string } {
  const ind = cond.indicator!;
  const win = cond.window || 20;
  const targetVal = cond.value || 0;

  try {
    if (ind === 'volume_sma') {
      const volumes = data.slice(-win).map(d => d.volume);
      const volumeSMA = calculateSMAFromValues(volumes);
      const currentVolume = data[data.length - 1].volume;
      const ratio = currentVolume / volumeSMA;
      const pass = ratio >= targetVal;
      return { pass, value: ratio, indicator: 'volume_spike' };
    }

    return { pass: false, value: 0, indicator: ind };
  } catch (error) {
    return { pass: false, value: 0, indicator: ind };
  }
}

// ============ TECHNICAL INDICATORS ============

function calculateRSI(data: any[], period: number = 14): number {
  if (data.length < period + 1) throw new Error('Insufficient data for RSI');

  const closes = data.map(d => d.close);
  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateCCI(data: any[], period: number = 20): number {
  if (data.length < period) throw new Error('Insufficient data for CCI');

  const recentData = data.slice(-period);
  const typicalPrices = recentData.map(d => (d.high + d.low + d.close) / 3);
  const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
  const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

  const latestTP = typicalPrices[typicalPrices.length - 1];
  return (latestTP - sma) / (0.015 * meanDeviation);
}

function calculateSMAFromValues(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + Number(val), 0) / values.length;
}

function compareValues(actual: number, op: string, target: number): boolean {
  switch (op) {
    case '>': return actual > target;
    case '>=': return actual >= target;
    case '<': return actual < target;
    case '<=': return actual <= target;
    case '==': return Math.abs(actual - target) < 0.0001;
    default: return false;
  }
}