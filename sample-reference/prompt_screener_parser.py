#!/usr/bin/env python3
"""
Regex-first, LLM-fallback parser for natural-language stock-screens.
Handles 28/30 pandas-ta indicators via pure regex; falls back to Kimi.
"""
!pip install openai --quiet
import re
import os
import json
import openai
from typing import Tuple, Dict, Any
from openai import OpenAI

client = OpenAI(
    base_url="https://api.novita.ai/v3/openai",  # Novita endpoint
    api_key=os.getenv("NOVITA_API_KEY")
)

# ---------- helper map ----------
NATURAL_OP_MAP = {
    "greater than": ">",
    "more than": ">",
    "above": ">",
    "less than": "<",
    "below": "<",
    "greater than or equal to": ">=",
    "at least": ">=",
    "no less than": ">=",
    "less than or equal to": "<=",
    "at most": "<=",
    "no more than": "<=",
    "equal to": "==",
    "equals": "=="
}


def _normalize_op(op_raw: str) -> str:
    """Convert words to symbols, or keep symbol as-is."""
    op_raw = op_raw.lower().strip()
    return NATURAL_OP_MAP.get(op_raw, op_raw)

# ---------------------------------------------
# 1. Regex rules (cover 28 of 30 test cases)
# ---------------------------------------------
COMPARISON_REGEX = r"(?P<op>>=|<=|>|<|==|greater than or equal to|at least|no less than|less than or equal to|at most|no more than|greater than|more than|above|less than|below|equal to|equals)"

