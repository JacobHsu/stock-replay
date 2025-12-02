import React, { useState, useEffect } from 'react'
import { TrendingDown } from 'lucide-react'
import { getDayTradingLosers } from '../services/api'
import type { DayTradingStock } from '../types'

interface DayTradingButtonsProps {
  currentSymbol: string
  onSelectStock: (symbol: string) => void
}

/**
 * 顯示前三大跌幅當沖股票的快捷按鈕
 * 只在台股交易時段 (09:00-13:30) 顯示
 */
export const DayTradingButtons: React.FC<DayTradingButtonsProps> = ({
  currentSymbol,
  onSelectStock,
}) => {
  const [stocks, setStocks] = useState<DayTradingStock[]>([])
  const [loading, setLoading] = useState(false)
  const [isMarketHours, setIsMarketHours] = useState(false)

  // 檢查是否在台股交易時段
  const checkMarketHours = () => {
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const day = now.getDay()

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
    setIsMarketHours(inMarketHours)

    if (inMarketHours) {
      loadDayTradingStocks()
      
      // 每 5 分鐘更新一次
      const interval = setInterval(loadDayTradingStocks, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [])

  // 非交易時段不顯示
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
        <span>當沖跌幅</span>
      </div>
      
      <div className="flex gap-1.5">
        {stocks.map((stock) => {
          const isActive = currentSymbol === stock.symbol
          
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
              title={`${stock.name} ${stock.change_percent.toFixed(2)}%`}
            >
              <span className="font-semibold">{stock.code}</span>
              <span className="ml-1 text-tv-danger">{stock.change_percent.toFixed(1)}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default DayTradingButtons
