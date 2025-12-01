"""
Trading service for managing trading accounts and executing trades.
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from ..models.trading import (
    Position,
    Trade,
    TradeExecuteResponse,
    TradeHistoryResponse,
    TradingAccountCreateResponse,
    TradingAccountStatus,
)
from .playback_service import playback_service

logger = logging.getLogger(__name__)


class TradingAccount:
    """Represents a trading account tied to a playback session."""

    def __init__(self, account_id: str, playback_id: str, symbol: str, initial_cash: float) -> None:
        """
        Initialize trading account.

        Args:
            account_id: Unique account identifier
            playback_id: Associated playback session ID
            symbol: Trading symbol
            initial_cash: Initial cash balance
        """
        self.account_id = account_id
        self.playback_id = playback_id
        self.symbol = symbol
        self.initial_cash = initial_cash
        self.current_cash = initial_cash

        # Position (None or Position data)
        self.position_shares: Optional[int] = None
        self.position_entry_price: Optional[float] = None
        self.position_entry_time: Optional[datetime] = None

        # Statistics
        self.realized_pl = 0.0
        self.trades: List[Trade] = []

    def has_position(self) -> bool:
        """Check if account has an open position."""
        return self.position_shares is not None and self.position_shares > 0

    def can_buy(self) -> bool:
        """Check if can execute buy (has enough cash for 1000 shares)."""
        return True  # Simplified: always allow buy attempt, will check cash in buy() method

    def can_sell(self) -> bool:
        """Check if can execute sell (has at least 1 share)."""
        return self.has_position() and self.position_shares >= 1

    def buy(self, current_price: float) -> Trade:
        """
        Execute buy order - buy fixed 1 share.

        Args:
            current_price: Current market price

        Returns:
            Trade object

        Raises:
            ValueError: If cannot buy
        """
        # Fixed shares per trade
        shares_to_buy = 1

        # Calculate total cost
        total_cost = shares_to_buy * current_price

        # Check if we have enough cash
        if self.current_cash < total_cost:
            raise ValueError(
                f"Insufficient cash: have ${self.current_cash:.2f}, need ${total_cost:.2f} for {shares_to_buy} shares"
            )

        # Execute trade
        self.current_cash -= total_cost

        # Add to position (allow accumulation)
        if self.position_shares is None:
            self.position_shares = shares_to_buy
            self.position_entry_price = current_price
            self.position_entry_time = datetime.now()
        else:
            # Average down/up the position
            old_shares = self.position_shares
            old_entry = self.position_entry_price
            new_total_shares = old_shares + shares_to_buy
            new_avg_price = (
                (old_shares * old_entry) + (shares_to_buy * current_price)
            ) / new_total_shares

            self.position_shares = new_total_shares
            self.position_entry_price = new_avg_price

        # Record trade
        trade = Trade(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            type="buy",
            shares=shares_to_buy,
            price=current_price,
            total=total_cost,
            cash_after=self.current_cash,
        )
        self.trades.append(trade)

        logger.info(
            f"BUY executed: {shares_to_buy} shares @ ${current_price:.2f} = ${total_cost:.2f}, Position: {self.position_shares} shares"
        )

        return trade

    def sell(self, current_price: float) -> Trade:
        """
        Execute sell order - sell fixed 1 share.

        Args:
            current_price: Current market price

        Returns:
            Trade object

        Raises:
            ValueError: If no position or insufficient shares
        """
        if not self.can_sell():
            raise ValueError("Cannot sell: no position to sell")

        # Fixed shares per trade
        shares_to_sell = 1

        # Check if we have enough shares
        if self.position_shares < shares_to_sell:
            raise ValueError(
                f"Insufficient shares: have {self.position_shares}, trying to sell {shares_to_sell}"
            )

        entry_price = self.position_entry_price

        # Calculate proceeds and P/L
        total_proceeds = shares_to_sell * current_price
        cost_basis = shares_to_sell * entry_price
        realized_pl = total_proceeds - cost_basis

        # Execute trade
        self.current_cash += total_proceeds
        self.realized_pl += realized_pl

        # Record trade
        trade = Trade(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            type="sell",
            shares=shares_to_sell,
            price=current_price,
            total=total_proceeds,
            cash_after=self.current_cash,
        )
        self.trades.append(trade)

        # Update position
        self.position_shares -= shares_to_sell
        if self.position_shares == 0:
            # Close position completely
            self.position_shares = None
            self.position_entry_price = None
            self.position_entry_time = None
            logger.info(
                f"SELL executed: {shares_to_sell} shares @ ${current_price:.2f} = ${total_proceeds:.2f}, P/L: ${realized_pl:.2f}, Position CLOSED"
            )
        else:
            logger.info(
                f"SELL executed: {shares_to_sell} shares @ ${current_price:.2f} = ${total_proceeds:.2f}, P/L: ${realized_pl:.2f}, Remaining: {self.position_shares} shares"
            )

        return trade

    def get_status(self, current_price: Optional[float] = None) -> TradingAccountStatus:
        """
        Get current account status.

        Args:
            current_price: Current market price for position valuation

        Returns:
            TradingAccountStatus
        """
        position = None
        total_value = self.current_cash
        unrealized_pl = 0.0

        if self.has_position() and current_price is not None:
            position = self._get_position(current_price)
            total_value += position.market_value
            unrealized_pl = position.unrealized_pl

        total_pl = self.realized_pl + unrealized_pl
        total_pl_pct = (total_pl / self.initial_cash) * 100 if self.initial_cash > 0 else 0.0

        return TradingAccountStatus(
            account_id=self.account_id,
            playback_id=self.playback_id,
            symbol=self.symbol,
            initial_cash=self.initial_cash,
            current_cash=self.current_cash,
            position=position,
            total_value=total_value,
            realized_pl=self.realized_pl,
            unrealized_pl=unrealized_pl,
            total_pl=total_pl,
            total_pl_pct=total_pl_pct,
            trade_count=len(self.trades),
        )

    def _get_position(self, current_price: float) -> Position:
        """
        Calculate current position details.

        Args:
            current_price: Current market price

        Returns:
            Position object
        """
        if not self.has_position():
            return None

        shares = self.position_shares
        entry_price = self.position_entry_price
        cost_basis = shares * entry_price
        market_value = shares * current_price
        unrealized_pl = market_value - cost_basis
        unrealized_pl_pct = (unrealized_pl / cost_basis) * 100

        return Position(
            shares=shares,
            entry_price=entry_price,
            entry_time=self.position_entry_time,
            current_price=current_price,
            cost_basis=cost_basis,
            market_value=market_value,
            unrealized_pl=unrealized_pl,
            unrealized_pl_pct=unrealized_pl_pct,
        )

    def get_history(self) -> List[Trade]:
        """
        Get trade history.

        Returns:
            List of Trade objects
        """
        return self.trades


class TradingService:
    """Service for managing trading accounts."""

    def __init__(self) -> None:
        """Initialize trading service."""
        self.accounts: Dict[str, TradingAccount] = {}

    def create_account(self, playback_id: str, symbol: str, initial_cash: float) -> str:
        """
        Create a new trading account.

        Args:
            playback_id: Associated playback session ID
            symbol: Trading symbol
            initial_cash: Initial cash balance

        Returns:
            Account ID

        Raises:
            ValueError: If playback session not found
        """
        # Verify playback session exists
        session = playback_service.get_session(playback_id)
        if not session:
            raise ValueError(f"Playback session {playback_id} not found")

        # Create account
        account_id = str(uuid.uuid4())
        account = TradingAccount(account_id, playback_id, symbol, initial_cash)
        self.accounts[account_id] = account

        logger.info(f"Created trading account {account_id} for {symbol} with ${initial_cash}")

        return account_id

    def get_account(self, account_id: str) -> Optional[TradingAccount]:
        """Get trading account by ID."""
        return self.accounts.get(account_id)

    def delete_account(self, account_id: str) -> bool:
        """
        Delete a trading account.

        Args:
            account_id: Account ID to delete

        Returns:
            True if deleted, False if not found
        """
        if account_id in self.accounts:
            del self.accounts[account_id]
            logger.info(f"Deleted trading account {account_id}")
            return True
        return False


# Global trading service instance
trading_service = TradingService()
