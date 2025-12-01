"""
News API endpoints.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db, init_db
from app.services.news_service import NewsService

# Initialize database on module import
init_db()

router = APIRouter(prefix="/api/news", tags=["news"])


class FetchNewsRequest(BaseModel):
    """Request model for fetching news."""

    symbol: str
    start_date: str  # YYYY-MM-DD format
    end_date: str  # YYYY-MM-DD format
    max_pages: int = 20
    max_articles: int = 300


class FetchNewsResponse(BaseModel):
    """Response model for fetch news request."""

    status: str
    message: str
    articles_count: int
    cached: bool


class DailyNewsModel(BaseModel):
    """Model for daily news summary."""

    date: str  # YYYY-MM-DD format
    primary_title: str
    primary_source: str
    related_count: int


class NewsDateModel(BaseModel):
    """Model for dates with news."""

    dates: List[str]  # List of YYYY-MM-DD dates


class TradingDatesRequest(BaseModel):
    """Request model for trading dates with news."""

    trading_dates: List[str]  # List of YYYY-MM-DD dates from actual trading data


@router.post("/fetch", response_model=FetchNewsResponse)
def fetch_news(request: FetchNewsRequest, db: Session = Depends(get_db)):
    """
    Fetch and cache news for a stock symbol.

    This endpoint will check cache first. If data exists, it returns immediately.
    Otherwise, it fetches from Google News and caches the results.
    """
    try:
        import logging

        logger = logging.getLogger(__name__)
        logger.info(f"[fetch_news] ===== API REQUEST =====")
        logger.info(f"[fetch_news] Symbol: {request.symbol}")
        logger.info(f"[fetch_news] Date range: {request.start_date} to {request.end_date}")
        logger.info(
            f"[fetch_news] Max pages: {request.max_pages}, Max articles: {request.max_articles}"
        )

        # Parse dates
        start_date = datetime.strptime(request.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(request.end_date, "%Y-%m-%d")

        # Create service
        service = NewsService(db)

        # Fetch and cache
        articles_fetched, articles_cached = service.fetch_and_cache_news(
            symbol=request.symbol,
            start_date=start_date,
            end_date=end_date,
            max_pages=request.max_pages,
            max_articles=request.max_articles,
        )

        logger.info(
            f"[fetch_news] Result: {articles_fetched} total, {articles_cached} newly cached"
        )
        logger.info(f"[fetch_news] ===== API RESPONSE =====")

        return FetchNewsResponse(
            status="success",
            message=f"成功獲取 {articles_fetched} 篇新聞",
            articles_count=articles_fetched,
            cached=articles_cached == 0,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch news: {str(e)}")


@router.get("/summaries/{symbol}", response_model=List[DailyNewsModel])
def get_daily_summaries(symbol: str, start_date: str, end_date: str, db: Session = Depends(get_db)):
    """
    Get daily news summaries for a stock symbol in a date range.

    Args:
        symbol: Stock symbol (e.g., "2408.TW")
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    """
    try:
        # Parse dates
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        # Create service
        service = NewsService(db)

        # Get summaries
        summaries = service.get_daily_summaries(symbol, start, end)

        return [
            DailyNewsModel(
                date=s.date.strftime("%Y-%m-%d"),
                primary_title=s.primary_title,
                primary_source=s.primary_source,
                related_count=s.related_count,
            )
            for s in summaries
        ]

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get summaries: {str(e)}")


@router.get("/by-date/{symbol}/{date}", response_model=List[DailyNewsModel])
def get_news_by_date(symbol: str, date: str, db: Session = Depends(get_db)):
    """
    Get news summaries for a specific date.
    Includes news from the current day and any preceding weekend/non-trading days.

    Args:
        symbol: Stock symbol (e.g., "2408.TW")
        date: Date in YYYY-MM-DD format
    """
    try:
        import logging

        logger = logging.getLogger(__name__)
        logger.info(f"[get_news_by_date] Request: symbol={symbol}, date={date}")

        # Parse date
        target_date = datetime.strptime(date, "%Y-%m-%d")

        # Create service
        service = NewsService(db)

        # Get summaries for date (may include weekend news)
        summaries = service.get_news_for_date(symbol, target_date)

        logger.info(f"[get_news_by_date] Found {len(summaries)} summaries")

        results = [
            DailyNewsModel(
                date=summary.date.strftime("%Y-%m-%d"),
                primary_title=summary.primary_title,
                primary_source=summary.primary_source,
                related_count=summary.related_count,
            )
            for summary in summaries
        ]

        logger.info(f"[get_news_by_date] Returning {len(results)} results")
        return results

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get news: {str(e)}")


@router.get("/dates/{symbol}", response_model=NewsDateModel)
def get_dates_with_news(symbol: str, start_date: str, end_date: str, db: Session = Depends(get_db)):
    """
    Get list of dates that have news (for marking on timeline).

    Args:
        symbol: Stock symbol (e.g., "2408.TW")
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    """
    try:
        # Parse dates
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        # Create service
        service = NewsService(db)

        # Get dates with news
        dates = service.get_dates_with_news(symbol, start, end)

        return NewsDateModel(dates=dates)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dates: {str(e)}")


@router.post("/trading-dates/{symbol}", response_model=NewsDateModel)
def get_trading_dates_with_news(
    symbol: str,
    start_date: str,
    end_date: str,
    request: TradingDatesRequest,
    db: Session = Depends(get_db),
):
    """
    Get list of trading dates that should display news markers.
    Maps weekend/non-trading day news to the next trading day.

    Args:
        symbol: Stock symbol (e.g., "2408.TW")
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        request: TradingDatesRequest with list of actual trading dates
    """
    try:
        # Parse dates
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        # Create service
        service = NewsService(db)

        # Get trading dates with news (mapped to actual trading days)
        dates = service.get_trading_dates_with_news(symbol, start, end, request.trading_dates)

        return NewsDateModel(dates=dates)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get trading dates: {str(e)}")
