// js/backup.js - 備份導出、還原解析、CSV 與 Excel (XLS/XLSX) 多格式序列化模組
import { normalizeImportedState, DEFAULT_ACCOUNT_ID } from "./storage.js";

const BACKUP_FORMAT = "xian-stock-backup";
const BACKUP_VERSION = 2;

// ============================================================================
// 1. JSON / JS 序列化與解析
// ============================================================================
export function serializeBackup(state) {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      accounts: state.accounts,
      activeAccountId: state.activeAccountId,
      holdings: state.holdings,
      customFields: state.customFields,
      settings: state.settings,
      transactions: state.transactions,
      openingBalances: state.openingBalances,
    },
  }, null, 2);
}

export function serializeJsBackup(state) {
  return `/** 鮮存股 (Xian Stock) 資料備份檔 - ${new Date().toISOString()} */\nconst xianStockBackup = ${serializeBackup(state)};\n`;
}

export function parseBackup(text) {
  let cleanText = text.trim();
  // 相容以 JS 變數包裹的代碼
  if (cleanText.startsWith("const ") || cleanText.startsWith("var ") || cleanText.startsWith("let ")) {
    const eqIdx = cleanText.indexOf("=");
    if (eqIdx > 0) {
      cleanText = cleanText.slice(eqIdx + 1).trim().replace(/;$/, "");
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanText);
  } catch {
    throw new Error("檔案不是有效的 JSON 或 JS 備份。");
  }
  if (parsed?.format === BACKUP_FORMAT) {
    return normalizeImportedState(parsed.data);
  }
  return normalizeImportedState(parsed);
}

// ============================================================================
// 2. CSV 序列化與 RFC 4180 完整雙向解析
// ============================================================================
function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function serializeCsv(state) {
  const columns = [
    "record_type", "account_id", "id", "symbol", "name", "market", "date", "type", "quantity", "price",
    "fee", "ratio", "current_price", "shares", "cost_basis", "realized_profit", "dividends", "data",
  ];
  const rows = [
    columns,
    ["metadata", "", "", "", "", "", new Date().toISOString(), "鮮存股 CSV 完整匯出資料庫"],
  ];

  for (const acc of (state.accounts || [])) {
    rows.push(["account", acc.id, "", acc.name, "", "", "", "", "", "", "", "", "", "", "", "", "", JSON.stringify(acc)]);
  }

  for (const holding of state.holdings) {
    rows.push([
      "holding", holding.accountId || DEFAULT_ACCOUNT_ID, holding.id, holding.symbol, holding.name, holding.market, holding.buyDate, "",
      "", "", holding.fees, "", holding.currentPrice, holding.shares, holding.costBasis,
      holding.realizedProfit, holding.dividends, JSON.stringify(holding),
    ]);
  }

  for (const transaction of state.transactions) {
    rows.push([
      "transaction", transaction.accountId || DEFAULT_ACCOUNT_ID, transaction.id, transaction.symbol, transaction.name, transaction.market,
      transaction.date, transaction.type, transaction.quantity, transaction.price, transaction.fee,
      transaction.ratio, transaction.currentPrice, "", "", "", "", JSON.stringify(transaction),
    ]);
  }

  for (const field of state.customFields) {
    rows.push(["custom_field", "", field.id, "", field.name]);
  }

  for (const [key, value] of Object.entries(state.settings)) {
    rows.push(["setting", "", key, "", "", "", "", "", "", "", "", "", "", "", "", "", "", value]);
  }

  for (const [id, balance] of Object.entries(state.openingBalances || {})) {
    rows.push(["opening_balance", "", id, "", "", "", "", "", "", "", "", "", "", "", "", "", "", JSON.stringify(balance)]);
  }

  return `\uFEFF${rows.map((row) => columns.map((_, index) => csvCell(row[index])).join(",")).join("\r\n")}`;
}

export function parseCsvRows(csvText) {
  const clean = csvText.replace(/^\uFEFF/, "");
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r" && nextChar === "\n") {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
        i++;
      } else if (char === "\n" || char === "\r") {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }
  return rows.filter((r) => r.length > 1);
}

