"""
Morning Star 市場最大跌幅股票
使用 RapidAPI 的 Morning Star API 獲取當日最大跌幅的股票
"""

import logging
from typing import List, Dict, Any
import httpx

from lib.config import settings

logger = logging.getLogger(__name__)


def get_top10_morning_star_losers() -> List[Dict[str, Any]]:
    """
    獲取 Morning Star 最大跌幅的前 10 支股票

    Returns:
        包含 code, symbol, name, change_percent, price 的列表

    Raises:
        ValueError: 當 RAPIDAPI_KEY 未設定時
        Exception: 當 API 調用失敗時
    """
    if not settings.rapidapi_key:
        error_msg = "RAPIDAPI_KEY not configured. Please set RAPIDAPI_KEY in backend/.env file"
        logger.error(error_msg)
        raise ValueError(error_msg)

    url = "https://morning-star.p.rapidapi.com/market/v3/get-movers"

    headers = {
        "X-RapidAPI-Key": settings.rapidapi_key,
        "X-RapidAPI-Host": "morning-star.p.rapidapi.com"
    }

    try:
        logger.info("Fetching market movers from Morning Star API...")

        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()

        logger.info(f"API Response status: {response.status_code}")

        # 解析 API 回應
        # Morning Star API 結構: data["Top10"]["Losers"]["Securities"]
        losers = []

        if isinstance(data, dict):
            # 獲取 Losers 數據
            top10 = data.get("Top10", {})
            losers_data = top10.get("Losers", {})
            securities = losers_data.get("Securities", [])

            logger.info(f"Found {len(securities)} losers in API response")

            for item in securities[:10]:  # 取前 10 支
                try:
                    # 解析股票資訊
                    security = item.get("Security", {})
                    quote = item.get("Quote", {})

                    # 從 RegionAndTicker 提取 ticker（格式：USA:TSLA）
                    region_and_ticker = security.get("RegionAndTicker", "")
                    ticker = region_and_ticker.split(":")[-1] if ":" in region_and_ticker else ""

                    name = security.get("Name", "")
                    price = quote.get("Price")
                    change_pct = quote.get("PercentChange", 0)

                    if ticker:
                        losers.append({
                            "code": ticker,
                            "symbol": ticker,
                            "name": name,
                            "change_percent": round(change_pct, 2),
                            "price": float(price) if price else None,
                        })
                        logger.debug(f"Added loser: {ticker} ({name}) {change_pct:.2f}%")
                except (ValueError, TypeError, KeyError) as e:
                    logger.warning(f"Failed to parse item: {e}")
                    continue

        if not losers:
            error_msg = "No losers found in API response. API may have returned unexpected structure."
            logger.error(error_msg)
            logger.error(f"Raw API response: {data}")
            raise ValueError(error_msg)

        logger.info(f"Successfully fetched {len(losers)} market losers")
        return losers

    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP {e.response.status_code} error from Morning Star API"
        logger.error(error_msg)
        logger.error(f"Response body: {e.response.text}")
        raise Exception(f"{error_msg}: {e.response.text}")
    except httpx.RequestError as e:
        error_msg = f"Network error connecting to Morning Star API: {str(e)}"
        logger.error(error_msg)
        raise Exception(error_msg)
    except ValueError as e:
        # Re-raise ValueError (from empty response check)
        raise
    except Exception as e:
        error_msg = f"Unexpected error fetching Morning Star losers: {str(e)}"
        logger.error(error_msg)
        logger.exception("Full traceback:")
        raise Exception(error_msg)
