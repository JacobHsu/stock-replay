# StockReplay Serverless Backend

從傳統 FastAPI Server 遷移到 **Vercel Serverless Functions** 的新後端。

## 🎯 遷移目標

```
改造前：
  前端 (Vercel) → 後端 (Railway) → yfinance / News API
                   ↳ 記憶體中管理 Session 和 Trading

改造後：
  前端 (Vercel) → Serverless API (Vercel) → yfinance / News API
                   ↳ 無狀態，純代理
                   ↳ Playback/Trading 邏輯移至前端
```

## 📋 遷移階段

| 階段 | 內容 | 狀態 |
|------|------|------|
| Phase 1 | 建立 Serverless 專案 + Health Check | ✅ 完成 |
| Phase 2 | 股票數據 API（無狀態代理） | ✅ 完成 |
| Phase 3 | 前端改造 - Playback 邏輯移至前端 | ✅ 完成 |
| Phase 4 | 前端改造 - Trading 邏輯移至前端 | ✅ 完成 |
| Phase 5 | 新聞 API 遷移 | ⬜ 待做 |
| Phase 6 | Stock Search API 遷移 | ⬜ 待做 |

---

## 🏗️ 專案結構

```
serverless/
├── app.py                 # FastAPI 應用入口（Vercel 會自動偵測）
├── lib/                   # 共用工具函數
│   ├── __init__.py
│   ├── config.py          # 環境變數設定
│   └── stock_fetcher.py   # yfinance 數據抓取
├── requirements.txt       # Python 依賴（精簡版，避免超過 250MB）
├── vercel.json            # Vercel 部署設定
├── .env.example           # 環境變數範例
├── .env                   # 本地環境變數（不進版控）
└── README.md              # 本文件
```

## 🔑 架構對比

### 原始 Backend（有狀態）
```
POST /api/playback/start   → 下載數據 + 建立 Session（存記憶體）
GET  /api/playback/{id}/next → current_index++ → 回傳一根 K 線
POST /api/trading/.../buy  → 更新記憶體中的帳戶
```

### 新 Serverless（無狀態）
```
GET /api/stock/{symbol}    → 下載數據 → 一次回傳全部 K 線
                             （前端自己管理 index 和 trading）
POST /api/news/fetch       → 代理新聞 API（隱藏 API Key）
GET /api/stocks/search     → 代理股票搜尋
GET /health                → 健康檢查
```

---

## 🚀 Phase 1：建立專案 + Health Check

### 目標
- 建立可運行的 FastAPI 專案
- 本地測試通過
- 確認 Vercel 部署格式正確

### 本地啟動

```powershell
# 1. 進入 serverless 資料夾
cd serverless

# 2. 建立虛擬環境（首次使用）
uv venv
.venv\Scripts\activate

# 3. 安裝依賴（首次使用）
uv pip install -r requirements.txt

# 4. 啟動本地開發伺服器（port 8889，避免和 backend 的 8888 衝突）
uvicorn app:app --reload --port 8889
```

### 測試端點（PowerShell）

```powershell
# Health Check
Invoke-RestMethod -Uri http://localhost:8889/health

# Root
Invoke-RestMethod -Uri http://localhost:8889/

# 瀏覽器開啟 Swagger 文件
Start-Process http://localhost:8889/docs
```

### 預期結果

```json
// GET /health
{"status": "healthy", "service": "serverless"}

// GET /
{"message": "StockReplay Serverless API", "version": "0.1.0", "architecture": "serverless"}
```

---

## 🚀 Phase 2：股票數據 API ✅

### 目標
- 新增 `/api/stock/{symbol}` 端點
- 一次回傳所有 K 線數據（取代 playback/start + next 組合）
- 本地測試 + 與前端整合測試

### API 參數

| 參數 | 類型 | 必填 | 說明 | 範例 |
|------|------|:----:|------|------|
| `symbol` | path | ✅ | 股票代碼 | `AAPL`, `2330.TW`, `BTC-USD` |
| `period` | query | ❌ | 時間區間（預設 1mo） | `1mo`, `3mo`, `6mo`, `1y` |
| `start_date` | query | ❌ | 起始日期 | `2025-01-01` |
| `end_date` | query | ❌ | 結束日期 | `2025-02-01` |

### 測試方法（PowerShell）

```powershell
# 抓取 AAPL 最近 1 個月
Invoke-RestMethod -Uri "http://localhost:8889/api/stock/AAPL?period=1mo"

# 抓取台積電 1 個月
Invoke-RestMethod -Uri "http://localhost:8889/api/stock/2330.TW?period=1mo"

# 抓取 BTC 3 個月
Invoke-RestMethod -Uri "http://localhost:8889/api/stock/BTC-USD?period=3mo"

# 指定日期範圍
Invoke-RestMethod -Uri "http://localhost:8889/api/stock/2330.TW?start_date=2025-01-01&end_date=2025-02-01"

# 查看完整 JSON 輸出
Invoke-RestMethod -Uri "http://localhost:8889/api/stock/AAPL?period=1mo" | ConvertTo-Json -Depth 3
```

### 預期回應格式

```json
{
  "symbol": "2330.TW",
  "data": [
    {
      "timestamp": "2026-01-12T00:00:00",
      "open": 1700.0,
      "high": 1705.0,
      "low": 1690.0,
      "close": 1690.0,
      "volume": 29987449
    }
    // ... 更多 K 線
  ],
  "total_count": 23,
  "price_range": {
    "min_price": 1680.0,
    "max_price": 1925.0
  },
  "all_dates": ["2026-01-12", "2026-01-13", ...]
}
```

