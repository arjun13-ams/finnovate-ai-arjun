#!pip install pandas-ta
#!pip install numpy==1.26.4

import pandas as pd
import pandas_ta as ta
from typing import Dict, Any

def apply_condition(df: pd.DataFrame, cond: dict) -> pd.Series:
    """
    Return a boolean Series indicating rows that satisfy `cond`.
    `cond` comes directly from parser JSON (one element inside `conditions`).
    """
    category = cond["category"]

    # ---------- 1.  Indicator Threshold ----------
    if category == 1:
        ind = cond["indicator"]
        win = cond.get("window", 14)
        op  = cond["op"]
        val = cond["value"]

        # numeric indicators
        series_map = {
            #"rsi":            lambda: ta.rsi(df.close, length=win),
            "rsi": lambda: df.groupby('symbol', group_keys=False).apply(
                lambda g: ta.rsi(g['close'], length=win)
            ),
            "stoch":          lambda: ta.stoch(df.high, df.low, df.close, length=win)[f"STOCHk_{win}_3_3"],
            "stochrsi":       lambda: ta.stochrsi(df.close, length=win)[f"STOCHRSIk_{win}_14_14_3_3"],
            "cci":            lambda: ta.cci(df.high, df.low, df.close, length=win),
            "williams_r":     lambda: ta.willr(df.high, df.low, df.close, length=win),
            "awesome_osc":    lambda: ta.ao(df.high, df.low),
            "kdj":            lambda: ta.kdj(df.high, df.low, df.close, length=win)[f"K_{win}_3"],
            "ultimate_osc":   lambda: ta.uo(df.high, df.low, df.close),
            "chande_momentum":lambda: ta.cmo(df.close, length=win),
            "roc":            lambda: ta.roc(df.close, length=win) / 100,
            "money_flow_idx": lambda: ta.mfi(df.high, df.low, df.close, df.volume, length=win),
            "percentage_price_osc": lambda: ta.ppo(df.close)[f"PPO_{win}_26_12_9"],
            "fisher_transform": lambda: ta.fisher(df.high, df.low)[f"FISHERT_{win}_1"],
            "tsi":            lambda: ta.tsi(df.close)[f"TSI_{win}_25_13_13"],
            #"schaff_trend_cycle": lambda: ta.stc(df.close)[f"STC{win}"],
            "schaff_trend_cycle": lambda: ta.stc(df.close).iloc[:, 0],
        }
        series = series_map[ind]()
        return _compare(series, op, val)

    # ---------- 2.  Price vs Moving Averages ----------
    elif category == 2:
        ma_type = cond["ma_type"]
        win = cond["window"]
        op  = cond["op"]
        val = cond.get("value", win)  # crossover value or proximity

        ma_series = getattr(ta, ma_type)(df.close, length=win)
        price = df.close

        if op == "crossed_above":
            return (price.shift(1) <= ma_series.shift(1)) & (price > ma_series)
        elif op == "crossed_below":
            return (price.shift(1) >= ma_series.shift(1)) & (price < ma_series)
        elif op == "proximity_within":
            pct = val
            return (price - ma_series).abs() / ma_series <= pct
        else:
            return _compare(price, op, val)

    # ---------- 3.  Relative Strength vs Index ----------
    elif category == 3:
        # `benchmark` must be a column in df or df itself
        benchmark = cond["benchmark"]
        win = cond.get("window", 60)
        op  = cond["op"]
        val = cond["value"]

        rs = df.close / (df[benchmark] if benchmark in df else benchmark)
        rs = rs.rolling(win).mean()
        return _compare(rs, op, val)

    # ---------- 4.  Percent Change from Reference ----------
    elif category == 4:
        ref = cond["reference"]
        op  = cond["op"]
        val = cond["value"]

        ref_map = {
            "1d_low":  lambda: df.close.rolling(1).min(),
            "1w_low":  lambda: df.close.rolling(5).min(),
            "1m_low":  lambda: df.close.rolling(21).min(),
            "52w_low": lambda: df.close.rolling(252).min(),
            "52w_high":lambda: df.close.rolling(252).max(),
        }
        ref_series = ref_map[ref]()
        pct_change = (df.close - ref_series) / ref_series
        return _compare(pct_change, op, val)

    # ---------- 5.  Volume / Volatility ----------
    elif category == 5:
        ind = cond["indicator"]
        win = cond.get("window", 14)
        op  = cond["op"]
        val = cond["value"]

        series_map = {
            "volume":     lambda: df.volume,
            "volume_sma": lambda: df.volume / df.volume.rolling(win).mean(),
            "atr":        lambda: ta.atr(df.high, df.low, df.close, length=win) / df.close,
            "bb_width":   lambda: ta.bbands(df.close, length=win)[f"BBB_{win}_2.0"],
            "kc_width":   lambda: ta.kc(df.high, df.low, df.close, length=win)[f"KCBU_{win}_2_20"] - ta.kc(df.high, df.low, df.close, length=win)[f"KCBL_{win}_2_20"],
            "ui":         lambda: ta.ui(df.close, length=win),
        }
        series = series_map[ind]()
        return _compare(series, op, val)

    # ---------- 6.  Chart Patterns ----------
    elif category == 6:
        pattern = cond["pattern_type"]
        direction = cond["direction"]
        window = cond.get("window", 1)

        pat_map = {
            "bullish_engulfing": lambda: ta.cdl_pattern(name="engulfing", open_=df.open, high=df.high, low=df.low, close=df.close)[f"CDLENGULFING"],
            "bearish_engulfing": lambda: ta.cdl_pattern(name="engulfing", open_=df.open, high=df.high, low=df.low, close=df.close)[f"CDLENGULFING"],
            "doji":      lambda: ta.cdl_pattern(name="doji", open_=df.open, high=df.high, low=df.low, close=df.close)[f"CDLDOJI"],
            "hammer":    lambda: ta.cdl_pattern(name="hammer", open_=df.open, high=df.high, low=df.low, close=df.close)[f"CDLHAMMER"],
            "nr7":       lambda: ta.cdl_pattern(name="nr7", open_=df.open, high=df.high, low=df.low, close=df.close)[f"CDLNR7"],
            "inside_bar":lambda: ta.cdl_pattern(name="inside", open_=df.open, high=df.high, low=df.low, close=df.close)[f"CDLINSIDE"],
            "outside_bar":lambda: ta.cdl_pattern(name="outside", open_=df.open, high=df.high, low=df.low, close=df.close)[f"CDLOUTSIDE"],
        }
        series = pat_map[pattern]()
        if direction == "bullish":
            return series == 100
        elif direction == "bearish":
            return series == -100
        else:
            return series != 0

    # ---------- 7.  Breakouts ----------
    elif category == 7:
        ind = cond["indicator"]
        direction = cond["direction"]
        win = cond.get("window", 14)

        break_map = {
            "bb_breakout": lambda: (df.close > ta.bbands(df.close, length=win)[f"BBU_{win}_2.0"]) if direction == "up" else (df.close < ta.bbands(df.close, length=win)[f"BBL_{win}_2.0"]),
            "kc_breakout": lambda: (df.close > ta.kc(df.high, df.low, df.close, length=win)[f"KCBU_{win}_2_20"]) if direction == "up" else (df.close < ta.kc(df.high, df.low, df.close, length=win)[f"KCBL_{win}_2_20"]),
            "donchian_breakout": lambda: (df.close == df.close.rolling(win).max()) if direction == "up" else (df.close == df.close.rolling(win).min()),
            "pivot_break": lambda: df.close.shift(1) < df.ta.pivots().pivot_high.shift(1) if direction == "up" else df.close.shift(1) > df.ta.pivots().pivot_low.shift(1),
        }
        return break_map[ind]()

    # ---------- 9.  Special Screeners ----------
    elif category == 9:
        screener = cond["screener"]
        direction = cond["direction"]
        win = cond.get("window", 14)

        if screener == "base_breakout":
            return (df.close.rolling(win).max() == df.close) & (df.close.rolling(win).pct_change() <= 0.03)
        elif screener == "adx_trend":
            adx = ta.adx(df.high, df.low, df.close, length=win)[f"ADX_{win}"]
            return adx > 25
        elif screener == "turtle_signal":
            return df.close == df.close.rolling(win).max()
        else:
            return pd.Series([False] * len(df))

    # ---------- 10.  Time-Based Filters ----------
    elif category == 10:
        tf = cond["timeframe"]
        op = cond["op"]
        val = cond["value"]

        days_map = {"1d": 1, "1w": 5, "1m": 21, "3m": 63, "6m": 126, "1y": 252, "ytd": len(df) - 1}
        days = days_map.get(tf, 21)
        pct = df.close.pct_change(days)
        return _compare(pct, op, val)

    # ---------- 11.  Fallback ----------
    elif category == 11:
        return pd.Series([False] * len(df))

    # Unknown category
    return pd.Series([False] * len(df))


