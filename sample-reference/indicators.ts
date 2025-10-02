import { StockData } from './types';
import * as ti from 'technicalindicators';

export interface IndicatorResult {
  value: number;
  values?: number[];
}

export function calculateRSI(data: StockData[], period: number = 14): number[] {
  const closes = data.map(d => d.close);
  const rsi = ti.RSI.calculate({ values: closes, period });
  return rsi;
}

export function calculateSMA(data: StockData[], period: number): number[] {
  const closes = data.map(d => d.close);
  const sma = ti.SMA.calculate({ values: closes, period });
  return sma;
}

export function calculateEMA(data: StockData[], period: number): number[] {
  const closes = data.map(d => d.close);
  const ema = ti.EMA.calculate({ values: closes, period });
  return ema;
}

export function calculateWMA(data: StockData[], period: number): number[] {
  const closes = data.map(d => d.close);
  const wma = ti.WMA.calculate({ values: closes, period });
  return wma;
}

export function calculateStochastic(data: StockData[], period: number = 14): { k: number[], d: number[] } {
  const input = {
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    close: data.map(d => d.close),
    period,
    signalPeriod: 3,
  };
  const result = ti.Stochastic.calculate(input);
  return {
    k: result.map(r => r.k),
    d: result.map(r => r.d),
  };
}

export function calculateCCI(data: StockData[], period: number = 20): number[] {
  const input = {
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    close: data.map(d => d.close),
    period,
  };
  return ti.CCI.calculate(input);
}

export function calculateWilliamsR(data: StockData[], period: number = 14): number[] {
  const input = {
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    close: data.map(d => d.close),
    period,
  };
  return ti.WilliamsR.calculate(input);
}

export function calculateROC(data: StockData[], period: number = 12): number[] {
  const closes = data.map(d => d.close);
  return ti.ROC.calculate({ values: closes, period });
}

export function calculateMFI(data: StockData[], period: number = 14): number[] {
  const input = {
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    close: data.map(d => d.close),
    volume: data.map(d => d.volume),
    period,
  };
  return ti.MFI.calculate(input);
}

export function calculateATR(data: StockData[], period: number = 14): number[] {
  const input = {
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    close: data.map(d => d.close),
    period,
  };
  return ti.ATR.calculate(input);
}

export function calculateBollingerBands(data: StockData[], period: number = 20, stdDev: number = 2) {
  const closes = data.map(d => d.close);
  const input = {
    values: closes,
    period,
    stdDev,
  };
  return ti.BollingerBands.calculate(input);
}

export function calculateMACD(data: StockData[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
  const closes = data.map(d => d.close);
  const input = {
    values: closes,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  };
  return ti.MACD.calculate(input);
}

export function calculateADX(data: StockData[], period: number = 14) {
  const input = {
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    close: data.map(d => d.close),
    period,
  };
  return ti.ADX.calculate(input);
}

export function calculateAwesomeOscillator(data: StockData[]): number[] {
  const input = {
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    fastPeriod: 5,
    slowPeriod: 34,
  };
  return ti.AwesomeOscillator.calculate(input);
}

export function calculateStochasticRSI(data: StockData[], rsiPeriod: number = 14, stochasticPeriod: number = 14): { k: number[], d: number[] } {
  const closes = data.map(d => d.close);
  const input = {
    values: closes,
    rsiPeriod,
    stochasticPeriod,
    kPeriod: 3,
    dPeriod: 3,
  };
  const result = ti.StochasticRSI.calculate(input);
  return {
    k: result.map(r => r.stochRSI),
    d: result.map(r => r.stochRSI),
  };
}

export function calculateKeltnerChannels(data: StockData[], period: number = 20, multiplier: number = 2) {
  const ema = calculateEMA(data, period);
  const atr = calculateATR(data, period);

  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];

  const offset = data.length - ema.length;

  for (let i = 0; i < ema.length; i++) {
    const atrIndex = i - (ema.length - atr.length);
    if (atrIndex >= 0) {
      upper.push(ema[i] + multiplier * atr[atrIndex]);
      middle.push(ema[i]);
      lower.push(ema[i] - multiplier * atr[atrIndex]);
    }
  }

  return { upper, middle, lower };
}

export function calculatePercentageChangeFromRef(data: StockData[], refType: string): number {
  const closes = data.map(d => d.close);
  const currentPrice = closes[closes.length - 1];

  let refPrice: number;

  switch (refType) {
    case '1d_low':
      refPrice = Math.min(...closes.slice(-1));
      break;
    case '1w_low':
      refPrice = Math.min(...closes.slice(-5));
      break;
    case '1m_low':
      refPrice = Math.min(...closes.slice(-21));
      break;
    case '52w_low':
      refPrice = Math.min(...closes.slice(-252));
      break;
    case '52w_high':
      refPrice = Math.max(...closes.slice(-252));
      break;
    default:
      refPrice = currentPrice;
  }

  return (currentPrice - refPrice) / refPrice;
}

