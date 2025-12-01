"""
News search utilities using Tavily API - Clean and efficient implementation.
"""

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from tavily import TavilyClient

# Load .env file
env_path = Path(__file__).parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Set up logger
log = logging.getLogger(__name__)

from .exceptions import (
    GoogleNewsError,
    InvalidDateFormatError,
    ScrapingError,
)
from .models import NewsArticle, NewsSearchResult, ScrapingConfig
from .stock_name_fetcher import build_news_query


def validate_date_format(date_str: str) -> str:
    """
    Validate and convert date format to YYYY-MM-DD.

    Args:
        date_str: Date string in YYYY-MM-DD or MM/DD/YYYY format

    Returns:
        Date string in YYYY-MM-DD format

    Raises:
        InvalidDateFormatError: If date format is invalid
    """
    try:
        if "-" in date_str:
            # Validate YYYY-MM-DD format
            datetime.strptime(date_str, "%Y-%m-%d")
            return date_str
        elif "/" in date_str:
            # Convert MM/DD/YYYY to YYYY-MM-DD
            date_obj = datetime.strptime(date_str, "%m/%d/%Y")
            return date_obj.strftime("%Y-%m-%d")
        else:
            raise InvalidDateFormatError(f"Invalid date format: {date_str}")
    except ValueError as e:
        raise InvalidDateFormatError(f"Invalid date format: {date_str}. Error: {e}")


class GoogleNewsClient:
    """Client for fetching news using Tavily API."""

    # Allowed news domains (Taiwan financial news sources)
    ALLOWED_DOMAINS = [
        "ctee.com.tw",  # 工商時報
    ]

    def __init__(self, config: Optional[ScrapingConfig] = None):
        """
        Initialize the news client.

        Args:
            config: Scraping configuration (used for compatibility, max_articles only)
        """
        self.config = config or ScrapingConfig()

        # Get API key from environment
        api_key = os.environ.get("TAVILY_API_KEY")
        if not api_key:
            raise GoogleNewsError("TAVILY_API_KEY environment variable not set")

        self.client = TavilyClient(api_key=api_key)
        log.info("Initialized Tavily news client")

    def search_news(
        self,
        query: str,
        start_date: str,
        end_date: str,
        max_pages: Optional[int] = None,
    ) -> NewsSearchResult:
        """
        Search news using Tavily API.

        Args:
            query: Search query string (e.g., stock symbol)
            start_date: Start date (YYYY-MM-DD or MM/DD/YYYY)
            end_date: End date (YYYY-MM-DD or MM/DD/YYYY)
            max_pages: Not used (kept for compatibility)

        Returns:
            NewsSearchResult object containing all found articles

        Raises:
            InvalidDateFormatError: If date format is invalid
            ScrapingError: If API call fails
            GoogleNewsError: For other errors
        """
        # Validate and convert dates
        try:
            start_date_formatted = validate_date_format(start_date)
            end_date_formatted = validate_date_format(end_date)
        except InvalidDateFormatError:
            raise

        result = NewsSearchResult.create_empty(query, start_date, end_date)

        # Build optimized query with Chinese company name
        optimized_query = build_news_query(query)

        log.info(
            f"Starting Tavily news search for query: '{optimized_query}' (original: '{query}') from {start_date} to {end_date}"
        )

        try:
            # Calculate time range (days between start and end)
            start_dt = datetime.strptime(start_date_formatted, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date_formatted, "%Y-%m-%d")
            days_diff = (end_dt - start_dt).days

            # Determine time_range parameter
            if days_diff <= 1:
                time_range = "day"
            elif days_diff <= 7:
                time_range = "week"
            elif days_diff <= 30:
                time_range = "month"
            else:
                time_range = "year"

            # Use max_articles from config
            max_results = min(self.config.max_articles, 20)  # Tavily max is 20

            # Perform Tavily search with news topic and domain filtering
            response = self.client.search(
                query=optimized_query,  # Use optimized query with Chinese name
                topic="news",  # Focus on news results
                search_depth="basic",  # Basic is faster and sufficient for news
                max_results=max_results,
                include_raw_content=False,  # Don't need full content
                include_images=False,  # Don't need images
                time_range=time_range,
                include_domains=self.ALLOWED_DOMAINS,  # Only search in allowed domains
            )

            log.info(f"Tavily returned {len(response.get('results', []))} results")

            # Convert Tavily results to NewsArticle objects
            articles = []
            for item in response.get("results", []):
                url = item.get("url", "")

                # Extract date from URL (工商時報 format: /YYYYMMDD)
                published_date = self._extract_date_from_url(url)

                # Skip articles without valid dates
                if not published_date:
                    log.debug(f"Skipping article without date: {item.get('title', '')[:50]}")
                    continue

                article = NewsArticle(
                    title=item.get("title", ""),
                    snippet=item.get("content", "")[:200],  # Limit snippet length
                    date=published_date,
                    source=self._extract_source_from_url(url),
                )
                articles.append(article)

            result.articles = articles
            result.total_results = len(articles)
            result.pages_scraped = 1  # Tavily returns all results in one call

            log.info(f"Successfully retrieved {result.total_results} articles")

        except Exception as e:
            log.error(f"Tavily API error: {e}")
            raise ScrapingError(f"Failed to fetch news from Tavily: {e}")

        return result

    def _extract_source_from_url(self, url: str) -> str:
        """
        Extract source name from URL.

        Args:
            url: Article URL

        Returns:
            Source name extracted from domain
        """
        try:
            from urllib.parse import urlparse

            domain = urlparse(url).netloc
            # Remove www. and .com/.tw etc
            domain = domain.replace("www.", "")
            parts = domain.split(".")
            return parts[0].title() if parts else "Unknown"
        except Exception:
            return "Unknown"

    def _extract_date_from_url(self, url: str) -> Optional[str]:
        """
        Extract date from URL (工商時報 format: /YYYYMMDD).

        Args:
            url: Article URL

        Returns:
            Date string in YYYY-MM-DD format, or None if not found
        """
        import re

        # Pattern for 工商時報: /news/YYYYMMDD
        pattern = r"/(\d{8})"
        match = re.search(pattern, url)

        if match:
            date_str = match.group(1)
            # Parse YYYYMMDD
            year = date_str[:4]
            month = date_str[4:6]
            day = date_str[6:8]

            # Validate date
            try:
                datetime.strptime(f"{year}-{month}-{day}", "%Y-%m-%d")
                return f"{year}-{month}-{day}"
            except ValueError:
                log.warning(f"Invalid date in URL: {date_str}")
                return None

        return None

    def close(self):
        """Close the client (no-op for Tavily, kept for compatibility)."""
        pass

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


