import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScreenerCondition {
  category: number;
  indicator?: string;
  window?: number;
  op: string;
  value?: number;
  low?: number;
  high?: number;
  ma_type?: string;
}

interface ParsedQuery {
  category: number;
  conditions: ScreenerCondition[];
  confidence: string;
  parser: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing screener query:', query);

    // Parse the query using regex or AI
    const parsedQuery = await parseQuery(query);
    console.log('Parsed query:', JSON.stringify(parsedQuery));

    // Execute the query against the database
    const results = await executeScreener(parsedQuery);
    console.log('Found results:', results.length);

    return new Response(
      JSON.stringify({ results, parsedQuery }),
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

async function parseQuery(text: string): Promise<ParsedQuery> {
  const lowerText = text.toLowerCase();

  // Simple regex patterns for common indicators
  const patterns = [
    // RSI patterns
    {
      regex: /rsi\s*(?:(\d+))?\s*(>|<|>=|<=|above|below)\s*(\d+(?:\.\d+)?)/i,
      handler: (match: RegExpMatchArray) => ({
        category: 1,
        indicator: 'rsi',
        window: match[1] ? parseInt(match[1]) : 14,
        op: normalizeOperator(match[2]),
        value: parseFloat(match[3])
      })
    },
    // Volume spike patterns
    {
      regex: /volume\s+spike\s+(\d+(?:\.\d+)?)\s*(?:x|×)?\s*sma\s+(\d+)/i,
      handler: (match: RegExpMatchArray) => ({
        category: 5,
        indicator: 'volume_sma',
        window: parseInt(match[2]),
        op: '>',
        value: parseFloat(match[1])
      })
    },
    // Price vs MA patterns
    {
      regex: /(?:price|close)?\s*crossed\s+(above|below)\s+(sma|ema)\s+(\d+)/i,
      handler: (match: RegExpMatchArray) => ({
        category: 2,
        ma_type: match[2],
        window: parseInt(match[3]),
        op: match[1] === 'above' ? 'crossed_above' : 'crossed_below'
      })
    },
    // CCI patterns
    {
      regex: /cci\s*(?:(\d+))?\s*(>|<|>=|<=|above|below|greater than|less than)\s*(-?\d+(?:\.\d+)?)/i,
      handler: (match: RegExpMatchArray) => ({
        category: 1,
        indicator: 'cci',
        window: match[1] ? parseInt(match[1]) : 14,
        op: normalizeOperator(match[2]),
        value: parseFloat(match[3])
      })
    },
    // MACD patterns
    {
      regex: /macd\s+crossed\s+(above|below)\s+signal/i,
      handler: (match: RegExpMatchArray) => ({
        category: 8,
        indicator: 'macd',
        op: match[1] === 'above' ? 'crossed_above' : 'crossed_below'
      })
    }
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const condition = pattern.handler(match);
      return {
        category: condition.category,
        conditions: [condition],
        confidence: 'high',
        parser: 'regex'
      };
    }
  }

  // Fallback to AI parsing for complex queries
  return await parseWithAI(text);
}

function normalizeOperator(op: string): string {
  const opMap: Record<string, string> = {
    'above': '>',
    'below': '<',
    'greater than': '>',
    'less than': '<',
    '>=': '>=',
    '<=': '<=',
    '>': '>',
    '<': '<'
  };
  return opMap[op.toLowerCase()] || op;
}

async function parseWithAI(text: string): Promise<ParsedQuery> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const systemPrompt = `You are a stock screener query parser. Convert natural language queries into structured JSON.
Return JSON with this structure:
{
  "category": <number 1-10>,
  "conditions": [{ "indicator": "string", "window": number, "op": "string", "value": number }],
  "confidence": "high|medium|low",
  "parser": "ai"
}

Categories:
1 - Indicator Threshold (RSI, CCI, etc)
2 - Price vs Moving Averages
5 - Volume/Volatility
8 - MACD signals

Operators: >, <, >=, <=, ==, crossed_above, crossed_below`;

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
      temperature: 0.1
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('AI parsing error:', error);
    throw new Error('Failed to parse query with AI');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No response from AI');
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Invalid AI response format');
  }
}

