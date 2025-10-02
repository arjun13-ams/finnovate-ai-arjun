import { StockData } from './types';

const GOOGLE_SHEETS_ID = '1Abo2NBSA5WavSfQSSo4LTBb9IwcNmGAXgqt42wpJGXo';
const CACHE_KEY = 'stock_screener_data';
const CACHE_TIMESTAMP_KEY = 'stock_screener_data_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export async function fetchGoogleSheetsData(): Promise<StockData[]> {
  const cachedData = getCachedData();
  if (cachedData) {
    return cachedData;
  }

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_ID}/export?format=csv`;
    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const csvText = await response.text();
    const stockData = parseCSV(csvText);

    setCachedData(stockData);

    return stockData;
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    throw error;
  }
}

function parseCSV(csvText: string): StockData[] {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const symbolIdx = headers.indexOf('symbol');
  const dateIdx = headers.indexOf('date');
  const openIdx = headers.indexOf('open');
  const highIdx = headers.indexOf('high');
  const lowIdx = headers.indexOf('low');
  const closeIdx = headers.indexOf('close');
  const volumeIdx = headers.indexOf('volume');

  console.log(`📊 CSV Headers:`, headers);
  console.log(`📊 Total lines in CSV: ${lines.length}`);

  const data: StockData[] = [];
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      skippedRows++;
      continue;
    }

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

      if (!record.symbol || !record.date) {
        skippedRows++;
        continue;
      }

      data.push(record);
    } catch (error) {
      console.warn(`Skipping invalid row ${i}:`, error);
      skippedRows++;
    }
  }

  const dates = data.map(d => d.date).sort();
  const uniqueSymbols = new Set(data.map(d => d.symbol)).size;

  console.log(`📊 Parsed ${data.length} records (${skippedRows} skipped)`);
  console.log(`📊 Unique symbols: ${uniqueSymbols}`);
  console.log(`📊 Date range: ${dates[0]} to ${dates[dates.length - 1]}`);

  return data;
}

function getCachedData(): StockData[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const timestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return null;

    const age = Date.now() - parseInt(timestamp, 10);
    if (age > CACHE_DURATION) {
      clearCache();
      return null;
    }

    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    return JSON.parse(cached);
  } catch (error) {
    console.error('Error reading cache:', error);
    clearCache();
    return null;
  }
}

function setCachedData(data: StockData[]): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    sessionStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error setting cache:', error);
  }
}

export function clearCache(): void {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem(CACHE_KEY);
  sessionStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

export function getCacheAge(): number | null {
  if (typeof window === 'undefined') return null;

  const timestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);
  if (!timestamp) return null;

  return Date.now() - parseInt(timestamp, 10);
}
