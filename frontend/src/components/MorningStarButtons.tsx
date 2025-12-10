import React, { useState, useEffect } from 'react'
import { TrendingDown } from 'lucide-react'
import { getMorningStarLosers } from '../services/api'
import type { DayTradingStock } from '../types'

interface MorningStarButtonsProps {
  currentSymbol: string
  onSelectStock: (symbol: string) => void
}

/**
 * 顯示 Morning Star 最大跌幅股票的快速切換按鈕
 * 顯示前 10 支跌幅最大的股票
 */
export const MorningStarButtons: React.FC<MorningStarButtonsProps> = ({
  currentSymbol,
  onSelectStock,
}) => {
  const [stocks, setStocks] = useState<DayTradingStock[]>([])
  const [loading, setLoading] = useState(false)

  // 載入股票數據
  const loadStocks = async () => {
    try {
      setLoading(true)
      console.log('[MorningStarButtons] Fetching Morning Star losers...')
      const data = await getMorningStarLosers()
      console.log('[MorningStarButtons] Successfully fetched:', data.length, 'stocks')
      setStocks(data)
    } catch (error: any) {
      console.error('[MorningStarButtons] ❌ Failed to load Morning Star losers')
      console.error('[MorningStarButtons] Error details:', error)
      if (error.response) {
        console.error('[MorningStarButtons] Status:', error.response.status)
        console.error('[MorningStarButtons] Response:', error.response.data)
      }
      // 不顯示任何股票（stocks 保持為空陣列）
      setStocks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStocks()

    // 每 5 分鐘更新一次
    const interval = setInterval(loadStocks, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading || stocks.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-tv-textSecondary text-xs">
        <TrendingDown className="w-3.5 h-3.5 text-tv-danger" />
        <a
          href="https://www.morningstar.com/markets"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-tv-primary transition-colors"
        >
          市場跌幅
        </a>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {stocks.map((stock) => {
          const isActive = currentSymbol === stock.symbol
          const priceText = stock.price ? ` $${stock.price.toFixed(2)}` : ''
          const tooltipText = `${stock.name}${priceText}\n漲跌幅: ${stock.change_percent.toFixed(2)}%`

          return (
            <button
              key={stock.symbol}
              onClick={() => onSelectStock(stock.symbol)}
              disabled={isActive}
              className={`
                px-2.5 py-1 rounded text-xs font-medium transition-all
                ${isActive
                  ? 'bg-tv-primary text-white cursor-default'
                  : 'bg-tv-surface text-tv-text hover:bg-tv-surfaceHover border border-tv-border hover:border-tv-primary'
                }
              `}
              title={tooltipText}
            >
              <span className="font-semibold">{stock.code}</span>
              <span className="ml-1 text-tv-danger">{stock.change_percent.toFixed(2)}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MorningStarButtons
