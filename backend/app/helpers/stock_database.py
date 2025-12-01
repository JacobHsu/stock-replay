"""
Taiwan stock database with caching for efficient search.
Loads stock data from pre-built JSON file for fast access.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

from app.helpers.newsapi.stock_name_fetcher import get_tw_stock_chinese_name

logger = logging.getLogger(__name__)


# Path to the stock database JSON file
STOCK_DB_PATH = Path(__file__).parent.parent.parent / "scripts" / "data" / "taiwan_stocks.json"


class StockDatabase:
    """
    In-memory stock database with caching.
    Loads stock data from JSON file for fast access.
    Falls back to fetching if stock not in database.
    """

    def __init__(self):
        self._cache: Dict[str, Dict[str, str]] = {}
        self._name_index: Dict[str, List[str]] = {}
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of the database."""
        if self._initialized:
            return

        logger.info("Initializing stock database...")
        self._load_database()
        self._initialized = True
        logger.info(f"Stock database initialized with {len(self._cache)} stocks")

    def _load_database(self):
        """Load stock database from JSON file."""
        try:
            if STOCK_DB_PATH.exists():
                logger.info(f"Loading stock database from {STOCK_DB_PATH}")
                with open(STOCK_DB_PATH, "r", encoding="utf-8") as f:
                    self._cache = json.load(f)

                # Build name index
                for code, info in self._cache.items():
                    name = info.get("name", "")
                    for char in name:
                        if char not in self._name_index:
                            self._name_index[char] = []
                        if code not in self._name_index[char]:
                            self._name_index[char].append(code)

                logger.info(f"Loaded {len(self._cache)} stocks from database")
            else:
                logger.warning(f"Stock database file not found at {STOCK_DB_PATH}")
                logger.warning("Run 'python scripts/build_stock_database.py' to build the database")
                self._cache = {}

        except Exception as e:
            logger.error(f"Failed to load stock database: {e}")
            self._cache = {}

    def get_stock_info(self, code: str) -> Optional[Dict[str, str]]:
        """
        Get stock information by code.

        Args:
            code: Stock code (e.g., "2330")

        Returns:
            Stock info dict or None if not found
        """
        self._ensure_initialized()

        # Check cache first
        if code in self._cache:
            return self._cache[code]

        # If not in cache, fetch and cache it
        try:
            symbol = f"{code}.TW"
            chinese_name = get_tw_stock_chinese_name(symbol)

            if chinese_name:
                stock_info = {
                    "symbol": symbol,
                    "code": code,
                    "name": chinese_name,
                }
                self._cache[code] = stock_info

                # Update name index
                for char in chinese_name:
                    if char not in self._name_index:
                        self._name_index[char] = []
                    if code not in self._name_index[char]:
                        self._name_index[char].append(code)

                return stock_info
        except Exception as e:
            logger.warning(f"Failed to get stock info for {code}: {e}")

        return None

    def search_by_name(self, query: str, limit: int = 10) -> List[Dict[str, str]]:
        """
        Search stocks by Chinese name.

        Args:
            query: Search query (Chinese characters)
            limit: Maximum number of results

        Returns:
            List of matching stock info dicts
        """
        self._ensure_initialized()

        results = []

        # Search in cache
        for code, info in self._cache.items():
            if query in info["name"]:
                results.append(info)

                if len(results) >= limit:
                    break

        return results


# Global database instance
_stock_db: Optional[StockDatabase] = None


def get_stock_database() -> StockDatabase:
    """Get or create the global stock database instance."""
    global _stock_db
    if _stock_db is None:
        _stock_db = StockDatabase()
    return _stock_db
