# 🔐 CORS 設定指南

## 問題說明

當你看到這個錯誤：
```
Access to XMLHttpRequest at 'https://stock-replay-production.up.railway.app/api/...' 
from origin 'https://stock-replay.vercel.app' has been blocked by CORS policy
```

這表示後端需要允許 Vercel 域名訪問。

---

## 🚀 快速修復（Railway 環境變數）

### 方法 1：在 Railway Dashboard 設定（推薦）

1. **登入 Railway**
   - 前往：https://railway.app/dashboard
   - 選擇你的 `stock-replay` 專案

2. **進入 Variables 設定**
   - 點擊你的 service
   - 點擊左側的 **Variables** 標籤

3. **新增/更新 CORS_ORIGINS**
   
   找到 `CORS_ORIGINS` 變數（如果沒有就新增），設定為：
   
   ```json
   ["http://localhost:5173","http://localhost:3000","https://stock-replay.vercel.app"]
   ```
   
   **重要提示：**
   - 必須是 JSON 陣列格式
   - 使用雙引號 `"`，不是單引號 `'`
   - 逗號之間不要有空格（或保持一致）
   - 包含你的 Vercel 域名

4. **儲存並等待重新部署**
   - Railway 會自動重新部署（約 1-2 分鐘）
   - 等待部署完成後再測試

---

### 方法 2：修改代碼並重新部署

如果環境變數方式不行，可以直接修改代碼：

**編輯 `backend/app/config.py`：**

```python
# CORS
cors_origins: List[str] = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://stock-replay.vercel.app",
    "https://stock-replay-*.vercel.app",  # 支持 Vercel 預覽部署
]
```

然後提交並推送到 GitHub，Railway 會自動重新部署。

---

## 🧪 測試 CORS 設定

### 1. 檢查後端健康狀態

在瀏覽器訪問：
```
https://stock-replay-production.up.railway.app/health
```

應該看到：
```json
{"status": "healthy"}
```

### 2. 測試 CORS

在瀏覽器 Console（F12）執行：

```javascript
fetch('https://stock-replay-production.up.railway.app/health', {
  method: 'GET',
  headers: {
    'Origin': 'https://stock-replay.vercel.app'
  }
})
.then(r => r.json())
.then(d => console.log('✅ CORS 正常:', d))
.catch(e => console.error('❌ CORS 錯誤:', e))
```

如果看到 `✅ CORS 正常`，表示設定成功！

### 3. 在 Vercel 前端測試

1. 前往你的 Vercel 網站：https://stock-replay.vercel.app
2. 打開開發者工具（F12）
3. 嘗試使用功能（選股票、播放等）
4. 檢查 Network 標籤，應該看到成功的 API 請求

---

## 📋 完整的 CORS 設定範例

### 支持多個環境

```python
# backend/app/config.py

cors_origins: List[str] = [
    # 本地開發
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    
    # Vercel 生產環境
    "https://stock-replay.vercel.app",
    
    # Vercel 預覽部署（支持通配符）
    "https://stock-replay-*.vercel.app",
    
    # 如果有自定義域名
    # "https://yourdomain.com",
]
```

---

## 🔍 疑難排解

### 問題 1：設定後還是有 CORS 錯誤

**檢查清單：**
- [ ] Railway 是否已完成重新部署？
- [ ] 環境變數格式是否正確（JSON 陣列）？
- [ ] Vercel 域名是否正確（檢查是否有 `www.` 前綴）？
- [ ] 瀏覽器是否有快取？（試試無痕模式）

**解決方法：**
```bash
# 1. 檢查 Railway Logs
# 在 Railway Dashboard > Deployments > 最新部署 > View Logs

# 2. 查看是否有 CORS 相關錯誤訊息

# 3. 確認環境變數已載入
# 在 Logs 中搜尋 "CORS" 或 "origins"
```

### 問題 2：Vercel 預覽部署無法訪問

Vercel 的預覽部署 URL 格式：
```
https://stock-replay-git-branch-name-username.vercel.app
```

**解決方法：**
使用通配符支持所有預覽部署：
```python
"https://stock-replay-*.vercel.app"
```

或者在 Railway 環境變數中使用：
```json
["http://localhost:5173","https://stock-replay.vercel.app","https://*.vercel.app"]
```

### 問題 3：OPTIONS 請求失敗

如果看到 `preflight request doesn't pass access control check`：

**原因：**
- CORS 預檢請求（OPTIONS）失敗
- 通常是 `allow_methods` 或 `allow_headers` 設定問題

**檢查 `backend/app/main.py`：**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],  # 確保這行存在
    allow_headers=["*"],  # 確保這行存在
)
```

---

## ✅ 設定完成檢查

完成以下檢查確保 CORS 正常：

- [ ] Railway 環境變數已設定 `CORS_ORIGINS`
- [ ] 包含 Vercel 域名：`https://stock-replay.vercel.app`
- [ ] Railway 已重新部署完成
- [ ] `/health` 端點可以訪問
- [ ] Vercel 前端可以成功呼叫 API
- [ ] 無 CORS 錯誤訊息
- [ ] 可以正常載入股票數據

---

## 🎯 推薦設定

**Railway 環境變數（最終版本）：**

```bash
# 變數名稱：CORS_ORIGINS
# 變數值：
["http://localhost:5173","http://localhost:3000","https://stock-replay.vercel.app","https://stock-replay-*.vercel.app"]
```

這樣可以同時支援：
- ✅ 本地開發（localhost:5173）
- ✅ Vercel 生產環境
- ✅ Vercel 預覽部署
- ✅ 備用本地端口（localhost:3000）

---

## 📞 還是不行？

如果按照以上步驟還是無法解決，請檢查：

1. **Railway Logs**：查看是否有其他錯誤
2. **Vercel Logs**：查看前端是否有其他問題
3. **瀏覽器 Console**：查看完整的錯誤訊息
4. **Network 標籤**：查看請求的 Headers 和 Response

提供這些資訊可以幫助更快找到問題！
