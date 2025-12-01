# 🚂 Railway 後端設定

## 當前狀態

✅ 前端已設定連接到 Railway 後端
- API URL: `https://stock-replay-production.up.railway.app`

## 🔧 需要在 Railway 設定的環境變數

請在 Railway Dashboard 設定以下環境變數：

### 1. 進入 Railway Dashboard
- 前往：https://railway.app/dashboard
- 點擊你的 `stock-replay` service

### 2. 進入 Variables 標籤
點擊左側的 **Variables** 標籤

### 3. 新增/更新以下變數

```bash
# 必要變數
PORT=8888
PYTHON_VERSION=3.12

# 應用設定
DEBUG=false
ENVIRONMENT=production
LOG_LEVEL=INFO

# CORS 設定（重要！讓本地前端可以連接）
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
```

**注意：**
- `CORS_ORIGINS` 必須是 JSON 陣列格式
- 包含 `http://localhost:5173`（Vite 開發伺服器）
- 包含 `http://localhost:3000`（備用）

### 4. 儲存並重新部署

設定完成後，Railway 會自動重新部署。

---

## 🧪 測試連接

### 1. 啟動本地前端

```bash
cd frontend
npm run dev
```

### 2. 開啟瀏覽器

前往：http://localhost:5173

### 3. 測試功能

- 選擇股票（例如：AAPL）
- 選擇時間範圍（例如：1mo）
- 點擊播放按鈕
- 檢查是否能正常載入數據

### 4. 檢查 Console

按 F12 開啟開發者工具，查看 Console：
- 應該看到 API 請求到 `https://stock-replay-production.up.railway.app`
- 不應該有 CORS 錯誤

---

## 🔄 切換回本地後端

當測試完成，要切換回本地後端：

### 1. 修改 frontend/src/services/api.ts

```typescript
// 改回本地
const API_BASE_URL = 'http://localhost:8888'
```

### 2. 啟動本地後端

```bash
cd backend
uv run uvicorn app.main:app --reload
```

### 3. 重新整理前端

瀏覽器重新整理即可。

---

## 🚨 疑難排解

### 問題 1：CORS 錯誤

**錯誤訊息：**
```
Access to fetch at 'https://stock-replay-production.up.railway.app/api/...' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**解決方法：**
1. 檢查 Railway Variables 中的 `CORS_ORIGINS`
2. 確認包含 `http://localhost:5173`
3. 格式必須是 JSON 陣列：`["http://localhost:5173"]`
4. 儲存後等待重新部署（約 1-2 分鐘）

### 問題 2：連接超時

**可能原因：**
- Railway service 正在休眠（冷啟動）
- 第一次請求需要等待 30-60 秒

**解決方法：**
- 等待一下再試
- 或先訪問：https://stock-replay-production.up.railway.app/health

### 問題 3：404 Not Found

**檢查：**
1. Railway 部署是否成功
2. 訪問：https://stock-replay-production.up.railway.app/docs
3. 應該能看到 API 文件

---

## 📊 監控

### 查看 Railway Logs

1. 進入 Railway Dashboard
2. 點擊 service
3. 點擊 **Deployments** 標籤
4. 點擊最新的 deployment
5. 查看 **Logs**

可以看到：
- API 請求記錄
- 錯誤訊息
- 應用狀態

---

## ✅ 設定完成檢查清單

- [ ] Railway Variables 已設定 `CORS_ORIGINS`
- [ ] 包含 `http://localhost:5173`
- [ ] Railway 已重新部署完成
- [ ] 訪問 `/health` 端點正常
- [ ] 本地前端可以連接
- [ ] 無 CORS 錯誤
- [ ] 可以正常載入股票數據

---

## 🎯 下一步

測試完成後：
1. 切換回本地後端（修改 api.ts）
2. 或準備部署前端到 Vercel
3. 更新 CORS 設定加入前端網址
