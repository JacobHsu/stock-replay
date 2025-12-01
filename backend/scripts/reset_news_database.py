"""
Reset news database - Delete all news articles, summaries, and fetch logs.

This script completely clears the news database to start fresh.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import get_db, init_db
from app.database.models import DailyNewsSummary, NewsArticle, NewsFetchLog

# Initialize database
init_db()


def reset_news_database():
    """Delete all news data from database."""
    db = next(get_db())

    try:
        # Count current records
        article_count = db.query(NewsArticle).count()
        summary_count = db.query(DailyNewsSummary).count()
        fetch_log_count = db.query(NewsFetchLog).count()

        print(f"Current database status:")
        print(f"  - News Articles: {article_count}")
        print(f"  - Daily Summaries: {summary_count}")
        print(f"  - Fetch Logs: {fetch_log_count}")
        print()

        if article_count == 0 and summary_count == 0 and fetch_log_count == 0:
            print("✓ Database is already empty.")
            return

        # Confirm deletion
        response = input("⚠️  This will DELETE ALL news data. Continue? (yes/no): ")
        if response.lower() not in ["yes", "y"]:
            print("✗ Reset cancelled.")
            return

        print("\nDeleting data...")

        # Delete in correct order (child tables first)
        deleted_summaries = db.query(DailyNewsSummary).delete()
        print(f"  ✓ Deleted {deleted_summaries} daily summaries")

        deleted_articles = db.query(NewsArticle).delete()
        print(f"  ✓ Deleted {deleted_articles} news articles")

        deleted_logs = db.query(NewsFetchLog).delete()
        print(f"  ✓ Deleted {deleted_logs} fetch logs")

        db.commit()

        print("\n✅ News database reset complete!")
        print("   All news data has been cleared.")

    except Exception as e:
        db.rollback()
        print(f"\n✗ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Reset News Database")
    print("=" * 60)
    print()

    reset_news_database()

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)
