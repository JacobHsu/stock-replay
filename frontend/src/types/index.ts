// API Response Types
export interface CandleData {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface StockDataResponse {
  symbol: string
  data: CandleData[]
  total_count: number
}

export interface PlaybackStatusResponse {
  playback_id: string
  symbol: string
  current_index: number
  total_count: number
  has_more: boolean
  current_data: CandleData | null
  price_range?: {
    min_price: number
    max_price: number
  }
  all_dates?: string[]  // List of all trading dates (only in start response)
}

export interface PlaybackCreateRequest {
  symbol: string
  start_date?: string
  end_date?: string
  period?: string
}

export interface PlaybackSeekRequest {
  index: number
}

// Trading Types
export interface Trade {
  id: string
  timestamp: string
  type: 'buy' | 'sell'
  shares: number
  price: number
  total: number
  cash_after: number
}

export interface Position {
  shares: number
  entry_price: number
  entry_time: string
  current_price: number
  cost_basis: number
  market_value: number
  unrealized_pl: number
  unrealized_pl_pct: number
}

export interface TradingAccountStatus {
  account_id: string
  playback_id: string
  symbol: string
  initial_cash: number
  current_cash: number
  position: Position | null
  total_value: number
  realized_pl: number
  unrealized_pl: number
  total_pl: number
  total_pl_pct: number
  trade_count: number
}

export interface TradingAccountCreateRequest {
  playback_id: string
  symbol: string
  initial_cash: number
}

export interface TradingAccountCreateResponse {
  account_id: string
  playback_id: string
  symbol: string
  initial_cash: number
  status: TradingAccountStatus
}

export interface TradeExecuteRequest {
  current_price: number
}

export interface TradeExecuteResponse {
  success: boolean
  trade: Trade
  status: TradingAccountStatus
  message: string
}

export interface TradeHistoryResponse {
  account_id: string
  trades: Trade[]
}

// Chart marker for displaying trades
export interface TradeMarker {
  time: number
  position: 'aboveBar' | 'belowBar'
  color: string
  shape: 'arrowUp' | 'arrowDown'
  text: string
}

// News Types
export interface DailyNews {
  date: string // YYYY-MM-DD format
  primary_title: string
  primary_source: string
  related_count: number
}

export interface FetchNewsRequest {
  symbol: string
  start_date: string // YYYY-MM-DD format
  end_date: string // YYYY-MM-DD format
  max_pages?: number
  max_articles?: number
}

export interface FetchNewsResponse {
  status: string
  message: string
  articles_count: number
  cached: boolean
}

export interface NewsDateResponse {
  dates: string[] // List of YYYY-MM-DD dates
}

// Stock Search Types
export interface StockInfo {
  symbol: string         // Full symbol with exchange suffix (e.g., "8033.TW")
  code: string          // Stock code only (e.g., "8033")
  name: string          // Chinese company name (e.g., "雷虎")
  display_name: string  // Display format (e.g., "8033.TW - 雷虎")
}

export interface StockSearchResponse {
  results: StockInfo[]
}

// Day Trading Types
export interface DayTradingStock {
  code: string
  symbol: string
  name: string
  change_percent: number
}

export interface DayTradingLosersResponse {
  stocks: DayTradingStock[]
}
