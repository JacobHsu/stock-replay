"""
Script to fetch comprehensive Taiwan stock list and build complete database.
Fetches stock list from TWSE and builds database with Chinese names.
"""

import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Set

import requests
from bs4 import BeautifulSoup

from app.helpers.newsapi.stock_name_fetcher import get_tw_stock_chinese_name

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_twse_stock_list() -> Set[str]:
    """
    Fetch complete stock list from TWSE (Taiwan Stock Exchange).
    Returns a set of stock codes.
    """
    stock_codes = set()

    try:
        # TWSE official stock list
        url = "https://isin.twse.com.tw/isin/C_public.jsp?strMode=2"

        logger.info("Fetching stock list from TWSE...")
        response = requests.get(url, timeout=30)
        response.encoding = "big5"

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")

            # Find all table rows
            rows = soup.find_all("tr")

            for row in rows:
                cols = row.find_all("td")
                if len(cols) >= 2:
                    # First column contains stock code and name
                    text = cols[0].get_text().strip()

                    # Format: "代碼 公司名稱" (e.g., "2330 台積電")
                    if "\u3000" in text:  # Full-width space
                        parts = text.split("\u3000")
                        if len(parts) >= 2:
                            code = parts[0].strip()
                            # Only include numeric codes (exclude special codes)
                            if code.isdigit() and len(code) == 4:
                                stock_codes.add(code)

            logger.info(f"Found {len(stock_codes)} stocks from TWSE")
        else:
            logger.error(f"Failed to fetch TWSE stock list: {response.status_code}")

    except Exception as e:
        logger.error(f"Error fetching TWSE stock list: {e}")

    return stock_codes


def get_tpex_stock_list() -> Set[str]:
    """
    Fetch stock list from TPEx (Taipei Exchange - OTC market).
    Returns a set of stock codes.
    """
    stock_codes = set()

    try:
        # TPEx official stock list
        url = "https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&d=113/11/26&_=1732644000000"

        logger.info("Fetching stock list from TPEx...")
        response = requests.get(url, timeout=30)

        if response.status_code == 200:
            data = response.json()

            if "aaData" in data:
                for item in data["aaData"]:
                    if len(item) > 0:
                        code = item[0].strip()
                        # Only include numeric codes
                        if code.isdigit() and len(code) == 4:
                            stock_codes.add(code)

                logger.info(f"Found {len(stock_codes)} stocks from TPEx")
        else:
            logger.error(f"Failed to fetch TPEx stock list: {response.status_code}")

    except Exception as e:
        logger.error(f"Error fetching TPEx stock list: {e}")

    return stock_codes


def build_complete_stock_database(output_path: Path) -> Dict[str, Dict[str, str]]:
    """
    Build complete stock database by fetching all Taiwan stocks.
    Can resume from existing database file.

    Args:
        output_path: Path to save the JSON database

    Returns:
        Dictionary mapping stock code to stock info
    """
    # Load existing database if available
    database = {}
    if output_path.exists():
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                database = json.load(f)
            logger.info(f"Loaded existing database with {len(database)} stocks")
        except Exception as e:
            logger.warning(f"Failed to load existing database: {e}")
            database = {}

    # Get all stock codes
    logger.info("Fetching complete stock list...")

    twse_stocks = get_twse_stock_list()
    tpex_stocks = get_tpex_stock_list()

    all_stocks = twse_stocks.union(tpex_stocks)
    all_stocks = sorted(list(all_stocks))

    logger.info(f"Total unique stocks: {len(all_stocks)}")
    logger.info(f"TWSE: {len(twse_stocks)}, TPEx: {len(tpex_stocks)}")

    # Filter out already fetched stocks
    remaining_stocks = [code for code in all_stocks if code not in database]

    logger.info(f"Already in database: {len(database)}")
    logger.info(f"Remaining to fetch: {len(remaining_stocks)}")

    # Build database
    total = len(remaining_stocks)
    success_count = 0
    failed_count = 0

    if total == 0:
        logger.info("All stocks already in database!")
        return database

    logger.info(f"Continuing from where we left off... ({total} stocks remaining)")

    logger.info(f"Continuing from where we left off... ({total} stocks remaining)")

    for idx, code in enumerate(remaining_stocks, 1):
        try:
            symbol = f"{code}.TW"
            logger.info(f"[{idx}/{total}] Fetching {symbol}...")

            chinese_name = get_tw_stock_chinese_name(symbol)

            if chinese_name:
                database[code] = {
                    "symbol": symbol,
                    "code": code,
                    "name": chinese_name,
                }
                success_count += 1
                logger.info(f"  ✓ {code} - {chinese_name}")
            else:
                failed_count += 1
                logger.warning(f"  ✗ {code} - Failed to fetch name")

            # Rate limiting to avoid being blocked
            time.sleep(0.5)

        except Exception as e:
            failed_count += 1
            logger.error(f"  ✗ {code} - Error: {e}")

        # Save checkpoint every 50 stocks
        if idx % 50 == 0:
            logger.info(f"Checkpoint: Total {len(database)} stocks in database...")
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(database, f, ensure_ascii=False, indent=2)
            logger.info(
                f"Checkpoint saved! ({success_count} new successes, {failed_count} failures)"
            )

    # Final save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(database, f, ensure_ascii=False, indent=2)

    logger.info(f"Stock database saved to {output_path}")
    logger.info(f"New stocks - Success: {success_count}, Failed: {failed_count}")
    logger.info(f"Total in database: {len(database)}")

    return database


if __name__ == "__main__":
    # Output path relative to this script
    script_dir = Path(__file__).parent
    output_path = script_dir / "data" / "taiwan_stocks.json"

    database = build_complete_stock_database(output_path)

    # Print statistics
    print("\n" + "=" * 50)
    print("Stock Database Built Successfully!")
    print("=" * 50)
    print(f"Total stocks: {len(database)}")
    print(f"Output file: {output_path}")
    print("\nSample entries:")
    for code, info in list(database.items())[:10]:
        print(f"  {info['symbol']} - {info['name']}")
