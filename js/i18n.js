// js/i18n.js - 多國語言、幣別格式化與介面文字對照模組

export const locale = {
  currency: {
    TW: { code: "TWD", symbol: "NT$", label: "台股", englishLabel: "Taiwan stocks" },
    US: { code: "USD", symbol: "US$", label: "美股", englishLabel: "U.S. stocks" },
    CA: { code: "CAD", symbol: "CA$", label: "加拿大股", englishLabel: "Canadian stocks" },
  },
  transactionLabels: {
    buy: "買入",
    sell: "賣出",
    dividend: "現金配息",
    stockDividend: "股票配股",
    split: "股票分割",
    capitalReduction: "減資",
  },
};

const translations = {
  "鮮存股": "Xian Stock",
  "鮮存股｜個人投資紀錄": "Xian Stock | Personal Portfolio",
  "鮮存股首頁": "Xian Stock home",
  "個人帳戶": "Personal account",
  "工作空間": "WORKSPACE",
  "投資總覽": "Overview",
  "我的庫存": "My Holdings",
  "偏好設定": "Preferences",
  "編輯持倉": "Edit Holding",
  "持倉詳情": "Holding Details",
  "尚無交易明細，點選「新增交易」開始記錄。": "No transactions yet. Select “Add Transaction” to get started.",
  "每股配息金額": "Dividend per Share",
  "減少股數（選填）": "Shares Reduced (Optional)",
  "分割後每股價格": "Price per Share After Split",
  "減資後每股價格": "Price per Share After Capital Reduction",
  "選填，留白自動調整": "Optional. Leave blank to adjust automatically",
  "留白會依分割比例調整原股價，以維持分割前市值。": "Leave blank to adjust the share price by the split ratio and preserve the pre-split market value.",
  "留白會依減少股數調整原股價，以維持減資前市值。": "Leave blank to adjust the share price for the reduced share count and preserve the pre-reduction market value.",
  "減少股數不可超過目前持有股數。": "Shares reduced cannot exceed the current shares held.",
  "每股退還金額必須大於 0。": "Capital returned per share must be greater than zero.",
  "分割比例": "Split Ratio",
  "舊版／校正": "Legacy / adjustment",
  "標示為舊版／校正的明細可編輯或刪除；這些變更只更新歷史紀錄，不會重算目前持倉股數與成本。": "Legacy / adjustment entries can be edited or deleted. Changes update the history only and do not recalculate current shares or cost basis.",
  "此為舊版／校正明細；編輯只會更新歷史紀錄，不會重算目前持倉股數與成本。": "This is a legacy / adjustment entry. Editing it updates the history only and does not recalculate current shares or cost basis.",
  "編輯這筆舊版／校正明細只會更新歷史紀錄，不會重算目前持倉。": "Editing this legacy / adjustment entry updates the history only and does not recalculate the current holding.",
  "刪除這筆舊版／校正明細不會改變目前持倉股數與成本。": "Deleting this legacy / adjustment entry does not change current shares or cost basis.",
  "確定刪除舊版／校正明細": "Delete legacy / adjustment entry",
  "目前持倉股數與成本不會變更。": "Current shares and cost basis will remain unchanged.",
  "確定刪除交易明細": "Delete transaction entry",
  "主要顯示幣別": "Primary display currency",
  "新台幣等值": "TWD equivalent",
  "依庫存現價估算・美元": "Estimated from current prices · U.S. dollars",
  "即時報價 API": "Live Quote API",
  "報價來源": "Quote Provider",
  "Render API（台股／美股代號，加股自動切換）": "Render API (TW/US Ticker, Auto-switch for Canada)",
  "Yahoo Finance（支援台股／美股／加股，含名稱搜尋）": "Yahoo Finance (Taiwan, U.S. & Canada with Search)",
  "Render 報價 API 網址": "Render Quote API URL",
  "Yahoo Finance 支援台股、美股與加拿大股完整查價及中英文名稱搜尋。Render API 為專屬自建服務；若在 Render 模式下查詢加拿大股，系統會智慧自動切換至 Yahoo 查詢，無須手動切換設定。": "Yahoo Finance provides quotes and name search for Taiwan, U.S., and Canadian stocks. The Render API is a custom endpoint; Canadian stocks will automatically switch to Yahoo Finance when using the Render API.",
  "Render 報價 API 請填寫有效的 HTTPS 網址。": "Enter a valid HTTPS URL for the Render Quote API.",
  "Render 報價 API 網址無效，請至偏好設定確認。": "The Render Quote API URL is invalid. Check Preferences.",
  "Render 報價 API 必須使用有效的 HTTPS 網址。": "The Render Quote API must use a valid HTTPS URL.",
  "Render 報價 API 未回傳有效股價，請確認股票代號。": "The Render Quote API returned no valid price. Check the ticker.",
  "舊版／校正交易明細已刪除；目前持倉股數與成本未變更。": "Legacy / adjustment entry deleted. Current shares and cost basis were not changed.",
  "舊版／校正交易明細已更新；目前持倉股數與成本未變更。": "Legacy / adjustment entry updated. Current shares and cost basis were not changed.",
  "查看 ": "View ",
  "交易明細": "Transaction History",
  "交易明細已修改，庫存成本已重新計算。": "Transaction updated. Your holdings and cost basis have been recalculated.",
  "交易明細已刪除，庫存成本已重新計算。": "Transaction deleted. Your holdings and cost basis have been recalculated.",
  "找不到要修改的交易明細。": "The transaction to edit could not be found.",
  "無法儲存資料，請確認瀏覽器儲存空間或隱私設定。": "Unable to save data. Check your browser storage or privacy settings.",
  "關閉": "Close",
  "新增買入、賣出或股利等交易": "Record a purchase, sale, dividend, or other transaction",
  "穩穩累積，慢慢變富": "Grow steadily, build wealth over time",
  "每一次投入，都是為未來多留一點選擇。": "Every investment creates more possibilities for your future.",
  "資料僅儲存於此裝置": "Your data stays on this device",
  "資料同步至已連結的雲端檔案": "Data syncs to the linked cloud file",
  "我的投資": "My Portfolio",
  "市場報價可查詢": "Market quotes available",
  "投資總覽✳": "Portfolio Overview ✳",
  "好好記錄每一步，讓時間成為你的隊友。": "Keep track of every step. Let time work for you.",
  "新增持倉": "Add Holding",
  "目前投資總市值": "Current Market Value",
  "全部帳戶": "All Accounts",
  "全部帳戶總覽": "All Accounts Overview",
  "🌐 全部帳戶總覽": "🌐 All Accounts Overview",
  "投資帳戶": "Account",
  "投資帳戶管理": "Accounts Manager",
  "建立獨立帳戶以區隔個人核心倉、定期定額或家人資產。刪除帳戶前須先清空該帳戶內之持倉與交易紀錄。": "Create accounts to organize core holdings, DCA strategies, or family assets. Clear positions before deleting an account.",
  "新增帳戶名稱": "New Account Name",
  "例如：定期定額倉、配偶投資帳戶": "e.g. DCA Strategy, Spouse Account",
  "新增帳戶": "Add Account",
  "管理投資帳戶": "Manage investment accounts",
  "切換帳戶": "Switch Account",
  "已經有同名的投資帳戶。": "An account with this name already exists.",
  "此帳戶內仍有持倉或交易紀錄，無法直接刪除。請先將持倉出清或轉移。": "This account still has holdings or transactions and cannot be deleted. Clear or transfer positions first.",
  "依庫存現價估算・新台幣": "Estimated from current prices · New Taiwan dollars",
  "美元等值": "USD equivalent",
  "日損益": "Daily P/L",
  "相對前一交易日收盤": "Compared with previous close",
  "總投資本金": "Total Invested",
  "目前持倉成本": "Current cost basis",
  "帳面總損益": "Total Unrealized P/L",
  "含未實現損益": "Unrealized gain or loss",
  "平均報酬率": "Average Return",
  "依投入本金加權計算": "Weighted by invested amount",
  "持有標的": "Holdings",
  "台股與美股": "Taiwan, U.S. & Canadian stocks",
  "台股、美股與加拿大股": "Taiwan, U.S. & Canadian stocks",
  "找不到符合的台股、美股或加拿大股，請再試試看代號。": "No matching Taiwan, U.S. or Canadian stocks found. Try a ticker instead.",
  "正在搜尋台股、美股與加拿大股…": "Searching Taiwan, U.S. and Canadian stocks…",
  "相同股號自動合併，報價與績效一目瞭然。": "Positions with the same ticker are combined for a clear view of quotes and performance.",
  "相同股號自動合併；點選持倉列可檢視交易明細。": "Positions with the same ticker are combined. Select a holding to view its transaction history.",
  "自訂欄位": "Customize Columns",
  "新增自訂欄位": "Add Custom Field",
  "全部持倉": "All Holdings",
  "台股": "Taiwan",
  "美股": "U.S.",
  "加拿大股": "Canada",
  "報價依上次更新時間": "Quotes as of last update",
  "更新所有報價": "Refresh all quotes",
  "股票代號 / 名稱": "Ticker / Name",
  "股票代號+名稱 / 股數": "Ticker & Name / Shares",
  "目前現價 / 平均買入價": "Price / Avg Cost",
  "當日漲跌 / 漲跌幅": "Day Change / Change %",
  "當日漲跌": "Day Change",
  "漲跌幅": "Change %",
  "買入日期": "Purchase Date",
  "平均買入價": "Avg. Cost",
  "持有股數": "Shares",
  "目前股數": "Current Shares",
  "目前現價": "Current Price",
  "手續費": "Fees",
  "投資本金": "Cost Basis",
  "目前市值": "Market Value",
  "帳面損益": "Unrealized P/L",
  "報酬率": "Return",
  "股息": "Dividends",
  "累計股息": "Total Dividends",
  "已領取現金配息": "Cash dividends received",
  "自訂庫存欄位順序與顯示": "Customize Column Order & Visibility",
  "勾選以顯示欄位，點選箭頭調整欄位在表格中的左右先後順序。": "Check to show columns. Use the arrows to reorder them in the table.",
  "重設預設順序": "Reset to Default",
  "完成": "Done",
  "操作": "Actions",
  "你的投資故事，從第一筆開始": "Your investment story starts with the first entry",
  "新增一筆持倉，開始整理自己的投資旅程。": "Add a holding to start organizing your investment journey.",
  "＋ 新增第一筆持倉": "＋ Add Your First Holding",
  "＋ 新增交易": "＋ Add Transaction",
  "報價可能延遲，實際成交價格請以券商為準。": "Quotes may be delayed. Confirm execution prices with your broker.",
  "以耐心，累積每一份成長。": "Patience turns every step into progress.",
  "報價來源：Yahoo Finance ・ ": "Quote source: Yahoo Finance · ",
  "新增交易": "New Transaction",
  "交易類型": "Transaction Type",
  "買入": "Buy",
  "賣出": "Sell",
  "現金配息": "Cash Dividend",
  "股票配股": "Stock Dividend",
  "股票分割": "Stock Split",
  "減資": "Capital Reduction",
  "股票代號或名稱": "Ticker or Company Name",
  "例如：2330、台積電、AAPL": "e.g. 2330, TSMC, AAPL",
  "搜尋即時報價": "Search live quotes",
  "輸入完整代號或台股中文名稱會自動帶入即時股價；其他名稱請選擇搜尋結果。": "Enter a full ticker or a Taiwanese company name in Chinese to fill in the latest price automatically; select a result for other names.",
  "交易日期": "Transaction Date",
  "買入股數": "Shares to Buy",
  "賣出股數": "Shares to Sell",
  "配息股數": "Shares Receiving Dividend",
  "新增配股股數": "Additional Shares",
  "目前持有股數": "Current Shares Held",
  "減資股數（選填）": "Shares Reduced (Optional)",
  "買入價格": "Purchase Price",
  "賣出價格": "Sale Price",
  "配股價格（參考）": "Stock Dividend Price (Reference)",
  "目前每股價格（參考）": "Current Price per Share (Reference)",
  "每股退還金額": "Capital Returned per Share",
  "自動計算": "Auto-calculated",
  "依偏好設定預估，可自行調整。": "Estimated using your preferences. You can adjust it.",
  "分割比例（新股數 / 舊股數）": "Split Ratio (New Shares / Old Shares)",
  "目前現價 ": "Current Price ",
  "可修改": "Editable",
  "搜尋股票後自動帶入": "Filled automatically after searching",
  "預估交易金額": "Estimated Transaction Amount",
  "取消": "Cancel",
  "確認新增": "Add Transaction",
  "編輯庫存資料": "Edit Holding",
  "股票代號": "Ticker",
  "股票名稱": "Company Name",
  "首次買入日期": "First Purchase Date",
  "目前總投資本金": "Total Cost Basis",
  "累計手續費": "Total Fees",
  "此處可直接校正庫存與成本；交易紀錄仍保留原始操作。": "You can adjust your shares and cost basis here. Your transaction history is preserved.",
  "儲存變更": "Save Changes",
  "欄位名稱": "Field Name",
  "例如：預估股利、備註": "e.g. Estimated Dividends, Notes",
  "自訂欄位與資料會儲存在目前選擇的儲存位置。": "Custom fields and data are saved to the selected storage location.",
  "新增欄位": "Add Field",
  "顯示語系": "Display Language",
  "介面語言": "Interface Language",
  "中文版（繁體中文）": "Chinese (Traditional)",
  "美語版（English）": "English (U.S.)",
  "語系設定會自動儲存，並套用至整個投資記錄介面。": "Your language preference is saved automatically and applied throughout the portfolio.",
  "資料儲存位置": "Data Storage Location",
  "儲存位置": "Storage Location",
  "本機（此瀏覽器）": "Local (this browser)",
  "雲端（共用檔案）": "Cloud (shared file)",
  "雲端共用檔案（PC File System Access API）": "Cloud Shared File (PC File System Access API)",
  "Google 試算表雲端同步（全平台 iOS / Android / PC）": "Google Sheets Sync (Cross-platform iOS/Android/PC)",
  "本機、共用檔案與 Google 試算表分開維護。切換模式前請先於下方完成連線設定。": "Local, PC file, and Google Sheets are managed separately. Configure connection below before switching.",
  "目前使用本機儲存；資料僅保存在此瀏覽器。": "Using local storage. Data is kept in this browser only.",
  "PC 本地共用雲端檔案": "PC Local Shared Cloud File",
  "支援 Google Drive for desktop、OneDrive、Dropbox 等本機同步資料夾。僅支援 PC 版 Chrome/Edge 瀏覽器。": "Supports Google Drive for desktop, OneDrive, Dropbox sync folders. PC Chrome/Edge only.",
  "檔案位置（同步資料夾內）": "File location (within synced folder)",
  "基於瀏覽器隱私限制，無法顯示完整磁碟路徑；上方顯示所選同步資料夾名稱與檔案相對位置。": "Browser privacy restrictions prevent showing the full disk path. The selected sync folder and relative file path are shown above.",
  "尚未選取同步資料夾。": "No sync folder selected.",
  "選取同步資料夾": "Choose Sync Folder",
  "處理中…": "Working…",
  "正在處理共用檔案操作，請稍候。": "Shared file operation in progress. Please wait.",
  "連結並載入共用檔": "Link & Load Shared File",
  "建立／另存共用檔": "Create / Save As Shared File",
  "載入共用檔": "Load Shared File",
  "儲存至共用檔": "Save to Shared File",
  "解除連結": "Unlink",
  "尚未連結共用檔案。": "No shared file is linked.",

  // 偏好設定分類標籤
  "雲端與備份": "Cloud & Sync",
  "即時行情": "Live Quotes",
  "費率與匯率": "Fees & FX",
  "一般設定": "General",

  // 雙層整併欄位標題
  "帳面損益 / 報酬率": "Unrealized P/L / Return",
  "目前市值 / 投資本金": "Market Value / Cost Basis",

  // 批量管理與帳戶移轉
  "批量整理": "Batch Transfer",
  "批量管理與條件移轉": "Batch Holdings Manager",
  "自訂條件篩選持倉標的（例如股數小於 2 的零股），一鍵批次移動至指定帳戶（如零股帳戶）。": "Filter holdings by conditions (e.g. shares < 2) and move them to a designated account in batch.",
  "持股數條件": "Shares Threshold",
  "市場篩選": "Market Filter",
  "移轉至目標帳戶": "Target Account",
  "＋ 建立「零股帳戶」": "＋ Create Odd-lot Account",
  "確認移動選取的標的": "Confirm Move Selected Holdings",
  "沒有符合此條件的持倉標的。": "No holdings match this condition.",
  "選取的標的已在目標帳戶內，未進行移動。": "Selected holdings are already in the target account. No move made.",

  // Google 試算表全平台同步
  "Google 試算表全平台雲端資料庫": "Google Sheets Cloud Database",
  "複製試算表專用腳本": "Copy Apps Script",
  "支援跨裝置（手機 iPhone、Android、電腦 PC）雙向即時同步。資料完全保存在您個人的 Google 雲端，安全且免費。": "Supports cross-device (iPhone, Android, PC) real-time 2-way sync. Data is saved in your personal Google Drive safely and for free.",
  "👉 初次使用？點此查看 3 步驟超簡單設定教學": "👉 First time? View 3-step setup guide",
  "Apps Script Webhook 網址 (exec 結尾)": "Apps Script Webhook URL (ends with /exec)",
  "⚡ 測試連線": "⚡ Test Connection",
  "立即同步至試算表 (Push)": "Sync to Google Sheet (Push)",
  "從試算表載入 (Pull)": "Load from Google Sheet (Pull)",
  "Finnhub API Token（選填／由後端 FINNHUB_TOKEN 自動授權）": "Finnhub API Token (Optional / Auto-authorized via Backend)",
  "後端配置 FINNHUB_TOKEN 環境變數後，系統透過 /api/us-ws-url 端點安全交握獲取連線權限，無須在前端輸入或洩漏 Token。": "When FINNHUB_TOKEN is configured in backend, the system safely handshakes via /api/us-ws-url. No token needed on frontend.",

  // 多格式匯出與匯入
  "資料多格式匯出與匯入": "Multi-Format Export & Import",
  "支援雙向匯出與匯入：JSON / JS（全量無損還原）、CSV（通用格式）與 Excel XLSX / XLS（多分頁活頁簿）。": "Supports 2-way export & import: JSON/JS (lossless restore), CSV (universal), and Excel XLSX/XLS (multi-sheet workbook).",
  "下載 JSON": "Download JSON",
  "下載 JS 檔": "Download JS",
  "匯出 CSV": "Export CSV",
  "匯出 Excel (XLSX)": "Export Excel (XLSX)",
  "匯入檔案 (JSON/JS/CSV/Excel)": "Import File (JSON/JS/CSV/Excel)",
  "無法識別此檔案欄位格式，請確保含有股票代號（或名稱）、股數以及價格（或金額）欄位。": "Unable to recognize file column format. Please ensure it contains stock ticker (or name), shares, and price (or amount) columns.",

  // 手續費與匯率
  "台股手續費": "Taiwan Stock Fees",
  "券商牌告費率 (%)": "Broker Commission Rate (%)",
  "折扣比例 (%)": "Discount (%)",
  "最低手續費（NT$）": "Minimum Fee (NT$)",
  "預設牌告費率 0.1425%，預設實收折扣為牌告的 28%（俗稱 2.8 折）。實際費用請依券商為準。": "Default commission rate is 0.1425%, with a 28% charge of the listed rate. Actual fees vary by broker.",
  "美股手續費與換匯": "U.S. Stock Fees & FX",
  "每股手續費（USD）": "Fee per Share (USD)",
  "單筆最低手續費（USD）": "Minimum Fee per Trade (USD)",
  "美元兌新台幣匯率": "USD to TWD Exchange Rate",
  "加拿大股手續費與換匯": "Canadian Stock Fees & FX",
  "每股手續費（CAD）": "Fee per Share (CAD)",
  "單筆最低手續費（CAD）": "Minimum Fee per Trade (CAD)",
  "加幣兌新台幣匯率": "CAD to TWD Exchange Rate",
  "儲存設定": "Save Settings",
  "編輯": "Edit",
  "改名": "Rename",
  "刪除": "Delete",
  "交易": "Trade",
  "上移": "Move Up",
  "下移": "Move Down",
  "台": "TW",
  "股": "shares",
  "檔": "holdings",
  "筆": "entries",
  "庫存資料已更新。": "Holding updated.",
  "手續費與匯率設定已儲存。": "Fee and exchange-rate settings saved.",
  "請確認各欄位皆為有效的非負數值。": "Enter a valid non-negative number in each field.",
  "台股折扣比例不可大於 100%。": "The Taiwan stock discount cannot exceed 100%.",
  "請輸入股票代號。": "Enter a stock ticker.",
  "股數與價格都必須是大於 0 的有效數值。": "Shares and price must both be valid numbers greater than zero.",
  "手續費必須是有效的非負數值。": "Fees must be a valid non-negative number.",
  "這檔股票在此帳戶尚無持倉，請先新增買入紀錄。": "You do not hold this stock in this account yet. Record a purchase first.",
  "買入股數與價格都必須大於 0。": "Shares and purchase price must be greater than zero.",
  "賣出股數不可超過持有股數，價格必須大於 0。": "Shares sold cannot exceed shares held, and the price must be greater than zero.",
  "配息金額不得小於 0。": "Dividend amount cannot be negative.",
  "配股股數必須大於 0。": "Stock dividend shares must be greater than zero.",
  "分割比例必須大於 0。": "The split ratio must be greater than zero.",
  "此帳戶內該股號已有其他持倉，請編輯既有持倉以避免重複資料。": "A holding for this ticker already exists in this account. Edit the existing holding to avoid duplicates.",
  "已經有同名的自訂欄位。": "A custom field with this name already exists.",
  "讀取已儲存資料時發生問題，目前顯示空白資料。": "There was a problem reading saved data. The current view is empty.",
  "確認交易": "Record Transaction",
};

