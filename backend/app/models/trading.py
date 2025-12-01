"""
Pydantic models for trading simulation.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Trade(BaseModel):
    """Single trade record."""

    id: str = Field(..., description="Unique trade ID")
    timestamp: datetime = Field(..., description="Trade execution time")
    type: str = Field(..., description="Trade type: BUY or SELL")
    shares: int = Field(..., description="Number of shares traded")
    price: float = Field(..., description="Price per share")
    total: float = Field(..., description="Total transaction value")
    cash_after: float = Field(..., description="Cash balance after trade")


class Position(BaseModel):
    """Current position information."""

    shares: int = Field(..., description="Number of shares held")
    entry_price: float = Field(..., description="Average entry price")
    entry_time: datetime = Field(..., description="Position entry time")
    current_price: float = Field(..., description="Current market price")
    cost_basis: float = Field(..., description="Total cost of position")
    market_value: float = Field(..., description="Current market value")
    unrealized_pl: float = Field(..., description="Unrealized profit/loss")
    unrealized_pl_pct: float = Field(..., description="Unrealized P/L percentage")


class TradingAccountStatus(BaseModel):
    """Trading account status response."""

    account_id: str = Field(..., description="Account ID")
    playback_id: str = Field(..., description="Playback session ID")
    symbol: str = Field(..., description="Trading symbol")
    initial_cash: float = Field(..., description="Initial cash balance")
    current_cash: float = Field(..., description="Current cash balance")
    position: Optional[Position] = Field(None, description="Current position if any")
    total_value: float = Field(..., description="Total account value (cash + position)")
    realized_pl: float = Field(..., description="Total realized profit/loss")
    unrealized_pl: float = Field(0.0, description="Unrealized profit/loss")
    total_pl: float = Field(..., description="Total P/L (realized + unrealized)")
    total_pl_pct: float = Field(..., description="Total P/L percentage")
    trade_count: int = Field(..., description="Total number of trades")


class TradingAccountCreateRequest(BaseModel):
    """Request to create a trading account."""

    playback_id: str = Field(..., description="Associated playback session ID")
    symbol: str = Field(..., description="Trading symbol")
    initial_cash: float = Field(1000000.0, description="Initial cash balance", gt=0)


class TradingAccountCreateResponse(BaseModel):
    """Response after creating trading account."""

    account_id: str = Field(..., description="Created account ID")
    playback_id: str = Field(..., description="Playback session ID")
    symbol: str = Field(..., description="Trading symbol")
    initial_cash: float = Field(..., description="Initial cash balance")
    status: TradingAccountStatus = Field(..., description="Account status")


class TradeExecuteRequest(BaseModel):
    """Request to execute a trade (buy or sell)."""

    current_price: float = Field(..., description="Current execution price", gt=0)


class TradeExecuteResponse(BaseModel):
    """Response after executing a trade."""

    success: bool = Field(..., description="Whether trade was successful")
    trade: Trade = Field(..., description="Trade details")
    status: TradingAccountStatus = Field(..., description="Updated account status")
    message: str = Field(..., description="Result message")


class TradeHistoryResponse(BaseModel):
    """Trade history response."""

    account_id: str = Field(..., description="Account ID")
    trades: List[Trade] = Field(..., description="List of all trades")
