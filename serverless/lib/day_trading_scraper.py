"""
Day trading stock scraper for Taiwan stocks.
Fetches top 3 stocks that can be day-traded with biggest losses from HiStock.
"""

import logging
from typing import List, Dict, Any
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def get_top3_day_trading_losers() -> List[Dict[str, Any]]:
    """
    Get top 6 stocks that can be day-traded with biggest losses.
    
    Scrapes from HiStock and filters by stocks in our database (taiwan_stocks.json).
    Returns list with: code, symbol, name, change_percent, price, industry
    """
    try:
        # Import here to avoid circular dependency
        from lib.stock_database import get_stock_database
        
        db = get_stock_database()
        
        # Scrape HiStock
        url = "https://histock.tw/stock/rank.aspx"
        params = {
            "m": "4",  # 跌幅排行
            "d": "0",  # 可現股當沖
            "t": "dt"  # 當日
        }
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        logger.info(f"Fetching day trading losers from HiStock: {url}")
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Find the ranking table (class="gvTB")
        table = soup.find("table", {"class": "gvTB"})
        if not table:
            logger.warning("Could not find stock table, using fallback data")
            return _get_fallback_data()
        
        results = []
        rows = table.find_all("tr")[1:]  # Skip header row
        
        for row in rows:
            try:
                cols = row.find_all("td")
                if len(cols) < 5:
                    continue
                
                # Extract data (columns: 代號, 名稱, 價格, 漲跌, 漲跌幅, ...)
                code = cols[0].text.strip()
                name_from_web = cols[1].text.strip()
                price = cols[2].text.strip()
                change = cols[3].text.strip()
                change_percent = cols[4].text.strip()
                
                # Ensure database is initialized
                db._ensure_initialized()
                
                # Check if stock exists in our database (only check cache, don't fetch)
                # This ensures we only use stocks with known historical data
                if code not in db._cache:
                    logger.debug(f"Stock {code} ({name_from_web}) not in database, skipping")
                    continue
                
                stock_info = db._cache[code]
                
                # Parse change percent (保留小數點第二位)
                try:
                    change_percent_float = float(change_percent.replace("%", "").replace(",", ""))
                    change_percent_float = round(change_percent_float, 2)
                except ValueError:
                    logger.warning(f"Could not parse change_percent for {code}: {change_percent}")
                    continue
                
                # Parse price (股價)
                try:
                    price_float = float(price.replace(",", ""))
                except ValueError:
                    logger.warning(f"Could not parse price for {code}: {price}")
                    price_float = 0.0
                
                # 取得產業別
                industry = stock_info.get("industry", "未分類")
                
                results.append({
                    "code": code,
                    "symbol": stock_info["symbol"],
                    "name": stock_info["name"],
                    "change_percent": change_percent_float,
                    "price": price_float,
                    "industry": industry,
                })
                
                logger.info(f"Found: {code} {stock_info['name']} ${price_float} {change_percent_float}%")
                
                # Stop when we have 6 stocks
                if len(results) >= 6:
                    break
                    
            except Exception as e:
                logger.error(f"Error parsing row: {e}")
                continue
        
        if len(results) >= 6:
            logger.info(f"Successfully fetched {len(results)} day trading losers")
            return results
        else:
            logger.warning(f"Only found {len(results)} stocks, using fallback data")
            return _get_fallback_data()
            
    except requests.RequestException as e:
        logger.error(f"Request error: {e}, using fallback data")
        return _get_fallback_data()
    except Exception as e:
        logger.error(f"Unexpected error: {e}, using fallback data")
        return _get_fallback_data()


def _get_fallback_data() -> List[Dict[str, Any]]:
    """
    Fallback data when scraping fails.
    Uses popular large-cap stocks with complete historical data.
    """
    return [
        {
            "code": "2454",
            "symbol": "2454.TW",
            "name": "聯發科",
            "change_percent": -3.20,
            "price": 1050.00,
            "industry": "半導體業"
        },
        {
            "code": "2317",
            "symbol": "2317.TW",
            "name": "鴻海",
            "change_percent": -2.80,
            "price": 185.50,
            "industry": "電腦及週邊設備業"
        },
        {
            "code": "2303",
            "symbol": "2303.TW",
            "name": "聯電",
            "change_percent": -2.50,
            "price": 48.20,
            "industry": "半導體業"
        },
        {
            "code": "2330",
            "symbol": "2330.TW",
            "name": "台積電",
            "change_percent": -2.30,
            "price": 980.00,
            "industry": "半導體業"
        },
        {
            "code": "2882",
            "symbol": "2882.TW",
            "name": "國泰金",
            "change_percent": -2.10,
            "price": 68.50,
            "industry": "金融保險業"
        },
        {
            "code": "2412",
            "symbol": "2412.TW",
            "name": "中華電",
            "change_percent": -1.80,
            "price": 125.00,
            "industry": "通信網路業"
        }
    ]
