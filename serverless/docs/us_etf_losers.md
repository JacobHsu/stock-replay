# US ETF 跌幅榜 — 實作說明

## 資料來源

**TradingView Scanner API**（非官方內部 API，無需 API Key）

```
POST https://scanner.tradingview.com/america/scan
```

### 端點來源

此端點由社群透過瀏覽器 DevTools 逆向發現，記錄於以下套件：

- **PyPI**: [tradingview-screener](https://pypi.org/project/tradingview-screener/)
- **GitHub**: [shner-elmo/TradingView-Screener](https://github.com/shner-elmo/TradingView-Screener)（822 stars，2026-02 仍維護）

此套件記錄了端點格式、欄位名稱、filter 語法，是本實作的主要參考來源。
TradingView Scanner 一次 POST 即可取得整個市場排序好的結果。

---

## 請求格式

```python
PAYLOAD = {
    "filter": [
        {"left": "typespecs", "operation": "has", "right": ["etf"]},
        {"left": "exchange", "operation": "in_range", "right": ["AMEX", "NASDAQ", "NYSE"]},
    ],
    "columns": ["name", "description", "close", "change"],
    "sort": {"sortBy": "change", "sortOrder": "asc"},
    "range": [0, 100],
}
```

| 欄位 | 說明 |
|------|------|
| `typespecs has ["etf"]` | 只取 ETF 類型 |
| `exchange in_range [...]` | 排除 OTC 等非主流交易所 |
| `sort asc` | 跌幅由大到小（負值最小排最前） |
| `range [0, 100]` | 抓前 100 筆（原因見下） |

### 回應結構

```json
{
  "totalCount": 5394,
  "data": [
    {
      "s": "NASDAQ:TQQQ",
      "d": ["TQQQ", "ProShares UltraPro QQQ", 45.21, -8.5]
    }
  ]
}
```

`d` 陣列的順序對應 `columns`：`[name, description, close, change]`

---

## 為什麼要抓 100 筆？

**TradingView 的 `typespecs` 對所有 ETF 皆只標記 `["etf"]`**，槓桿型和反向型 ETF
沒有額外標籤，無法在 server-side 過濾。

實測發現跌幅榜前段約 **70% 是槓桿/反向 ETF**（例如 Direxion 3x、ProShares UltraPro）。
若只抓 10 筆，過濾後幾乎不剩，因此抓 100 筆再 client-side 篩選。

---

## 槓桿 ETF 過濾邏輯

對 `description`（ETF 全名）進行 regex 比對，命中任一關鍵字則排除：

```python
_LEVERAGED_PATTERN = re.compile(
    r"(?i)(leveraged?|ultra|inverse|short\s|[23]x\b|direx|velocit)"
)
```

| Pattern | 捕捉範例 | 說明 |
|---------|---------|------|
| `leveraged?` | Leverage Shares 2x | Leverage / Leveraged |
| `ultra` | UltraShort, UltraPro | 不加字元邊界，捕捉子字串 |
| `inverse` | Inverse Nasdaq | 反向 ETF |
| `short\s` | Short S&P500 | 加空白避免誤判 "Short-Duration" 債券 ETF |
| `[23]x\b` | Daily 2x, Target 3x | 加字元邊界，不誤判 "20x" |
| `direx` | Direxion Daily | Direxion 為主要槓桿 ETF 發行商 |
| `velocit` | Velocity Shares | Velocity Shares 系列 |

過濾後逐筆加入，滿 10 筆即停止。

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `serverless/lib/us_etf_losers.py` | Serverless 版本實作 |
| `backend/app/helpers/us_etf_losers.py` | Backend 版本實作（內容相同） |
| `serverless/api/search.py` | API 端點 `GET /api/stocks/us-etf/losers` |
| `backend/app/api/stock_search.py` | Backend API 端點 |
