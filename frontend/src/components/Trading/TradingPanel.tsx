import React from 'react'
import type { TradingAccountStatus } from '../../types'
import './TradingPanel.css'

interface TradingPanelProps {
  accountStatus: TradingAccountStatus | null
  currentPrice: number | null
  onBuy: () => void
  onSell: () => void
  isLoading: boolean
  symbol?: string // Stock symbol to determine color scheme
}

/**
 * TradingPanel displays trading account status and provides buy/sell controls.
 * Shows current cash, position details, and P/L metrics.
 */
const TradingPanel: React.FC<TradingPanelProps> = ({
  accountStatus,
  currentPrice,
  onBuy,
  onSell,
  isLoading,
  symbol = '',
}) => {
  // Determine if Taiwan stock (紅漲綠跌) or US/Crypto stock (綠漲紅跌)
  const isTaiwanStock = symbol.endsWith('.TW')
  const colorMode = isTaiwanStock ? 'tw' : 'us'
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  const formatShares = (value: number): string => {
    return value.toLocaleString('en-US')
  }

  if (!accountStatus) {
    return (
      <div className="trading-panel">
        <div className="panel-header">Trading Account</div>
        <div className="panel-body">
          <p className="loading-text">Loading account...</p>
        </div>
      </div>
    )
  }

  const { position, current_cash, total_value, realized_pl, unrealized_pl, total_pl, total_pl_pct } =
    accountStatus

  const hasPosition = position !== null
  const canBuy = current_cash > 0 && currentPrice !== null && !isLoading
  const canSell = hasPosition && position.shares >= 1 && !isLoading

  return (
    <div className={`trading-panel ${colorMode}-mode`}>
      <div className="panel-header">Trading Account</div>

      <div className="panel-body">
        {/* Account Overview */}
        <div className="account-section">
          <h3>Account Overview</h3>
          <div className="info-row">
            <span className="label">Cash:</span>
            <span className="value">{formatCurrency(current_cash)}</span>
          </div>
          <div className="info-row">
            <span className="label">Total Value:</span>
            <span className="value total-value">{formatCurrency(total_value)}</span>
          </div>
        </div>

        {/* Position Details */}
        <div className="position-section">
          <h3>Position</h3>
          {hasPosition ? (
            <>
              <div className="info-row">
                <span className="label">Shares:</span>
                <span className="value">{formatShares(position.shares)}</span>
              </div>
              <div className="info-row">
                <span className="label">Entry Price:</span>
                <span className="value">{formatCurrency(position.entry_price)}</span>
              </div>
              <div className="info-row">
                <span className="label">Current Price:</span>
                <span className="value">{formatCurrency(position.current_price)}</span>
              </div>
              <div className="info-row">
                <span className="label">Market Value:</span>
                <span className="value">{formatCurrency(position.market_value)}</span>
              </div>
              <div className="info-row">
                <span className="label">Unrealized P/L:</span>
                <span className={`value ${position.unrealized_pl >= 0 ? 'profit' : 'loss'}`}>
                  {formatCurrency(position.unrealized_pl)} ({formatPercent(position.unrealized_pl_pct)})
                </span>
              </div>
            </>
          ) : (
            <p className="no-position">No position</p>
          )}
        </div>

        {/* P/L Summary */}
        <div className="pl-section">
          <h3>P/L Summary</h3>
          <div className="info-row">
            <span className="label">Realized P/L:</span>
            <span className={`value ${realized_pl >= 0 ? 'profit' : 'loss'}`}>
              {formatCurrency(realized_pl)}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Unrealized P/L:</span>
            <span className={`value ${unrealized_pl >= 0 ? 'profit' : 'loss'}`}>
              {formatCurrency(unrealized_pl)}
            </span>
          </div>
          <div className="info-row total-pl-row">
            <span className="label">Total P/L:</span>
            <span className={`value total-pl ${total_pl >= 0 ? 'profit' : 'loss'}`}>
              {formatCurrency(total_pl)} ({formatPercent(total_pl_pct)})
            </span>
          </div>
        </div>

        {/* Trading Controls */}
        <div className="controls-section">
          <button
            className="buy-button"
            onClick={onBuy}
            disabled={!canBuy}
            title={
              !canBuy
                ? current_cash <= 0
                  ? 'Insufficient cash'
                  : 'No current price'
                : 'Buy 1 share'
            }
          >
            {isLoading ? 'Processing...' : 'Buy 1'}
          </button>
          <button
            className="sell-button"
            onClick={onSell}
            disabled={!canSell}
            title={
              !canSell 
                ? hasPosition && position.shares < 1
                  ? `Only ${position?.shares || 0} shares available`
                  : 'No position to sell' 
                : 'Sell 1 share'
            }
          >
            {isLoading ? 'Processing...' : 'Sell 1'}
          </button>
        </div>

        {currentPrice !== null && (
          <div className="current-price-info">
            <span className="label">Current Price:</span>
            <span className="value">{formatCurrency(currentPrice)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default TradingPanel
