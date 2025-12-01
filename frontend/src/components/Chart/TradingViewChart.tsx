import { useEffect, useRef, memo } from 'react'

interface TradingViewChartProps {
  symbol: string
  period?: string
  height?: number
}

declare global {
  interface Window {
    TradingView: any
  }
}

function TradingViewChart({ symbol, period = '1mo', height = 400 }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<any>(null)

  // Convert period to TradingView range format
  const getTradingViewRange = (period: string) => {
    switch (period) {
      case '1mo':
        return '1M'
      case '3mo':
        return '3M'
      case '6mo':
        return '6M'
      case '1y':
        return '12M'
      default:
        return '1M'
    }
  }

  useEffect(() => {
    // Load TradingView script if not already loaded
    if (!window.TradingView) {
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/tv.js'
      script.async = true
      script.onload = () => initWidget()
      document.head.appendChild(script)
    } else {
      initWidget()
    }

    function initWidget() {
      if (!containerRef.current || !window.TradingView) return

      // Clean up previous widget
      if (widgetRef.current) {
        containerRef.current.innerHTML = ''
      }

      // Create new widget
      widgetRef.current = new window.TradingView.widget({
        container_id: containerRef.current.id,
        autosize: false,
        width: '100%',
        height: height,
        symbol: symbol,
        interval: 'D',
        // range: getTradingViewRange(period), // Set time range based on period
        timezone: 'Asia/Taipei',
        theme: 'dark',
        style: '1', // Candlestick
        locale: 'zh_TW',
        toolbar_bg: '#131722',
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        save_image: false,
        studies: [
          'BB@tv-basicstudies',
          'KLTNR@tv-basicstudies',
          'STD;MA%1Cross'
        ],
        show_popup_button: false,
        popup_width: '1000',
        popup_height: '650',
        hide_top_toolbar: false,
        hide_legend: false,
        details: false,
        hotlist: false,
        calendar: false,
        studies_overrides: {},
        overrides: {
          'mainSeriesProperties.candleStyle.upColor': '#F23645',
          'mainSeriesProperties.candleStyle.downColor': '#089981',
          'mainSeriesProperties.candleStyle.borderUpColor': '#F23645',
          'mainSeriesProperties.candleStyle.borderDownColor': '#089981',
          'mainSeriesProperties.candleStyle.wickUpColor': '#F23645',
          'mainSeriesProperties.candleStyle.wickDownColor': '#089981',
        },
      })
    }

    return () => {
      if (widgetRef.current && containerRef.current) {
        containerRef.current.innerHTML = ''
        widgetRef.current = null
      }
    }
  }, [symbol, period, height])

  return (
    <div className="tv-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-tv-text uppercase tracking-wide">
          {symbol}
        </h3>
        <div className="text-tv-textSecondary text-xs">
        </div>
      </div>
      <div
        id={`tradingview_${symbol}`}
        ref={containerRef}
        className="rounded border border-tv-border overflow-hidden"
        style={{ backgroundColor: '#131722' }}
      />
    </div>
  )
}

export default memo(TradingViewChart)
