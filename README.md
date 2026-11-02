# 鮮存股 (Xian Stock)｜跨國個人投資紀錄與即時看板

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Vanilla%20JavaScript-418874?style=for-the-badge&logo=javascript" alt="原生 JavaScript 前端" />
  <img src="https://img.shields.io/badge/US%20Market-Finnhub%20WebSocket-185a9d?style=for-the-badge" alt="Finnhub WebSocket" />
  <img src="https://img.shields.io/badge/Cloud%20Sync-Google%20Sheets%20Apps%20Script-34A853?style=for-the-badge&logo=googlesheets" alt="Google 試算表同步" />
  <img src="https://img.shields.io/badge/Import%20%2F%20Export-JSON%20%7C%20CSV%20%7C%20Excel-217346?style=for-the-badge&logo=microsoftexcel" alt="JSON、CSV 與 Excel 匯入匯出" />
</p>

> 輕量、手機友善的台股、美股與加拿大股多帳戶投資紀錄工具。前端採用原生 HTML、CSS 與 JavaScript ES Modules，無 npm 安裝或建置流程。支援瀏覽器本機儲存、電腦共用檔案、Google 試算表同步及多格式備份。
>
> 本工具僅供投資紀錄與資訊整理，不構成投資建議。行情、匯率及費用估算可能延遲或與券商資料不同，請以實際交易資訊為準。

## 架構概覽

```text
┌──────────────────────────────────────────────────────────┐
│ 前端：靜態網站（GitHub Pages、Netlify 或其他靜態主機）   │
│ 原生 HTML / CSS / ES Modules；無建置流程                 │
│                                                          │
│ 儲存：瀏覽器 LocalStorage / 電腦共用 JSON / Google Sheets│
│ 匯入匯出：JSON、JS、CSV、Excel XLSX / XLS                │
└───────────────┬───────────────────┬──────────────────────┘
                │                   │
     美股授權與報價           使用者設定的 Apps Script Web App
     GET /api/us-ws-url        Google Sheets GET / POST
                │                   │
     可設定的 HTTPS 報價 API          個人 Google 試算表
     GET /api/realtime
                │
      Finnhub WebSocket（美股）

行情搜尋亦可能直接連線至 Yahoo Finance、TWSE、TPEx；
Excel 功能使用 SheetJS CDN。
```

此儲存庫包含前端程式，但**不包含 FastAPI 後端、Fugle 串接服務或獨立的 Google Apps Script 檔案**。前端行情功能依賴可用的外部報價服務；Google Apps Script 程式碼則由設定頁面提供一鍵複製。

## 功能特色

### 多市場、多帳戶與投資總覽

- 管理台股、美股與加拿大股，可切換個別帳戶或查看全部帳戶總覽。
- 各帳戶的同一標的各自記帳；以 `${accountId}:${market}:${symbol}` 作為帳本識別鍵。
- 顯示成本、市值、帳面損益、已領股息、日損益及加權報酬率；可設定美元與加幣匯率並切換總覽顯示幣別。
- 表格支援排序、自訂欄位順序與顯示狀態，以及使用者自訂欄位。

### 交易帳本與費用估算

- 支援買入、賣出、現金配息、股票配股、股票分割與現金減資。
- 刪除持倉時，可連同該帳戶、該市場與該標的的交易明細及期初結餘一併刪除。
- 可設定台股、美股及加拿大股手續費與換匯匯率；台股賣出另估算證交稅。
- 全數賣出時歸零持股及成本，避免浮點數殘值。
- 費率與稅費屬估算值，請依券商實際收費及適用規定核對。

### 行情與股票搜尋

- 可設定 HTTPS Render 相容報價 API，或選擇 Yahoo Finance。加拿大股使用 Yahoo Finance；Yahoo 模式支援台股、美股與加拿大股報價。
- 台股持倉每 10 秒背景輪詢報價；頁面回到前景時會補刷台股行情並喚醒美股串流。
- 可手動刷新所有持倉報價；本地常用股票字典支援快速搜尋，並可向 TWSE、TPEx 或 Yahoo Finance 查詢補充資料。
- 美股使用 Finnhub WebSocket。標準模式只處理美東週一至週五 09:30–16:00 的收到成交資料，並約每 5 秒批次更新；Geek 模式即時處理收到的成交資料。實際行情時段與可用性依 Finnhub 方案及資料來源而異。
- 若後端提供 `GET /api/us-ws-url` 並回傳 `{ "ws_url": "wss://..." }`，前端會優先透過該端點取得串流連線網址。台股與美股的 Render 相容 API 使用設定的報價網址及 `tw_codes`／`us_symbols` 查詢參數。後端程式碼與快取策略不在本儲存庫中。

