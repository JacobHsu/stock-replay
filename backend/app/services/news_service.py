"""
News service for fetching, caching, and retrieving stock news.
"""

import logging
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.database.models import DailyNewsSummary, NewsArticle, NewsFetchLog
from app.helpers.newsapi.models import ScrapingConfig
from app.helpers.newsapi.utils import GoogleNewsClient

logger = logging.getLogger(__name__)


class NewsService:
    """
    Service for managing stock news.
    Handles fetching from Google News and caching in SQLite.
    """

    # Source priority mapping (lower number = higher priority)
    SOURCE_PRIORITY = {
        "工商時報": 1,
    }

    # Allowed news domains for Tavily search
    ALLOWED_DOMAINS = [
        "ctee.com.tw",  # 工商時報
    ]

    # Sources to exclude from news collection
    EXCLUDED_SOURCES = [
        "盤中速報",
        "TradingView",
    ]

    def __init__(self, db: Session):
        """
        Initialize news service.

        Args:
            db: SQLAlchemy database session
        """
        self.db = db

    @staticmethod
    def parse_relative_date(date_str: str) -> Optional[datetime]:
        """
        Parse date strings from various formats:
        - Direct date: "2025-11-26"
        - Relative dates: "1 天前", "2 週前", "3 個月前"
        - RFC 2822: "Tue, 25 Nov 2025 10:02:22 GMT"
        - ISO 8601: "2025-11-26T10:00:00Z"

        Args:
            date_str: Date string in various formats

        Returns:
            datetime object (naive, without timezone) or None if parsing fails
        """
        if not date_str:
            return None

        try:
            # Try direct YYYY-MM-DD format first (from 工商時報 URL)
            try:
                return datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                pass

            # Try RFC 2822 format (from Tavily API)
            from email.utils import parsedate_to_datetime

            try:
                dt = parsedate_to_datetime(date_str)
                # Convert to naive datetime (remove timezone)
                return dt.replace(tzinfo=None)
            except (ValueError, TypeError):
                pass

            # Try ISO 8601 format
            try:
                # Handle various ISO formats
                if "T" in date_str:
                    # Remove timezone info if present
                    date_str_clean = date_str.replace("Z", "+00:00")
                    dt = datetime.fromisoformat(date_str_clean)
                    # Convert to naive datetime
                    return dt.replace(tzinfo=None)
            except (ValueError, TypeError):
                pass

            # Handle relative date patterns like "1 天前", "2 週前", "3 個月前"
            patterns = [
                (r"(\d+)\s*天前", lambda n: timedelta(days=int(n))),
                (r"(\d+)\s*週前", lambda n: timedelta(weeks=int(n))),
                (r"(\d+)\s*個月前", lambda n: timedelta(days=int(n) * 30)),
                (r"(\d+)\s*年前", lambda n: timedelta(days=int(n) * 365)),
                (r"(\d+)\s*小時前", lambda n: timedelta(hours=int(n))),
            ]

            for pattern, delta_func in patterns:
                match = re.search(pattern, date_str)
                if match:
                    number = match.group(1)
                    delta = delta_func(number)
                    return datetime.now() - delta

            return None
        except Exception as e:
            logger.warning(f"Failed to parse date '{date_str}': {e}")
            return None

    def _get_source_priority(self, source: str) -> int:
        """
        Get priority value for a news source.

        Args:
            source: Source name

        Returns:
            Priority value (lower is higher priority), defaults to 999 for unknown sources
        """
        for key in self.SOURCE_PRIORITY:
            if key in source:
                return self.SOURCE_PRIORITY[key]
        return 999

    def _is_source_excluded(self, source: str) -> bool:
        """
        Check if a news source should be excluded.

        Args:
            source: Source name

        Returns:
            True if source should be excluded, False otherwise
        """
        for excluded in self.EXCLUDED_SOURCES:
            if excluded in source:
                return True
        return False

    def _get_article_priority(self, article: NewsArticle) -> Tuple[int, int]:
        """
        Get priority value for an article based on content and source.

        Priority rules:
        1. Title contains "謝金河" -> highest priority (0)
        2. Source priority (1-999)

        Args:
            article: NewsArticle object

        Returns:
            Tuple of (content_priority, source_priority) for sorting
        """
        # Check if title contains high-priority keywords
        content_priority = 1  # Default
        if "謝金河" in article.title:
            content_priority = 0  # Highest priority

        source_priority = self._get_source_priority(article.source)

        return (content_priority, source_priority)

    def _group_articles_by_date(self, articles: List[NewsArticle]) -> Dict[str, List[NewsArticle]]:
        """
        Group articles by date (YYYY-MM-DD format).

        Args:
            articles: List of NewsArticle database models

        Returns:
            Dictionary mapping date strings to lists of articles
        """
        grouped = defaultdict(list)
        for article in articles:
            date_key = article.published_date.strftime("%Y-%m-%d")
            grouped[date_key].append(article)
        return dict(grouped)

    def _create_daily_summary(
        self, symbol: str, date: datetime, articles: List[NewsArticle]
    ) -> DailyNewsSummary:
        """
        Create a daily summary from a list of articles.
        Selects primary article based on content priority (e.g., 謝金河) then source priority.

        Args:
            symbol: Stock symbol
            date: Date for the summary
            articles: List of articles for that date

        Returns:
            DailyNewsSummary object
        """
        # Sort by content priority first, then source priority
        sorted_articles = sorted(articles, key=lambda x: self._get_article_priority(x))

        primary = sorted_articles[0]
        related_count = len(articles) - 1

        return DailyNewsSummary(
            symbol=symbol,
            date=date,
            primary_title=primary.title,
            primary_source=primary.source,
            related_count=related_count,
        )

    def _find_missing_date_ranges(
        self, symbol: str, start_date: datetime, end_date: datetime
    ) -> List[Tuple[datetime, datetime]]:
        """
        Find missing date ranges that need to be fetched.
        Uses fetch log to determine what has been queried before.

        Args:
            symbol: Stock symbol
            start_date: Requested start date
            end_date: Requested end date

        Returns:
            List of (start, end) tuples for missing ranges
        """
        logger.info(f"[_find_missing_date_ranges] Checking cache for {symbol}")
        logger.info(
            f"[_find_missing_date_ranges] Target range: {start_date.date()} to {end_date.date()}"
        )

        # Get all fetch logs that overlap with our requested range
        fetch_logs = (
            self.db.query(NewsFetchLog)
            .filter(
                and_(
                    NewsFetchLog.symbol == symbol,
                    # Check for overlap: log.start <= our.end AND log.end >= our.start
                    NewsFetchLog.start_date <= end_date,
                    NewsFetchLog.end_date >= start_date,
                )
            )
            .order_by(NewsFetchLog.start_date)
            .all()
        )

        if not fetch_logs:
            # No previous fetches, need entire range
            total_days = (end_date - start_date).days + 1
            logger.info(
                f"[_find_missing_date_ranges] ✗ No fetch log found - need entire range ({total_days} days)"
            )
            return [(start_date, end_date)]

        logger.info(f"[_find_missing_date_ranges] Found {len(fetch_logs)} existing fetch log(s)")
        for i, log in enumerate(fetch_logs, 1):
            logger.info(
                f"[_find_missing_date_ranges]   Log {i}: {log.start_date.date()} to {log.end_date.date()} ({log.articles_found} articles)"
            )

        # Build a set of all cached dates
        cached_dates = set()
        for log in fetch_logs:
            current = log.start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            log_end = log.end_date.replace(hour=0, minute=0, second=0, microsecond=0)
            while current <= log_end:
                cached_dates.add(current.date())
                current += timedelta(days=1)

        logger.info(
            f"[_find_missing_date_ranges] Coverage: {len(cached_dates)} days already fetched"
        )

        # Find gaps
        missing_ranges = []
        current_range_start = None
        current_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_normalized = end_date.replace(hour=0, minute=0, second=0, microsecond=0)

        total_days_in_range = (end_normalized - current_date).days + 1
        cached_count = 0
        missing_count = 0

        while current_date <= end_normalized:
            if current_date.date() not in cached_dates:
                # This date is missing
                missing_count += 1
                if current_range_start is None:
                    current_range_start = current_date
            else:
                # This date exists
                cached_count += 1
                if current_range_start is not None:
                    # End of a missing range
                    missing_ranges.append((current_range_start, current_date - timedelta(days=1)))
                    current_range_start = None

            current_date += timedelta(days=1)

        # Handle last range if it extends to end_date
        if current_range_start is not None:
            missing_ranges.append((current_range_start, end_normalized))

        logger.info(
            f"[_find_missing_date_ranges] Analysis: {cached_count} cached / {missing_count} missing / {total_days_in_range} total days"
        )

        if missing_ranges:
            logger.info(
                f"[_find_missing_date_ranges] ⚠ Result: {len(missing_ranges)} missing ranges"
            )
        else:
            logger.info(f"[_find_missing_date_ranges] ✓ Result: Fully cached!")

        return missing_ranges

    def fetch_and_cache_news(
        self,
        symbol: str,
        start_date: datetime,
        end_date: datetime,
        max_pages: int = 20,
        max_articles: int = 300,
        progress_callback: Optional[callable] = None,
    ) -> Tuple[int, int]:
        """
        Fetch news from Google News and cache in database.
        Intelligently fetches only missing date ranges.

        Args:
            symbol: Stock symbol (e.g., "2408.TW")
            start_date: Start date for news search
            end_date: End date for news search
            max_pages: Maximum pages to scrape
            max_articles: Maximum articles to fetch
            progress_callback: Optional callback function for progress updates

        Returns:
            Tuple of (total_articles_count, newly_cached_articles)
        """
        logger.info(f"[fetch_and_cache_news] ===== START =====")
        logger.info(f"[fetch_and_cache_news] Symbol: {symbol}")
        logger.info(
            f"[fetch_and_cache_news] Requested range: {start_date.date()} to {end_date.date()}"
        )
        logger.info(f"[fetch_and_cache_news] Days requested: {(end_date - start_date).days + 1}")

        # Check existing cache
        existing_articles = self.db.query(NewsArticle).filter(NewsArticle.symbol == symbol).all()

        if existing_articles:
            existing_dates = sorted(set(a.published_date.date() for a in existing_articles))
            logger.info(
                f"[fetch_and_cache_news] Cache status: {len(existing_articles)} articles, {len(existing_dates)} unique dates"
            )
            logger.info(
                f"[fetch_and_cache_news] Cache range: {existing_dates[0]} to {existing_dates[-1]}"
            )
        else:
            logger.info(f"[fetch_and_cache_news] Cache status: EMPTY - no cached data for {symbol}")

        # Find missing date ranges
        missing_ranges = self._find_missing_date_ranges(symbol, start_date, end_date)

        if not missing_ranges:
            # All dates are cached
            existing_count = (
                self.db.query(NewsArticle)
                .filter(
                    and_(
                        NewsArticle.symbol == symbol,
                        NewsArticle.published_date >= start_date,
                        NewsArticle.published_date <= end_date,
                    )
                )
                .count()
            )
            logger.info(
                f"[fetch_and_cache_news] ✓ ALL CACHED - Using {existing_count} existing articles"
            )
            logger.info(f"[fetch_and_cache_news] ===== END (CACHED) =====")
            if progress_callback:
                progress_callback(100, f"使用快取資料 ({existing_count} 篇)")
            return existing_count, 0

        # Log missing ranges
        total_missing_days = sum((end - start).days + 1 for start, end in missing_ranges)
        logger.info(
            f"[fetch_and_cache_news] ⚠ PARTIAL CACHE - Need to fetch {len(missing_ranges)} missing ranges:"
        )
        for i, (range_start, range_end) in enumerate(missing_ranges, 1):
            days = (range_end - range_start).days + 1
            logger.info(
                f"[fetch_and_cache_news]   Missing range {i}: {range_start.date()} to {range_end.date()} ({days} days)"
            )

        if progress_callback:
            progress_callback(5, f"需要補足 {len(missing_ranges)} 個日期區間")

        # Fetch from Google News for each missing range
        config = ScrapingConfig(max_pages=max_pages, max_articles=max_articles)

        total_newly_cached = 0

        try:
            with GoogleNewsClient(config) as client:
                for idx, (range_start, range_end) in enumerate(missing_ranges):
                    # Progress update
                    progress_pct = 10 + (idx / len(missing_ranges)) * 60
                    if progress_callback:
                        progress_callback(
                            int(progress_pct),
                            f"搜尋 {range_start.strftime('%Y-%m-%d')} ~ {range_end.strftime('%Y-%m-%d')}",
                        )

                    logger.info(
                        f"[fetch_and_cache_news] Fetching range {idx + 1}/{len(missing_ranges)}: {range_start.date()} to {range_end.date()}"
                    )

                    result = client.search_news(
                        query=symbol,
                        start_date=range_start.strftime("%Y-%m-%d"),
                        end_date=range_end.strftime("%Y-%m-%d"),
                    )

                    logger.info(
                        f"[fetch_and_cache_news] Google returned {len(result.articles)} raw articles"
                    )

                    # Parse and cache articles (filter out excluded sources)
                    articles_with_dates = []
                    excluded_count = 0
                    date_parse_failures = 0
                    date_out_of_range = 0

                    for article in result.articles:
                        # Skip excluded sources
                        if self._is_source_excluded(article.source):
                            excluded_count += 1
                            continue

                        parsed_date = self.parse_relative_date(article.date)

                        if not parsed_date:
                            date_parse_failures += 1
                            logger.debug(
                                f"[fetch_and_cache_news] Failed to parse date: '{article.date}'"
                            )
                            continue

                        if range_start <= parsed_date <= range_end:
                            articles_with_dates.append((article, parsed_date))
                        else:
                            date_out_of_range += 1
                            logger.debug(
                                f"[fetch_and_cache_news] Date out of range: {parsed_date.date()} "
                                f"(expected: {range_start.date()} to {range_end.date()})"
                            )

                    if excluded_count > 0:
                        logger.info(
                            f"[fetch_and_cache_news] Excluded {excluded_count} articles from filtered sources"
                        )
                    if date_parse_failures > 0:
                        logger.info(
                            f"[fetch_and_cache_news] Failed to parse {date_parse_failures} article dates"
                        )
                    if date_out_of_range > 0:
                        logger.info(
                            f"[fetch_and_cache_news] Skipped {date_out_of_range} articles with dates outside range"
                        )
                    logger.info(
                        f"[fetch_and_cache_news] Parsed {len(articles_with_dates)} valid articles with dates"
                    )

                    # Cache in database
                    cached_for_range = 0
                    for article, parsed_date in articles_with_dates:
                        db_article = NewsArticle(
                            symbol=symbol,
                            title=article.title,
                            source=article.source,
                            published_date=parsed_date,
                        )
                        self.db.add(db_article)
                        total_newly_cached += 1
                        cached_for_range += 1

                    self.db.commit()
                    logger.info(
                        f"[fetch_and_cache_news] ✓ Cached {cached_for_range} articles for this range"
                    )

                    # Record fetch log for this range
                    fetch_log = NewsFetchLog(
                        symbol=symbol,
                        start_date=range_start,
                        end_date=range_end,
                        articles_found=cached_for_range,
                    )
                    self.db.add(fetch_log)
                    self.db.commit()
                    logger.info(f"[fetch_and_cache_news] ✓ Recorded fetch log for this range")

                    # Generate summaries for this range
                    self._generate_daily_summaries(symbol, range_start, range_end)

                if progress_callback:
                    progress_callback(90, "整理快取資料...")

                # Get total count for entire requested period
                total_count = (
                    self.db.query(NewsArticle)
                    .filter(
                        and_(
                            NewsArticle.symbol == symbol,
                            NewsArticle.published_date >= start_date,
                            NewsArticle.published_date <= end_date,
                        )
                    )
                    .count()
                )

                if progress_callback:
                    progress_callback(
                        100, f"完成！共 {total_count} 篇（新增 {total_newly_cached} 篇）"
                    )

                logger.info(f"[fetch_and_cache_news] ===== SUMMARY =====")
                logger.info(f"[fetch_and_cache_news] Newly cached: {total_newly_cached} articles")
                logger.info(f"[fetch_and_cache_news] Total available: {total_count} articles")
                logger.info(f"[fetch_and_cache_news] ===== END (SUCCESS) =====")
                return total_count, total_newly_cached

        except Exception as e:
            logger.error(f"[fetch_and_cache_news] ❌ ERROR: {e}")
            logger.error(f"[fetch_and_cache_news] ===== END (FAILED) =====")
            self.db.rollback()
            raise

    def _generate_daily_summaries(self, symbol: str, start_date: datetime, end_date: datetime):
        """
        Generate daily summaries for cached articles.

        Args:
            symbol: Stock symbol
            start_date: Start date
            end_date: End date
        """
        # Get all articles for the period
        articles = (
            self.db.query(NewsArticle)
            .filter(
                and_(
                    NewsArticle.symbol == symbol,
                    NewsArticle.published_date >= start_date,
                    NewsArticle.published_date <= end_date,
                )
            )
            .all()
        )

        # Group by date
        grouped = self._group_articles_by_date(articles)

        # Delete existing summaries for this period
        self.db.query(DailyNewsSummary).filter(
            and_(
                DailyNewsSummary.symbol == symbol,
                DailyNewsSummary.date >= start_date,
                DailyNewsSummary.date <= end_date,
            )
        ).delete()

        # Create new summaries
        for date_str, date_articles in grouped.items():
            date = datetime.strptime(date_str, "%Y-%m-%d")
            summary = self._create_daily_summary(symbol, date, date_articles)
            self.db.add(summary)

        self.db.commit()

    def get_daily_summaries(
        self, symbol: str, start_date: datetime, end_date: datetime
    ) -> List[DailyNewsSummary]:
        """
        Get daily news summaries for a period.

        Args:
            symbol: Stock symbol
            start_date: Start date
            end_date: End date

        Returns:
            List of DailyNewsSummary objects, sorted by date
        """
        summaries = (
            self.db.query(DailyNewsSummary)
            .filter(
                and_(
                    DailyNewsSummary.symbol == symbol,
                    DailyNewsSummary.date >= start_date,
                    DailyNewsSummary.date <= end_date,
                )
            )
            .order_by(DailyNewsSummary.date.desc())
            .all()
        )

        return summaries

    def get_news_for_date(self, symbol: str, date: datetime) -> List[DailyNewsSummary]:
        """
        Get news summaries for a specific trading day.
        Includes news from the current day and any preceding weekend/non-trading days.
        Results are sorted with high-priority content (e.g., 謝金河) appearing first.

        For example, if querying Monday, will return:
        - Monday's news
        - Sunday's news (if any)
        - Saturday's news (if any)
        - Friday's news (if Friday was a holiday)

        Args:
            symbol: Stock symbol
            date: Trading day date to query

        Returns:
            List of DailyNewsSummary objects (may include multiple days), sorted by priority
        """
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)

        # Look back up to 3 days to catch weekend news
        # Monday (0) -> look back to Friday (3 days)
        # Tuesday-Sunday -> look back 1 day
        lookback_days = 3 if start_of_day.weekday() == 0 else 1
        search_start = start_of_day - timedelta(days=lookback_days)

        summaries = (
            self.db.query(DailyNewsSummary)
            .filter(
                and_(
                    DailyNewsSummary.symbol == symbol,
                    DailyNewsSummary.date >= search_start,
                    DailyNewsSummary.date <= start_of_day,
                )
            )
            .order_by(DailyNewsSummary.date.desc())
            .all()
        )

        # Sort summaries by priority:
        # 1. Title contains "謝金河" -> highest priority (0)
        # 2. Then by date (descending)
        def get_summary_priority(summary: DailyNewsSummary) -> Tuple[int, datetime]:
            content_priority = 0 if "謝金河" in summary.primary_title else 1
            return (content_priority, -summary.date.timestamp())  # Negative for desc order

        sorted_summaries = sorted(summaries, key=get_summary_priority)

        return sorted_summaries

    def get_dates_with_news(
        self, symbol: str, start_date: datetime, end_date: datetime
    ) -> List[str]:
        """
        Get list of dates that have news (for marking on timeline).

        Args:
            symbol: Stock symbol
            start_date: Start date
            end_date: End date

        Returns:
            List of date strings in YYYY-MM-DD format
        """
        summaries = (
            self.db.query(DailyNewsSummary.date)
            .filter(
                and_(
                    DailyNewsSummary.symbol == symbol,
                    DailyNewsSummary.date >= start_date,
                    DailyNewsSummary.date <= end_date,
                )
            )
            .all()
        )

        return [s.date.strftime("%Y-%m-%d") for s in summaries]

    def get_trading_dates_with_news(
        self, symbol: str, start_date: datetime, end_date: datetime, trading_dates: List[str]
    ) -> List[str]:
        """
        Get list of trading dates that should display news markers.
        Maps weekend/non-trading day news to the next trading day.

        Args:
            symbol: Stock symbol
            start_date: Start date
            end_date: End date
            trading_dates: List of actual trading dates in YYYY-MM-DD format

        Returns:
            List of trading date strings in YYYY-MM-DD format where news should appear
        """
        # Get all dates with news
        news_dates_str = self.get_dates_with_news(symbol, start_date, end_date)

        if not news_dates_str or not trading_dates:
            return []

        # Convert to sets for faster lookup
        trading_dates_set = set(trading_dates)
        display_dates = set()

        # Sort trading dates for finding next trading day
        sorted_trading = sorted(trading_dates)

        for news_date_str in news_dates_str:
            if news_date_str in trading_dates_set:
                # News on a trading day - display on that day
                display_dates.add(news_date_str)
            else:
                # News on non-trading day (weekend/holiday) - find next trading day
                news_date = datetime.strptime(news_date_str, "%Y-%m-%d")

                # Find the next trading day
                for trading_date_str in sorted_trading:
                    trading_date = datetime.strptime(trading_date_str, "%Y-%m-%d")
                    if trading_date > news_date:
                        display_dates.add(trading_date_str)
                        logger.debug(
                            f"[get_trading_dates_with_news] Mapping {news_date_str} (non-trading) → {trading_date_str}"
                        )
                        break

        return sorted(list(display_dates))