const englishToChinese = new Map(Object.entries(translations).map(([chinese, english]) => [english, chinese]));

export function translateText(value, language = "zh-TW") {
  if (language !== "en-US") return englishToChinese.get(value) || value;
  if (translations[value]) return translations[value];

  const holdingCount = value.match(/^(\d+) 檔$/);
  if (holdingCount) return `${holdingCount[1]} holdings`;
  const transactionCount = value.match(/^(\d+) 筆$/);
  if (transactionCount) return `${transactionCount[1]} transactions`;
  const entryCount = value.match(/^顯示 (\d+) 筆持倉$/);
  if (entryCount) return `Showing ${entryCount[1]} holdings`;
  const updatedTime = value.match(/^更新於 (.+)$/);
  if (updatedTime) return `Updated at ${updatedTime[1]}`;
  const customFieldRemoved = value.match(/^「(.+)」欄位已刪除。$/);
  if (customFieldRemoved) return `"${customFieldRemoved[1]}" field deleted.`;
  const quoteUpdated = value.match(/^(\d+) 檔股票報價已更新。$/);
  if (quoteUpdated) return `Updated quotes for ${quoteUpdated[1]} stocks.`;
  const holdingAdded = value.match(/^新增「(.+)」交易$/);
  if (holdingAdded) return `New transaction for ${holdingAdded[1]}`;
  const splitPreview = value.match(/^持股數將乘以 (.+)$/);
  if (splitPreview) return `Shares will be multiplied by ${splitPreview[1]}`;
  const removedHolding = value.match(/^(.+) 已刪除。$/);
  if (removedHolding) return `${removedHolding[1]} deleted.`;
  const transactionRecorded = value.match(/^(買入|賣出|現金配息|股票配股|股票分割|減資)紀錄已新增。$/);
  if (transactionRecorded) return `${translateText(transactionRecorded[1], language)} transaction recorded.`;
  const customFieldAdded = value.match(/^已新增「(.+)」欄位，可在編輯持倉時填寫。$/);
  if (customFieldAdded) return `Added "${customFieldAdded[1]}" field. Edit a holding to add its value.`;
  const customFieldTitle = value.match(/^刪除「(.+)」欄位$/);
  if (customFieldTitle) return `Delete "${customFieldTitle[1]}" field`;
  const accountAdded = value.match(/^已新增「(.+)」帳戶。$/);
  if (accountAdded) return `Account "${accountAdded[1]}" added.`;
  const accountDeleted = value.match(/^已刪除「(.+)」帳戶。$/);
  if (accountDeleted) return `Account "${accountDeleted[1]}" deleted.`;
  const accountRenamed = value.match(/^帳戶已改名為「(.+)」。$/);
  if (accountRenamed) return `Account renamed to "${accountRenamed[1]}".`;
  const streamSwitched = value.match(/^已切換為美股 (.+)$/);
  if (streamSwitched) return `Switched to US stock ${streamSwitched[1]}.`;
  const importSuccess = value.match(/^已成功由 (.+) 匯入 (\d+) 筆資料！$/);
  if (importSuccess) return `Successfully imported ${importSuccess[2]} records from ${importSuccess[1]}!`;
  const confirmDeleteAccount = value.match(/^確定刪除「(.+)」帳戶？$/);
  if (confirmDeleteAccount) return `Are you sure you want to delete account "${confirmDeleteAccount[1]}"?`;

  const sortBy = value.match(/^依 (.+) 排序$/);
  if (sortBy) return `Sort by ${translateText(sortBy[1], language)}`;

  return value;
}

