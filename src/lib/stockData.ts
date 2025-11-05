// Google Sheets data fetching and caching

const GOOGLE_SHEETS_ID = '1Abo2NBSA5WavSfQSSo4LTBb9IwcNmGAXgqt42wpJGXo';
const CACHE_KEY = 'stock_data_cache';
const CACHE_TIMESTAMP_KEY = 'stock_data_timestamp';
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

export interface StockData {
  symbol: string;
  date: string; // dd-mm-yyyy format
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  total_shares?: number;
}

function parseDDMMYYYY(dateStr: string): Date | null {
  const parts = dateStr.trim().split(/[-/]/);
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  
  const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
  const date = new Date(fullYear, month, day);
  
  if (date.getDate() !== day || date.getMonth() !== month) return null;
  
  return date;
}

function parseCSV(csvText: string): StockData[] {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  console.log('📊 CSV Headers:', headers);
  
  const data: StockData[] = [];
  let skipped = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length < 7) {
      skipped++;
      continue;
    }
    
    const dateStr = row[1]?.trim();
    const dateObj = parseDDMMYYYY(dateStr);
    
    if (!dateObj) {
      skipped++;
      continue;
    }
    
    const record: StockData = {
      symbol: row[0]?.trim() || '',
      date: dateStr, // Keep original dd-mm-yyyy format
      open: parseFloat(row[2]) || 0,
      high: parseFloat(row[3]) || 0,
      low: parseFloat(row[4]) || 0,
      close: parseFloat(row[5]) || 0,
      volume: parseFloat(row[6]) || 0,
      total_shares: row[7] ? parseFloat(row[7]) : undefined,
    };
    
    data.push(record);
  }
  
  // Sort by symbol (ascending) then by date (ascending)
  data.sort((a, b) => {
    const symbolCompare = a.symbol.localeCompare(b.symbol);
    if (symbolCompare !== 0) return symbolCompare;
    
    const dateA = parseDDMMYYYY(a.date);
    const dateB = parseDDMMYYYY(b.date);
    if (!dateA || !dateB) return 0;
    
    return dateA.getTime() - dateB.getTime();
  });
  
  console.log(`📊 Parsed ${data.length} records (${skipped} skipped)`);
  
  return data;
}

async function fetchGoogleSheetsData(): Promise<StockData[]> {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_ID}/export?format=csv`;
  console.log('📡 Fetching fresh data from Google Sheets...');
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheets data: ${response.statusText}`);
  }
  
  const csvText = await response.text();
  console.log(`📊 Total lines in CSV: ${csvText.split('\n').length}`);
  
  const data = parseCSV(csvText);
  
  const uniqueSymbols = new Set(data.map(r => r.symbol)).size;
  const dateFrom = data.length > 0 ? data[0].date : null;
  const dateTo = data.length > 0 ? data[data.length - 1].date : null;
  
  console.log(`📊 Loaded ${data.length} stock records`);
  console.log(`📊 Unique symbols: ${uniqueSymbols}`);
  console.log(`📊 Date range: ${dateFrom} to ${dateTo}`);
  
  return data;
}

function getCachedData(): StockData[] | null {
  try {
    const timestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return null;
    
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > CACHE_DURATION) {
      console.log(`📦 Cache expired: Age ${Math.round(age / 60000)} minutes`);
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(CACHE_TIMESTAMP_KEY);
      return null;
    }
    
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    console.log(`📦 Cache hit: Age ${Math.round(age / 60000)} minutes`);
    return JSON.parse(cached);
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

function setCachedData(data: StockData[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    sessionStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    console.log('✅ Cache updated successfully');
  } catch (error) {
    console.error('Error setting cache:', error);
  }
}

export async function getStockData(): Promise<StockData[]> {
  const cached = getCachedData();
  if (cached) {
    console.log('📊 Using cached Google Sheets data');
    return cached;
  }
  
  const data = await fetchGoogleSheetsData();
  setCachedData(data);
  return data;
}

export function clearStockDataCache(): void {
  sessionStorage.removeItem(CACHE_KEY);
  sessionStorage.removeItem(CACHE_TIMESTAMP_KEY);
  console.log('🗑️ Cache cleared');
}