export function calculateVolumeSMA(data: StockData[], period: number = 20): number[] {
  const volumes = data.map(d => d.volume);
  return ti.SMA.calculate({ values: volumes, period });
}

export function calculateDEMA(data: StockData[], period: number): number[] {
  const closes = data.map(d => d.close);
  const ema1 = ti.EMA.calculate({ values: closes, period });
  const ema2 = ti.EMA.calculate({ values: ema1, period });

  const dema: number[] = [];
  const offset = ema1.length - ema2.length;

  for (let i = 0; i < ema2.length; i++) {
    dema.push(2 * ema1[i + offset] - ema2[i]);
  }

  return dema;
}

export function calculateTEMA(data: StockData[], period: number): number[] {
  const closes = data.map(d => d.close);
  const ema1 = ti.EMA.calculate({ values: closes, period });
  const ema2 = ti.EMA.calculate({ values: ema1, period });
  const ema3 = ti.EMA.calculate({ values: ema2, period });

  const tema: number[] = [];
  const offset1 = ema1.length - ema2.length;
  const offset2 = ema2.length - ema3.length;

  for (let i = 0; i < ema3.length; i++) {
    tema.push(3 * ema1[i + offset1 + offset2] - 3 * ema2[i + offset2] + ema3[i]);
  }

  return tema;
}

export function isBullishEngulfing(data: StockData[], index: number): boolean {
  if (index < 1) return false;

  const prev = data[index - 1];
  const curr = data[index];

  const prevBearish = prev.close < prev.open;
  const currBullish = curr.close > curr.open;
  const engulfs = curr.open <= prev.close && curr.close >= prev.open;

  return prevBearish && currBullish && engulfs;
}

export function isBearishEngulfing(data: StockData[], index: number): boolean {
  if (index < 1) return false;

  const prev = data[index - 1];
  const curr = data[index];

  const prevBullish = prev.close > prev.open;
  const currBearish = curr.close < curr.open;
  const engulfs = curr.open >= prev.close && curr.close <= prev.open;

  return prevBullish && currBearish && engulfs;
}

export function isDoji(data: StockData[], index: number): boolean {
  const candle = data[index];
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;

  return range > 0 && body / range < 0.1;
}

export function isHammer(data: StockData[], index: number): boolean {
  const candle = data[index];
  const body = Math.abs(candle.close - candle.open);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);

  return lowerWick > body * 2 && upperWick < body * 0.3;
}

export function isInsideBar(data: StockData[], index: number): boolean {
  if (index < 1) return false;

  const prev = data[index - 1];
  const curr = data[index];

  return curr.high < prev.high && curr.low > prev.low;
}

export function isOutsideBar(data: StockData[], index: number): boolean {
  if (index < 1) return false;

  const prev = data[index - 1];
  const curr = data[index];

  return curr.high > prev.high && curr.low < prev.low;
}

export function isNR7(data: StockData[], index: number): boolean {
  if (index < 6) return false;

  const ranges = [];
  for (let i = index - 6; i <= index; i++) {
    ranges.push(data[i].high - data[i].low);
  }

  const currentRange = ranges[ranges.length - 1];
  return currentRange === Math.min(...ranges);
}

export function calculatePPO(data: StockData[], fastPeriod: number = 12, slowPeriod: number = 26): number[] {
  const closes = data.map(d => d.close);
  const fastEMA = ti.EMA.calculate({ values: closes, period: fastPeriod });
  const slowEMA = ti.EMA.calculate({ values: closes, period: slowPeriod });

  const ppo: number[] = [];
  const offset = fastEMA.length - slowEMA.length;

  for (let i = 0; i < slowEMA.length; i++) {
    const diff = fastEMA[i + offset] - slowEMA[i];
    ppo.push((diff / slowEMA[i]) * 100);
  }

  return ppo;
}

export function calculateCMO(data: StockData[], period: number = 14): number[] {
  const closes = data.map(d => d.close);
  const cmo: number[] = [];

  for (let i = period; i < closes.length; i++) {
    let upSum = 0;
    let downSum = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const change = closes[j] - closes[j - 1];
      if (change > 0) upSum += change;
      else downSum += Math.abs(change);
    }

    cmo.push(((upSum - downSum) / (upSum + downSum)) * 100);
  }

  return cmo;
}
