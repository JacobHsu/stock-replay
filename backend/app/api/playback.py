"""
Playback API endpoints for controlling data playback sessions.
"""

import logging

from fastapi import APIRouter, HTTPException, Path, Query

from ..models.playback import (
    PlaybackCreateRequest,
    PlaybackSeekRequest,
    PlaybackStatusResponse,
)
from ..services.playback_service import playback_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/playback", tags=["playback"])


@router.post("/start", response_model=PlaybackStatusResponse)
async def start_playback(request: PlaybackCreateRequest) -> PlaybackStatusResponse:
    """
    Start a new playback session.

    Args:
        request: Playback creation request with symbol and date range

    Returns:
        PlaybackStatusResponse with session info
    """
    try:
        session = playback_service.create_session(
            symbol=request.symbol,
            start_date=request.start_date,
            end_date=request.end_date,
            period=request.period,
        )

        if session is None:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to create playback session for {request.symbol}",
            )

        return PlaybackStatusResponse(
            playback_id=session.playback_id,
            symbol=session.symbol,
            current_index=session.current_index,
            total_count=session.get_total_count(),
            has_more=session.has_more(),
            current_data=session.get_current(),
            price_range=session.get_price_range(),
            all_dates=session.get_all_dates(),  # Include all trading dates for news mapping
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting playback: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{playback_id}/status", response_model=PlaybackStatusResponse)
async def get_playback_status(
    playback_id: str = Path(..., description="Playback session ID"),
) -> PlaybackStatusResponse:
    """
    Get current playback status.

    Args:
        playback_id: Unique playback session identifier

    Returns:
        PlaybackStatusResponse with current status
    """
    session = playback_service.get_session(playback_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Playback session not found")

    return PlaybackStatusResponse(
        playback_id=session.playback_id,
        symbol=session.symbol,
        current_index=session.current_index,
        total_count=session.get_total_count(),
        has_more=session.has_more(),
        current_data=session.get_current(),
        price_range=session.get_price_range(),
    )


@router.get("/{playback_id}/next", response_model=PlaybackStatusResponse)
async def get_next_candle(
    playback_id: str = Path(..., description="Playback session ID"),
    count: int = Query(1, description="Number of candles to retrieve", ge=1, le=100),
) -> PlaybackStatusResponse:
    """
    Get next N candles and advance playback position.

    Args:
        playback_id: Unique playback session identifier
        count: Number of candles to retrieve (default: 1)

    Returns:
        PlaybackStatusResponse with next candle(s)
    """
    session = playback_service.get_session(playback_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Playback session not found")

    # Get next candles (this also advances the position)
    candles = session.next(count)

    if not candles:
        raise HTTPException(status_code=404, detail="No more data available")

    # Return the last candle as current_data
    return PlaybackStatusResponse(
        playback_id=session.playback_id,
        symbol=session.symbol,
        current_index=session.current_index,
        total_count=session.get_total_count(),
        has_more=session.has_more(),
        current_data=candles[-1] if candles else None,
        price_range=session.get_price_range(),
    )


@router.post("/{playback_id}/seek", response_model=PlaybackStatusResponse)
async def seek_playback(
    playback_id: str = Path(..., description="Playback session ID"),
    request: PlaybackSeekRequest = ...,
) -> PlaybackStatusResponse:
    """
    Seek to a specific position in the playback.

    Args:
        playback_id: Unique playback session identifier
        request: Seek request with target index

    Returns:
        PlaybackStatusResponse at the new position
    """
    session = playback_service.get_session(playback_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Playback session not found")

    success = session.seek(request.index)
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid index {request.index} (total: {session.get_total_count()})",
        )

    return PlaybackStatusResponse(
        playback_id=session.playback_id,
        symbol=session.symbol,
        current_index=session.current_index,
        total_count=session.get_total_count(),
        has_more=session.has_more(),
        current_data=session.get_current(),
        price_range=session.get_price_range(),
    )


@router.delete("/{playback_id}")
async def delete_playback(playback_id: str = Path(..., description="Playback session ID")) -> dict:
    """
    Delete a playback session.

    Args:
        playback_id: Unique playback session identifier

    Returns:
        Success message
    """
    success = playback_service.delete_session(playback_id)
    if not success:
        raise HTTPException(status_code=404, detail="Playback session not found")

    return {"message": "Playback session deleted successfully"}
