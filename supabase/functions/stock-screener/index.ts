import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_SHEETS_ID = '1Abo2NBSA5WavSfQSSo4LTBb9IwcNmGAXgqt42wpJGXo';

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

    // Step 2: Fetch stock data from Google Sheets
    const stockData = await fetchGoogleSheetsData();
    console.log(`Loaded ${stockData.length} stock records`);

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

async function parseWithAI(text: string): Promise<ParsedQuery> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    return {
      category: 11,
      conditions: [],
      confidence: 'low',
      parser: 'llm',
      llmFallback: 'LOVABLE_API_KEY not configured',
      modelUsed: null,
    };
  }

  const systemPrompt = `You are a financial screening query parser. Convert natural language to JSON.

CATEGORIES:
1. Indicator Threshold (RSI, CCI, Stochastic, etc.)
2. Price vs Moving Averages (EMA, SMA crossovers)
5. Volume/Volatility (ATR, volume spike)
11. Parse Failure

OUTPUT ONLY valid JSON:
{
  "category": <number>,
  "conditions": [{
    "category": <number>,
    "indicator": "<indicator_name>",
    "window": <number>,
    "op": "<operator>",
    "value": <number>
  }],
  "confidence": "high|medium|low"
}

RULES:
- Percentages as decimals: 5% → 0.05
- Default windows: RSI=14, CCI=20, SMA=20
- Operators: >, >=, <, <=, ==, crossed_above, crossed_below
- If unclear → category 11, confidence "low"`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.0,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty LLM response');
    }

    const parsed = JSON.parse(content);
    return {
      ...parsed,
      parser: 'llm',
      modelUsed: 'google/gemini-2.5-flash-lite',
    };
  } catch (error) {
    console.error('LLM parse error:', error);
    return {
      category: 11,
      conditions: [],
      confidence: 'low',
      parser: 'llm',
      llmFallback: 'Failed to parse query',
      modelUsed: null,
    };
  }
}

async function parseQuery(text: string, userId: string | undefined, supabase: any): Promise<ParsedQuery> {
  // Try regex first
  const regexResult = parseQueryRegex(text);
  
  let parsedFilter: ParsedQuery;
  
  if (regexResult.success && regexResult.filter) {
    parsedFilter = regexResult.filter;
  } else {
    // Fallback to LLM
    parsedFilter = await parseWithAI(text);
  }

  // Track LLM usage if user is authenticated
  if (userId) {
    try {
      await supabase.from('llm_usage').insert({
        user_id: userId,
        user_query: text,
        parsed_query: parsedFilter,
        model_used: parsedFilter.modelUsed,
        confidence: parsedFilter.confidence,
        parser_type: parsedFilter.parser,
        success: parsedFilter.category !== 11,
      });
    } catch (error) {
      console.error('Failed to track LLM usage:', error);
    }
  }

  return parsedFilter;
}

// ============ GOOGLE SHEETS DATA FETCHING ============

async function fetchGoogleSheetsData(): Promise<any[]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_ID}/export?format=csv`;
  const response = await fetch(csvUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheets: ${response.statusText}`);
  }

  const csvText = await response.text();
  return parseCSV(csvText);
}

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