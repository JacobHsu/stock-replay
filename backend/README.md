# StockReplay Backend

FastAPI 後端服務，提供股票回放、模擬交易、新聞查詢等功能。

## 🚀 快速開始

```bash
# 安裝依賴
uv sync

# 複製環境變數檔案
cp .env.example .env

# 啟動開發伺服器
uv run uvicorn app.main:app --reload
```

- **API 服務**：http://localhost:8888
- **API 文檔**：http://localhost:8888/docs
- **健康檢查**：http://localhost:8888/health

---

## 📚 技術架構

### 核心技術棧

- **FastAPI** - 現代、高效能的 Python Web 框架
- **Uvicorn** - ASGI 伺服器
- **Pandas** - 資料分析和處理
- **yfinance** - 獲取股票歷史數據
- **SQLAlchemy** - ORM 資料庫操作
- **LangChain** - AI/LLM 整合（可選）

### 分層架構

```
┌─────────────────────────────────────┐
│   API Layer (FastAPI Routes)       │  ← HTTP 端點
├─────────────────────────────────────┤
│   Service Layer (Business Logic)   │  ← 業務邏輯
├─────────────────────────────────────┤
│   Model Layer (Data Models)        │  ← 資料模型
├─────────────────────────────────────┤
│   Utils/Helpers (Tools)             │  ← 工具函數
├─────────────────────────────────────┤
│   External Services                 │  ← 外部 API
│   (yfinance, News API, Database)   │
└─────────────────────────────────────┘
```

### 專案結構

```
backend/
├── app/
│   ├── api/                    # API 路由
│   │   ├── data.py            # 股票數據
│   │   ├── playback.py        # 回放控制
│   │   ├── trading.py         # 交易操作
│   │   ├── news.py            # 新聞管理
│   │   └── stock_search.py    # 股票搜尋
│   ├── services/              # 業務邏輯
│   │   ├── playback_service.py
│   │   ├── trading_service.py
│   │   └── news_service.py
│   ├── models/                # 資料模型
│   │   ├── playback.py
│   │   └── trading.py
│   ├── database/              # 資料庫
│   │   ├── connection.py
│   │   └── models.py
│   ├── helpers/               # 外部 API 整合
│   │   ├── yfinance/
│   │   └── newsapi/
│   ├── utils/                 # 工具函數
│   ├── config.py              # 配置管理
│   └── main.py                # 應用入口
├── data/                      # 資料存儲
│   └── news_cache.db         # SQLite 資料庫
├── tests/                     # 測試
├── .env.example              # 環境變數範例
├── requirements.txt          # 依賴清單
└── pyproject.toml           # 專案配置
```

---

## 🎯 核心功能

### 1. Playback Session（回放會話）

**目的**：逐步回放股票 K 線，不需一次載入所有數據到前端。

**工作原理**：
```python
# 1. 用戶選擇 AAPL, 3個月
POST /api/playback/start {symbol: "AAPL", period: "3mo"}

# 2. 後端從 yfinance 獲取 90 天數據
# 3. 創建 PlaybackSession 並存在記憶體
# 4. 返回 playback_id

# 5. 用戶點擊「下一根」
GET /api/playback/{id}/next

# 6. 返回一根 K 線，current_index += 1
```

**核心類別**：
```python
class PlaybackSession:
    playback_id: str        # 唯一 ID
    symbol: str             # 股票代碼
    data: DataFrame         # 所有 K 線數據
    current_index: int      # 當前位置
    
    def next(count=1)       # 獲取下 N 根 K 線
    def seek(index)         # 跳轉到指定位置
    def get_current()       # 獲取當前 K 線
```

**存儲方式**：記憶體（重啟後消失）

### 2. Trading Account（交易帳戶）

**目的**：模擬股票交易，追蹤損益。

**帳戶結構**：
```python
{
    "account_id": "xyz-789",
    "current_cash": 10000,      # 當前現金
    "position": {
        "shares": 10,           # 持股數量
        "entry_price": 150.5,   # 進場價格
        "unrealized_pl": 45.0   # 未實現損益
    },
    "realized_pl": 100.0,       # 已實現損益
    "total_pl": 145.0           # 總損益
}
```

**操作**：
- `buy()` - 全倉買入（用所有現金）
- `sell()` - 全倉賣出（賣出所有持股）
- 自動計算損益和更新持倉

