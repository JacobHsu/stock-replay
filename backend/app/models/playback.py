"""
Pydantic models for stock data playback.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CandleData(BaseModel):
    """Single candlestick data point."""

    timestamp: datetime = Field(..., description="Timestamp of the candle")
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="Highest price")
    low: float = Field(..., description="Lowest price")
    close: float = Field(..., description="Closing price")
    volume: int = Field(..., description="Trading volume")


class StockDataResponse(BaseModel):
    """Response model for historical stock data."""

    symbol: str = Field(..., description="Stock ticker symbol")
    data: List[CandleData] = Field(..., description="List of candlestick data")
    total_count: int = Field(..., description="Total number of data points")


class PlaybackCreateRequest(BaseModel):
    """Request model for creating a playback session."""

    symbol: str = Field(..., description="Stock ticker symbol")
    start_date: Optional[str] = Field(
        None, description="Start date (YYYY-MM-DD), optional if period is provided"
    )
    end_date: Optional[str] = Field(
        None, description="End date (YYYY-MM-DD), optional if period is provided"
    )
    period: Optional[str] = Field(
        "3mo", description="Period string (e.g., '1mo', '3mo', '6mo', '1y')"
    )


class PlaybackStatusResponse(BaseModel):
    """Response model for playback status."""

    playback_id: str = Field(..., description="Unique playback session ID")
    symbol: str = Field(..., description="Stock ticker symbol")
    current_index: int = Field(..., description="Current playback position (0-based)")
    total_count: int = Field(..., description="Total number of data points")
    has_more: bool = Field(..., description="Whether there are more data points")
    current_data: Optional[CandleData] = Field(None, description="Current candlestick data")
    price_range: Optional[dict] = Field(
        None, description="Price range of all data: {min_price, max_price}"
    )
    all_dates: Optional[List[str]] = Field(
        None, description="List of all trading dates in YYYY-MM-DD format (only in start response)"
    )


class PlaybackSeekRequest(BaseModel):
    """Request model for seeking to a specific position."""

    index: int = Field(..., description="Target index to seek to (0-based)", ge=0)
