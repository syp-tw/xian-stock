# 鮮存股 (Xian Stock)｜跨國個人投資紀錄與即時看板

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Vanilla%20JavaScript-418874?style=for-the-badge&logo=javascript" alt="原生 JavaScript 前端" />
  <img src="https://img.shields.io/badge/US%20Market-Finnhub%20WebSocket-185a9d?style=for-the-badge" alt="Finnhub WebSocket" />
  <img src="https://img.shields.io/badge/Cloud%20Sync-Google%20Sheets%20Apps%20Script-34A853?style=for-the-badge&logo=googlesheets" alt="Google 試算表同步" />
  <img src="https://img.shields.io/badge/Import%20%2F%20Export-JSON%20%7C%20CSV%20%7C%20Excel-217346?style=for-the-badge&logo=microsoftexcel" alt="JSON、CSV 與 Excel 匯入匯出" />
</p>

> 輕量、手機友善的台股、美股與加拿大股多帳戶投資紀錄工具。前端採用原生 HTML、CSS 與 JavaScript ES Modules，無 npm 安裝或建置流程。支援瀏覽器本機儲存、電腦共用檔案、Google 試算表同步、零股批量條件移轉，以及各大券商 CSV／Excel 對帳單高容錯自動解析。
>
> 本工具僅供投資紀錄與資訊整理，不構成投資建議。行情、匯率及費用估算可能延遲或與券商資料不同，請以實際交易資訊為準。

## 架構概覽