async function executeScreener(parsedQuery: ParsedQuery): Promise<any[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch stock data - get latest data for each symbol
  const { data: stockData, error } = await supabase
    .from('ohlcv_last_6_months')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch stock data');
  }

  if (!stockData || stockData.length === 0) {
    return [];
  }

  // Get latest data for each symbol
  const latestBySymbol = new Map();
  for (const row of stockData) {
    if (!latestBySymbol.has(row.symbol)) {
      latestBySymbol.set(row.symbol, row);
    }
  }

  const latestData = Array.from(latestBySymbol.values());
  console.log('Processing', latestData.length, 'symbols');

  // Apply conditions
  const results = [];
  for (const condition of parsedQuery.conditions) {
    const filtered = applyCondition(latestData, condition, stockData);
    results.push(...filtered);
  }

  // Remove duplicates and calculate change percentage
  const uniqueResults = Array.from(
    new Map(results.map(item => [item.symbol, item])).values()
  );

  return uniqueResults.slice(0, 50); // Limit to 50 results
}

function applyCondition(latestData: any[], condition: ScreenerCondition, allData: any[]): any[] {
  const results = [];

  for (const stock of latestData) {
    let matches = false;

    // Category 1: Indicator Threshold (RSI, CCI, etc.)
    if (condition.category === 1 && condition.indicator === 'rsi') {
      // Simple RSI approximation using price momentum
      const symbol = stock.symbol;
      const historicalData = allData
        .filter(d => d.symbol === symbol)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-14);
      
      if (historicalData.length >= 14) {
        const rsi = calculateRSI(historicalData);
        matches = compareValues(rsi, condition.op, condition.value || 0);
      }
    }
    // Category 1: CCI
    else if (condition.category === 1 && condition.indicator === 'cci') {
      const symbol = stock.symbol;
      const historicalData = allData
        .filter(d => d.symbol === symbol)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-20);
      
      if (historicalData.length >= 20) {
        const cci = calculateCCI(historicalData);
        matches = compareValues(cci, condition.op, condition.value || 0);
      }
    }
    // Category 2: Price vs MA
    else if (condition.category === 2) {
      const symbol = stock.symbol;
      const historicalData = allData
        .filter(d => d.symbol === symbol)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-(condition.window! + 5));
      
      if (historicalData.length >= condition.window!) {
        const ma = calculateSMA(historicalData.slice(-condition.window!).map(d => d.close));
        if (condition.op === 'crossed_above') {
          const prevPrice = historicalData[historicalData.length - 2]?.close;
          matches = prevPrice < ma && stock.close > ma;
        } else if (condition.op === 'crossed_below') {
          const prevPrice = historicalData[historicalData.length - 2]?.close;
          matches = prevPrice > ma && stock.close < ma;
        }
      }
    }
    // Category 5: Volume spike
    else if (condition.category === 5 && condition.indicator === 'volume_sma') {
      const symbol = stock.symbol;
      const historicalData = allData
        .filter(d => d.symbol === symbol)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-condition.window!);
      
      if (historicalData.length >= condition.window!) {
        const avgVolume = calculateSMA(historicalData.map(d => Number(d.volume)));
        const volumeRatio = Number(stock.volume) / avgVolume;
        matches = compareValues(volumeRatio, condition.op, condition.value || 0);
      }
    }

    if (matches) {
      // Calculate daily change percentage
      const symbol = stock.symbol;
      const prevDay = allData
        .filter(d => d.symbol === symbol)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[1];
      
      const change = prevDay ? ((stock.close - prevDay.close) / prevDay.close) * 100 : 0;
      
      results.push({
        symbol: stock.symbol,
        close: stock.close,
        volume: stock.volume,
        date: stock.date,
        change
      });
    }
  }

  return results;
}

function calculateRSI(data: any[], period = 14): number {
  if (data.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateCCI(data: any[], period = 20): number {
  if (data.length < period) return 0;

  const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);
  const sma = calculateSMA(typicalPrices.slice(-period));
  const meanDeviation = typicalPrices.slice(-period).reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

  const latestTypicalPrice = typicalPrices[typicalPrices.length - 1];
  return (latestTypicalPrice - sma) / (0.015 * meanDeviation);
}

function calculateSMA(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + Number(val), 0) / values.length;
}

function compareValues(actual: number, op: string, target: number): boolean {
  switch (op) {
    case '>': return actual > target;
    case '<': return actual < target;
    case '>=': return actual >= target;
    case '<=': return actual <= target;
    case '==': return Math.abs(actual - target) < 0.01;
    default: return false;
  }
}
