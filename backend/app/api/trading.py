"""
Trading API endpoints for buy/sell operations and account management.
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from app.models.trading import (
    TradeExecuteRequest,
    TradeExecuteResponse,
    TradeHistoryResponse,
    TradingAccountCreateRequest,
    TradingAccountCreateResponse,
    TradingAccountStatus,
)
from app.services.trading_service import trading_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trading", tags=["trading"])


@router.post("/account/create", response_model=TradingAccountCreateResponse)
async def create_trading_account(
    request: TradingAccountCreateRequest,
) -> TradingAccountCreateResponse:
    """
    Create a new trading account linked to a playback session.

    Args:
        request: Contains playback_id, symbol, and initial_cash

    Returns:
        TradingAccountCreateResponse with account_id and initial details

    Raises:
        HTTPException: If playback session is invalid
    """
    try:
        logger.info(
            f"Creating trading account: playback_id={request.playback_id}, symbol={request.symbol}, initial_cash={request.initial_cash}"
        )

        account_id = trading_service.create_account(
            playback_id=request.playback_id,
            symbol=request.symbol,
            initial_cash=request.initial_cash,
        )

        logger.info(f"Account created: {account_id}")

        # Get account to return full status
        account = trading_service.get_account(account_id)
        if not account:
            logger.error(f"Failed to retrieve created account {account_id}")
            raise HTTPException(status_code=500, detail="Failed to retrieve created account")

        status = account.get_status()
        logger.info(f"Account status retrieved: {status}")

        return TradingAccountCreateResponse(
            account_id=account_id,
            playback_id=request.playback_id,
            symbol=request.symbol,
            initial_cash=request.initial_cash,
            status=status,
        )
    except ValueError as e:
        logger.error(f"ValueError in create_trading_account: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in create_trading_account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create trading account: {str(e)}")


@router.get("/account/{account_id}/status", response_model=TradingAccountStatus)
async def get_account_status(account_id: str, current_price: float = None) -> TradingAccountStatus:
    """
    Get current status of a trading account.

    Args:
        account_id: The trading account ID
        current_price: Optional current price for position valuation

    Returns:
        TradingAccountStatus with current cash, position, and P/L

    Raises:
        HTTPException: If account not found
    """
    account = trading_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Trading account {account_id} not found")

    return account.get_status(current_price=current_price)


@router.post("/account/{account_id}/buy", response_model=TradeExecuteResponse)
async def execute_buy(account_id: str, request: TradeExecuteRequest) -> TradeExecuteResponse:
    """
    Execute a buy operation (all-in: uses all available cash).

    Args:
        account_id: The trading account ID
        request: Contains current_price for execution

    Returns:
        TradeExecuteResponse with trade details and updated status

    Raises:
        HTTPException: If account not found or buy operation fails
    """
    account = trading_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Trading account {account_id} not found")

    try:
        trade = account.buy(current_price=request.current_price)
        status = account.get_status(current_price=request.current_price)

        return TradeExecuteResponse(
            success=True,
            trade=trade,
            status=status,
            message=f"Bought {trade.shares} shares at ${trade.price:.2f}",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Buy operation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Buy operation failed: {str(e)}")


@router.post("/account/{account_id}/sell", response_model=TradeExecuteResponse)
async def execute_sell(account_id: str, request: TradeExecuteRequest) -> TradeExecuteResponse:
    """
    Execute a sell operation (all-out: sells entire position).

    Args:
        account_id: The trading account ID
        request: Contains current_price for execution

    Returns:
        TradeExecuteResponse with trade details and updated status

    Raises:
        HTTPException: If account not found or sell operation fails
    """
    account = trading_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Trading account {account_id} not found")

    try:
        trade = account.sell(current_price=request.current_price)
        status = account.get_status(current_price=request.current_price)

        return TradeExecuteResponse(
            success=True,
            trade=trade,
            status=status,
            message=f"Sold {trade.shares} shares at ${trade.price:.2f}",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Sell operation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Sell operation failed: {str(e)}")


@router.get("/account/{account_id}/history", response_model=TradeHistoryResponse)
async def get_trade_history(account_id: str) -> TradeHistoryResponse:
    """
    Get complete trade history for an account.

    Args:
        account_id: The trading account ID

    Returns:
        TradeHistoryResponse with list of all trades

    Raises:
        HTTPException: If account not found
    """
    account = trading_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Trading account {account_id} not found")

    trades = account.get_history()
    return TradeHistoryResponse(account_id=account_id, trades=trades)


@router.delete("/account/{account_id}")
async def delete_trading_account(account_id: str) -> Dict[str, Any]:
    """
    Delete a trading account.

    Args:
        account_id: The trading account ID

    Returns:
        Success message

    Raises:
        HTTPException: If account not found
    """
    success = trading_service.delete_account(account_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Trading account {account_id} not found")

    return {"message": f"Trading account {account_id} deleted successfully"}
