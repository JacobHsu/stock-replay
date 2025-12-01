# 🚀 Railway 部署指南

## 前置準備

1. **註冊 Railway 帳號**
   - 前往 https://railway.app
   - 使用 GitHub 帳號登入
   - 綁定信用卡（免費額度 $5/月，約 500 小時）

2. **推送程式碼到 GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Railway deployment"
   git push origin main
   ```

---

## 部署步驟

### 方法 1：從 GitHub 部署（推薦）

#### 1. 創建新專案

1. 登入 Railway Dashboard
2. 點擊 **"New Project"**
3. 選擇 **"Deploy from GitHub repo"**
4. 選擇你的 repository
5. Railway 會自動偵測到 Python 專案

#### 2. 設定 Root Directory

因為 backend 在子目錄中，需要設定：

1. 點擊你的 service
2. 進入 **Settings** 標籤
3. 找到 **"Root Directory"**
4. 設定為：`backend`
5. 點擊 **Save**

#### 3. 設定環境變數

在 **Variables** 標籤中新增：

```bash
# 必要變數
PORT=8888
PYTHON_VERSION=3.12

# 應用設定
DEBUG=false
ENVIRONMENT=production
LOG_LEVEL=INFO

# CORS（前端網址，部署後更新）
CORS_ORIGINS=["https://your-frontend.vercel.app"]

# API Keys（如果需要）
NEWS_API_KEY=your_news_api_key_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

#### 4. 部署

1. Railway 會自動開始部署
2. 等待建置完成（約 3-5 分鐘）
3. 部署成功後會顯示 URL

#### 5. 取得 API URL

1. 在 **Settings** 標籤
2. 找到 **"Domains"** 區塊
3. 點擊 **"Generate Domain"**
4. 複製產生的 URL（例如：`https://your-app.up.railway.app`）

---

### 方法 2：使用 Railway CLI

#### 1. 安裝 Railway CLI

```bash
# macOS/Linux
brew install railway

# Windows
npm install -g @railway/cli
```

#### 2. 登入

```bash
railway login
```

#### 3. 初始化專案

```bash
cd backend
railway init
```

#### 4. 部署

```bash
railway up
```

#### 5. 設定環境變數

```bash
railway variables set PORT=8888
railway variables set PYTHON_VERSION=3.12
railway variables set DEBUG=false
railway variables set ENVIRONMENT=production
```

#### 6. 開啟服務

```bash
railway open
```

---

## 驗證部署

### 1. 檢查健康狀態

```bash
curl https://your-app.up.railway.app/health
```

應該返回：
```json
{"status": "healthy"}
```

### 2. 查看 API 文件

瀏覽器開啟：
```
https://your-app.up.railway.app/docs
```

### 3. 測試 API

```bash
# 測試股票數據
curl -X POST https://your-app.up.railway.app/api/playback/start \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "period": "1mo"}'
```

---

## 常見問題

### 1. 部署失敗：找不到 requirements.txt

**解決方法：**
- 確認 `backend/requirements.txt` 存在
- 確認 Root Directory 設定為 `backend`

### 2. 應用啟動失敗：Port 錯誤

**解決方法：**
```python
# 確認 app/main.py 使用環境變數
import os
port = int(os.getenv("PORT", 8888))
```

### 3. CORS 錯誤

**解決方法：**
在 Railway Variables 中設定：
```bash
CORS_ORIGINS=["https://your-frontend.vercel.app","http://localhost:5173"]
```

### 4. 資料庫檔案消失

**原因：** Railway 的檔案系統是暫時的

**解決方法：**
- 使用 Railway 的 Volume 功能
- 或改用 Railway PostgreSQL

**設定 Volume：**
1. 在 Service Settings
2. 找到 **"Volumes"**
3. 新增 Volume：
   - Mount Path: `/app/data`
   - 這樣 `data/news_cache.db` 會持久化

### 5. 記憶體不足

**解決方法：**
- 升級到 Pro Plan（$20/月）
- 或優化程式碼，減少記憶體使用

---

## 監控與日誌

### 查看日誌

**在 Dashboard：**
1. 點擊你的 service
2. 進入 **"Deployments"** 標籤
3. 點擊最新的 deployment
4. 查看 **"Logs"**

**使用 CLI：**
```bash
railway logs
```

### 監控資源使用

在 Dashboard 的 **"Metrics"** 標籤可以看到：
- CPU 使用率
- 記憶體使用率
- 網路流量

---

## 更新部署

### 自動部署（推薦）

Railway 預設會監聽 GitHub repository：
```bash
git add .
git commit -m "Update backend"
git push origin main
```

推送後 Railway 會自動重新部署。

### 手動部署

使用 CLI：
```bash
cd backend
railway up
```

---

## 成本估算

### 免費額度
- $5/月 免費額度
- 約 500 小時運行時間
- 適合開發和測試

### 計費方式
- 按使用量計費
- CPU + 記憶體 + 網路
- 小型應用約 $5-10/月

### 節省成本技巧
1. 設定 Sleep on Idle（無活動時休眠）
2. 優化程式碼，減少資源使用
3. 使用快取減少 API 呼叫

---

## 生產環境建議

### 1. 環境變數管理
- 不要在程式碼中寫死 API keys
- 使用 Railway Variables
- 敏感資訊加密

### 2. 日誌管理
- 設定適當的 LOG_LEVEL
- 使用結構化日誌
- 定期檢查錯誤日誌

### 3. 錯誤處理
- 加入全域錯誤處理
- 回傳友善的錯誤訊息
- 記錄詳細的錯誤資訊

### 4. 效能優化
- 使用連接池
- 加入快取機制
- 優化資料庫查詢

### 5. 安全性
- 啟用 HTTPS（Railway 預設）
- 設定 CORS 白名單
- 限制 API 呼叫頻率

---

## 連接前端

部署完成後，更新前端的 API URL：

```typescript
// frontend/src/services/api.ts
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://your-app.up.railway.app'
  : 'http://localhost:8888'
```

然後在 Vercel 部署前端時設定環境變數：
```bash
VITE_API_URL=https://your-app.up.railway.app
```

---

## 參考資源

- [Railway 官方文件](https://docs.railway.app)
- [Railway Python 部署指南](https://docs.railway.app/guides/python)
- [FastAPI 部署最佳實踐](https://fastapi.tiangolo.com/deployment/)

---

## 需要幫助？

如果遇到問題：
1. 查看 Railway 日誌
2. 檢查環境變數設定
3. 確認 Root Directory 正確
4. 查看 Railway Discord 社群
