'use client'

import React, { useEffect, useRef } from 'react'
import { createChart, Time } from 'lightweight-charts'
import { StockData, TradingSignal, TriggerEvent } from '@/types'

interface SimpleTradingViewChartProps {
  /** 股票價格數據 */
  stockData: StockData[]
  /** 交易信號數據 */
  signals?: TradingSignal[]
  /** Trigger Events 數據 */
  triggerEvents?: TriggerEvent[]
  /** 圖表高度 */
  height?: number
  /** 是否顯示成交量 */
  showVolume?: boolean
  /** 是否顯示交易信號 */
  showSignals?: boolean
  /** 是否顯示 Trigger Events */
  showTriggerEvents?: boolean
  /** 是否顯示信號名稱 */
  showSignalNames?: boolean
  /** 是否顯示移動平均線 */
  showMA?: boolean
  /** 移動平均線週期 */
  maPeriods?: number[]
  /** 是否顯示RSI */
  showRSI?: boolean
  /** 是否顯示布林帶 */
  showBB?: boolean
  /** 是否顯示MACD */
  showMACD?: boolean
}

/**
 * 簡化版 TradingView Lightweight Charts 組件
 * 專注於K線圖表，避免複雜的型態問題
 */
export function SimpleTradingViewChart({
  stockData,
  signals = [],
  triggerEvents = [],
  height = 400,
  showVolume = true,
  showSignals = false,
  showTriggerEvents = false,
  showSignalNames = false,
  showMA = false,
  maPeriods = [10, 20],
  showRSI = false,
  showBB = false,
  showMACD = false,
}: SimpleTradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)

  // 在組件頂部添加數據驗證
  const validStockData = React.useMemo(() => {
    if (!stockData || !Array.isArray(stockData)) {
      console.warn('Invalid stock data:', stockData)
      return []
    }
    
    const filtered = stockData.filter(item => {
        // 基本數據驗證
        if (!item || typeof item !== 'object') return false
        if (!item.timestamp) return false
        if (typeof item.open !== 'number' || isNaN(item.open) || !isFinite(item.open)) return false
        if (typeof item.high !== 'number' || isNaN(item.high) || !isFinite(item.high)) return false
        if (typeof item.low !== 'number' || isNaN(item.low) || !isFinite(item.low)) return false
        if (typeof item.close !== 'number' || isNaN(item.close) || !isFinite(item.close)) return false
        if (typeof item.volume !== 'number' || isNaN(item.volume) || !isFinite(item.volume) || item.volume < 0) return false
        
        // OHLC 邏輯驗證
        if (item.high < item.low || item.high < item.open || item.high < item.close) return false
        if (item.low > item.open || item.low > item.close) return false
        
        return true
      })
      
      return filtered
  }, [stockData])

  console.log('Original data count:', stockData?.length || 0)
  console.log('Valid data count:', validStockData.length)
  if (validStockData.length > 0) {
    console.log('Sample valid data:', validStockData[0])
  }

  // 統一的時間轉換函數
  const convertTimestamp = (timestamp: string): number => {
    // 處理不同的時間格式
    let date: Date
    
    if (timestamp.includes('T')) {
      // ISO 格式: "2024-01-15T00:00:00" 或 "2024-01-15T00:00:00.000Z"
      date = new Date(timestamp)
    } else if (timestamp.includes(' ')) {
      // 日期時間格式: "2024-01-15 09:30:00" (5分鐘數據)
      // 後端已經轉換為台北時間，但瀏覽器可能把它當作本地時間
      // 我們需要確保它被正確解釋為台北時間
      date = new Date(timestamp)
    } else if (timestamp.includes('-')) {
      // 純日期格式: "2024-01-15" (日線數據)
      // 使用本地時間的午夜
      date = new Date(timestamp + 'T00:00:00')
    } else {
      // 其他格式，嘗試直接解析
      date = new Date(timestamp)
    }
    
    // 確保日期有效
    if (isNaN(date.getTime())) {
      console.warn('無效的時間格式:', timestamp)
      return Math.floor(Date.now() / 1000)
    }
    
    // 轉換為 TradingView 所需的 Unix 時間戳（秒）
    const unixTimestamp = Math.floor(date.getTime() / 1000)
    
    // 添加調試信息（只在開發環境）
    if (import.meta.env.DEV) {
      console.log(`時間轉換: ${timestamp} -> ${date.toISOString()} -> ${unixTimestamp}`)
    }
    
    return unixTimestamp
  }

  useEffect(() => {
    if (!chartContainerRef.current || !validStockData.length) {
      console.warn('Chart container or data not available')
      return
    }

    console.log('Creating chart with', validStockData.length, 'data points')

    // 計算所需的圖表高度分配
    let mainChartHeight = height
    let subChartsCount = 0
    if (showRSI) subChartsCount++
    if (showMACD) subChartsCount++
    
    // 如果有子圖表，主圖佔70%，子圖表平分剩餘空間
    if (subChartsCount > 0) {
      mainChartHeight = Math.floor(height * 0.7)
    }

    // 創建主圖表容器
    const mainChartContainer = document.createElement('div')
    mainChartContainer.style.height = `${mainChartHeight}px`
    chartContainerRef.current.innerHTML = ''
    chartContainerRef.current.appendChild(mainChartContainer)

    // 創建主圖表
    const chart = createChart(mainChartContainer, {
      width: mainChartContainer.clientWidth,
      height: height,
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
      leftPriceScale: {
        borderColor: '#2A2E39',
        visible: false,  // 預設隱藏，將由成交量系列控制
      },
      timeScale: {
        borderColor: '#2A2E39',
        timeVisible: true,
        secondsVisible: false,
        // 設定時間顯示格式（不進行時區轉換，使用後端提供的時間）
        tickMarkFormatter: (time: any) => {
          const date = new Date(time * 1000);
          return date.toLocaleString('zh-TW', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        },
      },
      // 設置時間顯示格式（不進行時區轉換）
      localization: {
        timeFormatter: (time: any) => {
          const date = new Date(time * 1000);
          return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
        },
      },
    })

    // 轉換數據格式 - 使用統一的時間轉換並過濾無效數據
    const candlestickData = validStockData.map(stock => ({
      time: convertTimestamp(stock.timestamp) as Time,
      open: stock.open,
      high: stock.high,
      low: stock.low,
      close: stock.close,
    }))

    console.log('Candlestick data sample:', candlestickData.slice(0, 2))
    console.log('Candlestick time range:', {
      first: candlestickData[0]?.time,
      last: candlestickData[candlestickData.length - 1]?.time
    })

    // 創建 markers 的通用函數
    const createMarkers = () => {
      const markers: any[] = []
      
      // 添加交易信號標記
      if (showSignals && signals.length > 0) {
        const signalMarkers = signals.map(signal => ({
          time: convertTimestamp(signal.timestamp) as Time,
          position: (signal.signal_type === 'BUY' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
          color: signal.signal_type === 'BUY' ? '#26a69a' : '#ef5350',
          shape: (signal.signal_type === 'BUY' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
          text: showSignalNames ? (signal.signal_type === 'BUY' ? '買入' : '賣出') : '',
          size: 2,
        }))
        markers.push(...signalMarkers)
      }
      
      // 添加觸發事件標記
      if (showTriggerEvents && triggerEvents.length > 0) {
        const getEventColor = (event: TriggerEvent): string => {
          // 優先使用事件中的顏色資訊（支援動態顏色）
          if (event.color) {
            return event.color;
          }
          
          // 備用：使用事件類型的固定顏色配置
          const colorMap: Record<string, string> = {
            // 基礎指標
            'MACD_GOLDEN_CROSS': '#4CAF50',
            'MACD_DEATH_CROSS': '#F44336',
            'MA_GOLDEN_CROSS': '#4CAF50',
            'MA_DEATH_CROSS': '#F44336',
            'RSI_OVERSOLD': '#2196F3',
            'RSI_OVERBOUGHT': '#FF9800',
            // 布林擴張指標
            'BOLLINGER_BULLISH_EXPANSION': '#4CAF50',
            'BOLLINGER_BEARISH_EXPANSION': '#F44336',
            // 1分K強勢空方指標
            'STRONG_BEARISH_1M': '#FF3D00',
            // 1分K MA交叉多頭指標
            'MA_CROSSOVER_BULLISH_1M': '#26A69A',
            // 1分K混合指標
            'HYBRID_BEARISH_1M': '#DC2626',
            'HYBRID_BULLISH_1M': '#22C55E',
            // 市場背景指標
            'MARKET_CONTEXT_BULLISH_1M': '#8B5CF6',
            'MARKET_CONTEXT_BEARISH_1M': '#DC2626',
            // 市場狀態指標
            'MARKET_STATE_BULL': '#10B981',
            'MARKET_STATE_BEAR': '#EF4444',
            'MARKET_STATE_OSCILLATION': '#F59E0B',
            // 震盪突破指標
            'CONSOLIDATION_BREAKOUT_BULLISH': '#26a69a',  // 綠色箭頭向上（多方）
            'CONSOLIDATION_BREAKOUT_BEARISH': '#ef5350',  // 紅色箭頭向下（空方）
            // 反轉信號
            'BEAR_TO_BULL_REVERSAL': '#26a69a',  // 綠色（熊牛轉換）
            'BULL_TO_BEAR_REVERSAL': '#ef5350',  // 紅色（牛熊轉換）
          }
          return colorMap[event.event_type] || '#666666'
        }

        const getEventSize = (event: TriggerEvent): number => {
          // 市場狀態指標：根據信心度調整大小
          if (event.event_type.startsWith('MARKET_STATE_')) {
            // 檢查 technical_data 中的百分比（如果有的話）
            const bullPct = event.technical_data?.bull_pct || 0
            const bearPct = event.technical_data?.bear_pct || 0
            const oscillationPct = event.technical_data?.oscillation_pct || 0
            const maxPct = Math.max(bullPct, bearPct, oscillationPct)
            
            // 超過 70% 使用大圓圈 (size: 3)
            // 其他使用小圓圈 (size: 1)
            return maxPct >= 70 ? 3 : 1
          }
          
          // 移動停損訊號使用小圖案
          if (event.event_type === 'TRAILING_STOP_SIGNAL') {
            return 1
          }
          
          // 其他事件：根據嚴重程度判斷大小
          return event.severity === 'high' ? 2 : 1
        }
        
        const getEventShape = (eventType: string): 'circle' | 'square' | 'arrowUp' | 'arrowDown' => {
          // 移動停損訊號使用向上箭頭（類似三角形）
          if (eventType === 'TRAILING_STOP_SIGNAL') {
            return 'arrowUp'
          }
          // 回到震盪區間使用方形
          if (eventType === 'CONSOLIDATION_REENTRY') {
            return 'square'
          }
          // 市場狀態使用圓形
          if (eventType.startsWith('MARKET_STATE_')) {
            return 'circle'
          }
          // 空方信號使用向下箭頭（必須在多方之前檢查，避免 BREAKOUT 被誤判）
          if (eventType.includes('DEATH_CROSS') || 
              eventType.includes('BEARISH') || 
              eventType.includes('BREAKDOWN') ||
              eventType === 'BULL_TO_BEAR_REVERSAL') {
            return 'arrowDown'
          }
          // 多方信號使用向上箭頭
          if (eventType.includes('GOLDEN_CROSS') || 
              eventType.includes('BULLISH') || 
              eventType.includes('BREAKOUT') ||
              eventType === 'BEAR_TO_BULL_REVERSAL') {
            return 'arrowUp'
          }
          // 布林擴張使用方形
          if (eventType.includes('EXPANSION')) {
            return 'square'
          }
          // 預設使用圓形
          return 'circle'
        }
        
        const getEventText = (eventType: string): string => {
          const textMap: Record<string, string> = {
            // 基礎指標
            'MACD_GOLDEN_CROSS': 'MACD↗',
            'MACD_DEATH_CROSS': 'MACD↘',
            'MA_GOLDEN_CROSS': 'MA↗',
            'MA_DEATH_CROSS': 'MA↘',
            'RSI_OVERSOLD': 'RSI超賣',
            'RSI_OVERBOUGHT': 'RSI超買',
            // 布林擴張指標
            'BOLLINGER_BULLISH_EXPANSION': '布多',
            'BOLLINGER_BEARISH_EXPANSION': '布空',
            // 1分K強勢空方指標
            'STRONG_BEARISH_1M': '1m強空',
            // 1分K MA交叉多頭指標
            'MA_CROSSOVER_BULLISH_1M': '1m MA多交',
            // 1分K混合指標
            'HYBRID_BEARISH_1M': '1m混空',
            'HYBRID_BULLISH_1M': '1m混多',
            // 市場背景指標
            'MARKET_CONTEXT_BULLISH_1M': '1m背景多',
            'MARKET_CONTEXT_BEARISH_1M': '1m背景空',
            // 市場狀態指標
            'MARKET_STATE_BULL': '多頭',
            'MARKET_STATE_BEAR': '空頭',
            'MARKET_STATE_OSCILLATION': '震盪',
            // 移動停損訊號
            'TRAILING_STOP_SIGNAL': '停損',
            // 震盪突破指標
            'CONSOLIDATION_BREAKOUT_BULLISH': '突破↗',
            'CONSOLIDATION_BREAKOUT_BEARISH': '突破↘',
            // 反轉信號
            'BEAR_TO_BULL_REVERSAL': '反轉↗',
            'BULL_TO_BEAR_REVERSAL': '反轉↘',
            // 震盪回歸
          }
          return textMap[eventType] || eventType.slice(0, 4)
        }
        
        const triggerEventMarkers = triggerEvents.map(event => {
          let position: 'belowBar' | 'aboveBar'
          
          // 移動停損訊號：紅K顯示在下方，黑K顯示在上方
          if (event.event_type === 'TRAILING_STOP_SIGNAL') {
            const candleType = event.technical_data?.candle_type
            position = candleType === 'bullish' ? 'belowBar' : 'aboveBar'
          }
          // 多方信號顯示在K線下方
          else if (event.event_type.includes('GOLDEN_CROSS') || 
              event.event_type.includes('BULLISH') || 
              event.event_type === 'RSI_OVERSOLD' ||
              event.event_type.includes('EXPANSION') ||
              event.event_type === 'BEAR_TO_BULL_REVERSAL') {
            position = 'belowBar'
          } 
          // 空方信號顯示在K線上方
          else {
            position = 'aboveBar'
          }
          
          return {
            time: convertTimestamp(event.timestamp) as Time,
            position: position,
            color: getEventColor(event),
            shape: getEventShape(event.event_type),
            text: showSignalNames ? getEventText(event.event_type) : '',
            size: getEventSize(event),
          }
        })
        markers.push(...triggerEventMarkers)
      }
      
      return markers
    }

    // 添加蠟燭圖系列
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    })

    candlestickSeries.setData(candlestickData)

    // 立即設置一次 markers
    if ((showSignals && signals.length > 0) || (showTriggerEvents && triggerEvents.length > 0)) {
      try {
        const initialMarkers = createMarkers()
        console.log('Setting initial markers after candlestick data:', initialMarkers.length)
        candlestickSeries.setMarkers(initialMarkers)
      } catch (error) {
        console.warn('設置初始標記時出錯:', error)
      }
    }

    // 添加移動平均線
    if (showMA && maPeriods.length > 0) {
      const colors = ['#2196F3', '#FF9800', '#4CAF50', '#9C27B0']
      maPeriods.forEach((period, index) => {
        const maKey = `ma_${period}` as keyof StockData
        const maData = validStockData
          .filter(stock => {
            const value = stock[maKey] as number
            return value !== null && value !== undefined && !isNaN(value) && isFinite(value)
          })
          .map(stock => ({
            time: convertTimestamp(stock.timestamp) as Time,
            value: stock[maKey] as number,
          }))

        console.log(`MA${period} data points:`, maData.length)

        if (maData.length > 0) {
          const maSeries = chart.addLineSeries({
            color: colors[index % colors.length],
            lineWidth: 2,
            title: `MA${period}`,
          })
          maSeries.setData(maData)
        }
      })
    }

    // 添加布林帶（放在主圖表）
    if (showBB) {
      // 上軌
      const bbUpperData = validStockData
        .filter(stock => {
          const value = stock.bb_upper
          return value !== null && value !== undefined && !isNaN(value) && isFinite(value)
        })
        .map(stock => ({
          time: convertTimestamp(stock.timestamp) as Time,
          value: stock.bb_upper!,
        }))

      console.log('BB Upper data points:', bbUpperData.length)

      if (bbUpperData.length > 0) {
        const bbUpperSeries = chart.addLineSeries({
          color: '#FF5722',
          lineWidth: 1,
          lineStyle: 2, // dashed
          title: 'BB Upper',
        })
        bbUpperSeries.setData(bbUpperData)
      }

      // 下軌
      const bbLowerData = validStockData
        .filter(stock => {
          const value = stock.bb_lower
          return value !== null && value !== undefined && !isNaN(value) && isFinite(value)
        })
        .map(stock => ({
          time: convertTimestamp(stock.timestamp) as Time,
          value: stock.bb_lower!,
        }))

      if (bbLowerData.length > 0) {
        const bbLowerSeries = chart.addLineSeries({
          color: '#FF5722',
          lineWidth: 1,
          lineStyle: 2, // dashed
          title: 'BB Lower',
        })
        bbLowerSeries.setData(bbLowerData)
      }

      // 中軌
      const bbMiddleData = stockData
        .filter(stock => {
          const value = stock.bb_middle
          return stock && value !== null && value !== undefined && !isNaN(value) && isFinite(value)
        })
        .map(stock => ({
          time: convertTimestamp(stock.timestamp) as Time,
          value: stock.bb_middle!,
        }))

      if (bbMiddleData.length > 0) {
        const bbMiddleSeries = chart.addLineSeries({
          color: '#FFC107',
          lineWidth: 1,
          title: 'BB Middle',
        })
        bbMiddleSeries.setData(bbMiddleData)
      }
    }

    // 添加成交量系列（放在主圖表底部）
    if (showVolume) {
      const volumeData = validStockData.map(stock => ({
        time: convertTimestamp(stock.timestamp) as Time,
        value: stock.volume,
        color: stock.close >= stock.open ? '#26a69a' : '#ef5350', // 根據漲跌設置顏色
      }))

      if (volumeData.length > 0) {
        const volumeSeries = chart.addHistogramSeries({
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'left',  // 嘗試使用 'left' 來指定左側價格尺度
        })
        
        volumeSeries.setData(volumeData)

        // 設置成交量的價格比例（嘗試顯示在左側）
        chart.priceScale('left').applyOptions({
          scaleMargins: {
            top: 0.7,
            bottom: 0,
          },
          borderColor: '#2A2E39',
          visible: true,
        })
      }
    }

    // 設置 markers 的函數
    const setMarkersOnChart = () => {
      if ((showSignals && signals.length > 0) || (showTriggerEvents && triggerEvents.length > 0)) {
        try {
          const markers = createMarkers()
          console.log('Setting markers on chart:', markers.length, 'total markers')
          candlestickSeries.setMarkers(markers)
        } catch (error) {
          console.warn('設置標記時出錯:', error)
        }
      }
    }

    // 初始設置 markers
    setMarkersOnChart()

    // 延遲再次設置 markers，確保圖表完全載入
    setTimeout(() => {
      setMarkersOnChart()
    }, 500)

    // 設置週期性刷新 markers（每2秒檢查一次）
    const markersInterval = setInterval(() => {
      if ((showSignals && signals.length > 0) || (showTriggerEvents && triggerEvents.length > 0)) {
        setMarkersOnChart()
      }
    }, 2000)

    // 自動適應主圖表視圖
    chart.timeScale().fitContent()

    // 儲存圖表實例用於清理
    const charts = [chart]

    // 時間軸同步控制 - 防止無限循環
    let isSyncing = false

    // 時間軸同步 - 當主圖表時間範圍變化時，同步所有子圖表
    const syncTimeRange = (timeRange: any, sourceChart?: any) => {
      if (!timeRange || isSyncing) return // 檢查空值和同步狀態
      
      isSyncing = true
      
      charts.forEach((chartInstance) => {
        if (chartInstance && chartInstance !== sourceChart) {
          try {
            chartInstance.timeScale().setVisibleRange(timeRange)
          } catch (error) {
            console.warn('時間軸同步失敗:', error)
          }
        }
      })
      
      // 延遲重置同步狀態，避免立即觸發
      setTimeout(() => {
        isSyncing = false
      }, 50)
    }

    // 監聽主圖表的時間軸變化
    let timeRangeChangeTimeout: ReturnType<typeof setTimeout>
    chart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
      syncTimeRange(timeRange, chart)
      
      // 清除之前的 timeout
      if (timeRangeChangeTimeout) {
        clearTimeout(timeRangeChangeTimeout)
      }
      
      // 在時間軸變化後重新設置 markers，使用更短的延遲
      timeRangeChangeTimeout = setTimeout(() => {
        setMarkersOnChart()
        
        // 再次延遲設置，確保 markers 不會被清除
        setTimeout(() => {
          setMarkersOnChart()
        }, 50)
      }, 10)
    })

    // 創建 RSI 子圖表
    let rsiChart: any = null
    if (showRSI) {
      const rsiChartHeight = Math.floor((height - mainChartHeight) / subChartsCount)
      const rsiChartContainer = document.createElement('div')
      rsiChartContainer.style.height = `${rsiChartHeight}px`
      rsiChartContainer.style.marginTop = '10px'
      chartContainerRef.current.appendChild(rsiChartContainer)

      rsiChart = createChart(rsiChartContainer, {
        width: chartContainerRef.current.clientWidth,
        height: rsiChartHeight,
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
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: '#2A2E39',
          timeVisible: false,
          secondsVisible: false,
        },
        // 設置時間顯示格式（不進行時區轉換）
        localization: {
          timeFormatter: (time: any) => {
            const date = new Date(time * 1000);
            return date.toLocaleString('zh-TW', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });
          },
        },
      })

      const rsiData = stockData
        .filter(stock => {
          const value = stock.rsi
          return stock && value !== null && value !== undefined && !isNaN(value) && isFinite(value)
        })
        .map(stock => ({
          time: convertTimestamp(stock.timestamp) as Time,
          value: stock.rsi!,
        }))

      if (rsiData.length > 0) {
        const rsiSeries = rsiChart.addLineSeries({
          color: '#9C27B0',
          lineWidth: 2,
          title: 'RSI',
        })
        rsiSeries.setData(rsiData)

        // 添加 RSI 的 30 和 70 參考線
        const rsiRef30 = rsiChart.addLineSeries({
          color: '#FF5722',
          lineWidth: 1,
          lineStyle: 2, // dashed
          title: 'RSI 30',
        })
        const rsiRef70 = rsiChart.addLineSeries({
          color: '#FF5722',
          lineWidth: 1,
          lineStyle: 2, // dashed
          title: 'RSI 70',
        })

        const ref30Data = rsiData.map(item => ({ time: item.time, value: 30 }))
        const ref70Data = rsiData.map(item => ({ time: item.time, value: 70 }))
        
        rsiRef30.setData(ref30Data)
        rsiRef70.setData(ref70Data)

        // 設置 RSI 圖表的價格範圍
        rsiChart.priceScale().applyOptions({
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
          borderColor: '#2A2E39',
        })
      }

      rsiChart.timeScale().fitContent()
      charts.push(rsiChart)

      // 為 RSI 圖表添加反向時間軸同步
      rsiChart.timeScale().subscribeVisibleTimeRangeChange((timeRange: any) => {
        syncTimeRange(timeRange, rsiChart)
      })
    }

    // 創建 MACD 子圖表
    let macdChart: any = null
    if (showMACD) {
      const macdChartHeight = Math.floor((height - mainChartHeight) / subChartsCount)
      const macdChartContainer = document.createElement('div')
      macdChartContainer.style.height = `${macdChartHeight}px`
      macdChartContainer.style.marginTop = '10px'
      chartContainerRef.current.appendChild(macdChartContainer)

      macdChart = createChart(macdChartContainer, {
        width: chartContainerRef.current.clientWidth,
        height: macdChartHeight,
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
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: '#2A2E39',
          timeVisible: true,
          secondsVisible: false,
        },
        // 設置時間顯示格式（不進行時區轉換）
        localization: {
          timeFormatter: (time: any) => {
            const date = new Date(time * 1000);
            return date.toLocaleString('zh-TW', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });
          },
        },
      })

      const macdData = stockData
        .filter(stock => {
          const value = stock.macd
          return stock && value !== null && value !== undefined && !isNaN(value) && isFinite(value)
        })
        .map(stock => ({
          time: convertTimestamp(stock.timestamp) as Time,
          value: stock.macd!,
        }))

      const macdSignalData = stockData
        .filter(stock => {
          const value = stock.macd_signal
          return stock && value !== null && value !== undefined && !isNaN(value) && isFinite(value)
        })
        .map(stock => ({
          time: convertTimestamp(stock.timestamp) as Time,
          value: stock.macd_signal!,
        }))

      const macdHistogramData = stockData
        .filter(stock => 
          stock && 
          stock.macd !== null && stock.macd !== undefined && 
          stock.macd_signal !== null && stock.macd_signal !== undefined &&
          !isNaN(stock.macd) && !isNaN(stock.macd_signal) &&
          isFinite(stock.macd) && isFinite(stock.macd_signal)
        )
        .map(stock => ({
          time: convertTimestamp(stock.timestamp) as Time,
          value: stock.macd! - stock.macd_signal!,
          color: (stock.macd! - stock.macd_signal!) >= 0 ? '#26a69a' : '#ef5350',
        }))

      if (macdData.length > 0) {
        // MACD 線
        const macdSeries = macdChart.addLineSeries({
          color: '#2196F3',
          lineWidth: 2,
          title: 'MACD',
        })
        macdSeries.setData(macdData)

        // Signal 線
        if (macdSignalData.length > 0) {
          const macdSignalSeries = macdChart.addLineSeries({
            color: '#FF9800',
            lineWidth: 2,
            title: 'Signal',
          })
          macdSignalSeries.setData(macdSignalData)
        }

        // MACD 柱狀圖
        if (macdHistogramData.length > 0) {
          const macdHistogramSeries = macdChart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
              type: 'price',
              precision: 4,
              minMove: 0.0001,
            },
          })
          macdHistogramSeries.setData(macdHistogramData)
        }

        // 添加零軸參考線
        const zeroLineData = macdData.map(item => ({ time: item.time, value: 0 }))
        const zeroLineSeries = macdChart.addLineSeries({
          color: '#666666',
          lineWidth: 1,
          lineStyle: 2, // dashed
          title: 'Zero Line',
        })
        zeroLineSeries.setData(zeroLineData)
      }

      macdChart.timeScale().fitContent()
      charts.push(macdChart)

      // 為 MACD 圖表添加反向時間軸同步
      macdChart.timeScale().subscribeVisibleTimeRangeChange((timeRange: any) => {
        syncTimeRange(timeRange, macdChart)
      })
    }

    // 響應式調整 - 為所有圖表設置
    const handleResize = () => {
      if (chartContainerRef.current) {
        charts.forEach(chartInstance => {
          if (chartInstance) {
            chartInstance.applyOptions({
              width: chartContainerRef.current!.clientWidth,
            })
          }
        })
        
        // 在 resize 後重新設置 markers
        setTimeout(() => {
          setMarkersOnChart()
        }, 100)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      // 清除 timeout 和 interval
      if (timeRangeChangeTimeout) {
        clearTimeout(timeRangeChangeTimeout)
      }
      if (markersInterval) {
        clearInterval(markersInterval)
      }
      
      window.removeEventListener('resize', handleResize)
      // 清理所有圖表實例
      charts.forEach(chartInstance => {
        if (chartInstance) {
          chartInstance.remove()
        }
      })
    }
  }, [validStockData, signals, triggerEvents, showSignals, showTriggerEvents, height, showMA, maPeriods, showRSI, showBB, showMACD, showVolume])

  return (
    <div className="w-full">
      <div 
        ref={chartContainerRef} 
        className="w-full border border-tv-border rounded"
        style={{ height: `${height}px`, backgroundColor: '#131722' }}
      />
      
      {/* 圖例 */}
      <div className="flex flex-wrap justify-center mt-4 space-x-4 text-sm text-tv-textSecondary">
        {/* 主圖指標 */}
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-4 bg-green-600"></div>
            <div className="w-2 h-4 bg-red-500"></div>
          </div>
          <span>K線圖</span>
        </div>
        {showVolume && (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span>成交量</span>
          </div>
        )}
        {showMA && maPeriods.map((period, index) => {
          const colors = ['#2196F3', '#FF9800', '#4CAF50', '#9C27B0']
          return (
            <div key={`ma-${index}-${period}`} className="flex items-center space-x-2">
              <div 
                className="w-3 h-1"
                style={{ backgroundColor: colors[index % colors.length] }}
              ></div>
              <span>MA{period}</span>
            </div>
          )
        })}
        {showBB && (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-1 bg-red-600"></div>
              <div className="w-2 h-1 bg-yellow-500"></div>
            </div>
            <span>布林帶</span>
          </div>
        )}
        
        {/* 子圖指標 */}
        {showRSI && (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-1 bg-purple-600"></div>
            <span>RSI (子圖)</span>
          </div>
        )}
        {showMACD && (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-1 bg-blue-500"></div>
              <div className="w-2 h-1 bg-orange-500"></div>
              <div className="w-2 h-2 bg-green-600"></div>
            </div>
            <span>MACD (子圖)</span>
          </div>
        )}
        
        {showSignals && (
          <>
            <div className="flex items-center space-x-2">
              <span className="text-green-600 text-lg font-bold">▲</span>
              <span className="font-medium">買入信號</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-red-500 text-lg font-bold">▼</span>
              <span className="font-medium">賣出信號</span>
            </div>
          </>
        )}
        
        {showTriggerEvents && (
          <>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              </div>
              <span className="font-medium">技術事件</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}