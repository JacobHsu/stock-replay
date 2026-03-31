import { useState, useEffect, useRef, useCallback } from 'react'
import CandlestickChart from '../components/Chart/CandlestickChart'
import TradingViewChart from '../components/Chart/TradingViewChart'
import YahooFinanceChart from '../components/Chart/YahooFinanceChart' // reserved for future use
import PlaybackControls from '../components/Player/PlaybackControls'
import TradingPanel from '../components/Trading/TradingPanel'
import NewsModal from '../components/News/NewsModal'
import ChartHeader from '../components/Chart/ChartHeader'
import { 
  startPlayback, 
  getNextCandle, 
  seekPlayback,
  createTradingAccount,
  getTradingAccountStatus,
  executeBuy,
  executeSell,
  fetchNews,
  getTradingDatesWithNews,
  getNewsByDate,
  // Phase 3: Serverless API
  isServerlessMode,
  getStockDataFromServerless,
} from '../services/api'
import { useLocalTrading } from '../hooks/useLocalTrading'
import type { CandleData, TradingAccountStatus, Trade, DailyNews } from '../types'

// Get initial symbol based on current time or forced mode
const getInitialSymbol = (): string => {
  // Check for forced market mode (for development)
  const forceMode = import.meta.env.VITE_FORCE_MARKET_MODE?.toUpperCase()

  if (forceMode) {
    let selectedSymbol = 'BTC-USD'
    switch (forceMode) {
      case 'CRYPTO':
        selectedSymbol = 'BTC-USD'
        break
      case 'TAIWAN':
        selectedSymbol = '006201.TWO'
        break
      case 'US':
        selectedSymbol = 'SPY'
        break
      default:
        console.warn('[getInitialSymbol] Invalid VITE_FORCE_MARKET_MODE:', forceMode)
    }
    console.log('[getInitialSymbol] 🔧 開發模式 - 強制市場:', forceMode, '| 選擇:', selectedSymbol)
    return selectedSymbol
  }

  // Auto-detect based on current time
  const now = new Date()

  // Get current time in different timezones
  const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const usTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))

  const taiwanHour = taiwanTime.getHours()
  const taiwanDay = taiwanTime.getDay()
  const usHour = usTime.getHours()
  const usDay = usTime.getDay()

  // Taiwan stock market hours: 9:00 - 13:30 (Mon-Fri)
  const isTaiwanMarketHours =
    taiwanDay >= 1 && taiwanDay <= 5 &&
    taiwanHour >= 9 && taiwanHour < 14

  // US stock market hours: 9:30 - 16:00 EST (Mon-Fri)
  const isUSMarketHours =
    usDay >= 1 && usDay <= 5 &&
    (usHour > 9 || (usHour === 9 && usTime.getMinutes() >= 30)) &&
    usHour < 16

  console.log('[getInitialSymbol] 本地時間:', now.toLocaleString())
  console.log('[getInitialSymbol] 台灣時間:', taiwanTime.toLocaleString(), '| 時:', taiwanHour, '| 星期:', taiwanDay, '| 開市:', isTaiwanMarketHours)
  console.log('[getInitialSymbol] 美東時間:', usTime.toLocaleString(), '| 時:', usHour, '| 星期:', usDay, '| 開市:', isUSMarketHours)

  let selectedSymbol = 'BTC-USD'
  let reason = '非交易時段'

  if (isTaiwanMarketHours) {
    selectedSymbol = '006201.TWO'
    reason = '台股交易時段'
  } else if (isUSMarketHours) {
    selectedSymbol = 'SPY'
    reason = '美股交易時段'
  }

  console.log('[getInitialSymbol] 選擇:', selectedSymbol, '原因:', reason)

  return selectedSymbol
}

