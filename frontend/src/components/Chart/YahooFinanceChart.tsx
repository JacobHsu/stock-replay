import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts'
import { getHistoricalData } from '../../services/api'

interface YahooFinanceChartProps {
  symbol: string
  period?: string
  height?: number
}

interface HistoricalData {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export default function YahooFinanceChart({ symbol, period = '1mo', height = 400 }: YahooFinanceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart

    // 台股配色：紅漲綠跌（與美股相反）
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#F23645',        // 紅色代表上漲
      downColor: '#089981',      // 綠色代表下跌
      borderUpColor: '#F23645',
      borderDownColor: '#089981',
      wickUpColor: '#F23645',
      wickDownColor: '#089981',
    })

    candlestickSeriesRef.current = candlestickSeries

    // Fetch historical data
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        console.log('[YahooFinanceChart] Fetching data for:', symbol, 'period:', period)
        console.log('[YahooFinanceChart] API params:', { period })
        const response = await getHistoricalData(symbol, { period: period || '1mo' })

        console.log('[YahooFinanceChart] Response:', response)
        console.log('[YahooFinanceChart] Data count:', response.data.length)

        const data = response.data.map((item: HistoricalData) => {
          const date = new Date(item.timestamp)
          const timeInSeconds = Math.floor(date.getTime() / 1000) as any
          
          return {
            time: timeInSeconds,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
          }
        })

        console.log('[YahooFinanceChart] Processed data count:', data.length)
        console.log('[YahooFinanceChart] First 3 items:', data.slice(0, 3))

        // 初始不顯示數據，設置空數組
        candlestickSeries.setData([])
        chart.timeScale().fitContent()
      } catch (err: any) {
        console.error('[YahooFinanceChart] Failed to fetch historical data:', err)
        console.error('[YahooFinanceChart] Error details:', err.response?.data)
        setError(`無法載入歷史數據: ${err.response?.data?.detail || err.message}`)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [symbol, period, height])

  // Generate TradingView URL
  const getTradingViewUrl = (): string => {
    if (symbol.endsWith('.TW') || symbol.endsWith('.TWO')) {
      const code = symbol.replace('.TW', '').replace('.TWO', '')
      return `https://tw.tradingview.com/symbols/TWSE-${code}/technicals/`
    }
    // 處理虛擬幣（如 BTC-USD）
    if (symbol.includes('-')) {
      const [base, quote] = symbol.split('-')
      return `https://www.tradingview.com/symbols/${base}${quote}/`
    }
    // 美股
    return `https://www.tradingview.com/symbols/${symbol}/`
  }

  return (
    <div className="tv-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          <a
            href={getTradingViewUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-tv-text hover:text-tv-primary transition-colors"
            title="在 TradingView 中查看"
          >
            {symbol}
          </a>
          <span className="text-tv-textSecondary"> - 歷史數據 ({period})</span>
        </h3>
        {loading && (
          <div className="text-tv-textSecondary text-xs">載入中...</div>
        )}
        {!loading && !error && (
          <div className="text-tv-textSecondary text-xs">
            Lightweight Charts
          </div>
        )}
      </div>
      {error && (
        <div className="text-tv-danger text-sm mb-2">⚠ {error}</div>
      )}
      <div
        ref={chartContainerRef}
        className="rounded border border-tv-border overflow-hidden"
        style={{ backgroundColor: '#131722' }}
      />
    </div>
  )
}
