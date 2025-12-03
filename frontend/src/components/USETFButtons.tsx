import React, { useState, useEffect } from 'react'
import { TrendingDown } from 'lucide-react'
import { getUSETFLosers } from '../services/api'
import type { DayTradingStock } from '../types'

interface USETFButtonsProps {
  currentSymbol: string
  onSelectETF: (symbol: string) => void
}

/**
 * 顯示跌幅最大的美國 ETF 快速切換按鈕
 */
export const USETFButtons: React.FC<USETFButtonsProps> = ({
  currentSymbol,
  onSelectETF,
}) => {
  const [etfs, setETFs] = useState<DayTradingStock[]>([])
  const [loading, setLoading] = useState(false)

  // 載入 ETF 數據
  const loadETFs = async () => {
    try {
      setLoading(true)
      const data = await getUSETFLosers()
      setETFs(data)
    } catch (error) {
      console.error('Failed to load US ETF losers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadETFs()
    
    // 每 5 分鐘更新一次
    const interval = setInterval(loadETFs, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading || etfs.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-tv-textSecondary text-xs">
        <TrendingDown className="w-3.5 h-3.5 text-tv-danger" />
        <span>ETF跌幅</span>
      </div>
      
      <div className="flex gap-1.5 flex-wrap">
        {etfs.map((etf) => {
          const isActive = currentSymbol === etf.symbol
          const priceText = etf.price ? ` $${etf.price.toFixed(2)}` : ''
          const tooltipText = `${etf.name}${priceText}\n漲跌幅: ${etf.change_percent.toFixed(2)}%`
          
          return (
            <button
              key={etf.symbol}
              onClick={() => onSelectETF(etf.symbol)}
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
              <span className="font-semibold">{etf.symbol}</span>
              <span className="ml-1 text-tv-danger">{etf.change_percent.toFixed(2)}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default USETFButtons
