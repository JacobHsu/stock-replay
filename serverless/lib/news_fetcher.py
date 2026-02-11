from typing import Optional
import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
TAVILY_API_URL = "https://api.tavily.com/search"
YAHOO_STOCK_URL = "https://tw.stock.yahoo.com/quote/{code}.TW"
HEADERS_UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
TIMEOUT = 3  # Reduced timeout for serverless

def get_stock_chinese_name(symbol: str) -> Optional[str]:
    """
    Fetch Chinese name of the stock from Yahoo Finance TW.
    Example: 2330.TW -> 台積電
    """
    try:
        code = symbol.replace(".TW", "").replace(".TWO", "")
        url = YAHOO_STOCK_URL.format(code=code)
        
        response = requests.get(url, headers=HEADERS_UA, timeout=TIMEOUT)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            title_tag = soup.find("title")
            if title_tag:
                title = title_tag.text
                if "(" in title:
                    name = title.split("(")[0].strip()
                    logger.info(f"Found Chinese name for {symbol}: {name}")
                    return name
    except Exception as e:
        logger.warning(f"Failed to fetch stock name for {symbol}: {e}")
    return None

from lib.config import settings

from dotenv import load_dotenv
load_dotenv()

def fetch_news(symbol: str, start_date: str, end_date: str) -> dict:
    """
    Fetch news for a given symbol and date range using Tavily API.
    
    Args:
        symbol: Stock symbol (e.g., '2330.TW')
        start_date: YYYY-MM-DD
        end_date: YYYY-MM-DD
    
    Returns:
        Dict containing list of articles and metadata.
    """
    
    # 1. Get API Key from settings OR env directly
    # Try settings first, fallback to os.environ
    api_key = "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"
    # if not api_key:
    #     api_key = settings.tavily_api_key
    #     if not api_key:
    #         api_key = os.environ.get("TAVILY_API_KEY")
        
    logger.info(f"Using Tavily API Key: {str(api_key)[:5]}...")
    if not api_key:
        logger.error("TAVILY_API_KEY is missing!")
        return {"error": "TAVILY_API_KEY is not configured", "data": []}

    # 2. Build Query (e.g., "2330 台積電")
    chinese_name = get_stock_chinese_name(symbol)
    code = symbol.replace(".TW", "").replace(".TWO", "")
    query = f"{code} {chinese_name}" if chinese_name else code
    
    # 3. Determine topic/time_range for Tavily
    # Note: Tavily's time_range is relative ("day", "week", "month", "year") from *now*.
    # Since we want historical news, we might need a different approach or verify Tavily supports date filtering.
    # Tavily API documentation says: time_range option: day, week, month, year, or 'archive' (though archive is implied if not specified).
    # But for historical search on specific dates, Tavily is actually a search engine, so we include dates in prompt or rely on relevance.
    # However, strict date filtering is tricky with pure search.
    # Let's use "year" if the range is within a year, or rely on the query context.
    
    # Actually, a better approach for stock news specific dates is to append date to query if necessary, 
    # OR accept that search results might be broad and filter locally.
    # But Tavily does return published dates.
    
    payload = {
        "api_key": api_key,
        "query": f"{query} news",  # Force news context
        "search_depth": "basic",
        "topic": "news",
        "max_results": 20,
        "include_domains": ["ctee.com.tw", "money.udn.com", "bnext.com.tw"],  # Limit to major TW financial news
        # "time_range": "year" # Let's default to year to capture some history, or omit for all time
    }
    
    try:
        response = requests.post(TAVILY_API_URL, json=payload, timeout=10)
        data = response.json()
        
        articles = []
        if "results" in data:
            for item in data["results"]:
                # Filter by date if provided in result (Tavily sometimes returns 'published_date')
                # But for now, just return what we find and let frontend handle basic filtering or display.
                
                # Tavily result format: { title, url, content, score, published_date, ... }
                published_date = item.get("published_date", "")
                
                # If no published_date, try to extract from URL (like backend does)
                # Backend logic for ctee: .../20231101/...
                if not published_date and "ctee.com.tw" in item.get("url", ""):
                    import re
                    match = re.search(r'/(\d{4})(\d{2})(\d{2})/', item["url"])
                    if match:
                        published_date = f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

                articles.append({
                    "title": item.get("title"),
                    "url": item.get("url"),
                    "summary": item.get("content"),
                    "date": published_date,
                    "source": item.get("url", "").split("/")[2] if item.get("url") else "Unknown"
                })
        
        return {
            "symbol": symbol,
            "query": query,
            "count": len(articles),
            "data": articles
        }
        
    except Exception as e:
        logger.error(f"Tavily API failed: {e}")
        return {"error": str(e), "data": []}

if __name__ == "__main__":
    # Simple test
    print(get_stock_chinese_name("2330.TW"))
