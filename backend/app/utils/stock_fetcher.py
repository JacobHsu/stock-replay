"""
Stock data fetcher using yfinance utilities.
Simple wrapper for Phase 1 MVP.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd

from ..helpers.yfinance import YFinanceService

logger = logging.getLogger(__name__)


def fetch_stock_data(symbol: str, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
    """
    Fetch stock data for the given symbol and date range.

    Args:
        symbol: Stock ticker symbol (e.g., 'AAPL', '2330.TW')
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format

    Returns:
        DataFrame with stock data or None if failed
    """
    try:
        df = YFinanceService.get_stock_data(symbol=symbol, start_date=start_date, end_date=end_date)
        logger.info(f"Fetched {len(df)} rows for {symbol}")
        return df
    except Exception as e:
        logger.error(f"Error fetching data for {symbol}: {e}")
        return None


def fetch_stock_data_by_period(symbol: str, period: str = "3mo") -> Optional[pd.DataFrame]:
    """
    Fetch stock data for the given symbol and period.

    Args:
        symbol: Stock ticker symbol
        period: Period string (e.g., '1mo', '3mo', '6mo', '1y')

    Returns:
        DataFrame with stock data or None if failed
    """
    try:
        df = YFinanceService.get_stock_data(
            symbol=symbol, start_date="", end_date="", period=period
        )
        logger.info(f"Fetched {len(df)} rows for {symbol} ({period})")
        return df
    except Exception as e:
        logger.error(f"Error fetching data for {symbol}: {e}")
        return None
