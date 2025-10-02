import { StockData, ParsedFilter, ParsedCondition, FilteredStock, OperatorType } from './types';
import * as indicators from './indicators';

interface ConditionResult {
  pass: boolean;
  value: number;
  indicator: string;
  window?: number;
}

function compare(value: number, op: OperatorType, target: number | [number, number]): boolean {
  if (op === 'between' && Array.isArray(target)) {
    return value >= target[0] && value <= target[1];
  }

  const targetNum = typeof target === 'number' ? target : target[0];

  switch (op) {
    case '>':
      return value > targetNum;
    case '>=':
      return value >= targetNum;
    case '<':
      return value < targetNum;
    case '<=':
      return value <= targetNum;
    case '==':
      return Math.abs(value - targetNum) < 0.0001;
    default:
      return false;
  }
}

function groupBySymbol(data: StockData[]): Map<string, StockData[]> {
  const grouped = new Map<string, StockData[]>();

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

function applyConditionToGroup(symbolData: StockData[], cond: ParsedCondition): ConditionResult {
  const category = cond.category;

  if (category === 1) {
    return handleIndicatorThreshold(symbolData, cond);
  } else if (category === 2) {
    return handlePriceVsMA(symbolData, cond);
  } else if (category === 3) {
    return handleRelativeStrength(symbolData, cond);
  } else if (category === 4) {
    return handlePercentChangeFromRef(symbolData, cond);
  } else if (category === 5) {
    return handleVolumeVolatility(symbolData, cond);
  } else if (category === 6) {
    return handleChartPatterns(symbolData, cond);
  } else if (category === 7) {
    return handleBreakouts(symbolData, cond);
  } else if (category === 9) {
    return handleSpecialScreeners(symbolData, cond);
  } else if (category === 10) {
    return handleTimeBasedFilters(symbolData, cond);
  }

  return { pass: false, value: 0, indicator: 'unknown' };
}

function handleIndicatorThreshold(data: StockData[], cond: ParsedCondition): ConditionResult {
  const ind = cond.indicator!;
  const win = cond.window || 14;
  const op = cond.op!;
  const val = cond.value!;

  try {
    let result: number[] | { k: number[], d: number[] };
    let latest: number;

    switch (ind) {
      case 'rsi':
        result = indicators.calculateRSI(data, win);
        latest = result[result.length - 1];
        break;
      case 'stoch':
        result = indicators.calculateStochastic(data, win);
        latest = result.k[result.k.length - 1];
        break;
      case 'stochrsi':
        result = indicators.calculateStochasticRSI(data, win, win);
        latest = result.k[result.k.length - 1];
        break;
      case 'cci':
        result = indicators.calculateCCI(data, win);
        latest = result[result.length - 1];
        break;
      case 'williams_r':
        result = indicators.calculateWilliamsR(data, win);
        latest = result[result.length - 1];
        break;
      case 'awesome_osc':
        result = indicators.calculateAwesomeOscillator(data);
        latest = result[result.length - 1];
        break;
      case 'roc':
        result = indicators.calculateROC(data, win);
        latest = result[result.length - 1] / 100;
        break;
      case 'money_flow_idx':
        result = indicators.calculateMFI(data, win);
        latest = result[result.length - 1];
        break;
      case 'percentage_price_osc':
        result = indicators.calculatePPO(data, win);
        latest = result[result.length - 1];
        break;
      case 'chande_momentum':
        result = indicators.calculateCMO(data, win);
        latest = result[result.length - 1];
        break;
      default:
        return { pass: false, value: 0, indicator: ind, window: win };
    }

    if (latest === undefined || isNaN(latest)) {
      return { pass: false, value: 0, indicator: ind, window: win };
    }

    return {
      pass: compare(latest, op as OperatorType, val),
      value: latest,
      indicator: ind,
      window: win,
    };
  } catch (error) {
    return { pass: false, value: 0, indicator: ind, window: win };
  }
}

function handlePriceVsMA(data: StockData[], cond: ParsedCondition): ConditionResult {
  const maType = cond.ma_type!;
  const win = cond.window!;
  const op = cond.op!;
  const val = cond.value;

  try {
    let ma: number[];

    switch (maType) {
      case 'sma':
        ma = indicators.calculateSMA(data, win);
        break;
      case 'ema':
        ma = indicators.calculateEMA(data, win);
        break;
      case 'wma':
        ma = indicators.calculateWMA(data, win);
        break;
      case 'dema':
        ma = indicators.calculateDEMA(data, win);
        break;
      case 'tema':
        ma = indicators.calculateTEMA(data, win);
        break;
      default:
        ma = indicators.calculateSMA(data, win);
    }

    const price = data[data.length - 1].close;
    const maValue = ma[ma.length - 1];
    const prevPrice = data[data.length - 2]?.close;
    const prevMA = ma[ma.length - 2];

    if (op === 'crossed_above') {
      const pass = prevPrice <= prevMA && price > maValue;
      return { pass, value: price, indicator: `${maType}_${win}`, window: win };
    } else if (op === 'crossed_below') {
      const pass = prevPrice >= prevMA && price < maValue;
      return { pass, value: price, indicator: `${maType}_${win}`, window: win };
    } else if (op === 'proximity_within') {
      const pct = typeof val === 'number' ? val : 0.01;
      const pass = Math.abs(price - maValue) / maValue <= pct;
      return { pass, value: price, indicator: `${maType}_${win}`, window: win };
    } else {
      const pass = compare(price, op as OperatorType, maValue);
      return { pass, value: price, indicator: `${maType}_${win}`, window: win };
    }
  } catch (error) {
    return { pass: false, value: 0, indicator: `${maType}_${win}`, window: win };
  }
}

function handleRelativeStrength(data: StockData[], cond: ParsedCondition): ConditionResult {
  return { pass: false, value: 0, indicator: 'rs', window: cond.window };
}

function handlePercentChangeFromRef(data: StockData[], cond: ParsedCondition): ConditionResult {
  const ref = cond.reference!;
  const op = cond.op!;
  const val = cond.value as number;

  try {
    const pctChange = indicators.calculatePercentageChangeFromRef(data, ref);

    return {
      pass: compare(pctChange, op as OperatorType, val),
      value: pctChange,
      indicator: ref,
    };
  } catch (error) {
    return { pass: false, value: 0, indicator: ref };
  }
}

function handleVolumeVolatility(data: StockData[], cond: ParsedCondition): ConditionResult {
  const ind = cond.indicator!;
  const win = cond.window || 14;
  const op = cond.op!;
  const val = cond.value as number;

  try {
    let latest: number;

    switch (ind) {
      case 'volume': {
        latest = data[data.length - 1].volume;
        break;
      }
      case 'volume_sma': {
        const volumeSMA = indicators.calculateVolumeSMA(data, win);
        const currentVolume = data[data.length - 1].volume;
        latest = currentVolume / volumeSMA[volumeSMA.length - 1];
        break;
      }
      case 'atr': {
        const atr = indicators.calculateATR(data, win);
        const close = data[data.length - 1].close;
        latest = atr[atr.length - 1] / close;
        break;
      }
      case 'bb_width': {
        const bb = indicators.calculateBollingerBands(data, win, 2);
        const lastBB = bb[bb.length - 1];
        latest = (lastBB.upper - lastBB.lower) / lastBB.middle;
        break;
      }
      case 'kc_width': {
        const kc = indicators.calculateKeltnerChannels(data, win, 2);
        latest = (kc.upper[kc.upper.length - 1] - kc.lower[kc.lower.length - 1]) / kc.middle[kc.middle.length - 1];
        break;
      }
      default:
        return { pass: false, value: 0, indicator: ind, window: win };
    }

    return {
      pass: compare(latest, op as OperatorType, val),
      value: latest,
      indicator: ind,
      window: win,
    };
  } catch (error) {
    return { pass: false, value: 0, indicator: ind, window: win };
  }
}

function handleChartPatterns(data: StockData[], cond: ParsedCondition): ConditionResult {
  const pattern = cond.pattern_type!;
  const direction = cond.direction;
  const lastIndex = data.length - 1;

  try {
    let pass = false;

    switch (pattern) {
      case 'bullish_engulfing':
      case 'engulfing':
        if (direction === 'bullish' || !direction) {
          pass = indicators.isBullishEngulfing(data, lastIndex);
        }
        break;
      case 'bearish_engulfing':
        if (direction === 'bearish' || !direction) {
          pass = indicators.isBearishEngulfing(data, lastIndex);
        }
        break;
      case 'doji':
        pass = indicators.isDoji(data, lastIndex);
        break;
      case 'hammer':
        pass = indicators.isHammer(data, lastIndex);
        break;
      case 'inside_bar':
        pass = indicators.isInsideBar(data, lastIndex);
        break;
      case 'outside_bar':
        pass = indicators.isOutsideBar(data, lastIndex);
        break;
      case 'nr7':
        pass = indicators.isNR7(data, lastIndex);
        break;
    }

    return {
      pass,
      value: pass ? 1 : 0,
      indicator: pattern,
    };
  } catch (error) {
    return { pass: false, value: 0, indicator: pattern };
  }
}

function handleBreakouts(data: StockData[], cond: ParsedCondition): ConditionResult {
  const ind = cond.indicator!;
  const direction = cond.direction!;
  const win = cond.window || 14;

  try {
    const price = data[data.length - 1].close;
    let pass = false;

    switch (ind) {
      case 'bb_breakout': {
        const bb = indicators.calculateBollingerBands(data, win, 2);
        const lastBB = bb[bb.length - 1];
        pass = direction === 'up' ? price > lastBB.upper : price < lastBB.lower;
        break;
      }
      case 'kc_breakout': {
        const kc = indicators.calculateKeltnerChannels(data, win, 2);
        const upper = kc.upper[kc.upper.length - 1];
        const lower = kc.lower[kc.lower.length - 1];
        pass = direction === 'up' ? price > upper : price < lower;
        break;
      }
      case 'donchian_breakout': {
        const closes = data.slice(-win).map(d => d.close);
        const high = Math.max(...closes);
        const low = Math.min(...closes);
        pass = direction === 'up' ? price >= high : price <= low;
        break;
      }
    }

    return {
      pass,
      value: price,
      indicator: ind,
      window: win,
    };
  } catch (error) {
    return { pass: false, value: 0, indicator: ind, window: win };
  }
}

function handleSpecialScreeners(data: StockData[], cond: ParsedCondition): ConditionResult {
  const screener = cond.screener!;
  const win = cond.window || 14;

  try {
    let pass = false;
    let value = 0;

    switch (screener) {
      case 'base_breakout': {
        const closes = data.slice(-win).map(d => d.close);
        const price = data[data.length - 1].close;
        const high = Math.max(...closes);
        const pctChange = (price - closes[0]) / closes[0];
        pass = price >= high && pctChange <= 0.03;
        value = pctChange;
        break;
      }
      case 'adx_trend': {
        const adx = indicators.calculateADX(data, win);
        const lastADX = adx[adx.length - 1];
        pass = lastADX.adx > 25;
        value = lastADX.adx;
        break;
      }
      case 'turtle_signal': {
        const closes = data.slice(-win).map(d => d.close);
        const price = data[data.length - 1].close;
        pass = price >= Math.max(...closes);
        value = price;
        break;
      }
    }

    return {
      pass,
      value,
      indicator: screener,
      window: win,
    };
  } catch (error) {
    return { pass: false, value: 0, indicator: screener, window: win };
  }
}

function handleTimeBasedFilters(data: StockData[], cond: ParsedCondition): ConditionResult {
  const tf = cond.timeframe!;
  const op = cond.op!;
  const val = cond.value as number;

  const daysMap: Record<string, number> = {
    '1d': 1,
    '1w': 5,
    '1m': 21,
    '3m': 63,
    '6m': 126,
    '1y': 252,
    'ytd': data.length - 1,
  };

  const days = daysMap[tf] || 21;

  try {
    const startIndex = Math.max(0, data.length - days - 1);
    const startPrice = data[startIndex].close;
    const endPrice = data[data.length - 1].close;
    const pctChange = (endPrice - startPrice) / startPrice;

    return {
      pass: compare(pctChange, op as OperatorType, val),
      value: pctChange,
      indicator: `return_${tf}`,
      window: days,
    };
  } catch (error) {
    return { pass: false, value: 0, indicator: `return_${tf}`, window: days };
  }
}

export function screenStocks(data: StockData[], filter: ParsedFilter): FilteredStock[] {
  const grouped = groupBySymbol(data);
  const results: FilteredStock[] = [];

  for (const [symbol, symbolData] of grouped) {
    if (symbolData.length < 50) continue;

    const condition = filter.conditions[0];
    if (!condition) continue;

    const result = applyConditionToGroup(symbolData, condition);

    if (result.pass) {
      const lastRow = symbolData[symbolData.length - 1];
      results.push({
        ...lastRow,
        indicator_value: result.value,
        indicator_name: result.indicator,
        window: result.window,
      });
    }
  }

  return results;
}
