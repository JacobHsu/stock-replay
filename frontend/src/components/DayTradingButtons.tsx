import React, { useState, useEffect } from 'react'
import { TrendingDown } from 'lucide-react'
import { getDayTradingLosers } from '../services/api'
import type { DayTradingStock } from '../types'

interface DayTradingButtonsProps {
  currentSymbol: string
  onSelectStock: (symbol: string) => void
}

/**
 * 顯示當沖跌幅股票快捷按鈕，分上下兩排：
 * 上排：.TWO 上櫃（TradingView 圖表）
 * 下排：.TW  上市（Yahoo Finance 圖表）
 * 只在台股交易時段 (09:00-13:30) 顯示
 */
export const DayTradingButtons: React.FC<DayTradingButtonsProps> = ({
  currentSymbol,
  onSelectStock,
}) => {
  const [stocks, setStocks] = useState<DayTradingStock[]>([])
  const [loading, setLoading] = useState(false)
  const [isMarketHours, setIsMarketHours] = useState(false)

  const checkMarketHours = () => {
    const now = new Date()
    const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
    const hours = taiwanTime.getHours()
    const minutes = taiwanTime.getMinutes()
    const day = taiwanTime.getDay()

    if (day === 0 || day === 6) return false

    const currentTime = hours * 60 + minutes
    return currentTime >= 9 * 60 && currentTime <= 13 * 60 + 30
  }

  const loadDayTradingStocks = async () => {
    try {
      setLoading(true)
      const data = await getDayTradingLosers()
      setStocks(data)
    } catch (error) {
      console.error('Failed to load day trading stocks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const inMarketHours = checkMarketHours()
    const forceMode = import.meta.env.VITE_FORCE_MARKET_MODE?.toUpperCase()
    const shouldShow = inMarketHours || forceMode === 'TAIWAN'

    setIsMarketHours(shouldShow)

    if (shouldShow) {
      loadDayTradingStocks()
      const interval = setInterval(loadDayTradingStocks, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [])

  if (!isMarketHours || loading || stocks.length === 0) return null

  const twoStocks = stocks.filter(s => s.symbol.endsWith('.TWO'))
  const twStocks = stocks.filter(s => s.symbol.endsWith('.TW'))

  const renderButton = (stock: DayTradingStock) => {
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
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-tv-textSecondary text-xs">
        <TrendingDown className="w-3.5 h-3.5 text-tv-danger" />
        <a
          href="https://histock.tw/stock/rank.aspx?m=4&d=0&t=dt"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-tv-primary transition-colors"
        >
          當沖跌幅
        </a>
      </div>

      <div className="flex flex-col gap-1">
        {/* 上排：上櫃 .TWO（TradingView 圖表） */}
        {twoStocks.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {twoStocks.map(renderButton)}
          </div>
        )}
        {/* 下排：上市 .TW（Yahoo Finance 圖表） */}
        {twStocks.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {twStocks.map(renderButton)}
          </div>
        )}
      </div>
    </div>
  )
}

export default DayTradingButtons
