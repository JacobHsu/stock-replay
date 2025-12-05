import React, { useState, useEffect, useMemo } from 'react'
import StockSearch from '../StockSearch'
import DayTradingButtons from '../DayTradingButtons'
import CryptoButtons from '../CryptoButtons'
import USETFButtons from '../USETFButtons'
import { getDayTradingLosers } from '../../services/api'
import type { DayTradingStock } from '../../types'

/**
 * 根據產業別生成 GoodInfo 連結
 */
const generateIndustryLink = (industry: string): string => {
  const encodedIndustry = encodeURIComponent(industry)
  return `https://goodinfo.tw/tw/StockList.asp?MARKET_CAT=%E5%85%A8%E9%83%A8&INDUSTRY_CAT=${encodedIndustry}&SHEET=%E4%BA%A4%E6%98%93%E7%8B%80%E6%B3%81&SHEET2=%E6%97%A5&RPT_TIME=%E6%9C%80%E6%96%B0%E8%B3%87%E6%96%99`
}

interface ChartHeaderProps {
  symbol: string
  onSymbolChange: (symbol: string) => void
  period: string
  onPeriodChange: (period: string) => void
  newsMode: boolean
  onNewsModeChange: (newsMode: boolean) => void
  loading: boolean
  newsLoading: boolean
}

const PERIOD_OPTIONS = [
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y', label: '1Y' },
]

export default function ChartHeader({
  symbol,
  onSymbolChange,
  period,
  onPeriodChange,
  newsMode,
  onNewsModeChange,
  loading,
  newsLoading,
}: ChartHeaderProps) {
  const [showStockSearch, setShowStockSearch] = useState(false)
  const [dayTradingStocks, setDayTradingStocks] = useState<DayTradingStock[]>([])
  const [isMarketHours, setIsMarketHours] = useState(false)

  // 判斷當前股票類型
  const isTaiwanStock = symbol.endsWith('.TW') || symbol.endsWith('.TWO')
  const isCrypto = symbol.includes('-USD')
  const isUSStock = !isTaiwanStock && !isCrypto // 美股（包含 ETF）

  // 檢查是否在台股交易時段（使用台灣時間）
  const checkMarketHours = () => {
    const now = new Date()
    const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
    const hours = taiwanTime.getHours()
    const minutes = taiwanTime.getMinutes()
    const day = taiwanTime.getDay()

    if (day === 0 || day === 6) {
      return false
    }

    const currentTime = hours * 60 + minutes
    const marketOpen = 9 * 60
    const marketClose = 13 * 60 + 30

    return currentTime >= marketOpen && currentTime <= marketClose
  }

  // 載入當沖股票數據
  const loadDayTradingStocks = async () => {
    try {
      const data = await getDayTradingLosers()
      setDayTradingStocks(data)
    } catch (error) {
      console.error('Failed to load day trading stocks:', error)
    }
  }

  // 提取所有產業別並去重
  const industries = useMemo(() => {
    const uniqueIndustries = new Set<string>()
    dayTradingStocks.forEach(stock => {
      if (stock.industry) {
        uniqueIndustries.add(stock.industry)
      }
    })
    return Array.from(uniqueIndustries)
  }, [dayTradingStocks])

  useEffect(() => {
    const inMarketHours = checkMarketHours()
    setIsMarketHours(inMarketHours)

    if (inMarketHours && isTaiwanStock) {
      loadDayTradingStocks()
      const interval = setInterval(loadDayTradingStocks, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [isTaiwanStock])

  return (
    <div className="tv-panel p-6 space-y-6">
      {/* Header with Stock Symbol and Action Buttons */}
      <div className="flex items-start justify-between">
        {/* Left: Stock Symbol (Large) with Change Button and Day Trading Buttons */}
        <div className="flex items-center gap-4">
          {!showStockSearch ? (
            <>
              <h1 className="text-5xl font-bold text-tv-text tracking-tight">
                {symbol}
              </h1>
              <button
                onClick={() => setShowStockSearch(true)}
                className="px-3 py-1.5 text-xs bg-tv-surface hover:bg-tv-surfaceHover text-tv-textSecondary border border-tv-border hover:border-tv-primary rounded transition-colors"
                title="Change stock symbol"
              >
                Change
              </button>
              {/* 根據股票類型顯示對應的快速切換按鈕 */}
              {isTaiwanStock && (
                <DayTradingButtons
                  currentSymbol={symbol}
                  onSelectStock={onSymbolChange}
                />
              )}
              {isCrypto && (
                <CryptoButtons
                  currentSymbol={symbol}
                  onSelectCrypto={onSymbolChange}
                />
              )}
              {isUSStock && (
                <USETFButtons
                  currentSymbol={symbol}
                  onSelectETF={onSymbolChange}
                />
              )}
            </>
          ) : (
            <div className="w-96">
              <StockSearch
                value=""
                onChange={(newSymbol) => {
                  onSymbolChange(newSymbol)
                  setShowStockSearch(false)
                }}
                placeholder="Enter stock code or Chinese name (e.g., 2330 or 台積電)"
                className="text-sm"
              />
              <button
                onClick={() => setShowStockSearch(false)}
                className="mt-2 text-xs text-tv-textSecondary hover:text-tv-text transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Right: Mode Switcher */}
        <div className="flex items-center gap-3">
          {/* Mode Switch Button Group */}
          <div className="inline-flex bg-[#2A2E39] rounded-md overflow-hidden">
            <button
              onClick={() => onNewsModeChange(false)}
              disabled={loading || newsLoading}
              className={`px-5 py-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                !newsMode
                  ? 'bg-[#3E4149] text-white'
                  : 'text-[#787B86] hover:text-white hover:bg-[#363A45]'
              }`}
            >
              Trading
            </button>
            <button
              onClick={() => onNewsModeChange(true)}
              disabled={loading || newsLoading}
              className={`px-5 py-2 text-sm font-semibold transition-all border-l border-[#1E222D] disabled:opacity-50 disabled:cursor-not-allowed ${
                newsMode
                  ? 'bg-[#3E4149] text-white'
                  : 'text-[#787B86] hover:text-white hover:bg-[#363A45]'
              }`}
            >
              News
            </button>
          </div>
        </div>
      </div>

      {/* Time Period Switcher */}
      <div className="flex items-center gap-4">
        <div className="inline-flex bg-[#2A2E39] rounded-md overflow-hidden">
          {PERIOD_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              onClick={() => onPeriodChange(option.value)}
              className={`px-4 py-1.5 text-sm font-semibold transition-all ${
                index > 0 ? 'border-l border-[#1E222D]' : ''
              } ${
                period === option.value
                  ? 'bg-[#3E4149] text-white'
                  : 'text-[#787B86] hover:text-white hover:bg-[#363A45]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* 產業別隱藏連結列表（僅台股交易時段顯示）*/}
        {isTaiwanStock && isMarketHours && industries.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <a
              href="https://goodinfo.tw/tw/StockList.asp"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden-link"
              title="全部類股"
            >
              全部類股
            </a>
            {industries.map((industry) => (
              <a
                key={industry}
                href={generateIndustryLink(industry)}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden-link"
                title={industry}
              >
                {industry}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
