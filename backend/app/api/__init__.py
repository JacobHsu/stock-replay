"""
API routes initialization.
"""

from .data import router as data_router
from .playback import router as playback_router

__all__ = ["data_router", "playback_router"]