**存儲方式**：記憶體（重啟後消失）

### 3. News Cache（新聞快取）

**目的**：快取新聞文章，避免重複呼叫 API。

**流程**：
```
查詢 AAPL 2024-01-01 的新聞
    ↓
檢查 SQLite 資料庫
    ↓
找到？ → 返回快取數據（快！）
沒有？ → 呼叫 API → 存入資料庫 → 返回
```

**資料庫表**：
- `news_articles` - 個別文章
- `daily_news_summary` - 每日摘要

**存儲方式**：SQLite (`data/news_cache.db`)

---

## 🔌 API 端點

### Playback（回放控制）
```
POST   /api/playback/start          # 創建回放會話
GET    /api/playback/{id}/status    # 獲取狀態
GET    /api/playback/{id}/next      # 下一根 K 線
POST   /api/playback/{id}/seek      # 跳轉位置
DELETE /api/playback/{id}           # 刪除會話
```

### Trading（交易操作）
```
POST   /api/trading/account/create           # 創建交易帳戶
GET    /api/trading/account/{id}/status      # 帳戶狀態
POST   /api/trading/account/{id}/buy         # 買入
POST   /api/trading/account/{id}/sell        # 賣出
GET    /api/trading/account/{id}/history     # 交易歷史
DELETE /api/trading/account/{id}             # 刪除帳戶
```

### Data（股票數據）
```
GET /api/data/historical/{symbol}   # 獲取歷史數據
```

### News（新聞）
```
POST /api/news/fetch                    # 抓取新聞
GET  /api/news/summaries/{symbol}       # 每日摘要
GET  /api/news/by-date/{symbol}/{date}  # 特定日期新聞
GET  /api/news/dates/{symbol}           # 有新聞的日期
```

### Stock Search（股票搜尋）
```
GET /api/stocks/info/{symbol}           # 股票資訊
GET /api/stocks/search?q={query}        # 搜尋股票
GET /api/stocks/day-trading/losers      # 當日跌幅榜
GET /api/stocks/us-etf/losers           # 美股 ETF 跌幅榜
```

---

## 🚀 部署到 GitHub Codespaces

GitHub Codespaces 提供雲端開發環境，適合開發測試使用。

### 快速開始

1. **開啟 Codespace**
   - 前往 GitHub repository
   - 點擊綠色 `<> Code` 按鈕
   - 選擇 `Codespaces` 標籤
   - 點擊 `Create codespace on main`

2. **等待環境建立**（約 2-3 分鐘）
   - 自動安裝 Python 3.12
   - 自動安裝 uv 和所有套件
   - 自動啟動後端伺服器

3. **存取 API**
   - 點擊 `PORTS` 標籤
   - 找到 port `8888`
   - 右鍵 → **Port Visibility** → **Public**（外部存取必須設為公開，否則會 302 重定向）
   - 點擊 🌐 開啟瀏覽器
   - 加上 `/docs` 查看 API 文件

### 手動啟動後端

```bash
cd /workspaces/stock-replay/backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8888
```

### 常用指令

| 指令 | 用途 |
|-----|------|
| `ps aux \| grep uvicorn` | 檢查服務是否運行 |
| `curl http://localhost:8888/health` | 健康檢查 |
| `pkill -f uvicorn` | 停止服務 |
| `cat /tmp/backend.log` | 查看 log |

### 注意事項

- **閒置暫停**：30 分鐘無活動後自動暫停（不收費）
- **免費額度**：每月 120 核心小時（約 60 小時 @ 2 核心）
- **重新啟動**：暫停後需手動重新開啟 Codespace
- **API 喚醒**：暫停狀態下 API 呼叫無法喚醒


---

## 🚀 部署到 Railway

### 快速部署

1. **推送到 GitHub**
   ```bash
   git push origin main
   ```

2. **在 Railway 創建專案**
   - 前往 https://railway.app
   - 選擇 "Deploy from GitHub repo"
   - 選擇你的 repository

3. **設定 Root Directory**
   - 專案根目錄已有 `railway.toml`，會自動設定
   - 或手動設定：Settings → Root Directory → `backend`

4. **設定環境變數**
   
   在 Variables 標籤新增：
   ```bash
   PORT=8888
   PYTHON_VERSION=3.12
   DEBUG=false
   ENVIRONMENT=production
   CORS_ORIGINS=["https://your-frontend.vercel.app","http://localhost:5173"]
   ```