### 三種資料儲存模式

1. **本機瀏覽器**：投資資料及設定儲存在瀏覽器 LocalStorage。
2. **電腦共用檔案**：透過 File System Access API 連結 JSON 檔案，可使用 Google Drive for desktop、OneDrive 或 Dropbox 等本機同步資料夾。檔案指紋檢查可在偵測到外部變更時阻止覆寫。此功能需瀏覽器支援，通常限 HTTPS 或 `localhost`。
3. **Google 試算表**：使用個人 Google Apps Script Web App 作為資料同步端點。編輯停止約 3 秒後自動推送，也可手動推送或載入。設定此模式時，應用程式會先將目前資料推送到試算表；若要從試算表還原，請使用「從試算表載入」。

三種儲存位置分開保存。切換前請確認目的地資料；尤其切換到 Google 試算表會先推送目前狀態，可能取代試算表中的既有備份。

### 多格式匯入與匯出

- **JSON**：完整備份及還原帳戶、持倉、交易、自訂欄位、期初結餘與設定。**JS**：另可匯出含備份資料的 JavaScript 檔；若要可靠還原，請使用 JSON 備份。
- **CSV**：匯入及匯出鮮存股資料，也可匯入包含日期、代號、股數、價格等欄位的通用交易明細。
- **Excel XLSX / XLS**：匯出庫存、交易、帳戶分頁；也支援讀取相應分頁或鮮存股完整備份。
- XLSX 匯出檔含 `_SystemState` 隱藏分頁，內含完整 JSON 備份，以支援無損還原。
- Excel 功能使用從 SheetJS CDN 載入的函式庫，使用時需要網路連線。
- 匯入會更新目前選擇的儲存位置，匯入前請先備份重要資料。

## 開始使用

### 本機執行

在專案根目錄執行靜態 HTTP 伺服器（需安裝 Python）：

```bash
python -m http.server 8080
```

瀏覽器開啟 <http://localhost:8080>。VS Code 的 `.vscode/launch.json` 也預設連線至此網址，啟動 Chrome 前請先啟動伺服器。

### 前端部署

前端為靜態網站，可部署到 GitHub Pages、Netlify 或其他靜態網站主機，不需建置步驟。共用檔案功能請使用 HTTPS 或 `localhost`，並確認瀏覽器支援 File System Access API。

`_redirects` 僅供 Netlify 使用，為 Yahoo Finance、TWSE 及 TPEx 請求提供代理轉發。GitHub Pages 不會套用此檔案；在 GitHub Pages 上部署時，瀏覽器會依程式設定直接連線到資料來源，可能受 CORS 或服務端限制影響。

### 報價後端需求

本儲存庫不含後端部署程式或 `requirements.txt`。若需自建或替換報價服務，請自行部署 HTTPS API，並配合前端需求實作：

| 路徑 | 方法 | 前端用途 |
|---|---|---|
| `/api/realtime?tw_codes=...` | GET | 台股背景輪詢；預期回傳 `tw` 物件，包含代號對應的 `price`、`prev_close` 或 `d` 等行情欄位 |
| `/api/realtime?tw_codes=...` 或 `/api/realtime?us_symbols=...` | GET | Render 相容模式的台股、美股報價查詢 |
| `/api/us-ws-url` | GET | 取得 Finnhub WebSocket 連線網址，回傳 JSON 欄位 `ws_url` |

請由後端管理供應商 API 金鑰，設定允許的前端來源及 CORS，勿將私密金鑰寫入前端靜態檔。行情 API 的供應商、快取及免費額度依自行部署的服務設定而定；本專案沒有內建 Fugle API 整合。

### Google 試算表同步設定

