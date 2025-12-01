"""
Debug Tavily response for Taiwan stocks.
"""

import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv

load_dotenv()

from app.helpers.newsapi.models import ScrapingConfig
from app.helpers.newsapi.utils import GoogleNewsClient


def debug_tavily_taiwan_stock():
    """Debug Tavily response for Taiwan stock."""
    print("=" * 60)
    print("Debugging Tavily for Taiwan Stock (8033.TW)")
    print("=" * 60)

    symbol = "8033.TW"
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)

    print(f"\nTest Parameters:")
    print(f"  Symbol: {symbol}")
    print(f"  Date Range: {start_date.date()} to {end_date.date()}")
    print()

    try:
        config = ScrapingConfig(max_articles=20)
        client = GoogleNewsClient(config)

        result = client.search_news(
            query=symbol,
            start_date=start_date.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
        )

        print(f"✓ Found {len(result.articles)} articles\n")

        if result.articles:
            print("Sample Articles with Dates:")
            print("-" * 60)
            for i, article in enumerate(result.articles[:10], 1):
                print(f"\n{i}. Title: {article.title[:80]}...")
                print(f"   Source: {article.source}")
                print(f"   Date String: '{article.date}'")

                # Try to parse the date
                from app.services.news_service import NewsService

                parsed = NewsService.parse_relative_date(article.date)
                if parsed:
                    print(f"   Parsed Date: {parsed.date()} {parsed.time()}")
                    # Check if in range
                    in_range = start_date <= parsed <= end_date
                    print(f"   In Range: {'✓ YES' if in_range else '✗ NO'}")
                else:
                    print(f"   Parsed Date: ✗ FAILED TO PARSE")

        print("\n" + "=" * 60)

    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    debug_tavily_taiwan_stock()
