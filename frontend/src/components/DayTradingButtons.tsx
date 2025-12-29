import React, { useState, useEffect } from 'react'
import { TrendingDown } from 'lucide-react'
import { getDayTradingLosers } from '../services/api'
import type { DayTradingStock } from '../types'

interface DayTradingButtonsProps {
  currentSymbol: string
  onSelectStock: (symbol: string) => void
}

/**
 * 顯示前六大跌幅當沖股票的快捷按鈕
 * 只在台股交易時段 (09:00-13:30) 顯示
 */
export const DayTradingButtons: React.FC<DayTradingButtonsProps> = ({
  currentSymbol,
  onSelectStock,
}) => {
  const [stocks, setStocks] = useState<DayTradingStock[]>([])
  const [loading, setLoading] = useState(false)
  const [isMarketHours, setIsMarketHours] = useState(false)

  // 檢查是否在台股交易時段（使用台灣時間）
  const checkMarketHours = () => {
    const now = new Date()
    // 轉換為台灣時間
    const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
    const hours = taiwanTime.getHours()
    const minutes = taiwanTime.getMinutes()
    const day = taiwanTime.getDay()

    // 週一到週五 (1-5)
    if (day === 0 || day === 6) {
      return false
    }

    // 09:00 - 13:30
    const currentTime = hours * 60 + minutes
    const marketOpen = 9 * 60 // 09:00
    const marketClose = 13 * 60 + 30 // 13:30

    return currentTime >= marketOpen && currentTime <= marketClose
  }

  // 載入當沖股票數據
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
    // 檢查交易時段
    const inMarketHours = checkMarketHours()

    // 開發模式：如果強制使用台股模式，則忽略交易時段限制
    const forceMode = import.meta.env.VITE_FORCE_MARKET_MODE?.toUpperCase()
    const shouldShow = inMarketHours || forceMode === 'TAIWAN'

    setIsMarketHours(shouldShow)

    if (shouldShow) {
      loadDayTradingStocks()

      // 每 5 分鐘更新一次
      const interval = setInterval(loadDayTradingStocks, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [])

  // 非交易時段不顯示（除非開發模式強制顯示）
  if (!isMarketHours) {
    return null
  }

  if (loading || stocks.length === 0) {
    return null
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

      <div className="flex gap-1.5 flex-wrap">
        {stocks.map((stock) => {
          const isActive = currentSymbol === stock.symbol
          const priceText = stock.price ? ` $${stock.price.toFixed(2)}` : ''
          const tooltipText = `${stock.name}${priceText}\n漲跌幅: ${stock.change_percent.toFixed(2)}%${stock.industry ? `\n產業別: ${stock.industry}` : ''}`

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

export default DayTradingButtons
