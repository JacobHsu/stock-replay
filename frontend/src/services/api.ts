import axios from 'axios'
import type {
  CandleData,
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

// Serverless API URL（Phase 3+）
// 設定後，股票數據會從 serverless 抓取，playback 在前端管理
const SERVERLESS_URL = import.meta.env.VITE_SERVERLESS_URL || "";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Serverless API client（僅在 SERVERLESS_URL 設定時使用）
const serverlessApi = SERVERLESS_URL ? axios.create({
  baseURL: SERVERLESS_URL,
  headers: {
    'Content-Type': 'application/json',
  },
}) : null;

// 是否使用 serverless 模式
export const isServerlessMode = !!SERVERLESS_URL;


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
  const client = serverlessApi || api
  const response = await client.get<StockInfo>(`/api/stocks/info/${symbol}`)
  return response.data
}

export const searchStocks = async (query: string): Promise<StockInfo[]> => {
  const client = serverlessApi || api
  const response = await client.get<StockSearchResponse>('/api/stocks/search', {
    params: { q: query }
  })
  return response.data.results || []
}

// Day Trading API
export const getDayTradingLosers = async (): Promise<DayTradingStock[]> => {
  const client = serverlessApi || api
  const response = await client.get<DayTradingLosersResponse>('/api/stocks/day-trading/losers')
  return response.data.stocks
}

// US ETF API
export const getUSETFLosers = async (): Promise<DayTradingStock[]> => {
  const client = serverlessApi || api
  const response = await client.get<DayTradingLosersResponse>('/api/stocks/us-etf/losers')
  return response.data.stocks
}

// Morning Star API
export const getMorningStarLosers = async (): Promise<DayTradingStock[]> => {
  const client = serverlessApi || api
  const response = await client.get<DayTradingLosersResponse>('/api/stocks/morning-star/losers')
  return response.data.stocks
}

// ============================================================
// Serverless API (Phase 3+)
// 從 serverless 一次取得所有股票數據，前端管理 playback
// ============================================================

export interface ServerlessStockResponse {
  symbol: string
  data: CandleData[]
  total_count: number
  price_range: {
    min_price: number
    max_price: number
  }
  all_dates: string[]
}

/**
 * 從 Serverless API 取得股票數據（一次全部回傳）
 * 
 * 取代 backend 的 playback/start + playback/next 組合。
 * 前端拿到所有數據後，自己管理 playback index。
 */
export const getStockDataFromServerless = async (
  symbol: string,
  params?: { start_date?: string; end_date?: string; period?: string }
): Promise<ServerlessStockResponse> => {
  if (!serverlessApi) {
    throw new Error('VITE_SERVERLESS_URL is not configured')
  }
  const response = await serverlessApi.get<ServerlessStockResponse>(
    `/api/stock/${symbol}`,
    { params }
  )
  return response.data
}

export default api
