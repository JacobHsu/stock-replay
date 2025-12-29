# 無狀態 API (Stateless API) 架構說明

> 本文件詳細說明 stock-replay 專案中採用的無狀態 API 設計模式

## 📖 目錄

- [什麼是無狀態 API](#什麼是無狀態-api)
- [有狀態 vs 無狀態對比](#有狀態-vs-無狀態對比)
- [生活化類比](#生活化類比)
- [在 stock-replay 中的實作](#在-stock-replay-中的實作)
- [優勢與挑戰](#優勢與挑戰)
- [最佳實踐](#最佳實踐)

---

## 什麼是無狀態 API

### 核心定義

**無狀態 (Stateless)**：伺服器**不記住**之前的請求，每個請求都是獨立的、自給自足的。

**有狀態 (Stateful)**：伺服器**會記住**客戶端的狀態，請求之間有依賴關係。

### 關鍵特徵

| 特性 | 無狀態 API | 有狀態 API |
|------|-----------|-----------|
| **請求獨立性** | ✅ 每個請求獨立 | ❌ 依賴先前請求 |
| **會話識別** | 客戶端提供 ID | 伺服器記憶用戶 |
| **擴展性** | ✅ 易於水平擴展 | ❌ 需要 sticky session |
| **容錯性** | ✅ 伺服器重啟影響小 | ❌ 重啟後狀態消失 |

---

## 有狀態 vs 無狀態對比

### ❌ 有狀態設計（反例）

```python
# 後端 - 伺服器記住當前用戶狀態
class PlaybackService:
    def __init__(self):
        self.current_user_symbol = None  # 記住用戶正在看的股票
        self.current_user_index = 0      # 記住用戶的播放位置

    def start(self, symbol: str):
        """伺服器記住用戶的狀態"""
        self.current_user_symbol = symbol
        self.current_user_index = 0
        return {"message": "已開始播放"}

    def next(self):
        """依賴之前記住的狀態"""
        if self.current_user_symbol is None:
            raise Error("錯誤：請先呼叫 start API")

        self.current_user_index += 1
        return f"當前第 {self.current_user_index} 根 K 線"
```

```typescript
// 前端 - 依賴請求順序
await api.post('/start', { symbol: '2330.TW' })
await api.get('/next')  // 伺服器知道我在看 2330.TW
await api.get('/next')  // 伺服器知道我現在在第 2 根
```

**問題**：
1. 如果伺服器重啟，狀態消失 ❌
2. 同一用戶開兩個分頁會衝突 ❌
3. 無法水平擴展（多台伺服器狀態不同步）❌
4. 必須按照特定順序呼叫 API ❌

---

### ✅ 無狀態設計（stock-replay 實作）

#### 後端實作

**會話物件（playback_service.py:17-100）**

```python
class PlaybackSession:
    """獨立的回放會話物件"""

    def __init__(self, playback_id: str, symbol: str, data: pd.DataFrame):
        self.playback_id = playback_id  # UUID 唯一識別
        self.symbol = symbol
        self.data = data                # 完整的歷史數據
        self.current_index = 0          # 當前播放位置

        # 預先計算價格範圍
        self.min_price = float(data["Low"].min())
        self.max_price = float(data["High"].max())

    def next(self, count: int = 1) -> List[CandleData]:
        """前進 N 根 K 線"""
        result = []
        for _ in range(count):
            if self.current_index >= len(self.data):
                break
            result.append(self.get_current())
            self.current_index += 1
        return result

    def seek(self, index: int) -> bool:
        """跳轉到指定位置"""
        if 0 <= index < len(self.data):
            self.current_index = index
            return True
        return False
```

**會話管理器（playback_service.py:115-187）**

```python
class PlaybackService:
    """管理多個播放會話的服務"""

    def __init__(self):
        # 使用字典儲存所有會話：playback_id → PlaybackSession
        self.sessions: Dict[str, PlaybackSession] = {}

    def create_session(self, symbol: str, period: str) -> PlaybackSession:
        """建立新會話"""
        # 1. 產生唯一 ID
        playback_id = str(uuid.uuid4())  # "abc-123-def-456"

        # 2. 獲取股票數據
        data = fetch_stock_data_by_period(symbol, period)

        # 3. 建立會話物件
        session = PlaybackSession(playback_id, symbol, data)

        # 4. 儲存到字典（公共資料庫）
        self.sessions[playback_id] = session

        logger.info(f"Created session {playback_id} for {symbol}")
        return session

    def get_session(self, playback_id: str) -> Optional[PlaybackSession]:
        """根據 ID 查詢會話（無狀態的關鍵）"""
        return self.sessions.get(playback_id)
        # 👆 客戶端提供 ID，伺服器查表找到對應會話

    def delete_session(self, playback_id: str) -> bool:
        """刪除會話"""
        if playback_id in self.sessions:
            del self.sessions[playback_id]
            return True
        return False
```

**API 路由（playback.py:21-126）**

```python
@router.post("/start", response_model=PlaybackStatusResponse)
async def start_playback(request: PlaybackCreateRequest):
    """建立新的回放會話"""
    session = playback_service.create_session(
        symbol=request.symbol,
        period=request.period,
    )

    # 返回完整狀態（包含 playback_id）
    return PlaybackStatusResponse(
        playback_id=session.playback_id,  # 👈 返回「鑰匙」
        symbol=session.symbol,
        current_index=session.current_index,
        total_count=session.get_total_count(),
        current_data=session.get_current(),
        price_range=session.get_price_range(),
    )


@router.get("/{playback_id}/next", response_model=PlaybackStatusResponse)
async def get_next_candle(
    playback_id: str = Path(...),  # 👈 客戶端帶著「鑰匙」
    count: int = Query(1, ge=1, le=100)
):
    """取得下一根 K 線"""
    # 1. 用 playback_id 查詢會話
    session = playback_service.get_session(playback_id)

    # 2. 會話不存在時返回 404（不假設客戶端狀態）
    if session is None:
        raise HTTPException(404, "Playback session not found")

    # 3. 執行操作
    candles = session.next(count)

    # 4. 返回完整狀態（客戶端不需要記住）
    return PlaybackStatusResponse(
        playback_id=session.playback_id,
        current_index=session.current_index,  # 明確告知當前位置
        total_count=session.get_total_count(),
        has_more=session.has_more(),
        current_data=candles[-1] if candles else None,
    )


@router.post("/{playback_id}/seek")
async def seek_playback(
    playback_id: str = Path(...),  # 👈 依然需要帶「鑰匙」
    request: PlaybackSeekRequest
):
    """跳轉到特定位置"""
    session = playback_service.get_session(playback_id)

    if session is None:
        raise HTTPException(404, "Playback session not found")

    success = session.seek(request.index)
    if not success:
        raise HTTPException(400, "Invalid seek index")

    return PlaybackStatusResponse(...)
```

#### 前端實作

**API 客戶端（api.ts:44-75）**

```typescript
// Axios 客戶端配置
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8888",
  headers: { 'Content-Type': 'application/json' },
})

// 建立播放會話
export const startPlayback = async (
  request: PlaybackCreateRequest
): Promise<PlaybackStatusResponse> => {
  const response = await api.post('/api/playback/start', request)
  return response.data
}

// 取得下一根 K 線（需要 playback_id）
export const getNextCandle = async (
  playbackId: string,  // 👈 每次請求都帶著 ID
  count: number = 1
): Promise<PlaybackStatusResponse> => {
  const response = await api.get(`/api/playback/${playbackId}/next`, {
    params: { count },
  })
  return response.data
}

// 跳轉到指定位置（需要 playback_id）
export const seekPlayback = async (
  playbackId: string,  // 👈 每次請求都帶著 ID
  request: PlaybackSeekRequest
): Promise<PlaybackStatusResponse> => {
  const response = await api.post(`/api/playback/${playbackId}/seek`, request)
  return response.data
}
```

**React 元件使用（TradingSimulator.tsx）**

```typescript
export default function TradingSimulator() {
  const [playbackId, setPlaybackId] = useState<string | null>(null)
  const [chartData, setChartData] = useState<CandleData[]>([])

  // 初始化播放會話
  const initializePlayback = async () => {
    try {
      // 1. 呼叫 start API
      const response = await startPlayback({
        symbol: '2330.TW',
        period: '1mo'
      })

      // 2. 儲存 playback_id（前端保管「鑰匙」）
      setPlaybackId(response.playback_id)
      setChartData([response.current_data])

    } catch (error) {
      console.error('初始化失敗:', error)
    }
  }

  // 取得下一根 K 線
  const getNext = useCallback(async () => {
    if (!playbackId) return  // 沒有 ID 就無法請求

    try {
      // 帶著 playback_id 請求
      const response = await getNextCandle(playbackId, 1)

      // 更新圖表數據
      setChartData(prev => [...prev, response.current_data])

    } catch (error) {
      console.error('取得下一根失敗:', error)
    }
  }, [playbackId])

  // 跳轉到特定位置
  const handleSeek = async (index: number) => {
    if (!playbackId) return

    try {
      const response = await seekPlayback(playbackId, { index })
      setChartData([response.current_data])

    } catch (error) {
      console.error('跳轉失敗:', error)
    }
  }

  return (
    <div>
      <button onClick={initializePlayback}>開始播放</button>
      <button onClick={getNext}>下一根</button>
      <button onClick={() => handleSeek(10)}>跳到第 10 根</button>
    </div>
  )
}
```

---

## 生活化類比

### 🎫 無狀態 API - 電影院取票機

```
你：「我要取票，訂單編號 ABC123」
機器：「查詢中... 找到了！2 張《駭客任務》，座位 A1-A2」

（5分鐘後，你回來）
你：「我要取票，訂單編號 ABC123」
機器：「抱歉，此訂單已取過票」

（換一台機器）
你：「我要取票，訂單編號 DEF456」
新機器：「查詢中... 找到了！1 張《星際效應》，座位 B5」
```

**特點**：
- ✅ 機器不記得你是誰
- ✅ 你提供訂單編號，機器查詢資料庫
- ✅ 任何一台機器都能處理你的請求
- ✅ 機器重啟不影響你取票

### 👨‍⚕️ 有狀態 API - 家庭醫生

```
你：「醫生，我上次來看感冒」
醫生：「對，我記得，你吃了藥後好多了嗎？」

（換一個醫生）
你：「醫生，我上次來看感冒」
新醫生：「你上次來？我不知道，讓我看病歷...」
```

**特點**：
- ❌ 醫生記住你的病史（狀態）
- ❌ 換醫生後需要重新說明
- ❌ 依賴醫生的記憶

### 📦 無狀態 API - 超商取貨

```
你：「我要取貨，取貨碼 12345」
店員 A：「掃描中... 是一箱書，簽收吧」

（下次去不同分店）
你：「我要取貨，取貨碼 67890」
店員 B：「掃描中... 是一個包裹，簽收吧」
```

**特點**：
- ✅ 任何分店都能處理
- ✅ 店員不需要記得你
- ✅ 取貨碼就是「session ID」

---

## 在 stock-replay 中的實作

### 完整請求流程圖

```
┌─────────────┐                    ┌─────────────┐
│   前端      │                    │   後端      │
│ React App   │                    │  FastAPI    │
└─────────────┘                    └─────────────┘
      │                                   │
      │ POST /api/playback/start          │
      │ { symbol: "2330.TW" }             │
      │──────────────────────────────────>│
      │                                   │ 1. 產生 UUID
      │                                   │    playback_id = "abc-123"
      │                                   │
      │                                   │ 2. 建立 PlaybackSession
      │                                   │    sessions["abc-123"] = session
      │                                   │
      │ { playback_id: "abc-123", ... }   │
      │<──────────────────────────────────│
      │                                   │
      │ 儲存 playback_id 到 state         │
      │                                   │
      │                                   │
      │ GET /api/playback/abc-123/next    │
      │──────────────────────────────────>│
      │                                   │ 3. 查詢 sessions["abc-123"]
      │                                   │ 4. session.next()
      │                                   │
      │ { current_index: 1, data: {...} } │
      │<──────────────────────────────────│
      │                                   │
      │                                   │
      │ POST /api/playback/abc-123/seek   │
      │ { index: 10 }                     │
      │──────────────────────────────────>│
      │                                   │ 5. 查詢 sessions["abc-123"]
      │                                   │ 6. session.seek(10)
      │                                   │
      │ { current_index: 10, data: {...} }│
      │<──────────────────────────────────│
      │                                   │
```

### 多用戶並發場景

```
用戶 A                               伺服器
  │ POST /start (TSLA)                  │
  │─────────────────────────────────────>│
  │ { playback_id: "aaa-111" }          │ sessions["aaa-111"] = TSLA session
  │<─────────────────────────────────────│
  │                                     │

用戶 B                                  │
  │ POST /start (2330.TW)               │
  │─────────────────────────────────────>│
  │ { playback_id: "bbb-222" }          │ sessions["bbb-222"] = 2330 session
  │<─────────────────────────────────────│
  │                                     │

用戶 A
  │ GET /playback/aaa-111/next          │
  │─────────────────────────────────────>│
  │ TSLA 的第 2 根 K 線                  │ ✅ 互不干擾
  │<─────────────────────────────────────│

用戶 B
  │ GET /playback/bbb-222/next          │
  │─────────────────────────────────────>│
  │ 2330 的第 2 根 K 線                  │ ✅ 互不干擾
  │<─────────────────────────────────────│
```

### 為什麼它是「無狀態」？

雖然後端有 `self.sessions` 字典在儲存資料，但符合無狀態的定義是因為：

#### ✅ 符合無狀態的原因

1. **請求自給自足**：每個請求都攜帶完整的識別資訊（playback_id）
2. **不依賴請求順序**：可以直接呼叫 `/playback/{id}/seek`，不需要先呼叫 `/next`
3. **任何伺服器都能處理**：只要 sessions 資料存在共享儲存，任何後端實例都能處理請求
4. **伺服器不記住「當前用戶」**：伺服器不知道「現在是誰在請求」，只知道「這個請求要操作哪個 session」

#### ❌ 如果是有狀態的設計

```python
# 反例：有狀態設計
current_session = None  # 全域變數記住「當前用戶」

def start(symbol):
    global current_session
    current_session = create_session(symbol)  # 記住這個用戶

def next():
    global current_session
    if current_session is None:
        raise Error("請先呼叫 start")  # 依賴之前的呼叫
    return current_session.next()
```

---

## 優勢與挑戰

### ✅ 優勢

#### 1. 水平擴展（Horizontal Scaling）

```
         負載均衡器
             │
     ┌───────┼───────┐
     ▼       ▼       ▼
 [伺服器1] [伺服器2] [伺服器3]
     │       │       │
     └───────┼───────┘
             ▼
        共享資料庫
   sessions = {
     "abc-123": {...},
     "def-456": {...}
   }
```

**無狀態**：用戶的請求可以由任何伺服器處理 ✅

**有狀態**：需要 sticky session（同一用戶必須路由到同一台伺服器）❌

#### 2. 容錯性（Fault Tolerance）

伺服器重啟後，如果會話資料存在持久化儲存中（如資料庫），就可以恢復會話。

**目前實作**：記憶體會話在伺服器重啟後會消失，這對個人專案來說是可接受的權衡（簡單 vs 可靠性）。

**如果需要持久化**：可以將會話資料存入 SQLite 資料庫（詳見下方「挑戰 2」）。

#### 3. 並發支援（Concurrency）

```typescript
// 用戶可以同時開多個分頁/視窗
const session1 = await startPlayback({ symbol: '2330.TW' })
const session2 = await startPlayback({ symbol: 'AAPL' })
const session3 = await startPlayback({ symbol: 'BTC-USD' })

// 互不干擾，獨立操作
await getNextCandle(session1.playback_id)  // 2330.TW 的下一根
await getNextCandle(session2.playback_id)  // AAPL 的下一根
await seekPlayback(session3.playback_id, { index: 10 })  // BTC 跳到第 10 根
```

#### 4. 易於測試

```python
# 單元測試：不需要模擬複雜的狀態機
def test_get_next():
    service = PlaybackService()
    session = service.create_session("AAPL", "1mo")

    # 直接測試，不依賴呼叫順序
    result = service.get_session(session.playback_id)
    assert result is not None

    candles = result.next(1)
    assert len(candles) == 1
```

### ⚠️ 挑戰與解決方案

#### 挑戰 1：記憶體管理

**問題**：每個會話都佔用記憶體，長時間不清理會導致記憶體洩漏

**解決方案**：
```python
# 1. 設定 TTL（Time To Live）
from datetime import datetime, timedelta

class PlaybackSession:
    def __init__(self, ...):
        self.created_at = datetime.now()
        self.last_accessed = datetime.now()

    def is_expired(self, ttl_minutes: int = 30) -> bool:
        """檢查會話是否過期"""
        return datetime.now() - self.last_accessed > timedelta(minutes=ttl_minutes)

# 2. 定期清理過期會話
import asyncio

async def cleanup_sessions():
    while True:
        await asyncio.sleep(300)  # 每 5 分鐘清理一次
        expired = [
            sid for sid, session in playback_service.sessions.items()
            if session.is_expired()
        ]
        for sid in expired:
            playback_service.delete_session(sid)
            logger.info(f"Cleaned up expired session {sid}")
```

#### 挑戰 2：會話持久化

**問題**：伺服器重啟後記憶體會話消失

**解決方案 1：接受這個限制（推薦用於個人專案）**

對於小型專案，記憶體會話已經足夠：
- 用戶重新載入頁面即可重建會話（只需幾秒鐘）
- 不需要額外的依賴和複雜度
- 符合 KISS 原則（Keep It Simple, Stupid）

**解決方案 2：使用 SQLite 持久化（如果真的需要）**

```python
import json
from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime

# 1. 定義資料庫模型
class PlaybackSessionDB(Base):
    __tablename__ = "playback_sessions"

    playback_id = Column(String(36), primary_key=True)
    symbol = Column(String(20), nullable=False)
    current_index = Column(Integer, default=0)
    data_json = Column(Text, nullable=False)  # 儲存序列化的數據
    created_at = Column(DateTime, default=datetime.now)
    expires_at = Column(DateTime, nullable=False)

# 2. 修改服務類
class PersistentPlaybackService:
    def create_session(self, symbol: str, period: str):
        playback_id = str(uuid.uuid4())
        data = fetch_stock_data_by_period(symbol, period)

        # 建立記憶體會話
        session = PlaybackSession(playback_id, symbol, data)
        self.sessions[playback_id] = session

        # 同時儲存到資料庫
        db_session = PlaybackSessionDB(
            playback_id=playback_id,
            symbol=symbol,
            current_index=0,
            data_json=data.to_json(),  # 序列化 DataFrame
            expires_at=datetime.now() + timedelta(hours=1)
        )
        db.add(db_session)
        db.commit()

        return session

    def get_session(self, playback_id: str):
        # 先從記憶體查詢（快速）
        if playback_id in self.sessions:
            return self.sessions[playback_id]

        # 記憶體沒有，從資料庫恢復
        db_session = db.query(PlaybackSessionDB).filter_by(
            playback_id=playback_id
        ).first()

        if db_session and db_session.expires_at > datetime.now():
            # 恢復會話到記憶體
            data = pd.read_json(db_session.data_json)
            session = PlaybackSession(playback_id, db_session.symbol, data)
            session.current_index = db_session.current_index
            self.sessions[playback_id] = session
            return session

        return None
```

**權衡**：
- ✅ 優點：伺服器重啟後會話不丟失
- ❌ 缺點：增加複雜度、需要定期清理過期資料
- 💡 建議：除非有明確需求，否則記憶體會話已足夠

#### 挑戰 3：Session ID 安全性

**問題**：UUID 可能被猜測或洩漏

**解決方案**：
```python
import secrets

# 1. 使用加密安全的隨機生成器
playback_id = secrets.token_urlsafe(32)  # 更安全的 ID

# 2. 添加用戶驗證（如果需要）
class PlaybackSession:
    def __init__(self, playback_id: str, user_id: str, ...):
        self.playback_id = playback_id
        self.user_id = user_id  # 綁定用戶

# 3. 在 API 中驗證
@router.get("/{playback_id}/next")
async def get_next_candle(
    playback_id: str,
    current_user: User = Depends(get_current_user)
):
    session = playback_service.get_session(playback_id)

    # 驗證會話屬於當前用戶
    if session.user_id != current_user.id:
        raise HTTPException(403, "Forbidden")

    return session.next()
```

---

## 最佳實踐

### 1. API 設計模式

```python
# ✅ 好的設計：資源在 URL 中
GET  /api/playback/{playback_id}/status
GET  /api/playback/{playback_id}/next
POST /api/playback/{playback_id}/seek
DELETE /api/playback/{playback_id}

GET  /api/trading/account/{account_id}/status
POST /api/trading/account/{account_id}/buy
POST /api/trading/account/{account_id}/sell

# ❌ 壞的設計：依賴隱式狀態
GET  /api/playback/next  # 不知道是哪個會話
POST /api/trading/buy    # 不知道是哪個帳戶
```

### 2. 返回完整狀態

```python
# ✅ 好的設計：返回完整狀態
return {
    "playback_id": "abc-123",
    "current_index": 5,        # 明確告知當前位置
    "total_count": 20,         # 明確告知總數
    "has_more": True,          # 明確告知是否還有更多
    "current_data": {...}
}

# ❌ 壞的設計：只返回數據
return {
    "data": {...}  # 客戶端不知道當前位置
}
```

### 3. 錯誤處理

```python
# ✅ 好的設計：明確的錯誤訊息
if session is None:
    raise HTTPException(
        status_code=404,
        detail=f"Playback session {playback_id} not found. It may have expired."
    )

# ❌ 壞的設計：假設客戶端知道狀態
if session is None:
    raise HTTPException(
        status_code=400,
        detail="Please call /start first"  # 假設客戶端知道流程
    )
```

### 4. 前端狀態管理

```typescript
// ✅ 好的設計：前端保管 session ID
const [playbackId, setPlaybackId] = useState<string | null>(null)
const [accountId, setAccountId] = useState<string | null>(null)

const initializePlayback = async () => {
  const response = await startPlayback({ symbol, period })
  setPlaybackId(response.playback_id)  // 儲存 ID
}

const getNext = async () => {
  if (!playbackId) return  // 明確檢查
  const response = await getNextCandle(playbackId, 1)
  // ...
}

// ❌ 壞的設計：假設後端記住
const getNext = async () => {
  const response = await api.get('/next')  // 後端怎麼知道是哪個會話？
}
```

---

## 總結

### 無狀態 API 的核心原則

1. **請求自給自足**：每個請求包含所有必要資訊
2. **可識別性**：使用 ID（如 playback_id）識別資源
3. **可重複性**：相同請求產生相同結果
4. **無依賴性**：不依賴請求順序
5. **可擴展性**：任何伺服器都能處理請求

### 類比總結

| 類比 | 有狀態 | 無狀態 |
|------|--------|--------|
| 🏥 就醫 | 家庭醫生（記得你） | 急診室（看病歷卡） |
| 🎬 電影 | 影廳座位（固定） | 取票機（憑票入場） |
| 📦 物流 | 送貨員（記得你家） | 超商取貨（憑取貨碼） |
| 🍕 訂餐 | 老店老闆（知道口味） | 連鎖店（憑訂單號） |

### 何時使用無狀態 API

✅ **適合的場景**：
- Web API / RESTful API
- 微服務架構
- 需要水平擴展的系統
- 多用戶並發系統
- 雲端部署應用

❌ **不適合的場景**：
- 即時通訊（WebSocket 更適合）
- 遊戲伺服器（需要低延遲狀態同步）
- 長連接應用（如串流）

---

## 參考資源

- [REST API 設計指南](https://restfulapi.net/)
- [HTTP 無狀態性](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview#http_is_stateless_but_not_sessionless)
- [微服務架構模式](https://microservices.io/patterns/data/database-per-service.html)
- [SQLite 官方文件](https://www.sqlite.org/docs.html)

---

**專案相關檔案**：
- 後端會話管理：`backend/app/services/playback_service.py`
- 後端 API 路由：`backend/app/api/playback.py`
- 前端 API 客戶端：`frontend/src/services/api.ts`
- 前端主頁面：`frontend/src/pages/TradingSimulator.tsx`
