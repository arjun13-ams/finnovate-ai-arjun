// Regex-based query parser

export interface ParsedCondition {
  category: number;
  indicator?: string;
  window?: number;
  op: string;
  value?: number | [number, number];
  ma_type?: string;
  benchmark?: string;
  reference?: string;
  pattern_type?: string;
  direction?: string;
  screener?: string;
  timeframe?: string;
  operator?: string;
  subConditions?: ParsedCondition[];
}

export interface ParsedQuery {
  category: number;
  conditions: ParsedCondition[];
  confidence: string;
  parser: string;
}

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

export function parseQueryRegex(text: string): { success: boolean; filter?: ParsedQuery } {
  const lowerText = text.toLowerCase();

  const ok = (category: number, condition: ParsedCondition): { success: boolean; filter: ParsedQuery } => ({
    success: true,
    filter: {
      category,
      conditions: [condition],
      confidence: 'high',
      parser: 'regex',
    },
  });

  // Category 1: Indicator Thresholds
  const rsiMatch = /\brsi\s*(?:(\d+))?\s*(>|>=|<|<=|above|below|greater than|less than)\s*(\d+(?:\.\d+)?)/i.exec(lowerText);
  if (rsiMatch) {
    const window = rsiMatch[1] ? parseInt(rsiMatch[1]) : 14;
    const op = normalizeOperator(rsiMatch[2]);
    const value = parseFloat(rsiMatch[3]);
    return ok(1, { category: 1, indicator: 'rsi', window, op, value });
  }

  const stochMatch = /\bstoch(?:astic)?\b.*?(>|>=|<|<=|greater than|less than|above|below)\s*(\d+(?:\.\d+)?)/i.exec(lowerText);
  if (stochMatch) {
    const op = normalizeOperator(stochMatch[1]);
    const value = parseFloat(stochMatch[2]);
    return ok(1, { category: 1, indicator: 'stoch', window: 14, op, value });
  }

  const cciMatch = /\bcci\s*(?:(\d+))?\s*(>|>=|<|<=|above|below)\s*(-?\d+(?:\.\d+)?)/i.exec(lowerText);
  if (cciMatch) {
    const window = cciMatch[1] ? parseInt(cciMatch[1]) : 20;
    const op = normalizeOperator(cciMatch[2]);
    const value = parseFloat(cciMatch[3]);
    return ok(1, { category: 1, indicator: 'cci', window, op, value });
  }

  // Category 2: Price vs Moving Averages
  const priceMAMatch = /\b(?:price|close)?\s*(crossed\s+above|crossed\s+below|above|below)\s+(sma|ema|wma|hma|kama|dema|tema|zlma)\s+(\d+)/i.exec(lowerText);
  if (priceMAMatch) {
    const op = priceMAMatch[1].includes('crossed')
      ? (priceMAMatch[1].includes('above') ? 'crossed_above' : 'crossed_below')
      : (priceMAMatch[1].includes('above') ? '>' : '<');
    const maType = priceMAMatch[2];
    const window = parseInt(priceMAMatch[3]);
    return ok(2, { category: 2, ma_type: maType, window, op });
  }

  const priceWithinMA = /\bwithin\s+(\d+(?:\.\d+)?)%?\s+of\s+(sma|ema|wma|hma|kama|dema|tema|zlma)\s+(\d+)/i.exec(lowerText);
  if (priceWithinMA) {
    const value = parseFloat(priceWithinMA[1]);
    const maType = priceWithinMA[2];
    const window = parseInt(priceWithinMA[3]);
    return ok(2, { category: 2, ma_type: maType, window, op: 'proximity_within', value });
  }

  // Category 3: Relative Strength
  const rsMatch = /\bRS\s+(?:vs|versus)\s+(\w+)\s*(>|>=|<|<=|greater than|less than|above|below)\s*(\d+(?:\.\d+)?)/i.exec(lowerText);
  if (rsMatch) {
    const benchmark = rsMatch[1];
    const op = normalizeOperator(rsMatch[2]);
    const value = parseFloat(rsMatch[3]);
    return ok(3, { category: 3, benchmark, op, value });
  }

  // Category 4: Percent Change from Reference
  const upFromLow = /\b(?:up|above)\s+(\d+(?:\.\d+)?)%?\s+from\s+(1d|1w|1m|3m|6m|52w|ytd)_low\b/i.exec(lowerText);
  if (upFromLow) {
    const value = parseFloat(upFromLow[1]) / 100;
    const ref = upFromLow[2] + '_low';
    return ok(4, { category: 4, reference: ref, op: '>', value });
  }

  const downFromHigh = /\b(?:down|below)\s+(\d+(?:\.\d+)?)%?\s+from\s+(1d|1w|1m|3m|6m|52w|ytd)_high\b/i.exec(lowerText);
  if (downFromHigh) {
    const value = parseFloat(downFromHigh[1]) / 100;
    const ref = downFromHigh[2] + '_high';
    return ok(4, { category: 4, reference: ref, op: '<', value });
  }

  const withinHigh = /\bwithin\s+(\d+(?:\.\d+)?)%?\s+of\s+(52w)_high\b/i.exec(lowerText);
  if (withinHigh) {
    const value = parseFloat(withinHigh[1]) / 100;
    const ref = withinHigh[2] + '_high';
    return ok(4, { category: 4, reference: ref, op: 'between', value });
  }

  return { success: false };
}