### 與 Backend 的 API 對比

```
Backend（需要多次呼叫）：
  1. POST /api/playback/start     → 建立 session，回傳 playback_id
  2. GET  /api/playback/{id}/next → 取得一根 K 線（需要重複呼叫）
  3. GET  /api/playback/{id}/next → 再一根...
  
Serverless（一次搞定）：
  1. GET /api/stock/2330.TW?period=1mo → 回傳全部 23 根 K 線 🎉
```

---

## 🚀 Phase 3：前端 Playback 改造 ✅

### 目標
- 前端改為一次載入所有 K 線數據
- `PlaybackControls` 直接操作本地 state，不再呼叫後端
- 移除對 `/api/playback/*` 的依賴

### 改動範圍
```
frontend/
├── .env.local                       # 新增 VITE_SERVERLESS_URL=http://localhost:8889
├── src/
│   ├── services/api.ts              # 新增 getStockDataFromServerless() + isServerlessMode
│   └── pages/TradingSimulator.tsx    # 雙模式：serverless / backend
```

### 運作機制

```
有 VITE_SERVERLESS_URL → Serverless 模式 🚀
  initializePlayback() → GET /api/stock/{symbol}（一次取完）
  getNext()            → currentIndex++（純前端，零 API 呼叫）
  handleSeek()         → setCurrentIndex(n)（純前端）
  handlePrevious()     → currentIndex--（純前端）

沒有 VITE_SERVERLESS_URL → Backend 模式 📦（向後相容）
  initializePlayback() → POST /api/playback/start
  getNext()            → GET /api/playback/{id}/next
  handleSeek()         → POST /api/playback/{id}/seek
```

### 測試方法

```powershell
# 1. 確保 serverless 運行中
cd serverless
.venv\Scripts\activate
uvicorn app:app --reload --port 8889

# 2. 確保前端 .env.local 有設定
#    VITE_SERVERLESS_URL=http://localhost:8889

# 3. 啟動前端
cd frontend
npm run dev

# 4. 開啟瀏覽器 http://localhost:2330
#    打開 DevTools Console，應該看到：
#    [TradingSimulator] Mode: 🚀 Serverless
#    [initializePlayback] 🚀 Serverless mode
#    [initializePlayback] Serverless response: 23 candles
```

### 切換回 Backend 模式

```powershell
# 在 frontend/.env.local 中註解掉 VITE_SERVERLESS_URL：
# VITE_SERVERLESS_URL=http://localhost:8889

# 重啟前端，Console 應顯示：
# [TradingSimulator] Mode: 📦 Backend
```

---

## 🚀 Phase 4：前端 Trading 改造 ✅

### 目標
- 前端自己管理交易帳戶狀態
- 計算買入/賣出/損益
- 移除對 `/api/trading/*` 的依賴

### 新增檔案
```
frontend/src/hooks/useLocalTrading.ts   # 本地交易 Hook
```

### 運作機制
```
Serverless 模式 🚀：
  初始資金：$1,000,000
  Buy 1  → cash -= price、position.shares += 1（純前端運算）
  Sell 1 → cash += price、計算 realized P/L（純前端運算）
  每根 K 線自動更新 unrealized P/L

Backend 模式 📦（向後相容）：
  仍然呼叫 Backend API（executeBuy、executeSell）
```

### Serverless 模式功能完整度

| 功能 | 狀態 |
|------|:----:|
| K 線圖表顯示 | ✅ |
| 播放/暫停/上一根/下一根/跳轉 | ✅ |
| Trading Account（資產區塊） | ✅ |
| Buy / Sell 按鈕 | ✅ |
| P/L 損益計算 | ✅ |
| 交易記錄（Trade History） | ✅ |
| 新聞模式 | ⚠️ 需要 Backend News API |

---

## 🚀 Phase 5：新聞 API 遷移（待實作）

### 目標
- 將 News API 代理遷移到 Serverless
- 注意：SQLite cache 在 Serverless 不可用，需改用其他方案

---

## 🚀 Phase 6：Stock Search API 遷移（待實作）

### 目標
- 將股票搜尋/資訊 API 遷移到 Serverless
- 這些都是無狀態的，遷移最簡單

---

## 🌐 部署到 Vercel

### 首次部署

```bash
# 1. 安裝 Vercel CLI
npm i -g vercel

# 2. 登入
vercel login

# 3. 在 serverless 資料夾下部署
cd serverless
vercel

# 4. 設定環境變數（在 Vercel Dashboard）
# CORS_ORIGINS=["https://stock-replay.vercel.app"]
# TAVILY_API_KEY=your_key
# RAPIDAPI_KEY=your_key
```

### 自動部署

連結 GitHub repo 後，每次 push 到 main 會自動部署。
需要在 Vercel Project Settings 設定 Root Directory 為 `serverless`。

---

## 📝 注意事項

### Serverless 限制
- **Bundle Size**：最大 250MB（需精簡 requirements.txt）
- **執行時間**：免費版最長 10 秒，Pro 版 60 秒
- **無狀態**：每次請求可能在不同 instance，不保證記憶體狀態
- **冷啟動**：首次呼叫可能需要 1-3 秒

### 遷移期間
- `backend/` 和 `serverless/` 可以同時運行
- 前端可以透過環境變數切換 API 來源
- 逐步驗證每個 Phase 後再進入下一階段
