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
  "Render API（台股／美股，預設）": "Render API (Taiwan / U.S. stocks, default)",
  "Yahoo Finance（名稱搜尋／加拿大股）": "Yahoo Finance (name search / Canadian stocks)",
  "Render 報價 API 網址": "Render Quote API URL",
  "Render API 會依輸入的台股／美股代號即時查價；網址中的 tw_codes、us_symbols 會自動替換成目前代號。此 API 不支援公司名稱搜尋；需搜尋名稱或查詢加拿大股時可切換 Yahoo Finance。但 GitHub Pages 可能因跨來源限制而封鎖 Yahoo 請求，建議使用預設 Render API。": "Render API looks up Taiwan and U.S. stocks by ticker. The tw_codes and us_symbols URL parameters are replaced with the current ticker. It does not search by company name; Yahoo Finance can be selected for name search or Canadian stocks. GitHub Pages may block Yahoo requests due to CORS, so the default Render API is recommended.",
  "Render 報價 API 請填寫有效的 HTTPS 網址。": "Enter a valid HTTPS URL for the Render Quote API.",
  "Render 報價 API 網址無效，請至偏好設定確認。": "The Render Quote API URL is invalid. Check Preferences.",
  "Render 報價 API 必須使用有效的 HTTPS 網址。": "The Render Quote API must use a valid HTTPS URL.",
  "Render 報價 API 未回傳有效股價，請確認股票代號。": "The Render Quote API returned no valid price. Check the ticker.",
  "目前 Render 報價 API 僅支援台股與美股；加拿大股請切換至 Yahoo Finance。": "The current Render Quote API supports Taiwan and U.S. stocks only. Switch to Yahoo Finance for Canadian stocks.",
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
  "新增自訂欄位": "Add Custom Field",
  "全部持倉": "All Holdings",
  "台股": "Taiwan",
  "美股": "U.S.",
  "加拿大股": "Canada",
  "報價依上次更新時間": "Quotes as of last update",
  "更新所有報價": "Refresh all quotes",
  "股票代號 / 名稱": "Ticker / Name",
  "買入日期": "Purchase Date",
  "平均買入價": "Avg. Cost / Share",
  "持有股數": "Shares",
  "目前現價": "Current Price",
  "手續費": "Fees",
  "投資本金": "Cost Basis",
  "目前市值": "Market Value",
  "帳面損益": "Unrealized P/L",
  "報酬率": "Return",
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
  "新增自訂欄位": "Add Custom Field",
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
  "目前使用雲端檔案；變更會自動同步。": "Using the cloud file. Changes sync automatically.",
  "雲端模式尚未連結檔案；請連結檔案或切回本機模式。": "No cloud file is linked. Link a file or switch back to local mode.",
  "目前使用本機儲存；資料僅保存在此瀏覽器。": "Using local storage. Data is kept in this browser only.",
  "本機與雲端資料分開保留；只有成功連結並載入或建立共用檔案後，才可切換至雲端模式。雲端模式會自動同步至已啟用的檔案，並在此瀏覽器保留快取。": "Local and cloud data are kept separately. Cloud mode becomes available only after a shared file has been linked and loaded or created. It automatically syncs to the active file and keeps a cache in this browser.",
  "請先連結或建立共用檔案，再切換至雲端模式。": "Link or create a shared file before switching to cloud mode.",
  "連結共用檔會更新雲端資料快取；本機資料會保留。是否繼續？": "Linking a shared file updates the cloud data cache. Local data will be preserved. Continue?",
  "載入共用檔會更新雲端資料；本機資料會保留。是否繼續？": "Loading a shared file updates cloud data. Local data will be preserved. Continue?",
  "切換至雲端會載入共用檔資料；本機資料將保留，之後的編輯會自動同步至雲端。是否繼續？": "Switching to cloud loads data from the shared file. Local data will be preserved, and future edits will sync automatically. Continue?",
  "切換至本機會載入此瀏覽器原有資料；雲端資料會保留不變。是否繼續？": "Switching to local loads the data previously stored in this browser. Cloud data will remain unchanged. Continue?",
  "本機資料未變更，可切換至雲端模式。": "Local data is unchanged. You can switch to cloud mode.",
  "已連結雲端檔案；本機資料未變更，可切換至雲端模式。": "Cloud file linked. Local data is unchanged; you can switch to cloud mode.",
  "雲端資料已自動同步。": "Cloud data synced automatically.",
  "共用檔案已在其他位置變更；為避免覆蓋，請先載入最新版本。": "The shared file changed elsewhere. Load the latest version to avoid overwriting it.",
  "共用檔案已在其他位置變更；雲端自動同步已暫停，請先載入最新版本。": "The shared file changed elsewhere. Automatic cloud sync is paused; load the latest version first.",
  "雲端自動同步已暫停；請先載入最新版本或重新授權。": "Automatic cloud sync is paused. Load the latest version or re-authorize access.",
  "雲端自動同步失敗；請重新授權或切回本機模式。": "Cloud sync failed. Re-authorize access or switch back to local mode.",
  "雲端模式尚未連結共用檔案；請先連結檔案或切回本機模式。": "No shared file is linked in cloud mode. Link a file or switch back to local mode.",
  "雲端模式需要重新授權；請按「載入共用檔」同步，或切回本機模式。": "Cloud mode needs permission again. Select “Load Shared File” to sync, or switch back to local mode.",
  "已切換至雲端；後續變更會自動同步。": "Switched to cloud. Future changes will sync automatically.",
  "已切換至本機；雲端資料保持不變。": "Switched to local. Cloud data remains unchanged.",
  "請先切回本機模式，再解除雲端檔案連結。": "Switch to local mode before unlinking the cloud file.",
  "無法儲存雲端資料的本機快取。": "Unable to save the local cache for cloud data.",
  "無法儲存儲存位置設定。": "Unable to save the storage location setting.",
  "無法讀取本機已儲存資料，未切換儲存位置。": "Unable to read local data. The storage location was not changed.",
  "資料匯出與備份": "Data Export & Backup",
  "JSON 可完整備份並還原庫存、交易與設定；CSV 適合用試算表查看，不可還原。": "JSON backs up and restores holdings, transactions, and settings. CSV is for spreadsheets and cannot be restored.",
  "下載 JSON 備份": "Download JSON Backup",
  "匯出 CSV": "Export CSV",
  "從 JSON 還原": "Restore from JSON",
  "共用雲端檔案": "Shared Cloud File",
  "可直接按「連結並載入共用檔」選取既有 JSON。若沒有檔案，按「建立／另存共用檔」並選擇資料夾，鮮存股會自動建立含日期時間的新 JSON，不會覆寫既有檔案。檔案成功載入或建立後，即可在上方選擇雲端模式。": "Select “Link & Load Shared File” to choose an existing JSON. To create a new file, select “Create / Save As Shared File” and choose a folder; Xian Stock automatically creates a new JSON with a timestamp in its name and never overwrites an existing file. After the file is linked or created, you can select Cloud above.",
  "支援 Google Drive for desktop、OneDrive、Dropbox 等已同步到本機的資料夾。雲端模式下編輯會自動同步；這不是即時多人協作，發現外部修改時會先提醒。": "Supports folders synced to this device by Google Drive for desktop, OneDrive, Dropbox, and similar services. Edits sync automatically in cloud mode. This is not real-time collaboration; external changes are flagged first.",
  "可選取 Google Drive for desktop、OneDrive、Dropbox 等同步資料夾中的 JSON 檔案。編輯仍會先儲存在本機；需按「載入」或「儲存」與共用檔同步。這不是即時多人協作，發現外部修改時會先提醒。": "Choose a JSON file in a synced folder such as Google Drive for desktop, OneDrive, or Dropbox. Edits are saved locally first; use Load or Save to sync. This is not real-time collaboration, and external changes are flagged before overwrite.",
  "檔案位置（同步資料夾內）": "File location (within synced folder)",
  "基於瀏覽器隱私限制，無法顯示完整磁碟路徑；上方顯示所選同步資料夾名稱與檔案相對位置。": "Browser privacy restrictions prevent showing the full disk path. The selected sync folder and relative file path are shown above.",
  "尚未選取同步資料夾。": "No sync folder selected.",
  "選取同步資料夾": "Choose Sync Folder",
  "處理中…": "Working…",
  "正在處理共用檔案操作，請稍候。": "Shared file operation in progress. Please wait.",
  "已取消選取；同步資料夾位置未變更。": "Selection cancelled. The sync folder location was not changed.",
  "已選取同步資料夾；請連結或建立共用檔案。": "Sync folder selected. Link or create a shared file.",
  "同步資料夾已選取，正在建立共用 JSON 檔…": "Sync folder selected. Creating the shared JSON file…",
  "瀏覽器未授權同步資料夾讀寫權限，尚未建立共用檔。": "The browser did not grant read/write access to the sync folder. No shared file was created.",
  "」已選取；可直接連結既有檔案，或建立新的共用檔。": "” selected. You can link an existing file or create a new shared file.",
  "可直接連結既有 JSON；按「建立／另存共用檔」選擇資料夾並自動建立新檔。": "Link an existing JSON, or select “Create / Save As Shared File” to choose a folder and automatically create a new file.",
  "」已選取；可直接選取或建立共用 JSON 檔。": "” selected. You can select or create a shared JSON file.",
  "連結既有 JSON 不需先選資料夾；建立新檔時，按鈕會請你選擇資料夾並自動建立。": "You do not need to choose a folder to link an existing JSON. To create a file, select the button to choose a folder and create it automatically.",
  "已選取同步資料夾：": "Sync folder selected: ",
  "請先選取同步資料夾。": "Choose a sync folder first.",
  "同步資料夾路徑已更新。": "Sync folder path updated.",
  "目前連結的檔案不在所選同步資料夾內；請重新連結共用檔案。": "The linked file is not in the selected sync folder. Please link the shared file again.",
  "相對路徑無法取得；目前僅顯示檔名。": "The relative path is unavailable. Showing the file name only.",
  "共用檔案已連結。": "Shared file linked.",
  "共用檔案已連結並啟用。": "Shared file linked and activated.",
  "共用檔案尚未啟用；請載入檔案並授予讀寫權限。": "The shared file is not active. Load the file and grant read/write permission.",
  "請先連結並載入或建立共用檔案，啟用後才能切換至雲端模式。": "Link and load or create a shared file before switching to cloud mode.",
  "請先連結並載入或建立共用檔案，再切換至雲端模式。": "Link and load or create a shared file before switching to cloud mode.",
  "尚未選擇共用檔案": "No shared file selected",
  "同步資料夾「": "Sync folder “",
  "」已選取；請連結並載入或建立共用檔，完成後即可切換至雲端模式。": "” selected. Link and load or create a shared JSON file to enable cloud mode.",
  "請先選取同步資料夾，再連結並載入或建立共用檔，完成後即可切換至雲端模式。": "Choose a sync folder, then link and load or create a shared file to enable cloud mode.",
  "共用檔案已連結；操作時需重新授權。": "Shared file linked. Permission is required when you use it.",
  "尚未連結共用檔案。": "No shared file is linked.",
  "此瀏覽器不支援共用檔案存取，仍可使用 JSON／CSV 匯出與 JSON 還原。": "This browser does not support shared-file access. JSON/CSV export and JSON restore are still available.",
  "連結並載入共用檔": "Link & Load Shared File",
  "建立／另存共用檔": "Create / Save As Shared File",
  "載入共用檔": "Load Shared File",
  "儲存至共用檔": "Save to Shared File",
  "解除連結": "Unlink",
  "無法讀取共用檔案設定，請重新連結檔案。": "Unable to read shared-file settings. Please link the file again.",
  "載入共用檔將取代這個瀏覽器目前的庫存、交易與設定。是否繼續？": "Loading the shared file will replace the holdings, transactions, and settings in this browser. Continue?",
  "所選檔案已有內容，建立共用檔會以目前資料覆寫。是否繼續？": "The selected file is not empty. Creating a shared file will overwrite it with the current data. Continue?",
  "已載入並連結共用檔案。": "Shared file loaded and linked.",
  "已建立並連結共用檔案。": "Shared file created and linked.",
  "已從共用檔載入資料。": "Data loaded from shared file.",
  "共用檔在上次載入後已被修改。若繼續儲存，將以此瀏覽器資料覆寫最新版本。是否仍要覆寫？": "The shared file has changed since it was last loaded. Saving will overwrite the latest version with this browser's data. Continue?",
  "共用檔再次被修改，為避免覆蓋他人資料，請先重新載入。": "The shared file changed again. Reload it before saving to avoid overwriting someone else's changes.",
  "已儲存至共用檔案。": "Saved to shared file.",
  "已解除共用檔案連結；本機資料不受影響。": "Shared file unlinked. Local data is unchanged.",
  "共用檔案操作失敗。": "Shared-file operation failed.",
  "備份檔超過 20 MB，無法匯入。": "The backup exceeds 20 MB and cannot be imported.",
  "還原備份會取代這個瀏覽器目前的庫存、交易與設定。建議先下載目前資料備份。是否繼續？": "Restoring the backup will replace the holdings, transactions, and settings in this browser. Download a backup of current data first. Continue?",
  "資料已從 JSON 備份還原。": "Data restored from JSON backup.",
  "無法匯入備份檔。": "Unable to import the backup file.",
  "JSON 完整備份已下載。": "Full JSON backup downloaded.",
  "CSV 試算表資料已下載。": "CSV spreadsheet data downloaded.",
  "檔案不是有效的 JSON 備份。": "The file is not a valid JSON backup.",
  "備份版本不支援，請更新應用程式後再試。": "This backup version is not supported. Update the app and try again.",
  "備份資料格式不正確。": "The backup data format is invalid.",
  "備份資料缺少庫存或交易清單。": "The backup is missing holdings or transactions.",
  "自訂欄位資料格式不正確。": "The custom-field data format is invalid.",
  "偏好設定資料格式不正確。": "The preferences data format is invalid.",
  "期初庫存資料格式不正確。": "The opening-balance data format is invalid.",
  "備份中有無效的庫存資料。": "The backup contains invalid holding data.",
  "備份中有無效的庫存數值。": "The backup contains invalid holding values.",
  "備份中有無效的自訂欄位。": "The backup contains an invalid custom field.",
  "備份中有無效的交易資料。": "The backup contains invalid transaction data.",
  "備份中的手續費或匯率設定無效。": "The backup contains invalid fee or exchange-rate settings.",
  "備份中的手續費或匯率設定超出有效範圍。": "The backup's fee or exchange-rate settings are out of range.",
  "無法儲存匯入資料至本機，原有資料未變更。": "Unable to save imported data locally. Existing data was not changed.",
  "無法儲存匯入資料，原有資料未變更。": "Unable to save imported data. Existing data was not changed.",
  "瀏覽器未授權讀寫共用檔案。": "The browser did not grant read/write access to the shared file.",
  "無法開啟共用檔案設定。": "Unable to open shared-file settings.",
  "無法更新共用檔案設定。": "Unable to update shared-file settings.",
  "無法儲存共用檔案設定。": "Unable to save shared-file settings.",
  "共用檔案設定更新已取消。": "Updating shared-file settings was cancelled.",
  "台股手續費": "Taiwan Stock Fees",
  "券商牌告費率 (%)": "Broker Commission Rate (%)",
  "折扣比例 (%)": "Discount (%)",
  "最低手續費（NT$）": "Minimum Fee (NT$)",
  "預設牌告費率 0.1425%，預設實收折扣為牌告的 28%（俗稱 2.8 折）。實際費用請依券商為準。": "Default commission rate is 0.1425%, with a 28% charge of the listed rate. Actual fees vary by broker.",
  "美股手續費與換匯": "U.S. Stock Fees & FX",
  "每股手續費（USD）": "Fee per Share (USD)",
  "單筆最低手續費（USD）": "Minimum Fee per Trade (USD)",
  "美元兌新台幣匯率": "USD to TWD Exchange Rate",
  "美股預設每股 USD 0.005；可依券商方案調整。匯率用於資產總覽換算。": "The default U.S. stock fee is USD 0.005 per share. Adjust it to match your broker. The exchange rate is used for portfolio totals.",
  "加拿大股手續費與換匯": "Canadian Stock Fees & Exchange Rate",
  "每股手續費（CAD）": "Fee per Share (CAD)",
  "單筆最低手續費（CAD）": "Minimum Fee per Trade (CAD)",
  "加幣兌新台幣匯率": "CAD to TWD Exchange Rate",
  "可自行設定加拿大券商手續費與 CAD/TWD 匯率；匯率用於資產總覽換算。": "Set Canadian broker fees and the CAD/TWD exchange rate used to convert portfolio totals.",
  "儲存設定": "Save Settings",
  "編輯": "Edit",
  "刪除": "Delete",
  "交易": "Trade",
  "台": "TW",
  "股": "shares",
  "檔": "holdings",
  "筆": "entries",
  "上次更新：": "Last updated: ",
  "交易紀錄已新增。": " transaction recorded.",
  "已刪除。": " deleted.",
  "庫存資料已更新。": "Holding updated.",
  "已新增「": "Added \"",
  "」欄位，可在編輯持倉時填寫。": "\" field. Edit a holding to add its value.",
  "欄位已刪除。": " field deleted.",
  "手續費與匯率設定已儲存。": "Fee and exchange-rate settings saved.",
  "目前沒有庫存可更新報價。": "There are no holdings to refresh.",
  "更新於 ": "Updated at ",
  "已更新 ": "Updated ",
  " 檔股票報價。": " stock quotes.",
  " / ": " / ",
  " 檔報價更新成功，失敗項目請稍後重試。": " quotes updated. Please retry failed quotes later.",
  "請先輸入股票代號或名稱。": "Enter a ticker or company name first.",
  "找不到符合的台股或美股，請再試試看代號。": "No matching Taiwan or U.S. stocks found. Try a ticker instead.",
  "找不到股票，請確認代號或輸入英文名稱。": "No matching stocks found. Check the ticker or try the English company name.",
  "正在搜尋台股與美股…": "Searching Taiwan and U.S. stocks…",
  "報價搜尋暫時無法使用，請稍後再試或手動輸入股票代號。": "Quote search is temporarily unavailable. Try again later or enter a ticker manually.",
  "報價幣別與預期市場不同，請確認股票代號。": "The quote currency does not match the selected market. Please check the ticker.",
  " 請手動輸入價格。": " Enter the price manually.",
  "請確認各欄位皆為有效的非負數值。": "Enter a valid non-negative number in each field.",
  "台股折扣比例不可大於 100%。": "The Taiwan stock discount cannot exceed 100%.",
  "請輸入股票代號。": "Enter a stock ticker.",
  "股數與價格都必須是大於 0 的有效數值。": "Shares and price must both be valid numbers greater than zero.",
  "手續費必須是有效的非負數值。": "Fees must be a valid non-negative number.",
  "這檔股票尚無持倉，請先新增買入紀錄。": "You do not hold this stock yet. Record a purchase first.",
  "買入股數與價格都必須大於 0。": "Shares and purchase price must be greater than zero.",
  "賣出股數不可超過持有股數，價格必須大於 0。": "Shares sold cannot exceed shares held, and the price must be greater than zero.",
  "配息金額不得小於 0。": "Dividend amount cannot be negative.",
  "配股股數必須大於 0。": "Stock dividend shares must be greater than zero.",
  "分割比例必須大於 0。": "The split ratio must be greater than zero.",
  "此股號已有其他持倉，請編輯既有持倉以避免重複資料。": "A holding for this ticker already exists. Edit the existing holding to avoid duplicates.",
  "已經有同名的自訂欄位。": "A custom field with this name already exists.",
  "讀取已儲存資料時發生問題，目前顯示空白資料。": "There was a problem reading saved data. The current view is empty.",
  "新增": "Add",
  "確認交易": "Record Transaction",
  "中文": "Chinese",
  "美語": "English (U.S.)",
};