# ---------- tiny helper ----------
def _compare(value, op, val):
    if op == ">":
        return value > val
    elif op == ">=":
        return value >= val
    elif op == "<":
        return value < val
    elif op == "<=":
        return value <= val
    elif op == "==":
        return value == val
    elif op == "between":
        low, high = val
        return low <= value <= high
    else:
        return False

def apply_condition_group(df_group: pd.DataFrame, cond: dict) -> Dict[str, Any]:
    """
    Evaluate ONE condition on ONE symbol and return:
        {
          "pass": bool,
          "value": float,          # actual indicator / metric
          "indicator": str,        # canonical name
          "window": int | None     # optional
        }
    """
    df = df_group.sort_values("date")
    category = cond["category"]

    # ---------- 1.  Indicator Threshold ----------
    if category == 1:
        ind = cond["indicator"]
        win = cond.get("window", 14)
        op = cond["op"]
        val = cond["value"]

        series_map = {
            "rsi":            lambda: ta.rsi(df["close"], length=win).iloc[-1],
            "stoch":          lambda: ta.stoch(df["high"], df["low"], df["close"], length=win)[f"STOCHk_{win}_3_3"].iloc[-1],
            "stochrsi":       lambda: ta.stochrsi(df["close"], length=win)[f"STOCHRSIk_{win}_14_14_3_3"].iloc[-1],
            "cci":            lambda: ta.cci(df["high"], df["low"], df["close"], length=win).iloc[-1],
            "williams_r":     lambda: ta.willr(df["high"], df["low"], df["close"], length=win).iloc[-1],
            "awesome_osc":    lambda: ta.ao(df["high"], df["low"]).iloc[-1],
            "kdj":            lambda: ta.kdj(df["high"], df["low"], df["close"], length=win)[f"K_{win}_3"].iloc[-1],
            "ultimate_osc":   lambda: ta.uo(df["high"], df["low"], df["close"]).iloc[-1],
            "chande_momentum":lambda: ta.cmo(df["close"], length=win).iloc[-1],
            "roc":            lambda: ta.roc(df["close"], length=win).iloc[-1] / 100,
            "money_flow_idx": lambda: ta.mfi(df["high"], df["low"], df["close"], df["volume"], length=win).iloc[-1],
            "percentage_price_osc": lambda: ta.ppo(df["close"])[f"PPO_{win}_26_12_9"].iloc[-1],
            "fisher_transform": lambda: ta.fisher(df["high"], df["low"])[f"FISHERT_{win}_1"].iloc[-1],
            "tsi":            lambda: ta.tsi(df["close"])[f"TSI_{win}_25_13_13"].iloc[-1],
            "schaff_trend_cycle": lambda: ta.stc(df["close"])[f"STC{win}"].iloc[-1],
        }
        latest = series_map[ind]()
        return {
            "pass": _compare(latest, op, val),
            "value": float(latest),
            "indicator": ind,
            "window": win
        }

    # ---------- 2.  Price vs Moving Averages ----------
    elif category == 2:
        ma_type = cond["ma_type"]
        win = int(cond["window"])
        op = cond["op"]
        val = cond.get("value", win)

        ma_series = getattr(ta, ma_type)(df["close"], length=win).iloc[-1]
        price = df["close"].iloc[-1]

        crossed_above = (df["close"].iloc[-2] <= ma_series) and (price > ma_series)
        crossed_below = (df["close"].iloc[-2] >= ma_series) and (price < ma_series)
        proximity = abs(price - ma_series) / ma_series <= val

        if op == "crossed_above":
            return {"pass": crossed_above, "value": price, "indicator": f"{ma_type}_{win}"}
        elif op == "crossed_below":
            return {"pass": crossed_below, "value": price, "indicator": f"{ma_type}_{win}"}
        elif op == "proximity_within":
            return {"pass": proximity, "value": price, "indicator": f"{ma_type}_{win}"}
        else:
            return {"pass": _compare(price, op, val), "value": price, "indicator": f"{ma_type}_{win}"}

    # ---------- 3.  Relative Strength vs Index ----------
    elif category == 3:
        benchmark = cond["benchmark"]
        win = cond.get("window", 60)
        op = cond["op"]
        val = cond["value"]

        rs = (df["close"] / (df[benchmark] if benchmark in df else benchmark)).rolling(win).mean().iloc[-1]
        return {
            "pass": _compare(rs, op, val),
            "value": float(rs),
            "indicator": f"rs_vs_{benchmark}",
            "window": win
        }

    # ---------- 4.  Percent Change from Reference ----------
    elif category == 4:
        ref = cond["reference"]
        op = cond["op"]
        val = cond["value"]

        ref_map = {
            "1d_low":  lambda: df["close"].rolling(1).min().iloc[-1],
            "1w_low":  lambda: df["close"].rolling(5).min().iloc[-1],
            "1m_low":  lambda: df["close"].rolling(21).min().iloc[-1],
            "52w_low": lambda: df["close"].rolling(252).min().iloc[-1],
            "52w_high":lambda: df["close"].rolling(252).max().iloc[-1],
        }
        ref_price = ref_map[ref]()
        pct = (df["close"].iloc[-1] - ref_price) / ref_price
        return {
            "pass": _compare(pct, op, val),
            "value": float(pct),
            "indicator": ref,
            "window": None
        }

    # ---------- 5.  Volume / Volatility ----------
    elif category == 5:
        ind = cond["indicator"]
        win = cond.get("window", 14)
        op = cond["op"]
        val = cond["value"]

        series_map = {
            "volume":     lambda: df["volume"].iloc[-1],
            "volume_sma": lambda: df["volume"].iloc[-1] / df["volume"].rolling(win).mean().iloc[-1],
            "atr":        lambda: ta.atr(df["high"], df["low"], df["close"], length=win).iloc[-1] / df["close"].iloc[-1],
            "bb_width":   lambda: ta.bbands(df["close"], length=win)[f"BBB_{win}_2.0"].iloc[-1],
            "kc_width":   lambda: (ta.kc(df["high"], df["low"], df["close"], length=win)[f"KCBU_{win}_2_20"].iloc[-1] -
                                   ta.kc(df["high"], df["low"], df["close"], length=win)[f"KCBL_{win}_2_20"].iloc[-1]),
            "ui":         lambda: ta.ui(df["close"], length=win).iloc[-1],
        }
        latest = series_map[ind]()
        return {
            "pass": _compare(latest, op, val),
            "value": float(latest),
            "indicator": ind,
            "window": win
        }

    # ---------- 6.  Chart Patterns ----------
    elif category == 6:
        pattern = cond["pattern_type"]
        direction = cond["direction"]

        pat_map = {
            "bullish_engulfing": lambda: ta.cdl_pattern(name="engulfing", open_=df["open"], high=df["high"], low=df["low"], close=df["close"])[f"CDLENGULFING"].iloc[-1],
            "bearish_engulfing": lambda: ta.cdl_pattern(name="engulfing", open_=df["open"], high=df["high"], low=df["low"], close=df["close"])[f"CDLENGULFING"].iloc[-1],
            "doji":      lambda: ta.cdl_pattern(name="doji", open_=df["open"], high=df["high"], low=df["low"], close=df["close"])[f"CDLDOJI"].iloc[-1],
            "hammer":    lambda: ta.cdl_pattern(name="hammer", open_=df["open"], high=df["high"], low=df["low"], close=df["close"])[f"CDLHAMMER"].iloc[-1],
            "nr7":       lambda: ta.cdl_pattern(name="nr7", open_=df["open"], high=df["high"], low=df["low"], close=df["close"])[f"CDLNR7"].iloc[-1],
            "inside_bar":lambda: ta.cdl_pattern(name="inside", open_=df["open"], high=df["high"], low=df["low"], close=df["close"])[f"CDLINSIDE"].iloc[-1],
            "outside_bar":lambda: ta.cdl_pattern(name="outside", open_=df["open"], high=df["high"], low=df["low"], close=df["close"])[f"CDLOUTSIDE"].iloc[-1],
        }
        latest = pat_map[pattern]()
        if direction == "bullish":
            pass_ = latest == 100
        elif direction == "bearish":
            pass_ = latest == -100
        else:
            pass_ = latest != 0
        return {"pass": pass_, "value": int(latest), "indicator": pattern, "window": None}

    # ---------- 7.  Breakouts ----------
    elif category == 7:
        ind = cond["indicator"]
        direction = cond["direction"]
        win = cond.get("window", 14)

        if ind == "bb_breakout":
            bb = ta.bbands(df["close"], length=win)
            bbu = bb[f"BBU_{win}_2.0"].iloc[-1]
            bbl = bb[f"BBL_{win}_2.0"].iloc[-1]
            latest = df["close"].iloc[-1]
            return {"pass": latest > bbu if direction == "up" else latest < bbl,
                    "value": latest, "indicator": "bb_breakout", "window": win}

        elif ind == "kc_breakout":
            kc = ta.kc(df["high"], df["low"], df["close"], length=win)
            kcu = kc[f"KCBU_{win}_2_20"].iloc[-1]
            kcl = kc[f"KCBL_{win}_2_20"].iloc[-1]
            latest = df["close"].iloc[-1]
            return {"pass": latest > kcu if direction == "up" else latest < kcl,
                    "value": latest, "indicator": "kc_breakout", "window": win}

        elif ind == "donchian_breakout":
            latest = df["close"].iloc[-1]
            max_ = df["close"].rolling(win).max().iloc[-1]
            min_ = df["close"].rolling(win).min().iloc[-1]
            return {"pass": latest == max_ if direction == "up" else latest == min_,
                    "value": latest, "indicator": "donchian_breakout", "window": win}

        elif ind == "pivot_break":
            # placeholder – add pivot logic if needed
            return {"pass": False, "value": 0.0, "indicator": "pivot_break", "window": win}

    # ---------- 9.  Special Screeners ----------
    elif category == 9:
        screener = cond["screener"]
        direction = cond["direction"]
        win = cond.get("window", 14)

        if screener == "base_breakout":
            latest = df["close"].iloc[-1]
            max_ = df["close"].rolling(win).max().iloc[-1]
            pct = df["close"].pct_change(win).iloc[-1]
            return {"pass": latest == max_ and pct <= 0.03,
                    "value": pct, "indicator": "base_breakout", "window": win}

        elif screener == "adx_trend":
            adx = ta.adx(df["high"], df["low"], df["close"], length=win)[f"ADX_{win}"].iloc[-1]
            return {"pass": adx > 25,
                    "value": float(adx), "indicator": "adx_trend", "window": win}

        elif screener == "turtle_signal":
            latest = df["close"].iloc[-1]
            max_ = df["close"].rolling(win).max().iloc[-1]
            return {"pass": latest == max_,
                    "value": latest, "indicator": "turtle_signal", "window": win}

    # ---------- 10.  Time-Based Filters ----------
    elif category == 10:
        tf = cond["timeframe"]
        op = cond["op"]
        val = cond["value"]

        days_map = {"1d": 1, "1w": 5, "1m": 21, "3m": 63, "6m": 126, "1y": 252, "ytd": len(df) - 1}
        days = days_map.get(tf, 21)
        pct = df["close"].pct_change(days).iloc[-1]
        return {"pass": _compare(pct, op, val),
                "value": float(pct), "indicator": f"return_{tf}", "window": days}

    # ---------- 11.  Fallback ----------
    elif category == 11:
        return {"pass": False, "value": 0.0, "indicator": "fallback", "window": None}

    return {"pass": False, "value": 0.0, "indicator": "unknown", "window": None}