# Backward compatibility function
def getNewsData(query: str, start_date: str, end_date: str) -> List[dict]:
    """
    Legacy function for backward compatibility.

    Args:
        query: Search query
        start_date: Start date (YYYY-MM-DD or MM/DD/YYYY)
        end_date: End date (YYYY-MM-DD or MM/DD/YYYY)

    Returns:
        List of dictionaries containing article data
    """
    try:
        with GoogleNewsClient() as client:
            result = client.search_news(query, start_date, end_date)

            return [
                {
                    "title": article.title,
                    "snippet": article.snippet,
                    "date": article.date,
                    "source": article.source,
                }
                for article in result.articles
            ]
    except Exception as e:
        log.error(f"Error in getNewsData: {e}")
        return []


# Convenience function
def search_google_news(
    query: str,
    start_date: str,
    end_date: str,
    max_pages: int = 2,
    max_articles: int = 8,
) -> NewsSearchResult:
    """
    Convenient function to search news.

    Args:
        query: Search query
        start_date: Start date (YYYY-MM-DD or MM/DD/YYYY)
        end_date: End date (YYYY-MM-DD or MM/DD/YYYY)
        max_pages: Not used (kept for compatibility)
        max_articles: Maximum articles to return

    Returns:
        NewsSearchResult object
    """
    config = ScrapingConfig(max_pages=max_pages, max_articles=max_articles)
    with GoogleNewsClient(config) as client:
        return client.search_news(query, start_date, end_date)
