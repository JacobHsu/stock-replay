/**
 * useLocalTrading - Phase 4: 前端本地交易管理
 * 
 * 在 Serverless 模式下，交易邏輯全在前端處理。
 * 不需要 Backend API，提供與 Backend TradingAccount 相同的介面。
 */

import { useState, useCallback } from 'react'
import type { TradingAccountStatus, Trade, Position } from '../types'

const INITIAL_CASH = 1_000_000 // $1,000,000

interface LocalTradingState {
  cash: number
  position: {
    shares: number
    totalCost: number     // 累計成本
    entryTime: string     // 第一次買入時間
  } | null
  realizedPL: number      // 已實現損益
  tradeCount: number
}

/**
 * 建立 TradingAccountStatus 物件（與 Backend API 回傳格式一致）
 */
function buildAccountStatus(
  state: LocalTradingState,
  symbol: string,
  currentPrice: number
): TradingAccountStatus {
  let position: Position | null = null
  let unrealizedPL = 0
  let totalValue = state.cash

  if (state.position && state.position.shares > 0) {
    const entryPrice = state.position.totalCost / state.position.shares
    const marketValue = state.position.shares * currentPrice
    const costBasis = state.position.totalCost
    unrealizedPL = marketValue - costBasis
    const unrealizedPLPct = costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0
    totalValue = state.cash + marketValue

    position = {
      shares: state.position.shares,
      entry_price: entryPrice,
      entry_time: state.position.entryTime,
      current_price: currentPrice,
      cost_basis: costBasis,
      market_value: marketValue,
      unrealized_pl: unrealizedPL,
      unrealized_pl_pct: unrealizedPLPct,
    }
  }

  const totalPL = state.realizedPL + unrealizedPL
  const totalPLPct = INITIAL_CASH > 0 ? (totalPL / INITIAL_CASH) * 100 : 0

  return {
    account_id: 'local',
    playback_id: 'serverless',
    symbol,
    initial_cash: INITIAL_CASH,
    current_cash: state.cash,
    position,
    total_value: totalValue,
    realized_pl: state.realizedPL,
    unrealized_pl: unrealizedPL,
    total_pl: totalPL,
    total_pl_pct: totalPLPct,
    trade_count: state.tradeCount,
  }
}

export function useLocalTrading(symbol: string) {
  const [tradingState, setTradingState] = useState<LocalTradingState>({
    cash: INITIAL_CASH,
    position: null,
    realizedPL: 0,
    tradeCount: 0,
  })

  /**
   * 重置交易帳戶
   */
  const resetAccount = useCallback(() => {
    setTradingState({
      cash: INITIAL_CASH,
      position: null,
      realizedPL: 0,
      tradeCount: 0,
    })
  }, [])

  /**
   * 取得帳戶狀態（指定當前價格計算未實現損益）
   */
  const getAccountStatus = useCallback(
    (currentPrice: number): TradingAccountStatus => {
      return buildAccountStatus(tradingState, symbol, currentPrice)
    },
    [tradingState, symbol]
  )

  /**
   * 買入 1 股
   */
  const localBuy = useCallback(
    (currentPrice: number, timestamp: string): { status: TradingAccountStatus; trade: Trade } | null => {
      const cost = currentPrice

      if (tradingState.cash < cost) {
        console.warn('[localBuy] Insufficient cash:', tradingState.cash, '< ', cost)
        return null
      }

      const newState: LocalTradingState = {
        cash: tradingState.cash - cost,
        position: {
          shares: (tradingState.position?.shares || 0) + 1,
          totalCost: (tradingState.position?.totalCost || 0) + cost,
          entryTime: tradingState.position?.entryTime || timestamp,
        },
        realizedPL: tradingState.realizedPL,
        tradeCount: tradingState.tradeCount + 1,
      }

      setTradingState(newState)

      const trade: Trade = {
        id: `local-${Date.now()}`,
        timestamp,
        type: 'buy',
        shares: 1,
        price: currentPrice,
        total: cost,
        cash_after: newState.cash,
      }

      return {
        status: buildAccountStatus(newState, symbol, currentPrice),
        trade,
      }
    },
    [tradingState, symbol]
  )

  /**
   * 賣出 1 股
   */
  const localSell = useCallback(
    (currentPrice: number, timestamp: string): { status: TradingAccountStatus; trade: Trade } | null => {
      if (!tradingState.position || tradingState.position.shares < 1) {
        console.warn('[localSell] No position to sell')
        return null
      }

      // Calculate realized P/L for the 1 share being sold
      const avgCost = tradingState.position.totalCost / tradingState.position.shares
      const profitPerShare = currentPrice - avgCost
      const revenue = currentPrice

      const remainingShares = tradingState.position.shares - 1
      const remainingCost = remainingShares > 0
        ? tradingState.position.totalCost - avgCost
        : 0

      const newState: LocalTradingState = {
        cash: tradingState.cash + revenue,
        position: remainingShares > 0
          ? {
              shares: remainingShares,
              totalCost: remainingCost,
              entryTime: tradingState.position.entryTime,
            }
          : null,
        realizedPL: tradingState.realizedPL + profitPerShare,
        tradeCount: tradingState.tradeCount + 1,
      }

      setTradingState(newState)

      const trade: Trade = {
        id: `local-${Date.now()}`,
        timestamp,
        type: 'sell',
        shares: 1,
        price: currentPrice,
        total: revenue,
        cash_after: newState.cash,
      }

      return {
        status: buildAccountStatus(newState, symbol, currentPrice),
        trade,
      }
    },
    [tradingState, symbol]
  )

  return {
    resetAccount,
    getAccountStatus,
    localBuy,
    localSell,
  }
}