const englishToChinese = new Map(Object.entries(translations).map(([chinese, english]) => [english, chinese]));

export function translateText(value, language = "zh-TW") {
  if (language !== "en-US") return englishToChinese.get(value) || value;
  if (translations[value]) return translations[value];
  const folderStatusSuffixes = [
    "」已選取；可直接連結既有檔案，或建立新的共用檔。",
    "」已選取；可直接選取或建立共用 JSON 檔。",
  ];
  if (value.startsWith("同步資料夾「")) {
    const suffix = folderStatusSuffixes.find((candidate) => value.endsWith(candidate));
    if (suffix) {
      const folderName = value.slice("同步資料夾「".length, -suffix.length);
      return `${translations["同步資料夾「"]}${folderName}${translations[suffix]}`;
    }
  }

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
  const quoteLoaded = value.match(/^(.+) 已帶入報價 (.+)。$/);
  if (quoteLoaded) return `Loaded quote for ${quoteLoaded[1]}: ${quoteLoaded[2]}.`;
  const renderApiError = value.match(/^Render 報價 API 回應錯誤（(\d+)）。$/);
  if (renderApiError) return `Render Quote API returned an error (${renderApiError[1]}).`;
  const holdingAdded = value.match(/^新增「(.+)」交易$/);
  if (holdingAdded) return `New transaction for ${holdingAdded[1]}`;
  const holdingDeleted = value.match(/^確定刪除 (.+)（(.+)）及其持倉資料？$/);
  if (holdingDeleted) return `Delete ${holdingDeleted[1]} (${holdingDeleted[2]}) and its holding data?`;
  const fieldDeleted = value.match(/^確定刪除「(.+)」欄位及所有該欄位資料？$/);
  if (fieldDeleted) return `Delete the "${fieldDeleted[1]}" field and all its data?`;
  const transactionDeleted = value.match(/^確定刪除 (.+)（(.+)）交易明細？$/);
  if (transactionDeleted) return `Delete the ${transactionDeleted[1]} transaction dated ${transactionDeleted[2]}?`;
  const holdingDetailsLink = value.match(/^查看 (.+) 交易明細$/);
  if (holdingDetailsLink) return `View ${holdingDetailsLink[1]} transaction history`;
  const transactionTitle = value.match(/^編輯 (.+)交易$/);
  if (transactionTitle) return `Edit ${transactionTitle[1]} Transaction`;
  const fieldPlaceholder = value.match(/^輸入(.+)$/);
  if (fieldPlaceholder) return `Enter ${fieldPlaceholder[1]}`;
  const feeEstimate = value.match(/^依(台股|美股|加拿大股)手續費設定預估，可自行修改。$/);
  if (feeEstimate) return `Estimated using ${feeEstimate[1] === "台股" ? "Taiwan" : feeEstimate[1] === "加拿大股" ? "Canadian" : "U.S."} stock fee settings. You can adjust it.`;
  const splitPreview = value.match(/^持股數將乘以 (.+)$/);
  if (splitPreview) return `Shares will be multiplied by ${splitPreview[1]}`;
  const lookup = value.match(/^輸入(.+)$/);
  if (lookup) return `Enter ${lookup[1]}`;
  const removedHolding = value.match(/^(.+) 已刪除。$/);
  if (removedHolding) return `${removedHolding[1]} deleted.`;
  const transactionRecorded = value.match(/^(買入|賣出|現金配息|股票配股|股票分割|減資)紀錄已新增。$/);
  if (transactionRecorded) return `${translateText(transactionRecorded[1], language)} transaction recorded.`;
  const customFieldAdded = value.match(/^已新增「(.+)」欄位，可在編輯持倉時填寫。$/);
  if (customFieldAdded) return `Added "${customFieldAdded[1]}" field. Edit a holding to add its value.`;
  const customFieldTitle = value.match(/^刪除「(.+)」欄位$/);
  if (customFieldTitle) return `Delete "${customFieldTitle[1]}" field`;
  const dateTitle = value.match(/^上次更新：(.+)$/);
  if (dateTitle) return `Last updated: ${dateTitle[1]}`;
  const quoteFailure = value.match(/^(.+) 可手動輸入價格。$/);
  if (quoteFailure) return `${translateText(quoteFailure[1], language)} Enter the price manually.`;
  const feePreview = value.match(/^依(台股|美股|加拿大股)手續費設定預估，可自行修改。$/);
  if (feePreview) return `Estimated using ${feePreview[1] === "台股" ? "Taiwan" : feePreview[1] === "加拿大股" ? "Canadian" : "U.S."} stock fee settings. You can adjust it.`;
  const amount = value.match(/^(\d+) \/ (\d+) 檔報價更新成功，失敗項目請稍後重試。$/);
  if (amount) return `${amount[1]} of ${amount[2]} quotes updated. Please retry failed quotes later.`;

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