export default function TradingSimulator() {
  const [symbol, setSymbol] = useState(getInitialSymbol())
  // displaySymbol 只在資料載入完成後才更新，避免 TradingViewChart 提前切換造成空白閃爍
  const [displaySymbol, setDisplaySymbol] = useState(getInitialSymbol())
  const [period, setPeriod] = useState('1mo')
  const [playbackId, setPlaybackId] = useState<string | null>(null)
  const [chartData, setChartData] = useState<CandleData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [priceRange, setPriceRange] = useState<{ min_price: number; max_price: number } | undefined>()
  
  // Phase 3: Serverless mode - 所有 K 線數據（一次取完）
  const [allCandles, setAllCandles] = useState<CandleData[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Trading account state
  const [tradingAccountId, setTradingAccountId] = useState<string | null>(null)
  const [accountStatus, setAccountStatus] = useState<TradingAccountStatus | null>(null)
  const [isTrading, setIsTrading] = useState(false)
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([])
  
  // News state
  const [newsEnabled, setNewsEnabled] = useState(false)
  const [newsMode, setNewsMode] = useState(false)
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsProgress, setNewsProgress] = useState({ percent: 0, message: '' })
  const [newsMarkers, setNewsMarkers] = useState<Set<string>>(new Set())
  const [currentNewsList, setCurrentNewsList] = useState<DailyNews[]>([])
  const [showNewsModal, setShowNewsModal] = useState(false)
  
  const playIntervalRef = useRef<number | null>(null)
  // 用來跳過 mount 時 [symbol, period] effect 的首次觸發（mount effect 已處理）
  const isFirstSymbolRender = useRef(true)
  // 用來識別最新一次 load，忽略過時的 async 結果
  const loadVersionRef = useRef(0)

  // Phase 4: Local trading for serverless mode
  const { resetAccount, getAccountStatus: getLocalAccountStatus, localBuy, localSell } = useLocalTrading(symbol)

  // Initialize playback session
  const initializePlayback = async (withNews: boolean = false) => {
    // 每次 load 遞增版本號，用來忽略過時的 async 結果
    loadVersionRef.current += 1
    const currentVersion = loadVersionRef.current

    setLoading(true)
    setError(null)
    setAllCandles([])
    setTradeHistory([])
    setNewsEnabled(withNews)
    setNewsMarkers(new Set())
    setCurrentNewsList([])
    setShowNewsModal(false)

    try {
      if (isServerlessMode) {
        // ============ Serverless 模式 ============
        // 一次從 serverless 取得所有 K 線，前端管理 playback
        console.log('[initializePlayback] 🚀 Serverless mode')
        const response = await getStockDataFromServerless(symbol, { period })

        // 若有更新的 load 已啟動，丟棄此次結果
        if (currentVersion !== loadVersionRef.current) return

        console.log('[initializePlayback] Serverless response:', response.total_count, 'candles')

        setAllCandles(response.data)
        setTotalCount(response.total_count)
        setCurrentIndex(0)
        setSessionKey(prev => prev + 1)
        setPriceRange(response.price_range)
        setIsInitialized(true)
        setPlaybackId('serverless')
        setDisplaySymbol(symbol)

        // 顯示第一根 K 線
        if (response.data.length > 0) {
          setChartData([response.data[0]])
        } else {
          setChartData([])
        }

        // Phase 4: 建立本地交易帳戶
        resetAccount()
        if (response.data.length > 0) {
          const initialStatus = getLocalAccountStatus(response.data[0].close)
          setAccountStatus(initialStatus)
          setTradingAccountId('local')
        }

        // Fetch news if enabled
        if (withNews && response.all_dates) {
          await initializeNews({ symbol, period }, response.all_dates)
        }
      } else {
        // ============ Backend 模式（原始邏輯）============
        const requestData: any = { symbol, period }

        console.log('[initializePlayback] 📦 Backend mode')
        const response = await startPlayback(requestData)

        if (currentVersion !== loadVersionRef.current) return

        console.log('[initializePlayback] Response:', response)

        setPlaybackId(response.playback_id)
        setTotalCount(response.total_count)
        setCurrentIndex(response.current_index)
        setSessionKey(prev => prev + 1)
        setPriceRange(response.price_range)
        setIsInitialized(true)
        setDisplaySymbol(symbol)

        if (response.current_data) {
          setChartData([response.current_data])
        }

        // Create trading account automatically
        await initializeTradingAccount(response.playback_id)

        // Fetch news if enabled
        if (withNews && response.all_dates) {
          await initializeNews(requestData, response.all_dates)
        }
      }
    } catch (err) {
      if (currentVersion !== loadVersionRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to initialize playback')
      console.error('Playback initialization error:', err)
    } finally {
      if (currentVersion === loadVersionRef.current) {
        setLoading(false)
      }
    }
  }
  
  // Initialize news data
  const initializeNews = async (requestData: any, tradingDates: string[]) => {
    setNewsLoading(true)
    setNewsProgress({ percent: 10, message: '準備獲取新聞...' })
    
    try {
      // Determine date range
      let start_date: string, end_date: string
      
      if (requestData.start_date && requestData.end_date) {
        start_date = requestData.start_date
        end_date = requestData.end_date
      } else {
        // Calculate date range from period
        const end = new Date()
        const start = new Date()
        
        switch (requestData.period) {
          case '1mo':
            start.setMonth(start.getMonth() - 1)
            break
          case '3mo':
            start.setMonth(start.getMonth() - 3)
            break
          case '6mo':
            start.setMonth(start.getMonth() - 6)
            break
          case '1y':
            start.setFullYear(start.getFullYear() - 1)
            break
        }
        
        start_date = start.toISOString().split('T')[0]
        end_date = end.toISOString().split('T')[0]
      }
      
      setNewsProgress({ percent: 30, message: '搜尋新聞中...' })
      
      // Fetch news (will use cache if available)
      const fetchResponse = await fetchNews({
        symbol,
        start_date,
        end_date,
        max_pages: 20,
        max_articles: 300
      })
      
      console.log('[initializeNews] Fetch response:', fetchResponse)
      
      setNewsProgress({ percent: 70, message: '載入新聞標記...' })
      
      console.log('[initializeNews] Trading dates:', tradingDates.length)
      
      // Get dates with news mapped to trading days
      const dates = await getTradingDatesWithNews(symbol, start_date, end_date, tradingDates)
      setNewsMarkers(new Set(dates))
      
      setNewsProgress({ percent: 100, message: '完成!' })
      
      console.log('[initializeNews] News markers (trading days):', dates)
      console.log('[initializeNews] Total news dates:', dates.length)
      
      setTimeout(() => {
        setNewsLoading(false)
        setNewsProgress({ percent: 0, message: '' })
      }, 500)
      
    } catch (err) {
      console.error('[initializeNews] Error:', err)
      setError('Failed to load news data')
      setNewsLoading(false)
      setNewsProgress({ percent: 0, message: '' })
    }
  }

  // Initialize trading account
  const initializeTradingAccount = async (playback_id: string) => {
    try {
      const response = await createTradingAccount({
        playback_id,
        symbol,
        initial_cash: 1000000, // $1,000,000 initial capital
      })
      
      setTradingAccountId(response.account_id)
      setAccountStatus(response.status)
      console.log('[initializeTradingAccount] Created account:', response.account_id)
    } catch (err) {
      console.error('Failed to create trading account:', err)
    }
  }

  // Handle buy operation
  const handleBuy = async () => {
    if (!chartData.length || isTrading) return
    
    const currentCandle = chartData[chartData.length - 1]
    const currentPrice = currentCandle.close
    setIsTrading(true)
    
    try {
      if (isServerlessMode) {
        // ============ Serverless: 本地交易 ============
        const result = localBuy(currentPrice, currentCandle.timestamp)
        if (result) {
          setAccountStatus(result.status)
          setTradeHistory(prev => [...prev, result.trade])
          console.log('[handleBuy] Local trade executed: bought 1 @', currentPrice)
        } else {
          setError('Insufficient cash')
        }
      } else {
        // ============ Backend: API 呼叫 ============
        if (!tradingAccountId) return
        const response = await executeBuy(tradingAccountId, { current_price: currentPrice })
        setAccountStatus(response.status)
        const updatedTrade = { ...response.trade, timestamp: currentCandle.timestamp }
        setTradeHistory(prev => [...prev, updatedTrade])
        console.log('[handleBuy] Trade executed:', response.message)
      }
    } catch (err: any) {
      console.error('Buy operation failed:', err)
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to execute buy'
      setError(errorMessage)
    } finally {
      setIsTrading(false)
    }
  }

  // Handle sell operation
  const handleSell = async () => {
    if (!chartData.length || isTrading) return
    
    const currentCandle = chartData[chartData.length - 1]
    const currentPrice = currentCandle.close
    setIsTrading(true)
    
    try {
      if (isServerlessMode) {
        // ============ Serverless: 本地交易 ============
        const result = localSell(currentPrice, currentCandle.timestamp)
        if (result) {
          setAccountStatus(result.status)
          setTradeHistory(prev => [...prev, result.trade])
          console.log('[handleSell] Local trade executed: sold 1 @', currentPrice)
        } else {
          setError('No position to sell')
        }
      } else {
        // ============ Backend: API 呼叫 ============
        if (!tradingAccountId) return
        const response = await executeSell(tradingAccountId, { current_price: currentPrice })
        setAccountStatus(response.status)
        const updatedTrade = { ...response.trade, timestamp: currentCandle.timestamp }
        setTradeHistory(prev => [...prev, updatedTrade])
        console.log('[handleSell] Trade executed:', response.message)
      }
    } catch (err: any) {
      console.error('Sell operation failed:', err)
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to execute sell'
      setError(errorMessage)
    } finally {
      setIsTrading(false)
    }
  }

  // Get next candle
  const getNext = useCallback(async () => {
    if (isServerlessMode) {
      // ============ Serverless 模式：純前端操作 ============
      const nextIndex = currentIndex + 1
      if (nextIndex >= allCandles.length) {
        setIsPlaying(false)
        return
      }
      
      const newCandle = allCandles[nextIndex]
      setChartData(prev => [...prev, newCandle])
      setCurrentIndex(nextIndex)
      
      // Phase 4: 更新本地帳戶狀態
      if (tradingAccountId === 'local') {
        setAccountStatus(getLocalAccountStatus(newCandle.close))
      }
      
      // Check for news on this date (if news enabled)
      if (newsEnabled) {
        const dateStr = new Date(newCandle.timestamp).toISOString().split('T')[0]
        if (newsMarkers.has(dateStr)) {
          setIsPlaying(false)
          try {
            const newsList = await getNewsByDate(symbol, dateStr)
            if (newsList && newsList.length > 0) {
              setCurrentNewsList(newsList)
              setShowNewsModal(true)
            }
          } catch (err) {
            console.error('Failed to fetch news for date:', dateStr, err)
          }
        }
      }
      
      // Update account status with new price if we have a position
      if (accountStatus?.position && tradingAccountId) {
        try {
          const status = await getTradingAccountStatus(tradingAccountId, newCandle.close)
          setAccountStatus(status)
        } catch (err) {
          console.error('Failed to update account status:', err)
        }
      }
    } else {
      // ============ Backend 模式（原始邏輯） ============
      if (!playbackId) return
      
      try {
        const response = await getNextCandle(playbackId, 1)
        
        if (response.current_data) {
          const timestamp = new Date(response.current_data.timestamp).getTime()
          const newCandle = response.current_data
          
          setChartData(prev => {
            const lastTimestamp = prev.length > 0 
              ? new Date(prev[prev.length - 1].timestamp).getTime() 
              : 0
            
            if (timestamp !== lastTimestamp) {
              return [...prev, newCandle]
            }
            return prev
          })
          setCurrentIndex(response.current_index)
          
          // Update account status with new price if we have a position
          if (accountStatus?.position && tradingAccountId) {
            try {
              const status = await getTradingAccountStatus(tradingAccountId, newCandle.close)
              setAccountStatus(status)
            } catch (err) {
              console.error('Failed to update account status:', err)
            }
          }
          
          // Check for news on this date (if news enabled)
          if (newsEnabled) {
            const dateStr = new Date(newCandle.timestamp).toISOString().split('T')[0]
            if (newsMarkers.has(dateStr)) {
              setIsPlaying(false)
              try {
                const newsList = await getNewsByDate(symbol, dateStr)
                if (newsList && newsList.length > 0) {
                  setCurrentNewsList(newsList)
                  setShowNewsModal(true)
                }
              } catch (err) {
                console.error('Failed to fetch news for date:', dateStr, err)
              }
            }
          }
          
          if (!response.has_more) {
            setIsPlaying(false)
          }
        }
      } catch (err) {
        console.error('Error getting next candle:', err)
        setIsPlaying(false)
      }
    }
  }, [isServerlessMode, currentIndex, allCandles, playbackId, accountStatus, tradingAccountId, newsEnabled, newsMarkers, symbol])

  // Playback controls
  const handlePlay = async () => {
    if (!isInitialized) {
      await initializePlayback(newsMode)
    }
    setIsPlaying(true)
  }

  const handlePause = () => {
    setIsPlaying(false)
  }

  const handleNext = () => {
    getNext()
  }

  const handlePrevious = async () => {
    if (currentIndex <= 0) return
    
    setIsPlaying(false)
    
    if (isServerlessMode) {
      // Serverless: 純前端操作
      const newIndex = currentIndex - 1
      setChartData(prev => prev.slice(0, -1))
      setCurrentIndex(newIndex)
    } else {
      // Backend: API 呼叫
      if (!playbackId) return
      try {
        const newIndex = currentIndex - 1
        const response = await seekPlayback(playbackId, { index: newIndex })
        if (response.current_data) {
          setChartData(prev => prev.slice(0, -1))
          setCurrentIndex(response.current_index)
        }
      } catch (err) {
        console.error('Error going to previous:', err)
      }
    }
  }

  const handleReset = () => {
    setIsPlaying(false)
    setIsInitialized(false)
    initializePlayback(newsMode)
  }
  
  const handleCloseNews = () => {
    setShowNewsModal(false)
    setCurrentNewsList([])
  }
  
  const handleContinueFromNews = () => {
    setShowNewsModal(false)
    setCurrentNewsList([])
  }

  const handleSeek = async (index: number) => {
    if (index < 0 || index >= totalCount) return
    
    setIsPlaying(false)
    
    if (isServerlessMode) {
      // Serverless: 純前端操作 — 從 allCandles 重建顯示數據
      setChartData(allCandles.slice(0, index + 1))
      setCurrentIndex(index)
    } else {
      // Backend: API 呼叫
      if (!playbackId) return
      try {
        const response = await seekPlayback(playbackId, { index })
        if (response.current_data) {
          setChartData(prev => prev.slice(0, index + 1))
          setCurrentIndex(response.current_index)
        }
      } catch (err) {
        console.error('Error seeking:', err)
      }
    }
  }

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed)
  }

  // Auto-play effect
  useEffect(() => {
    if (isPlaying && isInitialized) {
      const intervalDuration = 1000 / playbackSpeed
      const interval = setInterval(() => {
        getNext()
      }, intervalDuration)
      playIntervalRef.current = interval
      
      return () => {
        clearInterval(interval)
      }
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
        playIntervalRef.current = null
      }
    }
  }, [isPlaying, isInitialized, getNext, playbackSpeed])

  // Initialize on mount
  useEffect(() => {
    console.log('[TradingSimulator] Mode:', isServerlessMode ? '🚀 Serverless' : '📦 Backend')
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    initializePlayback(false)
  }, [])

  // Handle mode change - reload data if already initialized
  useEffect(() => {
    if (isInitialized) {
      setIsPlaying(false)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      initializePlayback(newsMode)
    }
  }, [newsMode])
  
  // Handle symbol or time range change - reload data
  // isFirstSymbolRender 跳過 mount 時的首次觸發（mount effect 已處理）
  useEffect(() => {
    if (isFirstSymbolRender.current) {
      isFirstSymbolRender.current = false
      return
    }
    setIsPlaying(false)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    initializePlayback(newsMode)
  }, [symbol, period])

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      {/* Chart Header with TradingView Style */}
      <ChartHeader
        symbol={symbol}
        onSymbolChange={setSymbol}
        period={period}
        onPeriodChange={setPeriod}
        newsMode={newsMode}
        onNewsModeChange={setNewsMode}
        loading={loading}
        newsLoading={newsLoading}
      />

      {/* News Loading Progress */}
      {newsLoading && (
        <div className="tv-panel p-4">
          <div className="bg-tv-bg border border-tv-border rounded p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-tv-text">{newsProgress.message}</span>
              <span className="text-tv-primary">{newsProgress.percent}%</span>
            </div>
            <div className="w-full bg-tv-bg rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-tv-primary h-full transition-all duration-300"
                style={{ width: `${newsProgress.percent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="tv-panel p-4 border-tv-danger bg-tv-danger bg-opacity-10">
          <p className="text-tv-danger text-sm">⚠ {error}</p>
        </div>
      )}

      {/* Charts and Trading Account Layout */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: Charts */}
          <div className="lg:col-span-2 space-y-3">
            {/* Reference Chart - TWSE (.TW) uses Yahoo Finance (TWSE not on free TV widget)
                TPEX (.TWO), US stocks, and Crypto use TradingView */}
            {displaySymbol.endsWith('.TW') ? (
              <YahooFinanceChart symbol={displaySymbol} period={period} height={380} />
            ) : (
              <TradingViewChart symbol={displaySymbol} period={period} height={380} />
            )}
            
            {/* Playback Chart */}
            <div className="tv-panel p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-tv-text uppercase tracking-wide">
                  {symbol}
                </h3>
                <div className="text-tv-textSecondary text-xs">
                  {chartData.length} bars
                </div>
              </div>
              <CandlestickChart 
                key={sessionKey} 
                data={chartData} 
                height={380} 
                priceRange={priceRange}
                totalCount={totalCount}
                trades={tradeHistory}
                newsMarkers={newsMarkers}
                symbol={symbol}
              />
            </div>
          </div>

          {/* Right Column: Trading Account + Playback Controls */}
          <div className="lg:col-span-1 space-y-3">
            {accountStatus && (
              <TradingPanel
                accountStatus={accountStatus}
                currentPrice={chartData.length > 0 ? chartData[chartData.length - 1].close : null}
                onBuy={handleBuy}
                onSell={handleSell}
                isLoading={isTrading}
                symbol={symbol}
              />
            )}
            
            <PlaybackControls
              isPlaying={isPlaying}
              currentIndex={currentIndex}
              totalCount={totalCount}
              playbackSpeed={playbackSpeed}
              currentDate={chartData.length > 0 ? chartData[chartData.length - 1].timestamp : undefined}
              currentCandle={chartData.length > 0 ? {
                open: chartData[chartData.length - 1].open,
                close: chartData[chartData.length - 1].close
              } : undefined}
              symbol={symbol}
              onPlay={handlePlay}
              onPause={handlePause}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onReset={handleReset}
              onSeek={handleSeek}
              onSpeedChange={handleSpeedChange}
            />
          </div>
        </div>
      )}

      {/* Show reference chart even when no playback data */}
      {chartData.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {displaySymbol.endsWith('.TW') ? (
              <YahooFinanceChart symbol={displaySymbol} period={period} height={380} />
            ) : (
              <TradingViewChart symbol={displaySymbol} period={period} height={380} />
            )}
          </div>
          <div className="lg:col-span-1">
            {accountStatus && (
              <TradingPanel
                accountStatus={accountStatus}
                currentPrice={null}
                onBuy={handleBuy}
                onSell={handleSell}
                isLoading={isTrading}
                symbol={symbol}
              />
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {/* <div className="text-center text-tv-textMuted text-xs">
        <p>Stock Trading Simulator • Educational Purpose Only</p>
      </div> */}
      
      {/* News Modal */}
      {showNewsModal && currentNewsList.length > 0 && (
        <NewsModal
          news={currentNewsList[0]}
          allNews={currentNewsList}
          onClose={handleCloseNews}
          onContinue={handleContinueFromNews}
        />
      )}
    </div>
  )
}
