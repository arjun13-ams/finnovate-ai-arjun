import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

// Free models with fallback order
const FREE_MODELS = [
  'google/gemini-2.0-flash-001:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free'
];

interface PromptRequest {
  action: 'start' | 'answer' | 'generate';
  userInput?: string;
  answers?: { question: string; answer: string }[];
  conversationContext?: string;
}

async function callOpenRouterWithFallback(
  messages: any[],
  userId: string | null
): Promise<{ content: string; model: string; confidence: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  for (let i = 0; i < FREE_MODELS.length; i++) {
    const model = FREE_MODELS[i];
    const confidence = i === 0 ? 'high' : i === 1 ? 'medium' : 'low';
    
    try {
      console.log(`🤖 Trying model: ${model} (attempt ${i + 1}/${FREE_MODELS.length})`);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://screener.ai',
          'X-Title': 'Screener.AI Prompt Generator'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Model ${model} failed: ${response.status} - ${errorText}`);
        
        // Log failed attempt
        if (userId) {
          await supabaseAdmin.from('llm_usage').insert({
            user_id: userId,
            parser_type: 'prompt_generator',
            model_used: model,
            confidence,
            user_query: JSON.stringify(messages[messages.length - 1]),
            success: false,
            attempt_count: i + 1
          });
        }
        
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        console.error(`❌ Model ${model} returned empty content`);
        continue;
      }

      console.log(`✅ Model ${model} succeeded with confidence: ${confidence}`);
      
      // Log successful usage
      if (userId) {
        await supabaseAdmin.from('llm_usage').insert({
          user_id: userId,
          parser_type: 'prompt_generator',
          model_used: model,
          confidence,
          user_query: JSON.stringify(messages[messages.length - 1]),
          parsed_query: { content },
          success: true,
          attempt_count: i + 1
        });
      }

      return { content, model, confidence };
      
    } catch (error) {
      console.error(`❌ Model ${model} exception:`, error);
      
      // Log failed attempt
      if (userId) {
        await supabaseAdmin.from('llm_usage').insert({
          user_id: userId,
          parser_type: 'prompt_generator',
          model_used: model,
          confidence,
          user_query: JSON.stringify(messages[messages.length - 1]),
          success: false,
          attempt_count: i + 1
        });
      }
      
      continue;
    }
  }

  throw new Error('All models failed to generate response');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader! } }
    });

    // Get user
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    const body: PromptRequest = await req.json();
    console.log(`📝 Prompt Generator action: ${body.action}`);

    if (body.action === 'start') {
      // Generate 5 clarifying questions based on user input
      const messages = [
        {
          role: 'system',
          content: `You are an expert prompt engineer. Your job is to ask 5 clarifying questions to help create the perfect AI prompt.
The questions should be:
1. Specific to the user's goal
2. Help understand context, audience, tone, format, and constraints
3. Short and easy to answer
4. Optional but valuable

Return ONLY a JSON array of 5 questions, nothing else. Format:
["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]`
        },
        {
          role: 'user',
          content: `User wants to: ${body.userInput}\n\nGenerate 5 clarifying questions.`
        }
      ];

      const result = await callOpenRouterWithFallback(messages, userId);
      
      try {
        const questions = JSON.parse(result.content);
        return new Response(
          JSON.stringify({ 
            questions,
            model: result.model,
            confidence: result.confidence
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        // If parsing fails, extract questions manually
        const matches = result.content.match(/"([^"]+\?)"/g) || [];
        const questions = matches.map(m => m.replace(/"/g, ''));
        return new Response(
          JSON.stringify({ 
            questions: questions.slice(0, 5),
            model: result.model,
            confidence: result.confidence
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (body.action === 'generate') {
      // Generate final prompt based on user input and answers
      const answersText = body.answers
        ?.map(a => `Q: ${a.question}\nA: ${a.answer}`)
        .join('\n\n') || 'No additional context provided.';

      const messages = [
        {
          role: 'system',
          content: `You are an expert prompt engineer. Create a perfectly structured, detailed AI prompt based on the user's goal and their answers to clarifying questions.

The final prompt should:
- Be clear, specific, and actionable
- Include all relevant context from the answers
- Specify desired format, tone, and style
- Include any constraints or requirements
- Be ready to use with ChatGPT, Claude, or any AI tool

Return ONLY the final prompt text, nothing else. No explanation, no preamble.`
        },
        {
          role: 'user',
          content: `User Goal: ${body.userInput}

Clarifying Questions & Answers:
${answersText}

Generate the perfect AI prompt for this request.`
        }
      ];

      const result = await callOpenRouterWithFallback(messages, userId);

      return new Response(
        JSON.stringify({ 
          prompt: result.content,
          model: result.model,
          confidence: result.confidence
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Prompt generator error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
