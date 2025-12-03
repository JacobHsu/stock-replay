"""
Application configuration using pydantic-settings.
"""

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    # Application
    app_name: str = "StockReplay"
    app_version: str = "0.1.0"
    debug: bool = True
    environment: str = "development"

    # Server
    host: str = "0.0.0.0"
    port: int = 8888

    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://stock-replay.vercel.app",
        "https://stock-replay-*.vercel.app",  # 支持 Vercel 預覽部署
    ]

    # Logging
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


# Global settings instance
settings = Settings()
