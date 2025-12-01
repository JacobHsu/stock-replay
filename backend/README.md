# StockReplay - Backend

FastAPI backend for stock trading simulator with playback functionality.

## Quick Start

```bash
# Install dependencies
uv sync

# Copy environment file
cp .env.example .env

# Run development server
uv run uvicorn app.main:app --reload
```

API: http://localhost:8888  
Docs: http://localhost:8888/docs

---

## Architecture

### Layered Design

```
API Layer (FastAPI)
    ↓
Service Layer (Business Logic)
    ↓
Data Layer (yfinance, SQLite)
```

### Project Structure

```
backend/
├── app/
│   ├── api/              # HTTP endpoints
│   │   ├── playback.py   # Playback control
│   │   ├── trading.py    # Trading operations
│   │   ├── news.py       # News management
│   │   └── data.py       # Stock data
│   ├── services/         # Core business logic
│   │   ├── playback_service.py   # Session management
│   │   ├── trading_service.py    # Trading logic
│   │   └── news_service.py       # News caching
│   ├── models/           # Data models
│   ├── database/         # SQLite (news cache)
│   ├── helpers/          # External APIs (yfinance, newsapi)
│   └── utils/            # Utilities
└── data/
    └── news_cache.db     # SQLite database
```

---

## Core Concepts

### 1. Playback Session

**Purpose:** Enable step-by-step K-line playback without loading all data to frontend.

**How it works:**
```python
# User selects AAPL, 3mo
1. Fetch 90 days of data from yfinance
2. Create PlaybackSession with unique ID
3. Store in memory (sessions dict)
4. Return playback_id to frontend

# User clicks "Next"
1. Frontend sends: GET /api/playback/{id}/next
2. Backend: session.next() → returns 1 K-line
3. current_index += 1
```

**Key Class:**
```python
class PlaybackSession:
    playback_id: str        # Unique ID
    symbol: str             # Stock symbol
    data: DataFrame         # All K-lines
    current_index: int      # Current position
    
    def next(count=1)       # Get next N K-lines
    def seek(index)         # Jump to position
    def get_current()       # Get current K-line
```

**Storage:** Memory only (not in database)

### 2. Trading Account

**Purpose:** Simulate stock trading with P/L tracking.

**Account Structure:**
```python
{
    "account_id": "xyz-789",
    "current_cash": 10000,
    "position": {
        "shares": 10,
        "entry_price": 150.5,
        "unrealized_pl": 45.0
    },
    "realized_pl": 100.0,
    "total_pl": 145.0
}
```

**Operations:**
- `execute_buy()` - Buy 1 share at current price
- `execute_sell()` - Sell 1 share at current price
- Auto-calculate P/L and update position

**Storage:** Memory only

### 3. News Cache

**Purpose:** Cache news articles to avoid repeated API calls.

**Flow:**
```
Query news for AAPL 2024-01-01
    ↓
Check SQLite database
    ↓
Found? → Return cached data (fast!)
Not found? → Fetch from API → Save to DB → Return
```

**Database Tables:**
- `news_articles` - Individual articles
- `daily_news_summary` - Daily grouped summaries

**Storage:** SQLite database (`data/news_cache.db`)

---

## API Endpoints

### Playback Control
- `POST /api/playback/start` - Create session
- `GET /api/playback/{id}/next` - Get next K-line
- `POST /api/playback/{id}/seek` - Jump to position
- `GET /api/playback/{id}/status` - Get status

### Trading
- `POST /api/trading/accounts` - Create account
- `GET /api/trading/accounts/{id}` - Get status
- `POST /api/trading/accounts/{id}/buy` - Buy 1 share
- `POST /api/trading/accounts/{id}/sell` - Sell 1 share

### News
- `POST /api/news/fetch` - Fetch and cache news
- `GET /api/news/dates` - Get dates with news
- `GET /api/news/by-date` - Get news by date

---

## Data Flow Example

### Complete Playback Flow

```
1. User selects stock
   Frontend → POST /api/playback/start {symbol: "AAPL", period: "3mo"}
   Backend → yfinance.download() → Create PlaybackSession
   Response → {playback_id: "abc-123", total_count: 63}

2. Auto-create trading account
   Frontend → POST /api/trading/accounts {playback_id: "abc-123"}
   Backend → Create TradingAccount
   Response → {account_id: "xyz-789", current_cash: 10000}

3. User clicks "Next"
   Frontend → GET /api/playback/abc-123/next
   Backend → session.next(1) → current_index += 1
   Response → {current_data: {K-line data}}

4. User clicks "Buy"
   Frontend → POST /api/trading/accounts/xyz-789/buy {current_price: 150.5}
   Backend → execute_buy() → Update cash and position
   Response → {trade: {...}, status: {updated account}}
```