export function parseCsvBackup(csvText) {
  const rows = parseCsvRows(csvText);
  if (!rows.length) throw new Error("CSV 內容為空。");

  const state = {
    accounts: [],
    holdings: [],
    transactions: [],
    customFields: [],
    settings: {},
    openingBalances: {},
  };

  const header = rows[0].map((c) => c.toLowerCase());
  const typeIdx = header.indexOf("record_type");

  // 1. 若為鮮存股標準導出格式
  if (typeIdx >= 0) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const recType = row[typeIdx];
      const dataCol = row[17];

      try {
        if (recType === "account" && dataCol) {
          state.accounts.push(JSON.parse(dataCol));
        } else if (recType === "holding" && dataCol) {
          state.holdings.push(JSON.parse(dataCol));
        } else if (recType === "transaction" && dataCol) {
          state.transactions.push(JSON.parse(dataCol));
        } else if (recType === "custom_field") {
          state.customFields.push({ id: row[2], name: row[4] });
        } else if (recType === "setting") {
          state.settings[row[2]] = row[17];
        } else if (recType === "opening_balance" && dataCol) {
          state.openingBalances[row[2]] = JSON.parse(dataCol);
        }
      } catch (e) {
        console.warn("略過格式損壞之 CSV 行:", row);
      }
    }
  } else {
    // 2. 外部通用交易明細 CSV（欄位：日期, 代號, 類別, 股數, 價格, 手續費）
    const dateIdx = header.findIndex((h) => h.includes("date") || h.includes("日期"));
    const symIdx = header.findIndex((h) => h.includes("symbol") || h.includes("代號") || h.includes("代碼"));
    const qtyIdx = header.findIndex((h) => h.includes("quantity") || h.includes("shares") || h.includes("股數"));
    const priceIdx = header.findIndex((h) => h.includes("price") || h.includes("價格") || h.includes("單價"));
    const typeColIdx = header.findIndex((h) => h.includes("type") || h.includes("類型") || h.includes("類別"));

    if (symIdx >= 0 && qtyIdx >= 0 && priceIdx >= 0) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const symbol = String(row[symIdx] || "").trim().toUpperCase();
        if (!symbol) continue;
        const market = /\.(TO|V|CN|NE)$/i.test(symbol) ? "CA" : /\.(TW|TWO)$/i.test(symbol) || /^\d+$/.test(symbol) ? "TW" : "US";
        state.transactions.push({
          id: crypto.randomUUID(),
          accountId: DEFAULT_ACCOUNT_ID,
          type: (typeColIdx >= 0 && String(row[typeColIdx]).includes("賣")) ? "sell" : "buy",
          symbol: market === "TW" && !/\.(TW|TWO)$/i.test(symbol) ? `${symbol}.TW` : symbol,
          name: symbol,
          market,
          date: dateIdx >= 0 && row[dateIdx] ? row[dateIdx] : new Date().toISOString().slice(0, 10),
          quantity: Math.max(0, Number(row[qtyIdx]) || 0),
          price: Math.max(0, Number(row[priceIdx]) || 0),
          fee: 0,
        });
      }
    } else {
      throw new Error("無法識別此 CSV 欄位格式，請確保含有股票代號、股數與價格欄位。");
    }
  }

  return normalizeImportedState(state);
}

