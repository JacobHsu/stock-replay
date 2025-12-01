"""
Main FastAPI application entry point.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import data_router, playback_router
from .api.news import router as news_router
from .api.stock_search import router as stock_search_router
from .api.trading import router as trading_router
from .config import settings

# Setup logging
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Backend API for StockReplay",
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

# Include routers
app.include_router(data_router)
app.include_router(playback_router)
app.include_router(trading_router)
app.include_router(news_router)
app.include_router(stock_search_router)


@app.get("/")
async def root() -> dict:
    """Root endpoint."""
    return {
        "message": "StockReplay API",
        "version": settings.app_version,
        "status": "running",
    }


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import os
    import uvicorn

    # Railway uses PORT environment variable
    port = int(os.getenv("PORT", settings.port))
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=port,
        reload=settings.debug,
    )
