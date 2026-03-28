"""
美國 ETF 跌幅排行
從 TradingView Scanner API 獲取當日跌幅最大的非槓桿 ETF

實作說明：
  TradingView Scanner 的 typespecs 欄位對所有 ETF（含槓桿、反向）皆只回傳 ["etf"]，
  無法在 server-side 過濾槓桿型 ETF。
  解法：多抓 100 筆，在 client-side 用 regex 比對 description 排除槓桿/反向 ETF，
  再取跌幅最大的前 10 名。

詳見：docs/us_etf_losers.md
"""

import re
import logging
import requests
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

TRADINGVIEW_SCANNER_URL = "https://scanner.tradingview.com/america/scan"

HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://www.tradingview.com",
    "Referer": "https://www.tradingview.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}

PAYLOAD = {
    "filter": [
        {"left": "typespecs", "operation": "has", "right": ["etf"]},
        {"left": "exchange", "operation": "in_range", "right": ["AMEX", "NASDAQ", "NYSE"]},
    ],
    "columns": ["name", "description", "close", "change"],
    "sort": {"sortBy": "change", "sortOrder": "asc"},
    # 多抓 100 筆，因為跌幅榜前段約 70% 是槓桿/反向 ETF
    "range": [0, 100],
}

# 槓桿/反向 ETF 關鍵字 regex（大小寫不分）
# - leveraged?  : Leveraged / Leverage
# - ultra       : UltraShort / UltraPro（不加字元邊界，捕捉子字串）
# - inverse     : Inverse
# - short\s     : "Short " + 空白，避免誤判 Short-Duration 債券 ETF
# - [23]x\b     : 2x / 3x（加字元邊界）
# - direx       : Direxion（主要槓桿 ETF 發行商）
# - velocit     : Velocity Shares
# - proshares.*ultra : ProShares 的 Ultra 系列
_LEVERAGED_PATTERN = re.compile(
    r"(?i)(leveraged?|ultra|inverse|short\s|[23]x\b|direx|velocit)"
)


def _is_leveraged(description: str) -> bool:
    return bool(_LEVERAGED_PATTERN.search(description))


def get_top3_us_etf_losers() -> List[Dict[str, Any]]:
    """
    從 TradingView Scanner API 獲取跌幅最大的前 10 個非槓桿美國 ETF

    Returns:
        包含 symbol, name, price, change_percent 的列表（最多 10 筆）
    """
    try:
        response = requests.post(
            TRADINGVIEW_SCANNER_URL,
            json=PAYLOAD,
            headers=HEADERS,
            timeout=10,
        )
        response.raise_for_status()

        data = response.json()
        results = []

        for item in data.get("data", []):
            # d = [name, description, close, change]
            d = item.get("d", [])
            if len(d) < 4:
                continue

            symbol, name, price, change_pct = d[0], d[1], d[2], d[3]

            if change_pct is None:
                continue

            # 排除槓桿 / 反向 ETF
            if _is_leveraged(name) or _is_leveraged(str(name)):
                logger.debug(f"Skipping leveraged ETF: {symbol} ({name})")
                continue

            results.append({
                "code": symbol,
                "symbol": symbol,
                "name": name,
                "price": float(price) if price is not None else None,
                "change_percent": float(round(change_pct, 2)),
            })

            if len(results) >= 10:
                break

        logger.info(f"Found {len(results)} non-leveraged US ETF losers from TradingView")
        return results

    except Exception as e:
        logger.error(f"Error getting US ETF losers from TradingView: {e}")
        return []