export function applyTranslations(language = "zh-TW", root = document) {
  const isEnglish = language === "en-US";
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest("script, style, [data-no-translate]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = textWalker.nextNode())) {
    const text = node.nodeValue;
    const trimmed = text.trim();
    if (!trimmed) continue;
    const translated = translateText(trimmed, language);
    if (translated !== trimmed) node.nodeValue = text.replace(trimmed, translated);
  }

  root.querySelectorAll?.("[placeholder], [title], [aria-label]").forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    for (const attribute of ["placeholder", "title", "aria-label"]) {
      if (element.hasAttribute(attribute)) {
        const current = element.getAttribute(attribute);
        element.setAttribute(attribute, translateText(current, language));
      }
    }
  });
  document.documentElement.lang = isEnglish ? "en-US" : "zh-Hant";
  document.title = isEnglish ? translations["鮮存股｜個人投資紀錄"] : "鮮存股｜個人投資紀錄";
}

export function formatMoney(value, market = "TW", digits = 2, language = "zh-TW") {
  const { symbol: zhSymbol } = locale.currency[market] || locale.currency.TW;
  const symbol = language === "en-US" && market === "US" ? "US$"
    : language === "en-US" && market === "CA" ? "CA$"
      : zhSymbol;
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  const roundedAmount = digits === 0 && Math.abs(amount) < 0.5 ? 0 : amount;
  const formattedAmount = new Intl.NumberFormat(language === "en-US" ? "en-US" : "zh-TW", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(roundedAmount));
  return `${roundedAmount < 0 ? "-" : ""}${symbol} ${formattedAmount}`;
}

export function formatTwd(value, digits = 0, language = "zh-TW") {
  return formatMoney(value, "TW", digits, language);
}

export function formatQuantity(value, language = "zh-TW") {
  return new Intl.NumberFormat(language === "en-US" ? "en-US" : "zh-TW", { maximumFractionDigits: 4 }).format(Number(value) || 0);
}