// Stock screening executor using technicalindicators library

import * as ti from 'technicalindicators';
import { StockData } from './stockData';
import { ParsedQuery, ParsedCondition } from './regexParser';

export interface FilteredStock {
  symbol: string;
  date: string;
  close: number;
  volume: number;
  change: number;
  indicator_name: string;
  indicator_value: number;
}

function groupBySymbol(data: StockData[]): Map<string, StockData[]> {
  const grouped = new Map<string, StockData[]>();
  
  for (const record of data) {
    if (!grouped.has(record.symbol)) {
      grouped.set(record.symbol, []);
    }
    grouped.get(record.symbol)!.push(record);
  }
  
  return grouped;
}

function compare(value: number, op: string, target: number | [number, number]): boolean {
  switch (op) {
    case '>': return value > (target as number);
    case '>=': return value >= (target as number);
    case '<': return value < (target as number);
    case '<=': return value <= (target as number);
    case '==': return Math.abs(value - (target as number)) < 0.0001;
    case 'between':
      const [low, high] = target as [number, number];
      return value >= low && value <= high;
    default: return false;
  }
}

function calculateIndicator(
  stockGroup: StockData[],
  indicator: string,
  window: number
): number | null {
  const values = stockGroup.map(s => s.close);
  const highs = stockGroup.map(s => s.high);
  const lows = stockGroup.map(s => s.low);
  const volumes = stockGroup.map(s => s.volume);
  
  if (values.length < window) return null;
  
  try {
    switch (indicator) {
      case 'rsi': {
        const result = ti.RSI.calculate({ values, period: window });
        return result.length > 0 ? result[result.length - 1] : null;
      }
      
      case 'stoch': {
        const result = ti.Stochastic.calculate({
          high: highs,
          low: lows,
          close: values,
          period: window,
          signalPeriod: 3
        });
        return result.length > 0 ? result[result.length - 1].k : null;
      }
      
      case 'cci': {
        const result = ti.CCI.calculate({
          high: highs,
          low: lows,
          close: values,
          period: window
        });
        return result.length > 0 ? result[result.length - 1] : null;
      }
      
      case 'williams_r': {
        const result = ti.WilliamsR.calculate({
          high: highs,
          low: lows,
          close: values,
          period: window
        });
        return result.length > 0 ? result[result.length - 1] : null;
      }
      
      case 'mfi':
      case 'money_flow_idx': {
        const result = ti.MFI.calculate({
          high: highs,
          low: lows,
          close: values,
          volume: volumes,
          period: window
        });
        return result.length > 0 ? result[result.length - 1] : null;
      }
      
      default:
        console.warn(`Indicator ${indicator} not yet implemented`);
        return null;
    }
  } catch (error) {
    console.error(`Error calculating ${indicator}:`, error);
    return null;
  }
}

function calculateMA(
  stockGroup: StockData[],
  maType: string,
  window: number
): number | null {
  const values = stockGroup.map(s => s.close);
  if (values.length < window) return null;
  
  try {
    switch (maType.toLowerCase()) {
      case 'sma': {
        const result = ti.SMA.calculate({ values, period: window });
        return result.length > 0 ? result[result.length - 1] : null;
      }
      
      case 'ema': {
        const result = ti.EMA.calculate({ values, period: window });
        return result.length > 0 ? result[result.length - 1] : null;
      }
      
      case 'wma': {
        const result = ti.WMA.calculate({ values, period: window });
        return result.length > 0 ? result[result.length - 1] : null;
      }
      
      default:
        console.warn(`MA type ${maType} not yet implemented`);
        return null;
    }
  } catch (error) {
    console.error(`Error calculating ${maType}:`, error);
    return null;
  }
}

function applyCondition(
  stockGroup: StockData[],
  condition: ParsedCondition
): { passed: boolean; value: number | null; indicator: string } {
  const latestStock = stockGroup[stockGroup.length - 1];
  
  // Category 1: Indicator Threshold
  if (condition.category === 1 && condition.indicator) {
    const value = calculateIndicator(stockGroup, condition.indicator, condition.window || 14);
    if (value === null) return { passed: false, value: null, indicator: condition.indicator };
    
    const passed = compare(value, condition.op, condition.value!);
    return { passed, value, indicator: condition.indicator };
  }
  
  // Category 2: Price vs MA
  if (condition.category === 2 && condition.ma_type) {
    const maValue = calculateMA(stockGroup, condition.ma_type, condition.window!);
    if (maValue === null) return { passed: false, value: null, indicator: condition.ma_type };
    
    const currentPrice = latestStock.close;
    let passed = false;
    
    if (condition.op === 'crossed_above') {
      const prevPrice = stockGroup.length > 1 ? stockGroup[stockGroup.length - 2].close : currentPrice;
      passed = prevPrice <= maValue && currentPrice > maValue;
    } else if (condition.op === 'crossed_below') {
      const prevPrice = stockGroup.length > 1 ? stockGroup[stockGroup.length - 2].close : currentPrice;
      passed = prevPrice >= maValue && currentPrice < maValue;
    } else if (condition.op === 'proximity_within') {
      const threshold = typeof condition.value === 'number' ? condition.value : 0;
      const diff = Math.abs(currentPrice - maValue) / maValue;
      passed = diff <= (threshold / 100);
    } else {
      passed = compare(currentPrice, condition.op, maValue);
    }
    
    return { passed, value: maValue, indicator: `${condition.ma_type}_${condition.window}` };
  }
  
  // Category 3: Relative Strength (not implemented yet)
  if (condition.category === 3) {
    console.warn('Category 3 (Relative Strength) not yet implemented');
    return { passed: false, value: null, indicator: 'rs' };
  }
  
  // Category 4: Percent Change from Reference (not implemented yet)
  if (condition.category === 4) {
    console.warn('Category 4 (Percent Change) not yet implemented');
    return { passed: false, value: null, indicator: 'pct_change' };
  }
  
  return { passed: false, value: null, indicator: 'unknown' };
}

export async function screenStocks(
  stockData: StockData[],
  parsedQuery: ParsedQuery
): Promise<FilteredStock[]> {
  const grouped = groupBySymbol(stockData);
  const results: FilteredStock[] = [];
  
  if (!parsedQuery.conditions || parsedQuery.conditions.length === 0) {
    console.log('No conditions to apply');
    return results;
  }
  
  const condition = parsedQuery.conditions[0];
  
  for (const [symbol, stockGroup] of grouped) {
    if (stockGroup.length === 0) continue;
    
    const { passed, value, indicator } = applyCondition(stockGroup, condition);
    
    if (passed) {
      const latestStock = stockGroup[stockGroup.length - 1];
      const prevStock = stockGroup.length > 1 ? stockGroup[stockGroup.length - 2] : latestStock;
      const change = ((latestStock.close - prevStock.close) / prevStock.close) * 100;
      
      results.push({
        symbol,
        date: latestStock.date,
        close: latestStock.close,
        volume: latestStock.volume,
        change,
        indicator_name: indicator,
        indicator_value: value || 0,
      });
    }
  }
  
  return results;
}