// ============================================================================
// 3. Excel (XLS / XLSX) 序列化與反向解析（依賴全域 SheetJS 函式庫）
// ============================================================================
export function serializeExcel(state) {
  if (typeof window.XLSX === "undefined") {
    throw new Error("尚未載入 Excel (SheetJS) 模組，請稍後重試或確認網路連線。");
  }

  const wb = window.XLSX.utils.book_new();

  // (1) 庫存分頁
  const holdingsData = [
    ["帳戶ID", "股票代號", "股票名稱", "市場", "持有股數", "總投資成本", "目前現價", "累計股息", "累計手續費", "首次買入日"],
    ...state.holdings.map((h) => [
      h.accountId, h.symbol, h.name, h.market, h.shares, h.costBasis, h.currentPrice, h.dividends || 0, h.fees || 0, h.buyDate || "",
    ]),
  ];
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(holdingsData), "我的庫存");

  // (2) 交易分頁
  const transactionsData = [
    ["帳戶ID", "交易日期", "交易類型", "股票代號", "名稱", "市場", "股數", "單價", "手續費", "分割比例"],
    ...state.transactions.map((t) => [
      t.accountId, t.date, t.type, t.symbol, t.name, t.market, t.quantity, t.price, t.fee || 0, t.ratio || "",
    ]),
  ];
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(transactionsData), "交易紀錄");

  // (3) 帳戶分頁
  const accountsData = [
    ["帳戶ID", "帳戶名稱", "標籤顏色"],
    ...(state.accounts || []).map((a) => [a.id, a.name, a.color]),
  ];
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(accountsData), "投資帳戶");

  // (4) 無損還原系統底表（將 JSON 完整隱藏存於底表）
  const systemData = [
    ["_XIAN_STOCK_BACKUP_RAW_JSON_"],
    [serializeBackup(state)],
  ];
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(systemData), "_SystemState");

  const wbout = window.XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function parseExcelBackup(arrayBuffer) {
  if (typeof window.XLSX === "undefined") {
    throw new Error("尚未載入 Excel 解析模組，無法讀取檔案。");
  }

  const wb = window.XLSX.read(arrayBuffer, { type: "array" });

  // 1. 優先檢查是否包含無損系統還原底表
  if (wb.Sheets["_SystemState"]) {
    const cellValue = wb.Sheets["_SystemState"]["A2"] ? wb.Sheets["_SystemState"]["A2"].v : null;
    if (cellValue) {
      return parseBackup(String(cellValue));
    }
  }

  // 2. 反向解析由使用者或外部編輯的標準 Excel 分頁
  const state = {
    accounts: [],
    holdings: [],
    transactions: [],
    customFields: [],
    settings: {},
    openingBalances: {},
  };

  // 解析帳戶
  if (wb.Sheets["投資帳戶"]) {
    const accRows = window.XLSX.utils.sheet_to_json(wb.Sheets["投資帳戶"]);
    accRows.forEach((r) => {
      if (r["帳戶名稱"]) state.accounts.push({ id: String(r["帳戶ID"] || crypto.randomUUID()), name: String(r["帳戶名稱"]), color: r["標籤顏色"] || "#418874" });
    });
  }

  // 解析交易紀錄
  if (wb.Sheets["交易紀錄"]) {
    const txRows = window.XLSX.utils.sheet_to_json(wb.Sheets["交易紀錄"]);
    txRows.forEach((r) => {
      if (r["股票代號"]) {
        const sym = String(r["股票代號"]).trim().toUpperCase();
        const market = r["市場"] || (/\.(TO|V|CN|NE)$/i.test(sym) ? "CA" : /\.(TW|TWO)$/i.test(sym) || /^\d+$/.test(sym) ? "TW" : "US");
        state.transactions.push({
          id: crypto.randomUUID(),
          accountId: String(r["帳戶ID"] || DEFAULT_ACCOUNT_ID),
          type: r["交易類型"] || "buy",
          symbol: sym,
          name: String(r["名稱"] || sym),
          market,
          date: String(r["交易日期"] || new Date().toISOString().slice(0, 10)),
          quantity: Math.max(0, Number(r["股數"]) || 0),
          price: Math.max(0, Number(r["單價"]) || 0),
          fee: Math.max(0, Number(r["手續費"]) || 0),
          ratio: Number(r["分割比例"]) || 0,
        });
      }
    });
  }

  // 解析現有庫存
  if (wb.Sheets["我的庫存"]) {
    const hRows = window.XLSX.utils.sheet_to_json(wb.Sheets["我的庫存"]);
    hRows.forEach((r) => {
      if (r["股票代號"] && Number(r["持有股數"]) > 0) {
        const sym = String(r["股票代號"]).trim().toUpperCase();
        state.holdings.push({
          id: crypto.randomUUID(),
          accountId: String(r["帳戶ID"] || DEFAULT_ACCOUNT_ID),
          symbol: sym,
          name: String(r["股票名稱"] || sym),
          market: r["市場"] || (/\.(TW|TWO)$/i.test(sym) || /^\d+$/.test(sym) ? "TW" : "US"),
          shares: Number(r["持有股數"]) || 0,
          costBasis: Number(r["總投資成本"]) || 0,
          currentPrice: Number(r["目前現價"]) || 0,
          dividends: Number(r["累計股息"]) || 0,
          fees: Number(r["累計手續費"]) || 0,
          buyDate: String(r["首次買入日"] || new Date().toISOString().slice(0, 10)),
        });
      }
    });
  }

  return normalizeImportedState(state);
}