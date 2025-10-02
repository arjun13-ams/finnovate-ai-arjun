# Stock Screener AI - Complete Product Documentation

## Executive Summary

This document provides comprehensive details about the Stock Screener AI product, a natural language-powered technical analysis tool that allows users to query stock data using plain English. The system uses a two-tier parsing architecture (Regex + LLM fallback) with OpenRouter API integration, processes data from Google Sheets, and performs real-time technical indicator calculations.

---

## Table of Contents

1. [Core Product Overview](#core-product-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Data Flow & Processing Pipeline](#data-flow--processing-pipeline)
4. [Query Parsing System](#query-parsing-system)
5. [Technical Indicators Engine](#technical-indicators-engine)
6. [Database Schema](#database-schema)
7. [OpenRouter API Integration](#openrouter-api-integration)
8. [Issues Encountered & Solutions](#issues-encountered--solutions)
9. [Google Sheets Data Integration](#google-sheets-data-integration)
10. [Implementation Guide](#implementation-guide)
11. [Future Enhancements](#future-enhancements)

---

## Core Product Overview

### Product Description
Stock Screener AI is an intelligent stock screening tool that allows users to filter stocks using natural language queries. Instead of complex UI forms with dropdowns and sliders, users simply type queries like "RSI above 70" or "price crossed above EMA 20" and the system returns matching stocks with relevant indicator values.

### Key Features
- **Natural Language Processing**: Convert plain English to technical queries
- **Technical Indicators**: RSI, MACD, Bollinger Bands, EMA, SMA, Stochastic, CCI, ATR, and more
- **Two-Tier Parsing**: Fast regex parser (70% coverage) + AI fallback (30% coverage)
- **Real-Time Calculations**: Calculate indicators on-the-fly from OHLCV data
- **Google Sheets Integration**: Live data source with automatic caching (24hr sessionStorage)
- **Cost-Optimized AI**: Multi-model fallback chain with free-tier models
- **Usage Analytics**: Track all LLM queries for cost monitoring and parser improvement

### User Experience Flow
1. User enters natural language query in search box
2. System attempts regex parsing (instant, free)
3. If regex fails, falls back to LLM parsing (OpenRouter API)
4. Parsed query is converted to technical filter conditions
5. System loads stock data from Google Sheets (cached 24 hours)
6. Indicators are calculated for each stock
7. Results are filtered and displayed in a table
8. Query analysis shows confidence level and parser type used

---

## Architecture & Technology Stack

### Frontend Stack
- **Framework**: Next.js  (App Router)
- **Language**: TypeScript 
- **UI Library**: React 
- **Styling**: Tailwind CSS 
- **Component Library**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **State Management**: React hooks (useState, useEffect, useContext)

### Backend Stack
- **API Routes**: Next.js API Routes (Server-side)
- **Database**: 
- **Authentication**: 
- **Data Processing**: Client-side JavaScript
- **Technical Indicators**: technicalindicators npm package 

### External Services
- **LLM Provider**: OpenRouter AI (free-tier models)
- **Data Source**: Google Sheets (CSV export)
- **Google Sheets ID**: 1Abo2NBSA5WavSfQSSo4LTBb9IwcNmGAXgqt42wpJGXo
- **Hosting**: 


---

## Data Flow & Processing Pipeline

### Complete Request Flow Diagram

\`\`\`
User Input: "RSI above 70"
        ↓
┌───────────────────────┐
│ Regex Parser          │ → 70% success → Return ParsedFilter
│ (parser.ts)           │                 confidence: high
└───────┬───────────────┘
        │ 30% fail
        ↓
┌───────────────────────┐
│ LLM Fallback          │ → Try 8 free models
│ (/api/parse-query)    │   Stop on high confidence
└───────┬───────────────┘
        ↓
┌───────────────────────┐
│ Track LLM Usage       │ → Store in llm_usage table
│ (if LLM used)         │   (user input prompt, llm converted technical query, model used, confidence)
└───────┬───────────────┘
        ↓
┌───────────────────────┐
│ Load Stock Data       │ → Fetch from Google Sheets
│ (google-sheets.ts)    │   Cache 24hr in sessionStorage
└───────┬───────────────┘
        ↓
┌───────────────────────┐
│ Screen Stocks         │ → Calculate indicators
│ (executor.ts)         │   Apply conditions
│                       │   Return matching stocks
└───────┬───────────────┘
        ↓
┌───────────────────────┐
│ Display Results       │ → Table + Query Analysis Card
└───────────────────────┘
\`\`\`

### Key Data Structures

**StockData Interface**
\`\`\`typescript
interface StockData {
  symbol: string;      // "AAPL"
  date: string;        // "2024-01-15"
  open: number;        // 187.50
  high: number;        // 190.25
  low: number;         // 186.80
  close: number;       // 189.00
  volume: number;      // 54321000
}
\`\`\`

**ParsedFilter Interface**
\`\`\`typescript
interface ParsedFilter {
  category: number;              // 1-11
  conditions: ParsedCondition[];
  confidence: 'high' | 'medium' | 'low';
  parser: 'regex' | 'llm';
  llmFallback?: string;
  modelUsed?: string | null;
  modelsAttempted?: string[];
}
\`\`\`

**FilteredStock Interface**
\`\`\`typescript
interface FilteredStock extends StockData {
  indicator_value: number;    // 73.4
  indicator_name: string;     // "rsi"
  window?: number;            // 14
}
\`\`\`

---

## Query Parsing System

### Two-Tier Architecture

#### Tier 1: Regex Parser (Fast & Free)
**File**: `lib/stock-screener/parser.ts`
**Coverage**: ~70% of queries
**Cost**: $0.00

**Key Regex Patterns**:
| Query Example | Matches |
|---------------|---------|
| "RSI above 70" | Category 1: Indicator Threshold |
| "EMA 20 crossed above SMA 50" | Category 2: MA Crossover |
| "up 15% from 52w low" | Category 4: Reference Change |
| "ATR above 3%" | Category 5: Volatility |
| "bullish engulfing" | Category 6: Chart Pattern |
| "BB breakout up" | Category 7: Breakout |
| "weekly return above 5%" | Category 10: Time-based |

#### Tier 2: LLM Parser (Intelligent Fallback)
**File**: `app/api/parse-query/route.ts`
**Coverage**: ~30% of queries
**Cost**: Free (using free-tier models)

**Free Model Cascade**:
1. x-ai/grok-4-fast:free
2. z-ai/glm-4.5-air:free
3. deepseek/deepseek-chat-v3.1:free
4. meta-llama/llama-4-maverick:free
5. google/gemini-2.0-flash-exp:free
6. mistralai/mistral-small-3.2-24b-instruct:free
7. qwen/qwen3-coder:free
8. moonshotai/kimi-k2:free

**Logic**: Try each model sequentially. Stop when first model returns `confidence: 'high'`. If all models return low/medium confidence, return category 11 (parse failure).

### Category System (1-11)

| Category | Type | Examples |
|----------|------|----------|
| 1 | Indicator Threshold | RSI > 70, CCI < -100, Stochastic 20-80 |
| 2 | Price vs MA | Crossed above EMA 20, within 2% of SMA 50 |
| 3 | Relative Strength | RS vs SPY > 1.5 |
| 4 | % from Reference | Up 15% from 52w low |
| 5 | Volume/Volatility | ATR > 3%, volume spike 2x |
| 6 | Chart Patterns | Doji, hammer, engulfing |
| 7 | Breakouts | BB breakout, Donchian breakout |
| 8 | Composite (future) | RSI > 70 AND volume spike |
| 9 | Special Screeners | Base breakout, turtle signal |
| 10 | Time-based | Weekly return > 5%, YTD > 20% |
| 11 | Parse Failure | Couldn't understand query |

---

## Technical Indicators Engine

### Implementation
**File**: `lib/stock-screener/indicators.ts`
**Library**: `technicalindicators` npm package

### Supported Indicators (28+)

#### Momentum Indicators
- **RSI** (Relative Strength Index) - Default: 14 period
- **Stochastic** - %K and %D lines
- **Stochastic RSI** - Stochastic of RSI
- **CCI** (Commodity Channel Index) - Default: 20 period
- **Williams %R** - Default: 14 period
- **ROC** (Rate of Change) - Default: 12 period
- **CMO** (Chande Momentum Oscillator) - Default: 14
- **Awesome Oscillator** - 5/34 period
- **MFI** (Money Flow Index) - Default: 14

#### Moving Averages
- **SMA** (Simple Moving Average)
- **EMA** (Exponential Moving Average)
- **WMA** (Weighted Moving Average)
- **DEMA** (Double Exponential MA)
- **TEMA** (Triple Exponential MA)

#### Volatility Indicators
- **ATR** (Average True Range) - Default: 14
- **Bollinger Bands** - Default: 20 period, 2 std dev
- **Keltner Channels** - Default: 20 period, 2 multiplier

#### Chart Patterns
- Bullish/Bearish Engulfing
- Doji
- Hammer
- Inside Bar
- Outside Bar
- NR7 (Narrowest Range in 7 days)

#### Other Indicators
- **MACD** (Moving Average Convergence Divergence)
- **ADX** (Average Directional Index)
- **PPO** (Percentage Price Oscillator)
- **Volume SMA**
- **Percentage Change from Reference** (1d, 1w, 1m, 52w low/high)

### Calculation Example

\`\`\`typescript
// Calculate RSI for a stock
const rsiValues = calculateRSI(stockData, 14);
const latestRSI = rsiValues[rsiValues.length - 1];

// Compare against threshold
if (latestRSI > 70) {
  // Stock passes the filter
}
\`\`\`

### Execution Logic
**File**: `lib/stock-screener/executor.ts`

\`\`\`typescript
export function screenStocks(
  data: StockData[], 
  filter: ParsedFilter
): FilteredStock[] {
  // 1. Group by symbol
  const grouped = groupBySymbol(data);
  
  // 2. For each symbol
  for (const [symbol, symbolData] of grouped) {
    // Skip if insufficient data (need 50+ points)
    if (symbolData.length < 50) continue;
    
    // 3. Calculate indicator
    const result = applyConditionToGroup(symbolData, condition);
    
    // 4. Check if passes
    if (result.pass) {
      results.push({
        ...symbolData[symbolData.length - 1],
        indicator_value: result.value,
        indicator_name: result.indicator
      });
    }
  }
  
  return results;
}
\`\`\`

---

## Database Schema

### Core Tables

#### 1. user_profiles

#### 2. usage_tracking

#### 3. llm_usage (Critical for Analytics)

### Analytics Queries

\`\`\`sql
-- Failed queries for regex improvement
SELECT 
FROM llm_usage
WHERE success = false
ORDER BY created_at DESC
LIMIT 20;

-- Model performance
SELECT 
  model_used,
  COUNT(*) as times_used,
  COUNT(*) FILTER (WHERE success = true) as successful,
  AVG(attempt_count) as avg_position
FROM llm_usage
WHERE model_used IS NOT NULL
GROUP BY model_used;

-- Daily trends
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_queries,
  COUNT(DISTINCT user_id) as unique_users
FROM llm_usage
GROUP BY DATE(created_at);
\`\`\`

---

## OpenRouter API Integration

### Configuration

**Environment Variables**:
\`\`\`bash
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
\`\`\`

### API Request

\`\`\`typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${process.env.OPENROUTER_API_KEY}\`,
    'X-Title': 'Stock Screener AI'
  },
  body: JSON.stringify({
    model: 'x-ai/grok-4-fast:free',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userQuery }
    ],
    temperature: 0.0,
    max_tokens: 500
  })
});
\`\`\`

### System Prompt (Excerpt)

\`\`\`
You are a financial-screening compiler.
Convert natural-language queries into strict JSON matching this schema:

CATEGORIES:
[1] Indicator Threshold (RSI, CCI, Stochastic, etc.)
[2] Price vs Moving Averages (EMA, SMA crossovers)
[3] Relative Strength vs Index
[4] Percent Change from Reference (52w low/high)
[5] Volume/Volatility (ATR, BB width, volume spike)
[6] Chart Patterns (doji, engulfing, hammer)
[7] Breakouts (BB, Donchian, pivot)
[8] Composite Conditions (AND/OR)
[9] Special Screeners (base breakout, turtle signal)
[10] Time-Based (weekly return, YTD)
[11] Fallback (could not parse)

RULES:
- Output ONLY valid JSON
- Percentages as decimals: 5% → 0.05
- Return confidence: 'high', 'medium', or 'low'
- If ambiguous → category 11 + llmFallback explanation
\`\`\`

### Cost Analysis

**With Free Models**:
- Cost per query: $0.00
- Rate limits apply (varies by model)
- 8 fallback models available

**If Using Paid Models** (future):
- Avg 600 tokens/query
- Claude 3.5 Sonnet: $0.0024/query
- 1000 users × 10 queries/month × 30% LLM = 3000 queries
- Monthly cost: $7.20
- Revenue at $29/month × 1000 = $29,000
- **LLM cost: 0.025% of revenue**

---

## Issues Encountered & Solutions

### Issue 1: API Key Management
**Problem**: Users had to configure OpenRouter API keys  
**Solution**: Moved to server-side environment variable  

### Issue 2: LLM Response Storage

### Issue 3: Data Loading Performance
**Problem**: 2-3 second CSV fetch on every query  
**Solution**: 24-hour sessionStorage caching  

### Issue 4: Category 11 Error Messages
**Problem**: Cryptic parse failure messages  
**Solution**: Enhanced LLM prompt to return helpful `llmFallback` text  

### Issue 5: Insufficient Data Points
**Problem**: Stocks with <50 points crashed indicators  
**Solution**: Skip stocks with insufficient data  

---

## Google Sheets Data Integration

### Configuration

**Google Sheets ID**: `1Abo2NBSA5WavSfQSSo4LTBb9IwcNmGAXgqt42wpJGXo`  
**Access**: Public (no authentication required)  
**Format**: CSV export

### Expected Sheet Structure

| symbol | date | open | high | low | close | volume |
|--------|------|------|------|-----|-------|--------|
| AAPL | 2024-01-01 | 185.50 | 188.20 | 184.90 | 187.50 | 45000000 |
| AAPL | 2024-01-02 | 187.50 | 190.30 | 187.00 | 189.80 | 52000000 |

### Data Loading Process

\`\`\`typescript
// 1. Check cache (24hr TTL)
const cached = getCachedData();
if (cached) return cached;

// 2. Fetch CSV from Google Sheets
const csvUrl = \`https://docs.google.com/spreadsheets/d/\${SHEET_ID}/export?format=csv\`;
const response = await fetch(csvUrl);
const csvText = await response.text();

// 3. Parse CSV
const data = parseCSV(csvText);

// 4. Cache in sessionStorage
setCachedData(data);

return data;
\`\`\`

### Caching Strategy

**Storage**: Browser sessionStorage  
**Duration**: 24 hours (86,400,000 ms)  
**Keys**:
- `stock_screener_data` - JSON array of StockData
- `stock_screener_data_timestamp` - Unix timestamp

**Benefits**:
- Instant subsequent queries
- Reduced bandwidth
- Lower server load
- Better UX

### Data Requirements

**Minimum**:
- 50+ data points per symbol (for indicator calculations)
- OHLCV columns present
- Valid dates in YYYY-MM-DD format

**Recommended**:
- 200+ data points (for 200-day MA)
- Daily frequency
- Multiple symbols (10+)
- Recent data (within 30 days)

## Future Enhancements

### 1. Composite Conditions (Category 8)
Support queries like "RSI above 70 AND volume spike 2x"

### 2. Query Caching
Cache parsed queries in database to reduce LLM costs by 50%

### 3. Admin Analytics Dashboard
Dashboard showing:
- Query volume trends
- Model performance
- Cost analysis
- Failed queries for regex improvement

### 4. Saved Screens & Alerts
Allow users to:
- Save frequently used screens
- Set alerts when stocks match criteria
- Email/push notifications

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `app/products/stock-screener/page.tsx` | Main UI component |
| `app/api/parse-query/route.ts` | LLM API endpoint |
| `lib/stock-screener/parser.ts` | Query parsing (regex + LLM) |
| `lib/stock-screener/executor.ts` | Stock filtering logic |
| `lib/stock-screener/indicators.ts` | Technical calculations |
| `lib/stock-screener/google-sheets.ts` | Data loading & caching |
| `lib/stock-screener/types.ts` | TypeScript interfaces |
| `hooks/use-stock-data.ts` | Data loading hook |
| `lib/hooks/use-usage-tracking.ts` | Analytics tracking |

---

## Conclusion

This Stock Screener AI product represents a production-ready, cost-effective solution for natural language stock screening. The two-tier parsing architecture (Regex + LLM) achieves 70% cost savings while maintaining high accuracy. The system is designed to scale efficiently and provides comprehensive analytics for continuous improvement.

**Key Achievements**:
- Zero-configuration user experience
- 28+ technical indicators
- Cost-optimized AI parsing
- Real-time indicator calculations
- Comprehensive usage tracking
- Production-ready codebase

---
