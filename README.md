# 🎯 StockReplay

股市交易模擬器 - 結合即時新聞的股票回測訓練平台

## 📋 這是什麼？

這是一個股市交易訓練系統，讓你可以用歷史資料練習交易


## ✨ 主要功能
- 📊 回放歷史股價走勢（像看影片一樣，一天一天播放）
- 📰 查看當天的真實新聞（工商時報）
- 💰 模擬買賣股票，追蹤賺賠
- 🔍 搜尋股票（輸入代碼或中文名稱都可以，例如：2330 或 台積電）

## 🚀 如何開始？

### 步驟 1：安裝程式

#### macOS / Linux 使用者

打開終端機（Terminal），執行：

```bash
make install
```

#### Windows 使用者

Windows 預設沒有 `make` 指令，有以下兩種方式：

**方法 1：直接執行安裝指令（建議）**

打開 PowerShell，執行：

```powershell
# 安裝後端套件
cd backend
uv sync
cd ..

# 安裝前端套件
cd frontend
npm install
cd ..
```

**方法 2：安裝 make 工具**

透過套件管理工具安裝 make：
- Chocolatey: `choco install make`
- Scoop: `scoop install make`
- 或使用 Git Bash（內建 make）

> 💡 這會自動下載所有需要的套件，請耐心等待

### 步驟 2：設定新聞 API（重要！）

如果你想使用**新聞功能**，需要先取得免費的 API Key：

#### 📝 取得 Tavily API Key（免費）

1. 前往 [https://tavily.com/](https://tavily.com/)
2. 點右上角 **"Sign Up"** 註冊
3. 註冊完成後，進入 Dashboard
4. 複製你的 **API Key**

#### 🔧 填入 API Key

```bash
cd backend
cp .env.example .env
```

用文字編輯器打開 `backend/.env` 檔案，找到這一行：

```bash
TAVILY_API_KEY="your-tavily-api-key-here"
```

把 `your-tavily-api-key-here` 換成你剛才複製的 API Key

> ⚠️ **沒有 API Key 會怎樣？**  
> 系統還是能正常使用，但是 **無法載入新聞**。如果不需要新聞功能，可以跳過這個步驟。

### 步驟 3：啟動系統

#### macOS / Linux 使用者

```bash
make run
```

#### Windows 使用者

我們提供了兩個 Windows 專用的啟動腳本：

**方法 1：使用 PowerShell 腳本（推薦）**

打開 PowerShell，執行：

```powershell
# 同時啟動前後端
.\run.ps1 run

# 或只啟動後端
.\run.ps1 backend

# 或只啟動前端
.\run.ps1 frontend
```

> 💡 如果遇到執行權限問題，請先執行：
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

**方法 2：使用批次檔**

打開命令提示字元（CMD），執行：

```cmd
REM 同時啟動前後端
run.bat run

REM 或只啟動後端
run.bat backend

REM 或只啟動前端
run.bat frontend
```

**方法 3：手動分別啟動（最穩定）**

開啟兩個 PowerShell 視窗：

視窗 1 - 啟動後端：
```powershell
cd backend
uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8888
```

視窗 2 - 啟動前端：
```powershell
cd frontend
npm run dev
```

幾秒後，系統會自動開啟：
- 🎨 **操作介面**: http://localhost:5173
- 📚 **API 文件**: http://localhost:8888/docs

## 🎮 怎麼使用？

### 1. 選擇股票

在搜尋框輸入：
- 股票代碼（例如：`2330`、`8033`）
- 或中文名稱（例如：`台積電`、`雷虎`）

### 2. 選擇時間範圍

- **快速選擇**：點選 `1mo`（1個月）、`3mo`（3個月）、`6mo`（6個月）
- **自訂日期**：選擇 "Custom Date Range"，設定起始和結束日期

### 3. 決定要不要載入新聞

- **Start with News**：同時載入股價和新聞（需要 API Key）
- **Start**：只載入股價，不載入新聞

### 4. 開始練習！

- ⏯️ 按播放鍵開始回放
- 📰 看到圖示亮起就表示有新聞，點擊可以閱讀
- 💰 用 BUY/SELL 按鈕模擬交易
- 📊 追蹤你的損益表現

## 🛠️ 其他指令

### macOS / Linux

| 指令 | 用途 |
|------|------|
| `make run` | 啟動系統 |
| `make stop` | 關閉系統 |
| `make backend` | 只啟動後端 |
| `make frontend` | 只啟動前端 |
| `make install` | 安裝依賴套件 |
| `make help` | 查看所有指令 |

### Windows

#### 使用 PowerShell 腳本（推薦）

| 指令 | 用途 |
|------|------|
| `.\run.ps1 run` | 啟動前後端 |
| `.\run.ps1 stop` | 關閉所有服務 |
| `.\run.ps1 backend` | 只啟動後端 |
| `.\run.ps1 frontend` | 只啟動前端 |
| `.\run.ps1 install` | 安裝依賴套件 |
| `.\run.ps1 help` | 查看所有指令 |

#### 使用批次檔

| 指令 | 用途 |
|------|------|
| `run.bat run` | 啟動前後端 |
| `run.bat stop` | 關閉所有服務 |
| `run.bat backend` | 只啟動後端 |
| `run.bat frontend` | 只啟動前端 |
| `run.bat install` | 安裝依賴套件 |
| `run.bat help` | 查看所有指令 |

> 💡 **關閉服務**：使用腳本啟動時會開啟新視窗，直接關閉視窗或執行 `stop` 指令即可停止服務

## 💡 使用提示

- 第一次載入新聞需要比較久的時間（特別是 3-6 個月的資料）
- 建議先從 1 個月開始測試
- 新聞來源是工商時報，所以要選擇有新聞報導的股票

## ❓ 常見問題

**Q: 無法啟動怎麼辦？**  
A: 確認是否已執行 `make install` 安裝所有套件

**Q: 找不到某支股票怎麼辦？**  
A: 系統支援 200+ 支台股，如果找不到可能是較冷門的股票

**Q: 新聞沒有出現？**  
A: 檢查是否已設定 Tavily API Key，以及該股票在工商時報是否有相關報導

**Q: 如何停止系統？**  
A: 在終端機按 `Ctrl+C`，或執行 `make stop`

## 📄 參考

[llm-stock-trader-trainer](https://github.com/jason8745/llm-stock-trader-trainer)  
rapidapi [morning-star](https://rapidapi.com/apidojo/api/morning-star)  

## 📄 授權

MIT License - 自由使用

---

祝你交易順利！📈