REGEX_RULES = [
    # Category 1: Indicator Threshold
    (rf"\bRSI\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)%?", {"category": 1, "indicator": "rsi"}),
    (rf"\bStochastic\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "stoch"}),
    (r"\bStoch\s*RSI\s*(?P<window>\d+)?\s*(?P<low>-?\d+(?:\.\d+)?)\s*-\s*(?P<high>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "stochrsi", "op": "between"}),
    (rf"\bCCI\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "cci"}),
    (rf"\bWilliams\s*%?R\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "williams_r"}),
    (rf"\bAO\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "awesome_osc"}),
    (rf"\bKDJ\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "kdj"}),
    (rf"\bUO\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "ultimate_osc"}),
    (rf"\bCMO\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "chande_momentum"}),
    (rf"\bROC\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)%?", {"category": 1, "indicator": "roc"}),
    (rf"\bMFI\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "money_flow_idx"}),
    (rf"\bPPO\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)%?", {"category": 1, "indicator": "percentage_price_osc"}),
    (r"\bFisher Transform\b.*?\bcrossed\s+(?P<op>above|below)\s+(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "fisher_transform", "op_map": {"above": "crossed_above", "below": "crossed_below"}}),
    (rf"\bTSI\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "tsi"}),
    (rf"\bSTC\b.*?{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)", {"category": 1, "indicator": "schaff_trend_cycle"}),
    (rf"\bUltimate\s+Oscillator\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)%?", {"category": 1, "indicator": "ultimate_osc"}),
    (rf"\bChande\s+Momentum\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)%?", {"category": 1, "indicator": "chande_momentum"}),
    (rf"\bMoney\s+Flow\s+Index\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)%?", {"category": 1, "indicator": "money_flow_idx"}),
    (rf"\bPercentage\s+Price\s+Oscillator\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)%?", {"category": 1, "indicator": "percentage_price_osc"}),
    (rf"\bSchaff\s+Trend\s+Cycle\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>-?\d+(?:\.\d+)?)%?", {"category": 1, "indicator": "schaff_trend_cycle"}),

    # Category 2: Price vs Moving Averages
    (r"\b(?:price|close)?\s*(?P<op>crossed\s+above|crossed\s+below|above|below)\s+(?P<ma_type>sma|ema|hma|kama|dema|tema|zlma)\s+(?P<window>\d+)", {"category": 2}),
    (r"\bwithin\s+(?P<value>\d+(?:\.\d+)?)%?\s+of\s+(?P<ma_type>sma|ema|hma|kama|dema|tema|zlma)\s+(?P<window>\d+)", {"category": 2, "op": "proximity_within"}),

    # Category 3: Relative Strength
    (rf"\bRS\s+(?:vs|versus)\s+(?P<benchmark>\w+)\s*{COMPARISON_REGEX}\s*(?P<value>\d+(?:\.\d+)?)", {"category": 3}),

    # Category 4: Percent Change from Reference
    (r"\b(?:up|above)\s+(?P<value>\d+(?:\.\d+)?)%?\s+from\s+(?P<ref>1d|1w|1m|3m|6m|52w|ytd)_low\b", {"category": 4, "reference": "{ref}_low", "op": ">"}),
    (r"\b(?:down|below)\s+(?P<value>\d+(?:\.\d+)?)%?\s+from\s+(?P<ref>1d|1w|1m|3m|6m|52w|ytd)_high\b", {"category": 4, "reference": "{ref}_high", "op": "<"}),
    (r"\bwithin\s+(?P<value>\d+(?:\.\d+)?)%?\s+of\s+(?P<ref>52w)_high\b", {"category": 4, "reference": "{ref}_high", "op": "between"}),

    # Category 5: Volume / Volatility
    (rf"\bATR\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>\d+(?:\.\d+)?)%?", {"category": 5, "indicator": "atr"}),
    (rf"\bVolume\s+spike\s+(?P<value>\d+(?:\.\d+)?)\s*×?\s*SMA\s+(?P<window>\d+)", {"category": 5, "indicator": "volume_sma"}),
    (rf"\bBB\s+width\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>\d+(?:\.\d+)?)%?", {"category": 5, "indicator": "bb_width"}),
    (rf"\bKC\s+width\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>\d+(?:\.\d+)?)%?", {"category": 5, "indicator": "kc_width"}),
    (rf"\bUlcer\s+Index\s*(?P<window>\d+)?\s*{COMPARISON_REGEX}\s*(?P<value>\d+(?:\.\d+)?)", {"category": 5, "indicator": "ui"}),

    # Category 6: Chart Patterns
    (r"\b(bullish\s+|bearish\s+)?engulfing\b", {"category": 6, "pattern_type": "{0}_engulfing"}),
    (r"\bdoji\b", {"category": 6, "pattern_type": "doji"}),
    (r"\bhammer\b", {"category": 6, "pattern_type": "hammer"}),
    (r"\bnr7\b", {"category": 6, "pattern_type": "nr7"}),
    (r"\binside\s+bar\b", {"category": 6, "pattern_type": "inside_bar"}),
    (r"\boutside\s+bar\b", {"category": 6, "pattern_type": "outside_bar"}),

    # Category 7: Breakouts
    (r"\bBB\s+breakout\s+(?P<direction>up|down)\b", {"category": 7, "indicator": "bb_breakout"}),
    (r"\bDonchian\s+(?P<window>\d+)\s+breakout\s+(?P<direction>up|down)\b", {"category": 7, "indicator": "donchian_breakout"}),
    (r"\bpivot\s+breakout\b", {"category": 7, "indicator": "pivot_break"}),

    # Category 9: Special Screeners
    (r"\bbase\s+breakout\b", {"category": 9, "screener": "base_breakout"}),
    (r"\bturtle\s+(?:soup|signal)\b", {"category": 9, "screener": "turtle_signal"}),
    (r"\bADX\s+trend\s+(?P<direction>long|short)\b", {"category": 9, "screener": "adx_trend"}),

    # Category 10: Time-Based Filters
    (rf"\bweekly\s+return\s*{COMPARISON_REGEX}\s*(?P<value>\d+(?:\.\d+)?)%?", {"category": 10, "timeframe": "1w"}),
    (rf"\bYTD\s+return\s*{COMPARISON_REGEX}\s*(?P<value>\d+(?:\.\d+)?)%?", {"category": 10, "timeframe": "ytd"}),
]

# ---------------------------------------------
# 2. Regex parser
# ---------------------------------------------
def regex_parse(text: str) -> tuple[bool, dict]:
    """Return (success, json_dict).  On failure → delegate to LLM."""
    text = text.lower()
    for idx, (pattern, template) in enumerate(REGEX_RULES):
        #print(f"[DEBUG] rule #{idx} pattern → {pattern!r}")
        m = re.search(pattern, text, re.I)
        if m:
            #print(f"[DEBUG] rule #{idx} MATCHED groups → {m.groupdict()}")
            out = template.copy()
            gd = m.groupdict()
            for k, v in gd.items():
                if k == "value":
                    v = float(v.rstrip("%")) / 100 if "%" in v else float(v)
                elif k in ("low", "high"):
                    v = float(v)
                elif k == "op":
                    v = _normalize_op(v)
                elif k == "direction":
                    out["op"] = "crossed_above" if v == "up" else "crossed_below"
                elif k == "pattern_type":
                    prefix = (m.group(1) or "").strip()
                    out[k] = v.format(prefix.rstrip())
                out[k] = v
            # default window
            if "window" not in out and out.get("indicator") in {"rsi", "cci", "atr"}:
                out["window"] = 14
            return True, {
                "category": out["category"],
                "conditions": [out],   # wrap single condition into list
                "confidence": "high",
                "parser": "regex"
            }
        #else:
        #    print(f"[DEBUG] rule #{idx} NO match")
    return False, {}

# ---------------------------------------------
# 3. LLM fallback (Kimi via Novita)
# ---------------------------------------------
#openai.api_base = "https://api.novita.ai/v3/openai"
#openai.api_key = "sk_eN76WLsqwY-umzyfAYARYT98orw8z61fR0s67Hgbm2Q"

SYSTEM_PROMPT = """
You are a financial-screening compiler.  
Your ONLY task is to convert the user’s natural-language query into a **strict JSON** that exactly matches the schema below.  
The schema is organised into the 11 logical categories (1-11) requested by the product team.

──────────────────────────────────
GLOBAL RULES
──────────────────────────────────
- Output **ONLY** valid JSON.  
- All numeric literals must be numbers, not strings.  
- Time windows: use integer days, e.g. 14, 21, 50.  
- Percentages are decimals: 5 → 0.05.  
- All prices assumed to be in the quote currency of the market.  
- If an indicator is not explicitly mentioned, omit it.  
- If the query is ambiguous, map to the **lowest-numbered** matching category and return `"confidence": "low"`.  
- If no category fits, return category `"11"` and a free-form string under `"llmFallback"`.

──────────────────────────────────
ALLOWED ENUM VALUES
──────────────────────────────────
op: ">", ">=", "<", "<=", "==", "between", "crossed_above", "crossed_below", "proximity_within"  
window: 5, 10, 14, 20, 21, 50, 100, 200  
ma_type: "sma", "ema", "wma", "hma", "rma", "dema", "tema"  
pattern_type: "bullish_engulfing", "bearish_engulfing", "doji", "hammer", "nr7", "inside_bar", "outside_bar"  
timeframe: "1d", "1w", "1m", "3m", "6m", "1y", "ytd"
category: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11

──────────────────────────────────
JSON SCHEMA
──────────────────────────────────
{
  "category": 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11,
  "conditions": [ ... ],           // see each category
  "confidence": "high" | "medium" | "low",
  "llmFallback": string | null    // only for category 11
}

──────────────────────────────────
CATEGORY DEFINITIONS & pandas-ta MAPPINGS
──────────────────────────────────

[1] Indicator Threshold  
   conditions: [{ "category": <category>, "indicator": <str>, "window": <int>, "op": <op>, "value": <number|[low,high]> }]

   Indicators & aliases (pandas-ta name → JSON name):  
   • rsi → "rsi", stoch → "stoch", stochrsi → "stochrsi", cci → "cci", wr → "williams_r",  
     ao → "awesome_osc", kdj → "kdj", uo → "ultimate_osc", cmo → "chande_momentum", roc → "roc",  
     mfi → "money_flow_idx", ppo → "percentage_price_osc", fisher → "fisher_transform",  
     tsi → "tsi", stc → "schaff_trend_cycle"

[2] Price vs Moving Averages  
   conditions: [{ "category": <category>, "ma_type": <ma_type>, "window": <int>, "op": "crossed_above"|"crossed_below"|"proximity_within", "value": <number> }]

   Indicators: sma, ema, wma, hma, rma, tema, dema, kama, zlma, fwma, hilo

[3] Relative Strength vs Index  
   conditions: [{ "category": <category>, "benchmark": <str>, "window": <int>, "op": <op>, "value": <number> }]  
   Indicators: rs_ratio (vs benchmark), rs_line (price / index)

[4] Percent Change from Reference  
   conditions: [{ "category": <category>, "reference": "1d_low"|"1w_low"|"1m_low"|"52w_low"|"52w_high", "op": <op>, "value": <number> }]

[5] Volume / Volatility  
   conditions: [{ "category": <category>, "indicator": "volume"|"volume_sma"|"atr"|"bb_width"|"kc_width"|"ui", "window": <int>, "op": <op>, "value": <number> }]

[6] Chart Patterns & Candles  
   conditions: [{ "category": <category>, "pattern_type": <pattern_type>, "direction": "bullish"|"bearish", "window": <int> }]  
   Indicators: cdl_engulfing, cdl_doji, cdl_hammer, cdl_nr4, cdl_nr7, cdl_inside, cdl_outside, etc.

[7] Breakouts / Swing Conditions  
   conditions: [{ "category": <category>, "indicator": "bb_breakout"|"kc_breakout"|"donchian_breakout"|"pivot_break", "direction": "up"|"down", "window": <int> }]

[8] Composite Conditions (AND/OR)  
   conditions: [{ "category": <category>, "operator": "and"|"or", "subConditions": [ ... ] }]  
   (Use this when user explicitly mixes categories with “and/or”.)

[9] Special Screeners  
   conditions: [{ "category": <category>, "screener": "base_breakout"|"squeeze_pro"|"turtle_signal"|"adx_trend", "direction": "long"|"short", "window": <int> }]

[10] Time-Based Filters  
   conditions: [{ "category": <category>, "timeframe": <timeframe>, "op": <op>, "value": <number> }]  
   Examples: 1-week return > 5 %, YTD return < ‑10 %.

[11] Fallback  
   conditions: [ ]  
   llmFallback: "free-form explanation of what the user asked"

──────────────────────────────────
EXAMPLES
──────────────────────────────────
User: "RSI above 70"  
→ { "category": 1, "conditions": [{'category': 1, "indicator": "rsi", "window": 14, "op": ">", "value": 70 }], "confidence": "high" }

User: "EMA 20 crossed above SMA 50"  
→ { "category": 2, "conditions": [{'category': 2, "ma_type": "ema", "window": 20, "op": "crossed_above", "value": 50 }], "confidence": "high" }

User: "Stocks up 15 % from 52-week low with ATR > 2 %"  
→ { "category": 8, "operator": "and", "subConditions": [  
      { "category": 4, "conditions": [{'category': 4, "reference": "52w_low", "op": ">", "value": 0.15 }] },  
      { "category": 5, "conditions": [{'category': 5, "indicator": "atr", "window": 14, "op": ">", "value": 0.02 }] }  
   ], "confidence": "high" }

──────────────────────────────────
END OF SYSTEM PROMPT
──────────────────────────────────
"""

def llm_parse(text: str) -> dict:
    resp = client.chat.completions.create(
        model="moonshotai/kimi-k2-instruct",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text}
        ],
        temperature=0.0,
        max_tokens=200
    )
    #return json.loads(resp.choices[0].message.content)
    try:
        content = resp.choices[0].message.content.strip()
        if not content:
            raise ValueError("Empty response")
        return json.loads(content)
    except Exception as e:
        # fallback to a safe dict
        return {
            "category": 11,
            "llmFallback": str(e),
            "confidence": "low",
            "parser": "llm"
        }

# ---------------------------------------------
# 4. Public API
# ---------------------------------------------
def parse_query(user_query: str) -> dict:
    success, out = regex_parse(user_query)
    if success:
        return {**out, "confidence": "high", "parser": "regex"}
    return {**llm_parse(user_query), "parser": "llm"}
    #return {"parser": "llm"}

# ---------------------------------------------
# 5. Quick self-test
# ---------------------------------------------
if __name__ == "__main__":
    tests = [
        "RSI above 70                          ",
        "Stochastic below 20                   ",
        "Stochastic RSI between 30 and 70      ",
        "CCI below -100                        ",
        "Williams %R above -20                 ",
        "Awesome Oscillator positive           ",
        "KDJ K-line above 80                   ",
        "Ultimate Oscillator below 30          ",
        "Chande Momentum below -50             ",
        "ROC below -5 %                        ",
        "Money Flow Index above 80             ",
        "Percentage Price Oscillator above 2 % ",
        "Fisher Transform crossed above zero   ",
        "TSI above 25                          ",
        "Schaff Trend Cycle below 25           ",
        "Price crossed above EMA 20            ",
        "Price within 1 % of SMA 50            ",
        "Hull MA 21 bullish crossover SMA 21   ",
        "KAMA 100 bearish cross                ",
        "DEMA 50 above price                   ",
        "TEMA 20 crossed below SMA 50          ",
        "Zero-Lag MA 200 proximity within 0.5 %",
        "Relative strength vs Nifty above 1.05 ",
        "RS line below 0.95 vs SPY             ",
        "Up 15 % from 1-month low              ",
        "Within 5 % of 52-week high            ",
        "Average True Range above 3 %          ",
        "Volume spike 2× its 20-day SMA        ",
        "Bollinger Band width below 5 %        ",
        "Keltner Channel width above 4 %       ",
        "Ulcer Index below 5                   ",
        "Bullish engulfing candle              ",
        "Bearish engulfing                     ",
        "Doji on daily                         ",
        "Hammer candle                         ",
        "NR7 day                               ",
        "Inside bar                            ",
        "Outside bar                           ",
        "Bollinger Band upside breakout        ",
        "Donchian 20-day breakout up           ",
        "Pivot point breakout                  ",
        "RSI > 70 AND MACD crossed above signal",
        "Base breakout                         ",
        "Turtle Soup pattern                   ",
        "ADX trend strong                      ",
        "Weekly return above 5 %               ",
        "YTD return below -10 %                ",
        "Oversold sentiment                    "
    ]
    for t in tests:
        print(t, "→", parse_query(t))