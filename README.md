# 鮮存股｜個人投資紀錄

鮮存股是以原生 HTML、CSS 與 JavaScript ES Modules 製作的個人投資紀錄工具，可管理台股、美股與加拿大股，並以多帳戶總覽、交易帳本和自訂匯率整理投資狀況。無需安裝 npm 套件或執行建置程序。

> 本工具僅供投資紀錄與資訊整理，行情、匯率及費用估算可能與券商或市場資料有差異，請以實際交易資料為準。

## 功能

- **多市場、多帳戶**：管理台股、美股、加拿大股；切換個別帳戶或檢視合併總覽。各帳戶的持倉與交易紀錄分開計算。
- **投資績效總覽**：查看持倉成本、市值、帳面損益、累計現金股息、日損益及加權報酬率，並以自訂匯率換算外幣資產。
- **交易帳本**：記錄買入、賣出、現金配息、股票配股、股票分割與現金減資，依交易紀錄重建持倉。
- **費用估算**：依市場套用可調整的手續費設定；台股賣出會估算證交稅。實際費用仍以券商計收為準。
- **行情與搜尋**：支援 Render API 或 Yahoo Finance 報價來源、股票搜尋和報價更新；台股行情會定期輪詢。美股可選擇 WebSocket 即時串流的標準或 Geek 模式。
- **個人化庫存表格**：調整欄位順序、顯示欄位及排序，也可新增自訂欄位。
- **資料管理**：可匯出完整 JSON 備份並還原，或匯出供試算表檢視的 CSV。CSV 僅供檢視，不能用來還原資料。
- **本機與共用檔案**：預設將資料存在目前瀏覽器；支援的瀏覽器也可連結 JSON 共用檔案，並同步至本機同步資料夾。
- **繁體中文與英文介面**。

## 開始使用

### 本機執行

建議使用本機 HTTP 靜態伺服器開啟專案，而非直接以 `file://` 開啟。若已安裝 Python，可在專案根目錄執行：

```bash
python -m http.server 8080
```

接著在瀏覽器開啟 <http://localhost:8080>。專案亦附有 VS Code Chrome 啟動設定，預設連線至同一網址；啟動前請先讓靜態伺服器在 `8080` 埠執行。

### 部署

本專案是靜態網站，可部署至支援靜態檔案的主機。使用共用檔案功能時，請採用 HTTPS 或 `localhost`，並確認瀏覽器支援 File System Access API。`_redirects` 提供 Netlify 使用的行情代理轉發規則；其他主機需自行設定等效代理，或在偏好設定中選擇可用的報價來源。

## 行情設定

開啟「偏好設定 → 即時報價 API」選擇報價來源：

- **Render API**：使用設定中的 HTTPS API 網址查詢台股與美股；加拿大股會自動改用 Yahoo Finance。
- **Yahoo Finance**：可查詢台股、美股與加拿大股，並支援股票名稱搜尋。行情服務的可用性及限制依服務提供方而異。
- **美股即時串流**：串流使用 Finnhub WebSocket。建議由行情後端設定 `FINNHUB_TOKEN`，並提供 `/api/us-ws-url` 安全交握端點；前端會以報價 API 網址的主機連線。若未設定後端授權，也可在偏好設定填入 Finnhub Token，但 Token 會保存在此瀏覽器的應用程式資料中。

串流標準模式只處理美股一般交易時段的成交資料，並以約 5 秒間隔更新；Geek 模式會即時處理收到的成交資料，不套用一般交易時段篩選。串流狀態會顯示在頁面上方。

## 資料與隱私

- 本機模式的投資資料保存在目前瀏覽器的儲存空間，不會自動同步至其他裝置。
- 本機模式與雲端共用檔案模式各自保存資料；切換模式時會載入所選位置的資料，請先確認目前選擇的儲存位置。
- 共用檔案透過瀏覽器的 File System Access API 讀寫，檔案 Handle 保存在 IndexedDB。可連結既有 JSON 檔，或選取同步資料夾建立新檔。
- 寫入前會檢查共用檔案指紋；若檔案在其他位置已有變更，系統會阻止直接覆寫並提示先載入最新資料。此功能不是即時多人協作。
- 定期下載 JSON 備份並妥善保管。JSON 還原會取代目前所選儲存位置的資料。

## 專案結構

```text
.
├── index.html                 # 頁面結構與設定／交易對話框
├── styles.css                 # RWD 版面與元件樣式
├── _redirects                 # Netlify 行情代理轉發規則
├── .vscode/
│   └── launch.json            # VS Code Chrome 啟動設定（localhost:8080）
└── js/
    ├── app.js                 # 應用程式入口、畫面、帳戶及行情協調
    ├── backup.js              # JSON 備份與 CSV 匯出
    ├── calculations.js        # 持倉、總覽及手續費計算
    ├── cloud-sync.js          # 共用檔案同步與衝突處理
    ├── dialog-transaction.js  # 交易表單、股票搜尋與報價
    ├── i18n.js                # 繁中／英文翻譯與格式化
    ├── ledger.js              # 交易帳本與持倉重建
    ├── quotes.js              # 行情查詢與股票搜尋
    ├── shared-file.js         # File System Access API、IndexedDB 與檔案指紋
    ├── storage.js             # 資料標準化、本機持久化與預設值
    └── us-stream.js           # 美股 Finnhub WebSocket 串流
```

## 技術

- 原生 HTML、CSS、JavaScript ES Modules
- 瀏覽器 LocalStorage、IndexedDB 與 File System Access API
- Yahoo Finance、可設定的 Render 報價 API，以及 Finnhub WebSocket
- 無 npm 套件、無建置步驟
