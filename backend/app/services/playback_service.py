"""
Playback service for managing stock data playback sessions.
"""

import logging
import uuid
from typing import Dict, List, Optional

import pandas as pd

from ..models.playback import CandleData
from ..utils.stock_fetcher import fetch_stock_data, fetch_stock_data_by_period

logger = logging.getLogger(__name__)


class PlaybackSession:
    """Represents a single playback session."""

    def __init__(self, playback_id: str, symbol: str, data: pd.DataFrame) -> None:
        """
        Initialize a playback session.

        Args:
            playback_id: Unique identifier for this session
            symbol: Stock ticker symbol
            data: DataFrame containing the stock data
        """
        self.playback_id = playback_id
        self.symbol = symbol
        self.data = data
        self.current_index = 0

        # Calculate price range for all data
        self.min_price = float(data["Low"].min())
        self.max_price = float(data["High"].max())

    def get_price_range(self) -> dict:
        """Get the price range of all data."""
        return {
            "min_price": self.min_price,
            "max_price": self.max_price,
        }

    def get_current(self) -> Optional[CandleData]:
        """Get current candle data."""
        if self.current_index >= len(self.data):
            return None

        row = self.data.iloc[self.current_index]
        return CandleData(
            timestamp=row.name.to_pydatetime(),
            open=float(row["Open"]),
            high=float(row["High"]),
            low=float(row["Low"]),
            close=float(row["Close"]),
            volume=int(row["Volume"]),
        )

    def next(self, count: int = 1) -> List[CandleData]:
        """
        Get next N candles and advance position.

        Args:
            count: Number of candles to retrieve

        Returns:
            List of candle data
        """
        result = []
        for _ in range(count):
            if self.current_index >= len(self.data):
                break

            candle = self.get_current()
            if candle:
                result.append(candle)
            self.current_index += 1

        return result

    def seek(self, index: int) -> bool:
        """
        Seek to specific position.

        Args:
            index: Target index (0-based)

        Returns:
            True if successful, False if out of range
        """
        if 0 <= index < len(self.data):
            self.current_index = index
            return True
        return False

    def has_more(self) -> bool:
        """Check if there are more data points."""
        return self.current_index < len(self.data)

    def get_total_count(self) -> int:
        """Get total number of data points."""
        return len(self.data)

    def get_all_dates(self) -> List[str]:
        """
        Get all trading dates in this playback session.

        Returns:
            List of date strings in YYYY-MM-DD format
        """
        return [date.strftime("%Y-%m-%d") for date in self.data.index]


class PlaybackService:
    """Service for managing multiple playback sessions."""

    def __init__(self) -> None:
        """Initialize playback service."""
        self.sessions: Dict[str, PlaybackSession] = {}

    def create_session(
        self,
        symbol: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        period: Optional[str] = None,
    ) -> Optional[PlaybackSession]:
        """
        Create a new playback session.

        Args:
            symbol: Stock ticker symbol
            start_date: Start date (YYYY-MM-DD), used to fetch exact date range
            end_date: End date (YYYY-MM-DD), used to fetch exact date range
            period: Period string (e.g., '3mo', '1y'), alternative to date range

        Returns:
            PlaybackSession if successful, None otherwise
        """
        try:
            # Fetch data using either date range or period
            if start_date and end_date:
                # Use date range directly with yfinance
                df = fetch_stock_data(symbol, start_date, end_date)
                logger.info(f"Fetching data for {symbol} from {start_date} to {end_date}")
            elif period:
                # Use period
                df = fetch_stock_data_by_period(symbol, period)
                logger.info(f"Fetching data for {symbol} with period {period}")
            else:
                # Default to 3mo
                df = fetch_stock_data_by_period(symbol, "3mo")
                logger.info(f"Fetching data for {symbol} with default period 3mo")

            if df is None or df.empty:
                logger.error(f"No data fetched for {symbol}")
                return None

            # Remove timezone info to avoid comparison issues
            if df.index.tz is not None:
                df.index = df.index.tz_localize(None)

            # Create session
            playback_id = str(uuid.uuid4())
            session = PlaybackSession(playback_id, symbol, df)
            self.sessions[playback_id] = session

            logger.info(f"Created playback session {playback_id} for {symbol} with {len(df)} bars")
            return session

        except Exception as e:
            logger.error(f"Error creating playback session: {e}")
            return None

    def get_session(self, playback_id: str) -> Optional[PlaybackSession]:
        """
        Get existing playback session.

        Args:
            playback_id: Unique session identifier

        Returns:
            PlaybackSession if found, None otherwise
        """
        return self.sessions.get(playback_id)

    def delete_session(self, playback_id: str) -> bool:
        """
        Delete a playback session.

        Args:
            playback_id: Session identifier to delete

        Returns:
            True if deleted, False if not found
        """
        if playback_id in self.sessions:
            del self.sessions[playback_id]
            logger.info(f"Deleted playback session {playback_id}")
            return True
        return False

    def get_all_sessions(self) -> List[str]:
        """Get list of all active session IDs."""
        return list(self.sessions.keys())


# Global playback service instance
playback_service = PlaybackService()
