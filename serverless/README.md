# StockReplay Serverless Backend

FastAPI on Vercel — 無狀態架構，取代原本的 Railway Backend。

## 架構

```
前端 (Vercel) → Serverless API (Vercel) → yfinance / News API
                 ↳ 無狀態，純代理
                 ↳ Playback / Trading 邏輯移至前端
```

## 本地啟動

```powershell
# 從專案根目錄（推薦）
.\run.ps1 run          # 同時啟動 serverless (8889) + frontend (5173)
.\run.ps1 serverless   # 只啟動 serverless

# 或手動
cd serverless
.venv\Scripts\uvicorn app:app --reload --port 8889
```

## 專案結構

```
serverless/
├── app.py                      # FastAPI 入口
├── api/
│   └── search.py               # 股票搜尋、當沖跌幅、Morning Star
├── lib/
│   ├── config.py               # 環境變數
│   ├── stock_fetcher.py        # yfinance K 線抓取
│   ├── stock_database.py       # taiwan_stocks.json 查詢（搜尋用）
│   ├── stock_name_fetcher.py   # 股票中文名查詢
│   ├── day_trading_scraper.py  # HiStock 當沖跌幅爬蟲
│   ├── us_etf_losers.py        # 美股 ETF 跌幅
│   ├── morning_star_losers.py  # Morning Star API
│   └── data/
│       └── taiwan_stocks.json  # 台股靜態資料庫（搜尋功能用）
├── requirements.txt
├── vercel.json
└── .env.example
```

## API 端點

| 端點 | 說明 |
|------|------|
| `GET /api/stock/{symbol}` | K 線數據（一次全部回傳） |
| `GET /api/data/historical/{symbol}` | 同上，舊版相容路徑 |
| `GET /api/stocks/search?q=` | 台股搜尋（代碼或中文名） |
| `GET /api/stocks/info/{symbol}` | 股票資訊 |
| `GET /api/stocks/day-trading/losers` | 當沖跌幅（上八 .TWO + 下八 .TW） |
| `GET /api/stocks/us-etf/losers` | 美股 ETF 跌幅 |
| `GET /api/stocks/morning-star/losers` | Morning Star 跌幅 |
| `GET /health` | 健康檢查 |

## 當沖跌幅邏輯

從 HiStock 爬取可當沖跌幅排行，自動偵測上市/上櫃後綴：

- 上櫃 `.TWO`（TPEX）：優先湊滿 8 支，前端顯示上排，走 TradingView 圖表
- 上市 `.TW`（TWSE）：另取 8 支，前端顯示下排，走 Yahoo Finance 圖表

不依賴 `taiwan_stocks.json`——直接用 yfinance 驗證股票是否有歷史資料。

`taiwan_stocks.json` 只用於**搜尋功能**（中文名稱查詢）。

## 前端圖表對照

| 市場 | 圖表 |
|------|------|
| 台股上市 `.TW` | Yahoo Finance Chart（yfinance 資料，TWSE 在 TV 需付費） |
| 台股上櫃 `.TWO` | TradingView Widget（TPEX 免費） |
| 美股 / 加密貨幣 | TradingView Widget |

## 遷移階段

| 階段 | 內容 | 狀態 |
|------|------|------|
| Phase 1 | 建立專案 + Health Check | ✅ |
| Phase 2 | 股票數據 API（無狀態代理） | ✅ |
| Phase 3 | 前端 Playback 邏輯移至前端 | ✅ |
| Phase 4 | 前端 Trading 邏輯移至前端 | ✅ |
| Phase 5 | Stock Search / 當沖 / ETF API | ✅ |
| Phase 6 | 新聞 API 遷移 | ⬜ 待做 |

## 部署到 Vercel

```bash
cd serverless
vercel
```

Vercel Project Settings → Root Directory 設為 `serverless`。

環境變數（Vercel Dashboard）：
```
CORS_ORIGINS=["https://stock-replay.vercel.app"]
TAVILY_API_KEY=your_key
RAPIDAPI_KEY=your_key
```

## 注意事項

- **Bundle Size**：最大 250MB
- **執行時間**：免費版 10 秒，Pro 版 60 秒
- **無狀態**：每次請求可能在不同 instance
- **冷啟動**：首次呼叫約 1-3 秒
