import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Free models for OpenRouter
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

const SYSTEM_PROMPT = `You are a financial-screening compiler.
Your ONLY task is to convert the user's natural-language query into a **strict JSON** that exactly matches the schema below.

──────────────────────────────────
GLOBAL RULES
──────────────────────────────────
- Output **ONLY** valid JSON.
- All numeric literals must be numbers, not strings.
- Time windows: use integer days, e.g. 14, 21, 50.
- Percentages are decimals: 5 → 0.05.

──────────────────────────────────
ALLOWED ENUM VALUES
──────────────────────────────────
op: ">", ">=", "<", "<=", "==", "between", "crossed_above", "crossed_below", "proximity_within"
window: 5, 10, 14, 20, 21, 50, 100, 200
ma_type: "sma", "ema", "wma", "hma", "rma", "dema", "tema"
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
   Indicators: rsi, stoch, stochrsi, cci, williams_r, mfi

[2] Price vs Moving Averages
   conditions: [{ "category": 2, "ma_type": <ma_type>, "window": <int>, "op": "crossed_above"|"crossed_below"|"proximity_within", "value": <number> }]

[3] Relative Strength vs Index
   conditions: [{ "category": 3, "benchmark": <str>, "window": <int>, "op": <op>, "value": <number> }]

[4] Percent Change from Reference
   conditions: [{ "category": 4, "reference": "1d_low"|"1w_low"|"52w_low"|"52w_high", "op": <op>, "value": <number> }]

──────────────────────────────────
EXAMPLES
──────────────────────────────────
User: "RSI above 70"
→ { "category": 1, "conditions": [{"category": 1, "indicator": "rsi", "window": 14, "op": ">", "value": 70 }], "confidence": "high" }

User: "EMA 20 crossed above SMA 50"
→ { "category": 2, "conditions": [{"category": 2, "ma_type": "ema", "window": 20, "op": "crossed_above", "value": 50 }], "confidence": "high" }
`;

interface ParsedQuery {
  category: number;
  conditions: any[];
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

    console.log('📥 LLM Parser Request:', query);

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Parse query using LLM
    const parsedFilter = await parseQueryWithLLM(query, userId, supabaseAdmin);
    console.log('✅ LLM Parsed query:', JSON.stringify(parsedFilter));

    return new Response(
      JSON.stringify({
        success: true,
        parsedQuery: parsedFilter,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('LLM parser error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function parseQueryWithLLM(
  query: string,
  userId: string | undefined,
  supabaseAdmin: any
): Promise<ParsedQuery> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const modelsAttempted: string[] = [];
  let lastError: any = null;

  for (const model of FREE_MODELS) {
    modelsAttempted.push(model);
    console.log(`🤖 Trying model: ${model}`);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://your-app.com',
          'X-Title': 'Stock Screener AI',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: query }
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ Model ${model} failed: ${response.status} - ${errText}`);
        lastError = new Error(`Model ${model} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        console.error(`❌ Model ${model} returned empty content`);
        lastError = new Error(`Model ${model} returned empty content`);
        continue;
      }

      const parsed = JSON.parse(content);
      const confidence = parsed.confidence || 'medium';

      console.log(`✅ Model ${model} succeeded with confidence: ${confidence}`);

      const result: ParsedQuery = {
        category: parsed.category,
        conditions: parsed.conditions || [],
        confidence,
        parser: 'llm',
        modelUsed: model,
        llmFallback: parsed.llmFallback || null,
        modelsAttempted,
      };

      // Log LLM usage
      await logLLMUsage(userId, query, result, supabaseAdmin);

      return result;
    } catch (error: any) {
      console.error(`❌ Model ${model} error:`, error.message);
      lastError = error;
      continue;
    }
  }

  console.error('❌ All LLM models failed');
  throw lastError || new Error('All LLM models failed');
}

async function logLLMUsage(
  userId: string | undefined,
  query: string,
  result: ParsedQuery,
  supabaseAdmin: any
): Promise<void> {
  try {
    console.log('📝 Logging LLM usage...');
    
    const { error } = await supabaseAdmin.from('llm_usage_logs').insert({
      user_id: userId || null,
      query_text: query,
      parser_type: 'llm',
      model_used: result.modelUsed,
      confidence_score: result.confidence,
      parsed_result: result,
      models_attempted: result.modelsAttempted,
    });

    if (error) {
      console.error('❌ Failed to log LLM usage:', error);
    } else {
      console.log('✅ LLM usage logged successfully');
    }
  } catch (error) {
    console.error('❌ Error logging LLM usage:', error);
  }
}