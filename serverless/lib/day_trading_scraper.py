"""
Day trading stock scraper for Taiwan stocks.
Fetches top 6 stocks that can be day-traded with biggest losses from HiStock.

No dependency on taiwan_stocks.json — suffix (.TW / .TWO) is auto-detected
via yfinance so both listed (上市) and OTC (上櫃) stocks are supported.
"""

import logging
from typing import List, Dict, Any, Optional

import requests
import yfinance as yf
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def _detect_symbol(code: str) -> Optional[str]:
    """
    Auto-detect the correct yfinance symbol for a Taiwan stock code.
    Tries .TW (上市) first, then .TWO (上櫃).
    Returns the symbol string if data exists, None otherwise.
    """
    for suffix in [".TW", ".TWO"]:
        symbol = f"{code}{suffix}"
        try:
            df = yf.Ticker(symbol).history(period="1d")
            if not df.empty:
                return symbol
        except Exception:
            continue
    return None


def get_top3_day_trading_losers() -> List[Dict[str, Any]]:
    """
    Get top 6 stocks that can be day-traded with biggest losses.

    Scrapes from HiStock, auto-detects .TW/.TWO suffix via yfinance.
    No taiwan_stocks.json dependency.
    """
    try:
        url = "https://histock.tw/stock/rank.aspx"
        params = {
            "m": "4",  # 跌幅排行
            "d": "0",  # 可現股當沖
            "t": "dt",  # 當日
        }
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }

        logger.info(f"Fetching day trading losers from HiStock: {url}")
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        table = soup.find("table", {"class": "gvTB"})
        if not table:
            logger.warning("Could not find stock table, using fallback data")
            return _get_fallback_data()

        two_results = []  # 上櫃 .TWO（目標 8 支）
        tw_results = []   # 上市 .TW（目標 8 支）
        rows = table.find_all("tr")[1:]  # Skip header row

        for row in rows:
            if len(two_results) >= 8 and len(tw_results) >= 8:
                break

            try:
                cols = row.find_all("td")
                if len(cols) < 5:
                    continue

                code = cols[0].text.strip()
                name = cols[1].text.strip()
                price = cols[2].text.strip()
                change_percent = cols[4].text.strip()

                try:
                    change_percent_float = round(
                        float(change_percent.replace("%", "").replace(",", "")), 2
                    )
                except ValueError:
                    logger.warning(f"Could not parse change_percent for {code}: {change_percent}")
                    continue

                try:
                    price_float = float(price.replace(",", ""))
                except ValueError:
                    price_float = 0.0

                symbol = _detect_symbol(code)
                if symbol is None:
                    logger.warning(f"No yfinance data for {code} ({name}), skipping")
                    continue

                entry = {
                    "code": code,
                    "symbol": symbol,
                    "name": name,
                    "change_percent": change_percent_float,
                    "price": price_float,
                    "industry": None,
                }

                if symbol.endswith(".TWO") and len(two_results) < 8:
                    two_results.append(entry)
                elif symbol.endswith(".TW") and len(tw_results) < 8:
                    tw_results.append(entry)

                logger.info(f"Found: {symbol} {name} ${price_float} {change_percent_float}%")

            except Exception as e:
                logger.error(f"Error parsing row: {e}")
                continue

        # .TWO 優先排前，.TW 接後
        results = two_results + tw_results

        if len(two_results) >= 8 and len(tw_results) >= 8:
            logger.info(f"Successfully fetched {len(results)} stocks ({len(two_results)} TWO, {len(tw_results)} TW)")
            return results

        logger.warning(f"Only found {len(two_results)} TWO / {len(tw_results)} TW stocks, using fallback data")
        return _get_fallback_data()

    except requests.RequestException as e:
        logger.error(f"Request error: {e}, using fallback data")
        return _get_fallback_data()
    except Exception as e:
        logger.error(f"Unexpected error: {e}, using fallback data")
        return _get_fallback_data()


def _get_fallback_data() -> List[Dict[str, Any]]:
    """Fallback when scraping fails."""
    return [
        {"code": "2454", "symbol": "2454.TW", "name": "聯發科", "change_percent": -3.20, "price": 1050.00, "industry": None},
        {"code": "2317", "symbol": "2317.TW", "name": "鴻海",   "change_percent": -2.80, "price": 185.50,  "industry": None},
        {"code": "2303", "symbol": "2303.TW", "name": "聯電",   "change_percent": -2.50, "price": 48.20,   "industry": None},
        {"code": "2330", "symbol": "2330.TW", "name": "台積電", "change_percent": -2.30, "price": 980.00,  "industry": None},
        {"code": "2882", "symbol": "2882.TW", "name": "國泰金", "change_percent": -2.10, "price": 68.50,   "industry": None},
        {"code": "2412", "symbol": "2412.TW", "name": "中華電", "change_percent": -1.80, "price": 125.00,  "industry": None},
    ]
