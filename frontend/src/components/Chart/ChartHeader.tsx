import React from 'react'
import StockSearch from '../StockSearch'
import DayTradingButtons from '../DayTradingButtons'
import CryptoButtons from '../CryptoButtons'

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
  const [showStockSearch, setShowStockSearch] = React.useState(false)

  // 判斷當前股票類型
  const isTaiwanStock = symbol.endsWith('.TW') || symbol.endsWith('.TWO')
  const isCrypto = symbol.includes('-USD')

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
      </div>
    </div>
  )
}
