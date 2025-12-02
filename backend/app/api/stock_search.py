"""
Stock search API endpoints for Taiwan stocks.
"""

import logging
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.helpers.newsapi.stock_name_fetcher import get_tw_stock_chinese_name
from app.helpers.stock_database import get_stock_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


class StockInfo(BaseModel):
    """Stock information model."""

    symbol: str  # e.g., "2330.TW"
    code: str  # e.g., "2330"
    name: str  # e.g., "台積電"
    display_name: str  # e.g., "2330.TW - 台積電"


class StockSearchResponse(BaseModel):
    """Response model for stock search."""

    results: List[StockInfo]


@router.get("/search", response_model=StockSearchResponse)
def search_stock(q: str) -> StockSearchResponse:
    """
    Search for Taiwan stocks by symbol or Chinese name.

    Args:
        q: Search query (stock code or Chinese name)

    Returns:
        List of matching stocks

    Examples:
        /api/stocks/search?q=2330
        /api/stocks/search?q=台積電
        /api/stocks/search?q=雷虎
    """
    try:
        query = q.strip()

        if not query:
            return StockSearchResponse(results=[])

        results = []
        db = get_stock_database()

        # If query is numeric or contains .TW, treat as stock code
        if query.replace(".", "").replace("TW", "").replace("TWO", "").isdigit():
            # Extract code
            code = query.replace(".TW", "").replace(".TWO", "")

            # Try to get from database first
            stock_info = db.get_stock_info(code)

            if stock_info:
                results.append(
                    StockInfo(
                        symbol=stock_info["symbol"],
                        code=stock_info["code"],
                        name=stock_info["name"],
                        display_name=f"{stock_info['symbol']} - {stock_info['name']}",
                    )
                )
        else:
            # Chinese name search using database
            logger.info(f"Searching for Chinese name: {query}")

            stock_infos = db.search_by_name(query, limit=10)

            for stock_info in stock_infos:
                results.append(
                    StockInfo(
                        symbol=stock_info["symbol"],
                        code=stock_info["code"],
                        name=stock_info["name"],
                        display_name=f"{stock_info['symbol']} - {stock_info['name']}",
                    )
                )

        return StockSearchResponse(results=results)

    except Exception as e:
        logger.error(f"Stock search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/info/{symbol}", response_model=StockInfo)
def get_stock_info(symbol: str) -> StockInfo:
    """
    Get stock information by symbol.

    Args:
        symbol: Stock symbol (e.g., "2330.TW")

    Returns:
        Stock information
    """
    try:
        # Ensure symbol has .TW suffix
        if not symbol.endswith(".TW") and not symbol.endswith(".TWO"):
            symbol = f"{symbol}.TW"

        code = symbol.replace(".TW", "").replace(".TWO", "")

        # Fetch Chinese name
        chinese_name = get_tw_stock_chinese_name(symbol)

        if not chinese_name:
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

        return StockInfo(
            symbol=symbol,
            code=code,
            name=chinese_name,
            display_name=f"{symbol} - {chinese_name}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get stock info error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stock info: {str(e)}")


class DayTradingStock(BaseModel):
    """Day trading stock model."""

    code: str
    symbol: str
    name: str
    change_percent: float


class DayTradingLosersResponse(BaseModel):
    """Response for day trading losers."""

    stocks: List[DayTradingStock]


@router.get("/day-trading/losers", response_model=DayTradingLosersResponse)
def get_day_trading_losers() -> DayTradingLosersResponse:
    """
    Get top 3 day trading stocks with biggest losses.

    Returns:
        List of top 3 stocks that can be day-traded with biggest losses
    """
    try:
        from app.helpers.day_trading_scraper import get_top3_day_trading_losers

        stocks = get_top3_day_trading_losers()
        return DayTradingLosersResponse(stocks=stocks)

    except Exception as e:
        logger.error(f"Get day trading losers error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get day trading losers: {str(e)}")


@router.get("/us-etf/losers", response_model=DayTradingLosersResponse)
def get_us_etf_losers() -> DayTradingLosersResponse:
    """
    Get top 3 US ETFs with biggest losses.

    Returns:
        List of top 3 US ETFs with biggest losses
    """
    try:
        from app.helpers.us_etf_losers import get_top3_us_etf_losers

        etfs = get_top3_us_etf_losers()
        return DayTradingLosersResponse(stocks=etfs)

    except Exception as e:
        logger.error(f"Get US ETF losers error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get US ETF losers: {str(e)}")