1. 在偏好設定的 Google 試算表區塊複製內建 Apps Script 程式碼。
2. 建立自己的 Google 試算表，開啟「擴充功能 → Apps Script」，貼上程式碼並儲存。
3. 將 Apps Script 部署為網頁應用程式，複製 `/exec` 結尾的網址，貼回鮮存股並測試連線。
4. 若要從瀏覽器直接連線，部署權限通常需允許應用程式存取。**此腳本沒有使用者驗證；若選擇任何人都可存取，任何取得 Web App 網址的人都可能讀取或修改備份。請將網址視同密碼，不要公開分享或提交到公開儲存庫，並只用於自己可控的試算表。**

Google 試算表會保存完整投資備份於隱藏資料分頁，並更新可讀的庫存總覽分頁。同步是整份資料快照，不是多人即時協作；多裝置同時修改可能造成版本互相覆蓋。

## 隱私權與資料安全

**最後更新：2026-11-03**

- 應用程式沒有帳號註冊、廣告或分析追蹤功能；本機模式下投資資料保存在目前瀏覽器。自訂股票名稱、偏好設定及行情來源也可能保存在瀏覽器。
- 啟用報價查詢時，股票代號或搜尋字詞會送至所選報價服務；Yahoo Finance 搜尋、TWSE／TPEx 股票清單及 Finnhub WebSocket 會依功能直接收到相關查詢、訂閱代號及行情連線中繼資料。
- 若使用 Google 試算表模式，完整投資備份與設定會傳送至使用者所設 Apps Script Web App。該 Apps Script 及 Google 試算表由使用者的 Google 帳戶管理；部署權限可能允許任何持有網址者讀寫資料。
- 本機共用檔案的內容儲存在所選 JSON 檔案，檔案 Handle 保存在 IndexedDB；若檔案放在同步資料夾，雲端硬碟供應商也會依其服務處理檔案。
- JSON 與 XLSX 匯出檔可能包含完整投資紀錄及設定；XLSX 的隱藏 `_SystemState` 分頁也含完整備份。若設定 Finnhub Token，備份可能包含 Token。請勿分享未檢查的備份檔。
- 應用程式不會替 LocalStorage、IndexedDB、匯出檔或試算表額外加密。Google Fonts 與 SheetJS 從第三方 CDN 載入；網站代管商及第三方服務可能依其政策處理連線中繼資料。
- 清除瀏覽器網站資料不會刪除已下載備份、同步資料夾檔案或 Google 試算表內容；解除檔案連結亦不會刪除檔案本身。切換儲存模式前請確認資料位置並先備份。

此說明依本儲存庫目前前端程式整理。自行部署、修改程式或更換 API／代理服務，可能改變資料流向及隱私處理方式；第三方服務的保存方式請參閱其官方政策。

## 專案結構

```text
.
├── index.html                 # 儀表板、設定與交易對話框；載入 SheetJS CDN
├── styles.css                 # RWD 版面及元件樣式
├── _redirects                 # Netlify 行情代理轉發規則
├── .vscode/
│   └── launch.json            # 本機 Chrome 啟動設定
└── js/
    ├── app.js                 # 主控、帳戶、交易 UI、同步及匯入匯出
    ├── backup.js              # JSON、JS、CSV、Excel 序列化與解析
    ├── calculations.js        # 持倉、績效及交易費用計算
    ├── cloud-sync.js          # 共用檔案同步與衝突處理
    ├── dialog-transaction.js  # 交易表單、股票搜尋及報價
    ├── google-sheet-sync.js   # Google Apps Script Web App 同步
    ├── i18n.js                # 繁體中文／英文翻譯與格式化
    ├── ledger.js              # 複合鍵帳本及交易回放
    ├── market-poller.js       # 行情更新、批次刷新及頁面喚醒處理
    ├── quotes.js              # 股票搜尋及 Yahoo／Render 相容行情查詢
    ├── shared-file.js         # File System Access API、IndexedDB 及指紋
    ├── storage.js             # 狀態標準化與本機持久化
    ├── ui-accounts.js         # 帳戶選單與帳戶管理
    └── us-stream.js           # Finnhub 美股 WebSocket 串流
```

## 技術

- 原生 HTML、CSS、JavaScript ES Modules；無 npm 安裝與建置流程
- 瀏覽器 LocalStorage、IndexedDB、File System Access API
- Google Apps Script Web App 與 Google Sheets（使用者自行設定）
- Yahoo Finance、TWSE／TPEx、可設定的 Render 相容 API、Finnhub WebSocket
- SheetJS CDN（Excel XLSX / XLS）