```text
┌──────────────────────────────────────────────────────────┐
│ 前端：靜態網站（GitHub Pages、Netlify 或其他靜態主機）   │
│ 原生 HTML / CSS / ES Modules；無 npm 安裝或建置流程     │
│                                                          │
│ 儲存：瀏覽器 LocalStorage / 電腦共用 JSON / Google Sheets│
│ 匯入匯出：JSON、JS、通用券商 CSV、Excel XLSX / XLS       │
└───────────────┬───────────────────┬──────────────────────┘
                │                   │
     美股授權與報價           使用者設定的 Apps Script Web App
     GET /api/us-ws-url        Google Sheets GET / POST
                │                   │
     可設定的 HTTPS 報價 API          個人 Google 試算表
     GET /api/realtime
                │
      Finnhub WebSocket（美股）

行情搜尋亦支援 Yahoo Finance、TWSE、TPEx；
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

### 批量持倉管理與帳戶移轉

- 可依市場及持股數量條件篩選標的，再逐檔勾選或全選批次移轉至指定帳戶。
- 移轉時會一併更新所選持倉的帳戶及對應歷史交易帳戶；可快速建立並選取「零股帳戶」。
- 移轉前請確認篩選條件與選取清單；移轉不會合併目標帳戶中已存在的同標的持倉。

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

### 分類式偏好設定

- 偏好設定彈窗分為「雲端與備份」、「即時行情」、「費率與匯率」及「一般設定」四個標籤，一次顯示目前分類的內容。
- 分類切換可避免所有設定同時堆疊，縮短手機與電腦上的彈窗內容高度，讓設定更清晰易讀。

### 多格式匯入與匯出

- **JSON**：完整備份及還原帳戶、持倉、交易、自訂欄位、期初結餘與設定。**JS**：另可匯出含備份資料的 JavaScript 檔；若要可靠還原，請使用 JSON 備份。
- **CSV**：匯入及匯出鮮存股資料，也可自動解析常見券商 CSV 對帳單及包含日期、代號、股數、價格等欄位的通用交易明細。
- **Excel XLSX / XLS**：匯出庫存、交易、帳戶分頁；也支援讀取相應分頁、鮮存股完整備份及常見券商對帳單工作表。
- XLSX 匯出檔含 `_SystemState` 隱藏分頁，內含完整 JSON 備份，以支援無損還原。
- 券商檔案解析會嘗試自動辨識表頭及欄位；不同券商格式仍可能需要整理，匯入後請核對資料。
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

## 技術交接與維護

### 模組職責

| 模組 | 職責 | 維護重點 |
|---|---|---|
| `js/app.js` | 應用程式初始化、持倉表格渲染、狀態保存與替換，以及各功能模組協調 | 狀態修改應透過共用的 `persist`／`replaceState` 流程，讓目前儲存模式及串流訂閱同步更新；彈窗操作由對應模組處理。 |
| `js/ui-accounts.js` | 帳戶選單與新增、改名、刪除 | 改名會去除頭尾空白並拒絕空白或重複名稱；有持倉或交易紀錄的帳戶不可直接刪除。 |
| `js/ui-batch.js` | 批量篩選、選取持倉與帳戶移轉 | 移轉持倉時一併更新對應歷史交易的帳戶。 |
| `js/dialog-transaction.js` | 新增與編輯交易、股票搜尋及報價 | 交易寫入及歷史交易編輯需維持帳戶隔離與帳本回放一致性。 |
| `js/dialog-holding.js` | 持倉詳情、歷史交易管理、庫存校正及自訂欄位 | 刪除或修改持倉與交易時，需同步維持帳本資料一致。 |
| `js/dialog-settings.js` | 設定表單、分類標籤、儲存模式切換及 Google 試算表連線操作 | 儲存模式切換與設定保存會協調各同步管理器及美股串流。 |
| `js/market-poller.js` | 台股輪詢、持倉批次刷新、頁面喚醒處理 | 台股持倉每 10 秒輪詢；回到前景會喚醒美股串流並補刷台股。啟動時會對報價 API 主機送出背景預熱請求。 |
| `js/us-stream.js` | Finnhub WebSocket 連線、訂閱、節流與重連 | 標準模式限美東平日常規交易時段，約 5 秒批次更新；Geek 模式即時處理收到的成交資料。斷線採逐步增加、最高 30 秒的重連延遲。 |
| `js/google-sheet-sync.js` | Google Apps Script Web App 同步 | 編輯停止約 3 秒後推送完整備份；亦支援手動 Push／Pull。 |
| `js/backup.js` | JSON、JS、CSV 與 Excel 匯入匯出 | CSV 有內建引號解析及通用券商表格欄位辨識；Excel 讀寫依賴 `index.html` 載入的 SheetJS。 |
| `js/calculations.js` | 持倉與總覽指標、手續費估算 | 日損益只累加有資料的持倉；總報酬率以總損益除以總成本計算。 |
| `js/storage.js` | 預設值、資料正規化及瀏覽器持久化 | 維護多帳戶匯入相容、期初餘額及雙層欄位設定。 |
| `js/ledger.js` | 交易回放及持倉成本更新 | 帳本識別鍵為 `${accountId}:${market}:${symbol}`；修改交易型態時需維持回放一致性。 |
| `js/quotes.js` | 股票搜尋與行情查詢 | Render 相容 API、Yahoo Finance、TWSE／TPEx 清單的請求路徑集中於此。 |
| `js/cloud-sync.js`、`js/shared-file.js` | 共用 JSON 檔案、IndexedDB Handle 與衝突保護 | 寫入前檢查檔案指紋，偵測外部修改時需先處理衝突。 |

`backend/main.py`、`requirements.txt` 及 Fugle API 金鑰輪替服務**不在目前儲存庫中**。如有獨立的 Render 後端部署，請在該後端儲存庫維護程式與設定，勿假設修改本前端即可改變後端快取或供應商行為。

### 關鍵計算與狀態維護

- **日損益**：單一持倉優先使用 `dailyChangePerShare`；若沒有，且有有效的 `previousClose`，以現價減昨收計算。總覽只加總有日損益資料的持倉，不會因其他標的缺資料而清空已知小計；全部持倉都沒有資料時才顯示無資料。美股串流只推送成交價，因此報價更新時須保留 `previousClose`，並以新現價重新計算每股日漲跌。
- **報酬率**：總覽以換算後的總損益除以總成本計算，不是個股報酬率的簡單平均。驗證時應涵蓋不同市場匯率、成本為零及部分持倉缺乏昨收資料等情況。
- **雙層欄位**：目前 `BASE_COLUMNS` 使用 `priceCost`、`profitRate`、`marketValueCost` 等合併欄位 ID。表頭標題含「 / 」時呈現上下兩層。舊版使用個別價格、損益欄位 ID 的排序設定會由 `app.js` 重設為新版預設欄位；修改欄位 ID 時須同步檢查排序取值、隱藏欄位及自訂欄位管理。
- **帳戶及持倉刪除**：帳戶改名需保留不區分大小寫的重複名稱檢查；帳戶刪除需先確認沒有持倉與交易。刪除持倉時需同時移除相同帳戶／市場／代號的交易及對應 `openingBalances`，避免孤立帳務資料。
- **美股串流授權**：連線優先呼叫報價 API 主機的 `/api/us-ws-url` 取得 WebSocket 網址；交握失敗且瀏覽器設定有 Finnhub Token 時才改用 Token 直連。Token 若填在前端設定，會保存在瀏覽器資料並可能進入 JSON／Excel 完整備份。正式部署宜在受控後端管理 Token。
- **Google 試算表同步**：同步的是完整狀態快照，並非逐筆交易合併。多人或多裝置同時編輯有覆寫風險。程式以 `no-cors` 發出 POST，瀏覽器無法讀取 Apps Script 的實際回應；前端顯示的推送成功訊息不等同於伺服器已確認寫入，重要資料應再從試算表載入驗證。

### 設定與部署檢查

| 設定 | 用途 | 注意事項 |
|---|---|---|
| `quoteApiUrl` | Render 相容 HTTPS 行情 API | 前端會以該主機取得美股串流交握網址；API 應回傳前端預期的行情結構。 |
| `quoteProvider` | `render-api` 或 `yahoo` | 加拿大股會使用 Yahoo Finance；Netlify 代理僅由 `_redirects` 提供。 |
| `googleSheetWebhook` | 個人 Apps Script `/exec` 網址 | 此儲存庫內建腳本不含使用者驗證；任何人可存取的部署應保護網址，勿公開分享。 |
| `finnhubToken` | Finnhub Token 備援 | 優先使用後端交握；前端 Token 會保存在本機資料中。 |
| `usStreamMode` | `standard` 或 `geek` | 僅控制前端對收到成交資料的時段篩選與更新節奏，不保證供應商提供 24 小時成交資料。 |

若自建**不包含於本儲存庫**的後端，可自行管理 `ALLOWED_ORIGINS`、`FINNHUB_TOKEN` 等環境變數；只有在後端實際使用 Fugle 時，才需要 `FUGLE_API_KEY_1` 等供應商金鑰。請勿把金鑰提交至前端或 Git。後端供應商、金鑰輪替、CORS 與快取 TTL 應以其實際程式碼為準。

### 常見問題排查

- **Apps Script 回傳 401／302，或載入失敗**：確認 Web App 已部署為最新版本、網址以 `/exec` 結尾，且存取權限符合使用方式。此專案的測試連線會發出 GET，請確認 Apps Script `doGet` 可正常讀取資料或回傳空資料狀態。若部署允許任何人存取，網址即具備資料存取風險。
- **Google 試算表推送提示成功但資料未更新**：由於 POST 使用 `no-cors`，前端無法讀取伺服器回應；檢查 Apps Script 執行記錄與試算表內容，必要時從試算表重新載入驗證。
- **Render 首次報價較慢**：前端啟動時會對報價 API 主機送出背景預熱請求，但這不保證外部服務已完成冷啟動。確認 API 可用性與瀏覽器網路請求後再判斷是否為資料或前端問題。
- **美股交易時段判斷**：程式以 `America/New_York` 時區及瀏覽器 `Intl.DateTimeFormat` 判定美東平日 09:30 至 16:00，不應改成固定台灣時間或固定 UTC 偏移；夏令時間由時區資料自動處理。
- **Excel 無法匯入／匯出**：確認網路可載入 SheetJS CDN。Excel 功能不可用時，仍可使用 JSON／CSV；無損完整還原請保留 JSON 備份。

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
    ├── app.js                 # 應用程式主控、持倉表格與模組協調
    ├── backup.js              # JSON、JS、CSV、Excel 序列化與解析
    ├── calculations.js        # 持倉、績效及交易費用計算
    ├── cloud-sync.js          # 共用檔案同步與衝突處理
    ├── dialog-holding.js      # 持倉詳情、歷史交易及庫存資料管理
    ├── dialog-settings.js     # 設定表單、分類標籤與儲存模式管理
    ├── dialog-transaction.js  # 交易表單、股票搜尋及報價
    ├── google-sheet-sync.js   # Google Apps Script Web App 同步
    ├── i18n.js                # 繁體中文／英文翻譯與格式化
    ├── ledger.js              # 複合鍵帳本及交易回放
    ├── market-poller.js       # 行情更新、批次刷新及頁面喚醒處理
    ├── quotes.js              # 股票搜尋及 Yahoo／Render 相容行情查詢
    ├── shared-file.js         # File System Access API、IndexedDB 及指紋
    ├── storage.js             # 狀態標準化與本機持久化
    ├── ui-accounts.js         # 帳戶選單與帳戶管理
    ├── ui-batch.js            # 批量持倉篩選與帳戶移轉
    └── us-stream.js           # Finnhub 美股 WebSocket 串流
```

## 技術

- 原生 HTML、CSS、JavaScript ES Modules；無 npm 安裝與建置流程
- 瀏覽器 LocalStorage、IndexedDB、File System Access API
- Google Apps Script Web App 與 Google Sheets（使用者自行設定）
- Yahoo Finance、TWSE／TPEx、可設定的 Render 相容 API、Finnhub WebSocket
- SheetJS CDN（Excel XLSX / XLS）
