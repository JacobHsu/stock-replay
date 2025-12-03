import axios from 'axios'
import type {
  StockDataResponse,
  PlaybackCreateRequest,
  PlaybackStatusResponse,
  PlaybackSeekRequest,
  TradingAccountCreateRequest,
  TradingAccountCreateResponse,
  TradingAccountStatus,
  TradeExecuteRequest,
  TradeExecuteResponse,
  TradeHistoryResponse,
  FetchNewsRequest,
  FetchNewsResponse,
  DailyNews,
  NewsDateResponse,
  StockInfo,
  StockSearchResponse,
  DayTradingStock,
  DayTradingLosersResponse,
} from '../types'

// 使用環境變數來切換後端 URL
// 本地測試：'http://localhost:8888'
// Railway 線上：'https://stock-replay-production.up.railway.app'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8888";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Stock Data API
export const getHistoricalData = async (
  symbol: string,
  params?: { start_date?: string; end_date?: string; period?: string }
): Promise<StockDataResponse> => {
  const response = await api.get(`/api/data/historical/${symbol}`, { params })
  return response.data
}

// Playback API
export const startPlayback = async (
  request: PlaybackCreateRequest
): Promise<PlaybackStatusResponse> => {
  const response = await api.post('/api/playback/start', request)
  return response.data
}

export const getPlaybackStatus = async (
  playbackId: string
): Promise<PlaybackStatusResponse> => {
  const response = await api.get(`/api/playback/${playbackId}/status`)
  return response.data
}

export const getNextCandle = async (
  playbackId: string,
  count: number = 1
): Promise<PlaybackStatusResponse> => {
  const response = await api.get(`/api/playback/${playbackId}/next`, {
    params: { count },
  })
  return response.data
}

export const seekPlayback = async (
  playbackId: string,
  request: PlaybackSeekRequest
): Promise<PlaybackStatusResponse> => {
  const response = await api.post(`/api/playback/${playbackId}/seek`, request)
  return response.data
}

export const deletePlayback = async (playbackId: string): Promise<void> => {
  await api.delete(`/api/playback/${playbackId}`)
}

// Trading API
export const createTradingAccount = async (
  request: TradingAccountCreateRequest
): Promise<TradingAccountCreateResponse> => {
  const response = await api.post('/api/trading/account/create', request)
  return response.data
}

export const getTradingAccountStatus = async (
  accountId: string,
  currentPrice?: number
): Promise<TradingAccountStatus> => {
  const params = currentPrice ? { current_price: currentPrice } : {}
  const response = await api.get(`/api/trading/account/${accountId}/status`, { params })
  return response.data
}

export const executeBuy = async (
  accountId: string,
  request: TradeExecuteRequest
): Promise<TradeExecuteResponse> => {
  const response = await api.post(`/api/trading/account/${accountId}/buy`, request)
  return response.data
}

export const executeSell = async (
  accountId: string,
  request: TradeExecuteRequest
): Promise<TradeExecuteResponse> => {
  const response = await api.post(`/api/trading/account/${accountId}/sell`, request)
  return response.data
}

export const getTradeHistory = async (
  accountId: string
): Promise<TradeHistoryResponse> => {
  const response = await api.get(`/api/trading/account/${accountId}/history`)
  return response.data
}

export const deleteTradingAccount = async (accountId: string): Promise<void> => {
  await api.delete(`/api/trading/account/${accountId}`)
}

// News API
export const fetchNews = async (
  request: FetchNewsRequest
): Promise<FetchNewsResponse> => {
  const response = await api.post('/api/news/fetch', request)
  return response.data
}

export const getDailySummaries = async (
  symbol: string,
  startDate: string,
  endDate: string
): Promise<DailyNews[]> => {
  const response = await api.get(`/api/news/summaries/${symbol}`, {
    params: { start_date: startDate, end_date: endDate }
  })
  return response.data
}

export const getNewsByDate = async (
  symbol: string,
  date: string
): Promise<DailyNews[]> => {
  const response = await api.get(`/api/news/by-date/${symbol}/${date}`)
  return response.data
}

export const getDatesWithNews = async (
  symbol: string,
  startDate: string,
  endDate: string
): Promise<string[]> => {
  const response = await api.get<NewsDateResponse>(`/api/news/dates/${symbol}`, {
    params: { start_date: startDate, end_date: endDate }
  })
  return response.data.dates
}

export const getTradingDatesWithNews = async (
  symbol: string,
  startDate: string,
  endDate: string,
  tradingDates: string[]
): Promise<string[]> => {
  const response = await api.post<NewsDateResponse>(
    `/api/news/trading-dates/${symbol}`,
    { trading_dates: tradingDates },
    { params: { start_date: startDate, end_date: endDate } }
  )
  return response.data.dates
}

// Stock Search API
export const getStockInfo = async (symbol: string): Promise<StockInfo> => {
  const response = await api.get<StockInfo>(`/api/stocks/info/${symbol}`)
  return response.data
}

export const searchStocks = async (query: string): Promise<StockInfo[]> => {
  const response = await api.get<StockSearchResponse>('/api/stocks/search', {
    params: { q: query }
  })
  return response.data.results
}

// Day Trading API
export const getDayTradingLosers = async (): Promise<DayTradingStock[]> => {
  const response = await api.get<DayTradingLosersResponse>('/api/stocks/day-trading/losers')
  return response.data.stocks
}

// US ETF API
export const getUSETFLosers = async (): Promise<DayTradingStock[]> => {
  const response = await api.get<DayTradingLosersResponse>('/api/stocks/us-etf/losers')
  return response.data.stocks
}

export default api
