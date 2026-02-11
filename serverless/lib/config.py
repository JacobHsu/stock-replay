"""
Serverless application configuration.
Simplified version of backend/app/config.py for serverless deployment.
"""

import os
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings for serverless deployment."""

    # Application
    app_name: str = "StockReplay Serverless"
    app_version: str = "0.1.0"
    debug: bool = False

    # CORS - 允許的前端來源
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:2330",
        "https://stock-replay.vercel.app",
        "https://stock-replay-*.vercel.app",
    ]

    # External APIs
    tavily_api_key: str = ""
    rapidapi_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Global settings instance
settings = Settings()
print(f"DEBUG: TAVILY_API_KEY loaded: {settings.tavily_api_key[:5]}...")
