"""
Database models for news caching.
"""

from sqlalchemy import Column, DateTime, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.database.connection import Base


class NewsArticle(Base):
    """
    Individual news article cache.
    """

    __tablename__ = "news_articles"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    title = Column(Text, nullable=False)
    source = Column(String(100), nullable=False)
    published_date = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    # Composite index for faster queries
    __table_args__ = (Index("idx_symbol_date", "symbol", "published_date"),)

    def __repr__(self):
        return f"<NewsArticle(symbol={self.symbol}, date={self.published_date}, title={self.title[:30]})>"


class DailyNewsSummary(Base):
    """
    Daily grouped news summary for quick access.
    Stores the primary news title and count of related articles.
    """

    __tablename__ = "daily_news_summary"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    primary_title = Column(Text, nullable=False)
    primary_source = Column(String(100), nullable=False)
    related_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    # Composite index for faster queries
    __table_args__ = (Index("idx_summary_symbol_date", "symbol", "date"),)

    def __repr__(self):
        return f"<DailyNewsSummary(symbol={self.symbol}, date={self.date}, related={self.related_count})>"


class NewsFetchLog(Base):
    """
    Log of news fetch operations to track which date ranges have been queried.
    Used to avoid redundant fetches.
    """

    __tablename__ = "news_fetch_log"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    articles_found = Column(Integer, default=0)
    fetch_time = Column(DateTime, server_default=func.now())

    # Composite index for faster queries
    __table_args__ = (Index("idx_fetch_log_symbol_dates", "symbol", "start_date", "end_date"),)

    def __repr__(self):
        return f"<NewsFetchLog(symbol={self.symbol}, range={self.start_date.date()} to {self.end_date.date()}, found={self.articles_found})>"
