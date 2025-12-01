import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import type { CandleData, Trade } from '../../types'

interface CandlestickChartProps {
  data: CandleData[]
  height?: number
  priceRange?: {
    min_price: number
    max_price: number
  }
  totalCount?: number
  trades?: Trade[]
  newsMarkers?: Set<string> // Set of dates (YYYY-MM-DD) with news
  symbol?: string // Stock symbol to determine color scheme
}

export default function CandlestickChart({ 
  data, 
  height = 400,
  priceRange,
  totalCount,
  trades = [],
  newsMarkers = new Set(),
  symbol = ''
}: CandlestickChartProps) {
  // Determine if Taiwan stock (紅漲綠跌) or US/Crypto stock (綠漲紅跌)
  const isTaiwanStock = symbol.endsWith('.TW')
  
  // Color configuration based on market
  const colors = isTaiwanStock ? {
    up: '#F23645',      // 台股：紅色上漲
    down: '#089981',    // 台股：綠色下跌
  } : {
    up: '#089981',      // 美股/虛擬幣：綠色上漲
    down: '#F23645',    // 美股/虛擬幣：紅色下跌
  }
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const currentPriceRangeRef = useRef<{ min: number; max: number } | null>(null)

  // Initialize chart only once
  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart with TradingView dark theme
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#131722' },
        textColor: '#D1D4DC',
      },
      grid: {
        vertLines: { color: '#2A2E39' },
        horzLines: { color: '#2A2E39' },
      },
      rightPriceScale: {
        borderColor: '#2A2E39',
      },
      timeScale: {
        borderColor: '#2A2E39',
        timeVisible: true,
        barSpacing: 10,
        minBarSpacing: 0.5,
        rightOffset: 5,
      },
    })

    chartRef.current = chart

    // Add candlestick series with custom colors
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: colors.up,
      downColor: colors.down,
      borderUpColor: colors.up,
      borderDownColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    })

    candlestickSeriesRef.current = candlestickSeries

    // Add MA20 line series
    const ma20Series = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      title: 'MA20',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    })

    ma20SeriesRef.current = ma20Series

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    })

    volumeSeriesRef.current = volumeSeries

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85,  // 增加到 85%，讓成交量只佔 15% 的空間，給標記更多空間
        bottom: 0,
      },
    })

    // Resize handler
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
      chart.remove()
    }
  }, [height])

  // Calculate MA20
  const calculateMA20 = (data: CandleData[]) => {
    const ma20Data = []
    for (let i = 0; i < data.length; i++) {
      if (i < 19) {
        // Not enough data for MA20 yet
        continue
      }
      const sum = data.slice(i - 19, i + 1).reduce((acc, item) => acc + item.close, 0)
      const ma20 = sum / 20
      ma20Data.push({
        time: (new Date(data[i].timestamp).getTime() / 1000) as Time,
        value: ma20,
      })
    }
    return ma20Data
  }

  // Update data when it changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !ma20SeriesRef.current || !data.length) return

    // Calculate price range - use provided range if available, otherwise calculate from data
    let minPrice: number
    let maxPrice: number
    
    if (priceRange) {
      // Use the price range from backend (all data)
      minPrice = priceRange.min_price
      maxPrice = priceRange.max_price
    } else {
      // Fallback: calculate from current data
      const allHighs = data.map(d => d.high)
      const allLows = data.map(d => d.low)
      minPrice = Math.min(...allLows)
      maxPrice = Math.max(...allHighs)
    }
    
    const priceRangeValue = maxPrice - minPrice
    const padding = priceRangeValue * 0.1 // 10% padding

    // Store current price range
    currentPriceRangeRef.current = { min: minPrice, max: maxPrice }

    // Transform data - show all data
    const visibleData = data.map((item) => ({
      time: (new Date(item.timestamp).getTime() / 1000) as Time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }))

    candlestickSeriesRef.current.setData(visibleData)

    // Update MA20
    const ma20Data = calculateMA20(data)
    ma20SeriesRef.current.setData(ma20Data)

    // Combine trade markers and news markers
    const allMarkers = []
    
    // Add trade markers
    if (trades && trades.length > 0) {
      console.log('[CandlestickChart] Processing trades:', trades)
      const tradeMarkers = trades.map(trade => {
        const marker = {
          time: (new Date(trade.timestamp).getTime() / 1000) as Time,
          position: trade.type === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
          color: trade.type === 'buy' ? colors.up : colors.down, // Use market-specific colors
          shape: trade.type === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
          text: `${trade.type.toUpperCase()} ${trade.shares}@${trade.price.toFixed(2)}`,
        }
        console.log('[CandlestickChart] Created marker:', marker)
        return marker
      })
      allMarkers.push(...tradeMarkers)
    }
    
    // Add news markers
    if (newsMarkers.size > 0) {
      data.forEach(item => {
        const dateStr = new Date(item.timestamp).toISOString().split('T')[0]
        if (newsMarkers.has(dateStr)) {
          allMarkers.push({
            time: (new Date(item.timestamp).getTime() / 1000) as Time,
            position: 'aboveBar' as const,
            color: '#FF9800', // Orange for news (TradingView warning color)
            shape: 'circle' as const,
            text: '📰',
          })
        }
      })
    }
    
    if (allMarkers.length > 0) {
      // Sort markers by time to avoid overlapping issues
      allMarkers.sort((a, b) => (a.time as number) - (b.time as number))
      console.log('[CandlestickChart] Setting markers:', allMarkers)
      candlestickSeriesRef.current.setMarkers(allMarkers)
    } else {
      console.log('[CandlestickChart] No markers to set')
      candlestickSeriesRef.current.setMarkers([])
    }

    // Update volume with market-specific colors
    const visibleVolumeData = data.map((item) => {
      const isUp = item.close >= item.open
      const color = isUp ? colors.up : colors.down
      return {
        time: (new Date(item.timestamp).getTime() / 1000) as Time,
        value: item.volume,
        color: color.replace(')', ', 0.5)').replace('rgb', 'rgba'),
      }
    })

    volumeSeriesRef.current.setData(visibleVolumeData)

    // Set fixed price range based on all data
    if (chartRef.current) {
      // Always use autoscaleInfoProvider with current data range
      candlestickSeriesRef.current.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: minPrice - padding,
            maxValue: maxPrice + padding,
          },
          margins: {
            above: 10,
            below: 10,
          },
        }),
      })

      // Calculate bar spacing based on fixed 70 bars capacity
      if (chartContainerRef.current) {
        const chartWidth = chartContainerRef.current.clientWidth
        const effectiveWidth = chartWidth - 100 // Reserve for axis
        const targetBarCount = 70 // Fixed: optimal size to show 70 bars
        const calculatedBarSpacing = Math.max(2, Math.floor(effectiveWidth / targetBarCount))
        
        chartRef.current.timeScale().applyOptions({
          barSpacing: calculatedBarSpacing,
        })
      }

      // Fit all content without scrolling
      const timeScale = chartRef.current.timeScale()
      timeScale.fitContent()
    }
  }, [data, priceRange, totalCount, trades])

  return (
    <div>
      <div 
        ref={chartContainerRef} 
        className="rounded border border-tv-border overflow-hidden"
        style={{ backgroundColor: '#131722' }}
      />
    </div>
  )
}
