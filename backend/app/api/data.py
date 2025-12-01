"""
Data API endpoints for fetching stock historical data.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..models.playback import CandleData, StockDataResponse
from ..utils.stock_fetcher import fetch_stock_data, fetch_stock_data_by_period

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/historical/{symbol}", response_model=StockDataResponse)
async def get_historical_data(
    symbol: str,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    period: Optional[str] = Query("3mo", description="Period (e.g., '1mo', '3mo', '1y')"),
) -> StockDataResponse:
    """
    Get historical stock data for the given symbol.

    Args:
        symbol: Stock ticker symbol (e.g., 'AAPL', '2330.TW')
        start_date: Start date (YYYY-MM-DD), optional if period is provided
        end_date: End date (YYYY-MM-DD), optional if period is provided
        period: Period string (default: '3mo')

    Returns:
        StockDataResponse with historical data
    """
    try:
        # Fetch data
        if start_date and end_date:
            df = fetch_stock_data(symbol, start_date, end_date)
        else:
            df = fetch_stock_data_by_period(symbol, period or "3mo")

        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")

        # Convert to response model
        candles = []
        for timestamp, row in df.iterrows():
            candles.append(
                CandleData(
                    timestamp=timestamp.to_pydatetime(),
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=int(row["Volume"]),
                )
            )

        return StockDataResponse(symbol=symbol, data=candles, total_count=len(candles))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching historical data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
