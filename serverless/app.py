"""
StockReplay Serverless API - FastAPI on Vercel

Phase 1: Health Check + 基本架構
Phase 2: Stock Data API（一次回傳所有 K 線）
"""

import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from lib.config import settings
from lib.stock_fetcher import fetch_stock_data

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="StockReplay Serverless Backend API - Deployed on Vercel",
    debug=settings.debug,
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Phase 1: Health Check + Root
# ============================================================

@app.get("/")
async def root() -> dict:
    """Root endpoint - API information."""
    return {
        "message": "StockReplay Serverless API",
        "version": settings.app_version,
        "architecture": "serverless",
        "status": "running",
    }


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "serverless",
    }


# ============================================================
# Phase 2: Stock Data API
# ============================================================

@app.get("/api/stock/{symbol}")
async def get_stock_data(
    symbol: str,
    period: Optional[str] = Query("1mo", description="Period: 1mo, 3mo, 6mo, 1y"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
) -> dict:
    """
    一次回傳指定股票的所有 K 線數據。

    與 backend 的差異：
    - backend: POST /playback/start → GET /playback/{id}/next（逐根）
    - serverless: GET /api/stock/{symbol}（一次全部回傳）

    前端拿到所有數據後，自己管理 playback index。
    """
    try:
        candles = fetch_stock_data(
            symbol=symbol,
            period=period,
            start_date=start_date,
            end_date=end_date,
        )

        if not candles:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for {symbol}",
            )

        # Calculate price range (same as backend)
        all_highs = [c["high"] for c in candles]
        all_lows = [c["low"] for c in candles]

        return {
            "symbol": symbol.upper(),
            "data": candles,
            "total_count": len(candles),
            "price_range": {
                "min_price": min(all_lows),
                "max_price": max(all_highs),
            },
            "all_dates": [c["timestamp"][:10] for c in candles],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching stock data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Phase 5: News API (待實作)
# ============================================================
# @app.post("/api/news/fetch")
# async def fetch_news(...):
#     pass


# ============================================================
# Phase 6: Stock Search API (待實作)
# ============================================================
# @app.get("/api/stocks/search")
# async def search_stocks(...):
#     pass