def screen(df: pd.DataFrame, json_filter: dict) -> pd.DataFrame:
    """
    Screen multi-stock DataFrame and return the **latest** row of each symbol
    that satisfies the JSON filter, **plus** the indicator value/name.
    """
    df = df.sort_values(["symbol", "date"])

    def _screen_group(group):
        if json_filter["category"] == 8:  # composite
            # simplified: use first sub-condition for value
            res = apply_condition_group(group, json_filter["subConditions"][0])
        else:
            res = apply_condition_group(group, json_filter["conditions"][0])

        if res["pass"]:
            row = group.iloc[[-1]].copy()
            row["indicator_value"] = res["value"]
            row["indicator_name"]  = res["indicator"]
            row["window"]          = res.get("window")
            return row
        return pd.DataFrame()

    return df.groupby("symbol", group_keys=False).apply(_screen_group).reset_index(drop=True)   

def safe_print(result: pd.DataFrame):
    if result.empty:
        print("✅ Filtered Result length: 0 (no symbols match)")
    else:
        cols = ["symbol", "date", "close", "indicator_name", "indicator_value"]
        # ensure the columns we added exist
        for c in ["indicator_name", "indicator_value", "window"]:
            if c not in result.columns:
                result[c] = None
        print(result[cols])
        
# df must have OHLCV columns
df = pd.read_csv("ohlcv_last_6_months.csv")  # columns: open, high, low, close, volume
# Print original DataFrame length
print(f"📊 Original DataFrame length: {len(df)}")

parsed = {'category': 1, 'conditions': [{'category': 1, 'indicator': 'rsi', 'window': None, 'op': '>', 'value': 70.0}], 'confidence': 'high', 'parser': 'regex'}
result = screen(df, parsed)
# Print result length
print(f"✅ Filtered Result length: {len(result)}")

safe_print(result)
