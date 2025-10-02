import { ParsedFilter, ParsedCondition, OperatorType } from './types';

const NATURAL_OP_MAP: Record<string, OperatorType> = {
  'greater than': '>',
  'more than': '>',
  'above': '>',
  'less than': '<',
  'below': '<',
  'greater than or equal to': '>=',
  'at least': '>=',
  'no less than': '>=',
  'less than or equal to': '<=',
  'at most': '<=',
  'no more than': '<=',
  'equal to': '==',
  'equals': '==',
};

function normalizeOp(opRaw: string): OperatorType {
  const op = opRaw.toLowerCase().trim();
  return (NATURAL_OP_MAP[op] as OperatorType) || (op as OperatorType);
}

const COMPARISON_REGEX = '(?<op>>=|<=|>|<|==|greater than or equal to|at least|no less than|less than or equal to|at most|no more than|greater than|more than|above|less than|below|equal to|equals)';

interface RegexRule {
  pattern: RegExp;
  template: Partial<ParsedCondition>;
}

const REGEX_RULES: RegexRule[] = [
  {
    pattern: new RegExp(`\\bRSI\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 1, indicator: 'rsi' },
  },
  {
    pattern: new RegExp(`\\bStochastic\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'stoch' },
  },
  {
    pattern: /\bStoch\s*RSI\s*(?<window>\d+)?\s*(?<low>-?\d+(?:\.\d+)?)\s*-\s*(?<high>-?\d+(?:\.\d+)?)/i,
    template: { category: 1, indicator: 'stochrsi', op: 'between' },
  },
  {
    pattern: new RegExp(`\\bCCI\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'cci' },
  },
  {
    pattern: new RegExp(`\\bWilliams\\s*%?R\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'williams_r' },
  },
  {
    pattern: new RegExp(`\\bAO\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'awesome_osc' },
  },
  {
    pattern: new RegExp(`\\bKDJ\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'kdj' },
  },
  {
    pattern: new RegExp(`\\bUO\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'ultimate_osc' },
  },
  {
    pattern: new RegExp(`\\bCMO\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'chande_momentum' },
  },
  {
    pattern: new RegExp(`\\bROC\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 1, indicator: 'roc' },
  },
  {
    pattern: new RegExp(`\\bMFI\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'money_flow_idx' },
  },
  {
    pattern: new RegExp(`\\bPPO\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 1, indicator: 'percentage_price_osc' },
  },
  {
    pattern: /\bFisher Transform\b.*?\bcrossed\s+(?<op>above|below)\s+(?<value>-?\d+(?:\.\d+)?)/i,
    template: { category: 1, indicator: 'fisher_transform' },
  },
  {
    pattern: new RegExp(`\\bTSI\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'tsi' },
  },
  {
    pattern: new RegExp(`\\bSTC\\b.*?${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 1, indicator: 'schaff_trend_cycle' },
  },
  {
    pattern: new RegExp(`\\bUltimate\\s+Oscillator\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 1, indicator: 'ultimate_osc' },
  },
  {
    pattern: new RegExp(`\\bChande\\s+Momentum\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 1, indicator: 'chande_momentum' },
  },
  {
    pattern: new RegExp(`\\bMoney\\s+Flow\\s+Index\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 1, indicator: 'money_flow_idx' },
  },
  {
    pattern: new RegExp(`\\bPercentage\\s+Price\\s+Oscillator\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 1, indicator: 'percentage_price_osc' },
  },
  {
    pattern: new RegExp(`\\bSchaff\\s+Trend\\s+Cycle\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>-?\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 1, indicator: 'schaff_trend_cycle' },
  },
  {
    pattern: /\b(?:price|close)?\s*(?<op>crossed\s+above|crossed\s+below|above|below)\s+(?<ma_type>sma|ema|hma|kama|dema|tema|zlma)\s+(?<window>\d+)/i,
    template: { category: 2 },
  },
  {
    pattern: /\bwithin\s+(?<value>\d+(?:\.\d+)?)%?\s+of\s+(?<ma_type>sma|ema|hma|kama|dema|tema|zlma)\s+(?<window>\d+)/i,
    template: { category: 2, op: 'proximity_within' },
  },
  {
    pattern: new RegExp(`\\bRS\\s+(?:vs|versus)\\s+(?<benchmark>\\w+)\\s*${COMPARISON_REGEX}\\s*(?<value>\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 3 },
  },
  {
    pattern: /\b(?:up|above)\s+(?<value>\d+(?:\.\d+)?)%?\s+from\s+(?<ref>1d|1w|1m|3m|6m|52w|ytd)_low\b/i,
    template: { category: 4, op: '>' },
  },
  {
    pattern: /\b(?:down|below)\s+(?<value>\d+(?:\.\d+)?)%?\s+from\s+(?<ref>1d|1w|1m|3m|6m|52w|ytd)_high\b/i,
    template: { category: 4, op: '<' },
  },
  {
    pattern: /\bwithin\s+(?<value>\d+(?:\.\d+)?)%?\s+of\s+(?<ref>52w)_high\b/i,
    template: { category: 4, op: 'between' },
  },
  {
    pattern: new RegExp(`\\bATR\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 5, indicator: 'atr' },
  },
  {
    pattern: /\bVolume\s+spike\s+(?<value>\d+(?:\.\d+)?)\s*×?\s*SMA\s+(?<window>\d+)/i,
    template: { category: 5, indicator: 'volume_sma' },
  },
  {
    pattern: new RegExp(`\\bBB\\s+width\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 5, indicator: 'bb_width' },
  },
  {
    pattern: new RegExp(`\\bKC\\s+width\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 5, indicator: 'kc_width' },
  },
  {
    pattern: new RegExp(`\\bUlcer\\s+Index\\s*(?<window>\\d+)?\\s*${COMPARISON_REGEX}\\s*(?<value>\\d+(?:\\.\\d+)?)`, 'i'),
    template: { category: 5, indicator: 'ui' },
  },
  {
    pattern: /\b(bullish\s+|bearish\s+)?engulfing\b/i,
    template: { category: 6 },
  },
  {
    pattern: /\bdoji\b/i,
    template: { category: 6, pattern_type: 'doji' },
  },
  {
    pattern: /\bhammer\b/i,
    template: { category: 6, pattern_type: 'hammer' },
  },
  {
    pattern: /\bnr7\b/i,
    template: { category: 6, pattern_type: 'nr7' },
  },
  {
    pattern: /\binside\s+bar\b/i,
    template: { category: 6, pattern_type: 'inside_bar' },
  },
  {
    pattern: /\boutside\s+bar\b/i,
    template: { category: 6, pattern_type: 'outside_bar' },
  },
  {
    pattern: /\bBB\s+breakout\s+(?<direction>up|down)\b/i,
    template: { category: 7, indicator: 'bb_breakout' },
  },
  {
    pattern: /\bDonchian\s+(?<window>\d+)\s+breakout\s+(?<direction>up|down)\b/i,
    template: { category: 7, indicator: 'donchian_breakout' },
  },
  {
    pattern: /\bpivot\s+breakout\b/i,
    template: { category: 7, indicator: 'pivot_break' },
  },
  {
    pattern: /\bbase\s+breakout\b/i,
    template: { category: 9, screener: 'base_breakout' },
  },
  {
    pattern: /\bturtle\s+(?:soup|signal)\b/i,
    template: { category: 9, screener: 'turtle_signal' },
  },
  {
    pattern: /\bADX\s+trend\s+(?<direction>long|short)\b/i,
    template: { category: 9, screener: 'adx_trend' },
  },
  {
    pattern: new RegExp(`\\bweekly\\s+return\\s*${COMPARISON_REGEX}\\s*(?<value>\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 10, timeframe: '1w' },
  },
  {
    pattern: new RegExp(`\\bYTD\\s+return\\s*${COMPARISON_REGEX}\\s*(?<value>\\d+(?:\\.\\d+)?)%?`, 'i'),
    template: { category: 10, timeframe: 'ytd' },
  },
];

export function parseQueryRegex(text: string): { success: boolean; filter?: ParsedFilter } {
  const lowerText = text.toLowerCase();

  for (const rule of REGEX_RULES) {
    const match = rule.pattern.exec(lowerText);
    if (match) {
      const groups = match.groups || {};
      const condition: ParsedCondition = { ...rule.template } as ParsedCondition;

      for (const [key, val] of Object.entries(groups)) {
        if (val === undefined) continue;

        if (key === 'value') {
          const strVal = val.replace('%', '');
          condition.value = val.includes('%') ? parseFloat(strVal) / 100 : parseFloat(strVal);
        } else if (key === 'low' || key === 'high') {
          if (!condition.value || typeof condition.value === 'number') {
            condition.value = [0, 0];
          }
          const idx = key === 'low' ? 0 : 1;
          (condition.value as [number, number])[idx] = parseFloat(val);
        } else if (key === 'op') {
          condition.op = normalizeOp(val);
        } else if (key === 'window') {
          condition.window = parseInt(val, 10);
        } else if (key === 'direction') {
          condition.direction = val;
          if (condition.category === 7) {
            condition.op = val === 'up' ? 'crossed_above' : 'crossed_below';
          }
        } else if (key === 'ref') {
          condition.reference = `${val}_${groups['ref'] || 'low'}`;
        } else {
          (condition as any)[key] = val;
        }
      }

      if (rule.template.category === 6 && match[1]) {
        const prefix = match[1].trim();
        condition.pattern_type = prefix ? `${prefix}engulfing` : 'engulfing';
        condition.direction = prefix.includes('bullish') ? 'bullish' : 'bearish';
      }

      if (!condition.window && condition.indicator && ['rsi', 'cci', 'atr'].includes(condition.indicator)) {
        condition.window = 14;
      }

      if (condition.category === 2 && condition.op) {
        if (condition.op.includes('crossed')) {
          condition.op = condition.op as OperatorType;
        }
      }

      return {
        success: true,
        filter: {
          category: condition.category,
          conditions: [condition],
          confidence: 'high',
          parser: 'regex',
        },
      };
    }
  }

  return { success: false };
}

export async function parseQueryLLM(text: string): Promise<ParsedFilter> {
  try {
    const response = await fetch('/api/parse-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: text }),
    });

    if (!response.ok) {
      throw new Error('LLM parsing failed');
    }

    const result = await response.json();
    return {
      ...result,
      parser: 'llm',
      modelUsed: result.modelUsed || null,
      modelsAttempted: result.modelsAttempted || [],
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
      modelsAttempted: [],
    };
  }
}

export async function parseQuery(text: string): Promise<ParsedFilter> {
  const regexResult = parseQueryRegex(text);

  if (regexResult.success && regexResult.filter) {
    return regexResult.filter;
  }

  return await parseQueryLLM(text);
}
