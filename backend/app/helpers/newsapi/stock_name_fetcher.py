"""
Utility to fetch Chinese stock names from Yahoo Taiwan Stock.
"""

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def get_tw_stock_chinese_name(symbol: str, timeout: int = 5) -> Optional[str]:
    """
    Fetch Chinese company name from Yahoo Taiwan Stock website.

    Args:
        symbol: Stock symbol (e.g., "2330.TW")
        timeout: Request timeout in seconds

    Returns:
        Chinese company name or None if not found

    Examples:
        >>> get_tw_stock_chinese_name("2330.TW")
        "台積電"
        >>> get_tw_stock_chinese_name("8033.TW")
        "雷虎"
    """
    try:
        # Extract code without .TW suffix
        code = symbol.replace(".TW", "")
        url = f"https://tw.stock.yahoo.com/quote/{code}.TW"

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        response = requests.get(url, headers=headers, timeout=timeout)

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # Yahoo Taiwan Stock page title format: "公司名稱(代號) 走勢圖 - Yahoo奇摩股市"
            title_tag = soup.find("title")
            if title_tag:
                title = title_tag.text
                # Extract name before the first parenthesis
                if "(" in title:
                    name = title.split("(")[0].strip()
                    logger.info(f"Found Chinese name for {symbol}: {name}")
                    return name

        logger.warning(f"Could not fetch Chinese name for {symbol}")
        return None

    except Exception as e:
        logger.error(f"Error fetching Chinese name for {symbol}: {e}")
        return None


def build_news_query(symbol: str) -> str:
    """
    Build an optimized news search query for Taiwan stocks.

    Tries to fetch Chinese company name and combines it with stock code.
    Falls back to stock code only if name cannot be fetched.

    Args:
        symbol: Stock symbol (e.g., "2330.TW")

    Returns:
        Optimized query string

    Examples:
        >>> build_news_query("2330.TW")
        "2330 台積電"
        >>> build_news_query("INVALID")
        "INVALID"
    """
    # Extract code
    code = symbol.replace(".TW", "").replace(".TWO", "")

    # Try to get Chinese name
    chinese_name = get_tw_stock_chinese_name(symbol)

    if chinese_name:
        query = f"{code} {chinese_name}"
        logger.info(f"Built query for {symbol}: {query}")
        return query
    else:
        # Fallback to code only
        logger.info(f"Using fallback query for {symbol}: {code}")
        return code