---

## Key Design Decisions

### Why Session-based?
- **Problem:** Loading all K-lines to frontend is slow and memory-intensive
- **Solution:** Backend holds data, frontend requests one at a time
- **Benefits:** Fast, scalable, supports seek/jump operations

### Why Cache News?
- **Problem:** News API has rate limits and costs money
- **Solution:** Store in SQLite after first fetch
- **Benefits:** Fast subsequent queries, no repeated API calls

### Why Memory Storage for Sessions?
- **Pros:** Fast access, simple implementation
- **Cons:** Lost on restart (acceptable for MVP)
- **Future:** Can migrate to Redis for persistence

---

## Development

### Run Tests
```bash
uv run pytest
uv run pytest --cov=app --cov-report=html
```

### Code Quality
```bash
uv run black .           # Format
uv run ruff check .      # Lint
uv run mypy app/         # Type check
```

### Environment Variables
See `.env.example` for required configuration:
- `NEWS_API_KEY` - News API key
- `DATABASE_URL` - SQLite database path
- `CORS_ORIGINS` - Allowed frontend origins

---

## Deployment

### Railway 部署（推薦）

完整部署指南請參考：**[DEPLOYMENT.md](./DEPLOYMENT.md)**

#### 快速部署步驟

**1. 推送到 GitHub**
```bash
git add .
git commit -m "Add Railway deployment config"
git push origin main
```

**2. 在 Railway 創建專案**
- 前往 https://railway.app
- 用 GitHub 登入（需綁定信用卡，有 $5/月 免費額度）
- 點擊 "New Project" → "Deploy from GitHub repo"
- 選擇你的 repository

**3. 設定 Root Directory（重要！）**

因為 backend 在子目錄中，有兩種方法：

**方法 A：使用 railway.toml（推薦，最簡單）**

專案根目錄已有 `railway.toml` 檔案，Railway 會自動讀取。
無需手動設定，直接部署即可！

**方法 B：手動設定**

如果方法 A 不行：
1. 點擊 service → Settings（齒輪圖示）
2. 找到 Source 區塊 → Configure
3. Root Directory 輸入：`backend`
4. Save

如果沒設定，Railway 會找不到 `requirements.txt` 而部署失敗！

**4. 設定環境變數**

在 Variables 標籤中新增：
```bash
PORT=8888
PYTHON_VERSION=3.12
DEBUG=false
ENVIRONMENT=production
CORS_ORIGINS=["https://your-frontend.vercel.app","http://localhost:5173"]
```

如果使用新聞功能，還需要：
```bash
NEWS_API_KEY=your_news_api_key
```

**5. 產生公開 URL**
- 進入 Settings → Domains
- 點擊 "Generate Domain"
- 複製產生的 URL（例如：`https://your-app.up.railway.app`）

**6. 驗證部署**
```bash
# 檢查健康狀態
curl https://your-app.up.railway.app/health

# 查看 API 文件
# 瀏覽器開啟：https://your-app.up.railway.app/docs
```

#### 持久化資料庫（可選）

如果需要保留新聞快取：

1. 在 Service Settings 找到 "Volumes"
2. 新增 Volume：
   - Mount Path: `/app/data`
3. 這樣 `data/news_cache.db` 會在重啟後保留

#### 自動部署

Railway 會自動監聽 GitHub：
```bash
# 每次推送都會自動重新部署
git push origin main
```

#### 其他部署平台

- **Render** - 免費但 15 分鐘無活動會休眠
- **Fly.io** - 設定較複雜但效能好
- **Vercel** - 不適合（Serverless 限制）

### 部署注意事項

**記憶體存儲：**
- Playback Sessions 存在記憶體
- Trading Accounts 存在記憶體
- 重啟後會消失（正常行為）

**資料庫存儲：**
- 新聞快取存在 SQLite
- 需要設定 Volume 才能持久化
- 或改用 Railway PostgreSQL

**生產環境建議：**
- 使用 Redis 存 Session（避免重啟消失）
- 使用 PostgreSQL 存新聞（更穩定）
- 設定適當的 CORS 白名單
- 啟用日誌監控

**成本估算：**
- 免費額度：$5/月（約 500 小時）
- 小型應用：約 $5-10/月
- 可設定 Sleep on Idle 節省成本