5. **產生公開 URL**
   - Settings → Domains → Generate Domain
   - 複製 URL（例如：`https://your-app.up.railway.app`）

6. **驗證部署**
   ```bash
   curl https://your-app.up.railway.app/health
   ```

### CORS 設定

如果前端無法連接，出現 CORS 錯誤：

**解決方法 1：修改代碼（已完成）**

`backend/app/config.py` 已包含：
```python
cors_origins: List[str] = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://stock-replay.vercel.app",
    "https://stock-replay-*.vercel.app",  # 支持預覽部署
]
```

推送代碼後 Railway 會自動重新部署。

**解決方法 2：設定環境變數**

在 Railway Variables 中設定：
```json
CORS_ORIGINS=["http://localhost:5173","https://your-frontend.vercel.app"]
```

### 持久化資料庫（可選）

如果需要保留新聞快取：

1. Service Settings → Volumes
2. 新增 Volume：Mount Path = `/app/data`
3. 這樣 `data/news_cache.db` 會在重啟後保留

### 監控

**查看日誌**：
- Dashboard → Deployments → 最新部署 → View Logs

**監控資源**：
- Dashboard → Metrics（CPU、記憶體、網路）

---

## 🔧 開發

### 執行測試
```bash
uv run pytest
uv run pytest --cov=app --cov-report=html
```

### 程式碼品質
```bash
uv run ruff check .      # Lint
uv run ruff format .     # Format
```

### 環境變數

參考 `.env.example`：

```bash
# 應用設定
APP_NAME="StockReplay"
DEBUG=True
PORT=8888

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# API Keys（可選）
TAVILY_API_KEY=your_tavily_api_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# 資料庫
DATABASE_URL="sqlite:///./data/news_cache.db"

# 日誌
LOG_LEVEL="INFO"
```

---

## 📊 資料流程範例

### 完整的回放流程

```
1. 用戶選擇股票
   前端 → POST /api/playback/start {symbol: "AAPL", period: "3mo"}
   後端 → yfinance.download() → 創建 PlaybackSession
   響應 → {playback_id: "abc-123", total_count: 63}

2. 自動創建交易帳戶
   前端 → POST /api/trading/account/create {playback_id: "abc-123"}
   後端 → 創建 TradingAccount
   響應 → {account_id: "xyz-789", current_cash: 10000}

3. 用戶點擊「下一根」
   前端 → GET /api/playback/abc-123/next
   後端 → session.next(1) → current_index += 1
   響應 → {current_data: {K 線數據}}

4. 用戶點擊「買入」
   前端 → POST /api/trading/account/xyz-789/buy {current_price: 150.5}
   後端 → execute_buy() → 更新現金和持倉
   響應 → {trade: {...}, status: {更新後的帳戶}}
```

---

## 🎯 設計決策

### 為什麼使用會話管理？
- **問題**：一次載入所有 K 線到前端很慢且耗記憶體
- **解決**：後端持有數據，前端逐根請求
- **優點**：快速、可擴展、支援跳轉操作

### 為什麼快取新聞？
- **問題**：新聞 API 有速率限制且收費
- **解決**：首次查詢後存入 SQLite
- **優點**：後續查詢快速、節省 API 呼叫

### 為什麼用記憶體存儲會話？
- **優點**：存取快速、實作簡單
- **缺點**：重啟後消失（MVP 可接受）
- **未來**：可遷移到 Redis 實現持久化

---

## 🔍 疑難排解

### 問題 1：CORS 錯誤

**錯誤訊息**：
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**解決方法**：
1. 檢查 `backend/app/config.py` 的 `cors_origins`
2. 確認包含前端域名
3. 或在 Railway 設定 `CORS_ORIGINS` 環境變數
4. 重新部署

### 問題 2：Railway 部署失敗

**常見原因**：
- Root Directory 未設定為 `backend`
- `requirements.txt` 不存在
- Python 版本不符

**解決方法**：
1. 確認 `railway.toml` 存在
2. 或手動設定 Root Directory
3. 設定 `PYTHON_VERSION=3.12`

### 問題 3：資料庫檔案消失

**原因**：Railway 檔案系統是暫時的

**解決方法**：
- 設定 Volume（Mount Path: `/app/data`）
- 或改用 Railway PostgreSQL

---

## 📝 授權

MIT License

---

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！
