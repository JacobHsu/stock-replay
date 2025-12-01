"""
Test Tavily news integration.

Run this test to verify Tavily API is working correctly.
Make sure to set TAVILY_API_KEY in your .env file.
"""

import os
import sys
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Load environment variables
from dotenv import load_dotenv

load_dotenv()

from app.helpers.newsapi.models import ScrapingConfig
from app.helpers.newsapi.utils import GoogleNewsClient


def test_tavily_news():
    """Test Tavily news search."""
    print("=" * 60)
    print("Testing Tavily News Integration")
    print("=" * 60)

    # Check API key
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        print("✗ ERROR: TAVILY_API_KEY not set in environment")
        print("  Please add TAVILY_API_KEY to your .env file")
        return False

    print(f"✓ API Key found: {api_key[:10]}...")
    print()

    # Test parameters
    symbol = "2330.TW"  # TSMC
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)  # Last week

    print(f"Test Parameters:")
    print(f"  Symbol: {symbol}")
    print(f"  Date Range: {start_date.date()} to {end_date.date()}")
    print()

    try:
        # Create client
        config = ScrapingConfig(max_articles=5)
        client = GoogleNewsClient(config)
        print("✓ Tavily client initialized")

        # Search news
        print(f"\nSearching for news about {symbol}...")
        result = client.search_news(
            query=symbol,
            start_date=start_date.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
        )

        print(f"\n✓ Search completed!")
        print(f"  Found {result.total_results} articles")
        print()

        if result.articles:
            print("Sample Articles:")
            print("-" * 60)
            for i, article in enumerate(result.articles[:3], 1):
                print(f"\n{i}. {article.title}")
                print(f"   Source: {article.source}")
                print(f"   Date: {article.date}")
                print(f"   Snippet: {article.snippet[:100]}...")
            print()
        else:
            print("⚠ No articles found (this might be normal if there's no recent news)")

        print("=" * 60)
        print("✅ Tavily integration test PASSED!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        print()
        print("=" * 60)
        print("❌ Tavily integration test FAILED!")
        print("=" * 60)
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_tavily_news()
    sys.exit(0 if success else 1)
