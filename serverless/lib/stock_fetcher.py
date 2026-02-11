"""
Stock data fetcher using yfinance.
Simplified version for serverless deployment - returns all data at once.
"""

import logging
from typing import List, Optional

import pandas as pd
import yfinance as yf

log = logging.getLogger(__name__)


def fetch_stock_data(
    symbol: str,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[dict]:
    """
    Fetch stock OHLCV data and return ALL candles at once.

    Unlike the backend (which stores in memory and returns one-by-one),
    this returns everything in a single response — perfect for serverless.

    Args:
        symbol: Ticker symbol (e.g., 'AAPL', '2330.TW', 'BTC-USD')
        period: Period string (e.g., '1mo', '3mo', '6mo', '1y')
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format

    Returns:
        List of candle dictionaries with timestamp, open, high, low, close, volume
    """
    symbol = symbol.strip().upper()
    ticker = yf.Ticker(symbol)

    try:
        if start_date and end_date:
            # Add one day to end_date to make the range inclusive
            end_date_inclusive = (
                pd.to_datetime(end_date) + pd.DateOffset(days=1)
            ).strftime("%Y-%m-%d")
            data = ticker.history(start=start_date, end=end_date_inclusive)
        elif period:
            data = ticker.history(period=period)
        else:
            data = ticker.history(period="3mo")

        if data is None or data.empty:
            return []

        # Remove timezone info to avoid serialization issues
        if data.index.tz is not None:
            data.index = data.index.tz_localize(None)

        # Convert DataFrame to list of dicts
        candles = []
        for timestamp, row in data.iterrows():
            candles.append({
                "timestamp": timestamp.isoformat(),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })

        return candles

    except Exception as e:
        log.error(f"Error fetching data for {symbol}: {e}")
        raise
