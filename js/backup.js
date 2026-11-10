// js/backup.js - 備份導出、還原解析、CSV 與 Excel (XLS/XLSX) 多格式序列化模組（優化重構版）
import { normalizeImportedState, DEFAULT_ACCOUNT_ID } from "./storage.js";
import { resolveStockIdentity, getStockName } from "./quotes.js";

const BACKUP_FORMAT = "xian-stock-backup";
const BACKUP_VERSION = 2;

export function safeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function cleanNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  let s = String(val).trim();
  if (!s || s === "--" || s === "-") return 0;

  s = s
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\uFF0C]/g, ",")
    .replace(/[NT$¥,\s%]/gi, "");

  if (/^\((.+)\)$/.test(s)) {
    s = `-${s.replace(/^\((.+)\)$/, "$1")}`;
  }

  const num = Number(s);
  return Number.isFinite(num) ? num : 0;
}

export function normalizeDate(rawDate, fallbackDate = new Date().toISOString().slice(0, 10)) {
  if (!rawDate) return fallbackDate;
  let str = String(rawDate).trim().replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!str) return fallbackDate;

  str = str.split(/[ T]/)[0].trim();

  // 民國年判斷 (例如 1130520)
  if (/^\d{7}$/.test(str)) {
    const rocYear = parseInt(str.slice(0, 3), 10);
    return `${rocYear + 1911}-${str.slice(3, 5)}-${str.slice(5, 7)}`;
  }
  // 純西元 8 碼 (例如 20240520)
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }

  const parts = str.split(/[/.\-_]/).filter(Boolean);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);

    if (Number.isFinite(p1) && Number.isFinite(p2) && Number.isFinite(p3)) {
      if (p1 > 0 && p1 < 1900) {
        return `${p1 + 1911}-${String(p2).padStart(2, "0")}-${String(p3).padStart(2, "0")}`;
      }
      if (p1 >= 1900 && p1 < 2100) {
        return `${String(p1)}-${String(p2).padStart(2, "0")}-${String(p3).padStart(2, "0")}`;
      }
      if (p3 >= 1900 && p3 < 2100 && p1 >= 1 && p1 <= 12) {
        return `${String(p3)}-${String(p1).padStart(2, "0")}-${String(p2).padStart(2, "0")}`;
      }
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1970 && parsed.getFullYear() < 2100) {
    return parsed.toISOString().slice(0, 10);
  }

  return fallbackDate;
}

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
  return rows.filter((r) => r.length > 0);
}

function applyTransactionSafely(holding, tx) {
  const { type, quantity, price, fee = 0 } = tx;
  if (type === "buy") {
    holding.shares += quantity;
    holding.costBasis += quantity * price + fee;
    holding.fees += fee;
    if (!holding.buyDate || tx.date < holding.buyDate) holding.buyDate = tx.date;
    if (price > 0) holding.currentPrice = price;
  } else if (type === "sell") {
    if (holding.shares <= 0) {
      holding.realizedProfit += quantity * price - fee;
      holding.fees += fee;
    } else if (quantity >= holding.shares - 1e-6) {
      holding.realizedProfit += quantity * price - fee - holding.costBasis;
      holding.costBasis = 0;
      holding.shares = 0;
      holding.fees += fee;
    } else {
      const allocatedCost = (holding.costBasis * quantity) / holding.shares;
      holding.costBasis = Math.max(0, holding.costBasis - allocatedCost);
      holding.shares = Math.max(0, holding.shares - quantity);
      holding.realizedProfit += quantity * price - fee - allocatedCost;
      holding.fees += fee;
    }
    if (price > 0) holding.currentPrice = price;
  } else if (type === "dividend") {
    holding.dividends += (quantity || holding.shares) * price;
  } else if (type === "stockDividend") {
    holding.shares += quantity;
  }
}

function isGarbageRow(sText, nText) {
  const combined = `${sText} ${nText}`.toLowerCase();
  return (
    (!sText && !nText) ||
    /合計|小計|總計|總額|總預估|總現值|總融資|總利息|總損益|總成本|總報酬率|注意事項|備註|說明|製表|列印|客戶|帳號|免責/i.test(combined)
  );
}

/**
 * 通用券商二維表格解析引擎（優化重構）
 * 嚴格區分：成交均價 (pIdx)、市價 (curIdx)、現值 (mvIdx)、付出成本 (cIdx)
 */
export function parseBrokerTableRows(rows) {
  if (!rows || rows.length === 0) return null;

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const firstCell = String(rows[i][0] || "").trim().toLowerCase();
    if (firstCell === "record_type") {
      return parseOfficialCsv(rows, i);
    }
  }

  let headerRowIdx = -1;
  let symIdx = -1;
  let nameIdx = -1;
  let qtyIdx = -1;
  let unitPriceIdx = -1;
  let totalCostIdx = -1;
  let dateIdx = -1;
  let typeIdx = -1;
  let feeIdx = -1;
  let curPriceIdx = -1;
  let mValIdx = -1;
  let isLotUnit = false;

  for (let r = 0; r < Math.min(35, rows.length); r++) {
    const row = rows[r].map((c) => String(c || "").trim().toLowerCase());
    
    const sIdx = row.findIndex((h) =>
      h.includes("symbol") || h.includes("ticker") || h.includes("代號") || h.includes("代碼") || (h.includes("code") && !h.includes("postal"))
    );
    const nIdx = row.findIndex((h, idx) =>
      idx !== sIdx && (h.includes("name") || h.includes("名稱") || h.includes("股名") || h.includes("標的") || h.includes("股票"))
    );
    const qIdx = row.findIndex((h) =>
      h.includes("quantity") || h.includes("shares") || h.includes("股數") || h.includes("數量") || h.includes("庫存") || h.includes("持股") || h.includes("張數")
    );
    const pIdx = row.findIndex((h) =>
      h === "成交均價" || h === "買進均價" || h === "成本價" || h.includes("均價") || h.includes("買進價") || (h.includes("單價") && !h.includes("市")) || (h.includes("價格") && !h.includes("總") && !h.includes("市")) || h === "price"
    );
    const cIdx = row.findIndex((h) =>
      h === "付出成本" || h === "總成本" || h === "買進成本" || h === "成本金額" || h === "投資金額" || h === "成交價金" || h === "成交金額" ||
      (h.includes("成本") && !h.includes("均") && !h.includes("市")) || h.includes("價金") || h.includes("淨收付")
    );
    const curIdx = row.findIndex((h) =>
      h === "市價" || h === "現價" || h === "目前現價" || h === "收盤價" || h.includes("市價") || (h.includes("現價") && !h.includes("均"))
    );
    const mvIdx = row.findIndex((h) =>
      h === "現值" || h === "市值" || h === "預估現值" || h === "總現值" || (h.includes("現值") && !h.includes("價")) || h.includes("市值")
    );

    if ((sIdx >= 0 || nIdx >= 0) && qIdx >= 0 && (pIdx >= 0 || cIdx >= 0)) {
      headerRowIdx = r;
      symIdx = sIdx;
      nameIdx = nIdx;
      qtyIdx = qIdx;
      unitPriceIdx = pIdx;
      totalCostIdx = cIdx;
      curPriceIdx = curIdx;
      mValIdx = mvIdx;
      dateIdx = row.findIndex((h) => h.includes("date") || h.includes("日期") || h.includes("成交日") || h.includes("委託日") || h.includes("時間"));
      typeIdx = row.findIndex((h) => h.includes("買賣別") || h.includes("動作") || (h.includes("買賣") && !h.includes("價")));
      feeIdx = row.findIndex((h) => h.includes("fee") || h.includes("手續費") || h.includes("費用") || h.includes("稅"));

      if (row[qIdx].includes("張")) isLotUnit = true;
      break;
    }
  }

  if (headerRowIdx === -1) return null;

  const state = {
    accounts: [],
    holdings: [],
    transactions: [],
    customFields: [],
    settings: {},
    openingBalances: {},
  };

  const headerRow = rows[headerRowIdx].map((c) => String(c || "").trim().toLowerCase());
  const hasHoldingsKeyword = headerRow.some((h) => h.includes("庫存") || h.includes("持股") || h.includes("現有") || h.includes("未實現") || h.includes("損益") || h.includes("現值"));
  const isHoldingsSnapshot = hasHoldingsKeyword || (typeIdx === -1 && headerRow.some((h) => h.includes("成本") || h.includes("均價")));
  let lastValidDate = new Date().toISOString().slice(0, 10);
  const dataRows = rows.slice(headerRowIdx + 1);

  // A. 庫存總表快照模式
  if (isHoldingsSnapshot) {
    for (const row of dataRows) {
      const rawSym = symIdx >= 0 ? String(row[symIdx] || "").trim() : "";
      const rawName = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : "";
      if (isGarbageRow(rawSym, rawName)) continue;

      const resolved = resolveStockIdentity(rawSym, rawName);
      if (!resolved || !resolved.symbol) continue;

      let shares = cleanNumber(row[qtyIdx]);
      if (isLotUnit && shares < 100) shares *= 1000;
      if (shares <= 0) continue;

      let unitPrice = unitPriceIdx >= 0 ? cleanNumber(row[unitPriceIdx]) : 0;
      let totalCost = totalCostIdx >= 0 ? cleanNumber(row[totalCostIdx]) : 0;

      if (totalCost === 0 && unitPrice > 0) totalCost = unitPrice * shares;
      if (unitPrice === 0 && totalCost > 0 && shares > 0) unitPrice = totalCost / shares;

      let currentPrice = curPriceIdx >= 0 ? cleanNumber(row[curPriceIdx]) : 0;
      if (currentPrice === 0 && mValIdx >= 0 && shares > 0) {
        currentPrice = cleanNumber(row[mValIdx]) / shares;
      }
      if (currentPrice === 0) currentPrice = unitPrice;

      const rowDate = dateIdx >= 0 && row[dateIdx] ? normalizeDate(row[dateIdx], lastValidDate) : lastValidDate;
      lastValidDate = rowDate;

      state.holdings.push({
        id: safeId(),
        accountId: DEFAULT_ACCOUNT_ID,
        symbol: resolved.symbol,
        name: resolved.name,
        market: resolved.market,
        currency: resolved.market === "US" ? "USD" : resolved.market === "CA" ? "CAD" : "TWD",
        buyDate: rowDate,
        shares,
        costBasis: totalCost,
        currentPrice: currentPrice || unitPrice,
        dailyChangePerShare: null,
        fees: 0,
        realizedProfit: 0,
        dividends: 0,
        custom: {},
        updatedAt: null,
      });

      state.transactions.push({
        id: safeId(),
        accountId: DEFAULT_ACCOUNT_ID,
        type: "buy",
        symbol: resolved.symbol,
        name: resolved.name,
        market: resolved.market,
        date: rowDate,
        quantity: shares,
        price: unitPrice,
        fee: Math.max(0, totalCost - (unitPrice * shares)),
        locked: true,
      });
    }

    const imported = normalizeImportedState(state);
    imported._isExternalTable = true;
    imported._isHoldingsSnapshot = true;
    return imported;
  }

  // B. 歷史交易紀錄模式
  for (const row of dataRows) {
    const rawSym = symIdx >= 0 ? String(row[symIdx] || "").trim() : "";
    const rawName = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : "";
    if (isGarbageRow(rawSym, rawName)) continue;

    const resolved = resolveStockIdentity(rawSym, rawName);
    if (!resolved || !resolved.symbol) continue;

    const rawType = typeIdx >= 0 ? String(row[typeIdx] || "").trim() : "";
    const isSell = /賣|sell|s|券賣|資賣/i.test(rawType);
    const fee = feeIdx >= 0 ? cleanNumber(row[feeIdx]) : 0;
    let qty = cleanNumber(row[qtyIdx]);
    if (isLotUnit && qty < 100) qty *= 1000;
    if (qty <= 0) continue;

    let price = unitPriceIdx >= 0 ? cleanNumber(row[unitPriceIdx]) : 0;
    if (price === 0 && totalCostIdx >= 0 && qty > 0) {
      price = cleanNumber(row[totalCostIdx]) / qty;
    }

    const rowDate = (dateIdx >= 0 && row[dateIdx]) ? normalizeDate(row[dateIdx], lastValidDate) : lastValidDate;
    lastValidDate = rowDate;

    state.transactions.push({
      id: safeId(),
      accountId: DEFAULT_ACCOUNT_ID,
      type: isSell ? "sell" : "buy",
      symbol: resolved.symbol,
      name: resolved.name,
      market: resolved.market,
      date: rowDate,
      quantity: qty,
      price,
      fee,
    });
  }

  if (state.transactions.length > 0) {
    const holdingsMap = new Map();
    const sortedTx = [...state.transactions].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    for (const tx of sortedTx) {
      const key = `${tx.accountId}:${tx.market}:${tx.symbol}`;
      let holding = holdingsMap.get(key);
      if (!holding) {
        holding = {
          id: safeId(),
          accountId: tx.accountId || DEFAULT_ACCOUNT_ID,
          symbol: tx.symbol,
          name: tx.name || tx.symbol,
          market: tx.market,
          currency: tx.market === "US" ? "USD" : tx.market === "CA" ? "CAD" : "TWD",
          buyDate: tx.date || new Date().toISOString().slice(0, 10),
          shares: 0,
          costBasis: 0,
          currentPrice: tx.price || 0,
          dailyChangePerShare: null,
          fees: 0,
          realizedProfit: 0,
          dividends: 0,
          custom: {},
          updatedAt: null,
        };
        holdingsMap.set(key, holding);
      }
      applyTransactionSafely(holding, tx);
    }
    state.holdings = Array.from(holdingsMap.values()).filter((h) => h.shares > 0);
  }

  const imported = normalizeImportedState(state);
  imported._isExternalTable = true;
  imported._isHoldingsSnapshot = false;
  return imported;
}

function parseOfficialCsv(rows, startIdx) {
  const state = {
    accounts: [],
    holdings: [],
    transactions: [],
    customFields: [],
    settings: {},
    openingBalances: {},
  };

  const header = rows[startIdx].map((c) => String(c || "").trim().toLowerCase());
  const typeIdx = header.indexOf("record_type");

  for (let i = startIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const recType = row[typeIdx];
    const dataCol = row[17];

    try {
      if (recType === "account" && dataCol) {
        state.accounts.push(JSON.parse(dataCol));
      } else if (recType === "holding" && dataCol) {
        const h = JSON.parse(dataCol);
        const resolved = resolveStockIdentity(h.symbol, h.name);
        if (resolved.name && (!h.name || h.name === h.symbol)) h.name = resolved.name;
        h.buyDate = normalizeDate(h.buyDate);
        state.holdings.push(h);
      } else if (recType === "transaction" && dataCol) {
        const t = JSON.parse(dataCol);
        const resolved = resolveStockIdentity(t.symbol, t.name);
        if (resolved.name && (!t.name || t.name === t.symbol)) t.name = resolved.name;
        t.date = normalizeDate(t.date);
        state.transactions.push(t);
      } else if (recType === "custom_field") {
        state.customFields.push({ id: row[2], name: row[4] });
      } else if (recType === "setting") {
        state.settings[row[2]] = row[17];
      } else if (recType === "opening_balance" && dataCol) {
        state.openingBalances[row[2]] = JSON.parse(dataCol);
      }
    } catch {
      console.warn("略過格式損壞之 CSV 行:", row);
    }
  }

  return normalizeImportedState(state);
}

export function parseCsvBackup(csvText) {
  const rows = parseCsvRows(csvText);
  const result = parseBrokerTableRows(rows);
  if (!result) throw new Error("無法識別此檔案欄位格式，請確保含有股票代號（或名稱）、股數以及價格（或金額）欄位。");
  return result;
}

export function serializeExcel(state) {
  if (typeof window.XLSX === "undefined") {
    throw new Error("尚未載入 Excel (SheetJS) 模組，請稍後重試或確認網路連線。");
  }

  const wb = window.XLSX.utils.book_new();

  const holdingsData = [
    ["帳戶ID", "股票代號", "股票名稱", "市場", "持有股數", "總投資成本", "目前現價", "累計股息", "累計手續費", "首次買入日"],
    ...state.holdings.map((h) => [
      h.accountId, h.symbol, h.name, h.market, h.shares, h.costBasis, h.currentPrice, h.dividends || 0, h.fees || 0, h.buyDate || "",
    ]),
  ];
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(holdingsData), "我的庫存");

  const transactionsData = [
    ["帳戶ID", "交易日期", "交易類型", "股票代號", "名稱", "市場", "股數", "單價", "手續費", "分割比例"],
    ...state.transactions.map((t) => [
      t.accountId, t.date, t.type, t.symbol, t.name, t.market, t.quantity, t.price, t.fee || 0, t.ratio || "",
    ]),
  ];
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(transactionsData), "交易紀錄");

  const accountsData = [
    ["帳戶ID", "帳戶名稱", "標籤顏色"],
    ...(state.accounts || []).map((a) => [a.id, a.name, a.color]),
  ];
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(accountsData), "投資帳戶");

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

  if (wb.Sheets["_SystemState"]) {
    const cellValue = wb.Sheets["_SystemState"]["A2"] ? wb.Sheets["_SystemState"]["A2"].v : null;
    if (cellValue) {
      return parseBackup(String(cellValue));
    }
  }

  if (wb.Sheets["我的庫存"] || wb.Sheets["交易紀錄"]) {
    const state = {
      accounts: [],
      holdings: [],
      transactions: [],
      customFields: [],
      settings: {},
      openingBalances: {},
    };

    if (wb.Sheets["投資帳戶"]) {
      const accRows = window.XLSX.utils.sheet_to_json(wb.Sheets["投資帳戶"]);
      accRows.forEach((r) => {
        if (r["帳戶名稱"]) state.accounts.push({ id: String(r["帳戶ID"] || safeId()), name: String(r["帳戶名稱"]), color: r["標籤顏色"] || "#418874" });
      });
    }

    if (wb.Sheets["交易紀錄"]) {
      const txRows = window.XLSX.utils.sheet_to_json(wb.Sheets["交易紀錄"]);
      txRows.forEach((r) => {
        const rawSym = r["股票代號"] || "";
        const rawName = r["名稱"] || "";
        if (rawSym || rawName) {
          const resolved = resolveStockIdentity(rawSym, rawName);
          state.transactions.push({
            id: safeId(),
            accountId: String(r["帳戶ID"] || DEFAULT_ACCOUNT_ID),
            type: r["交易類型"] || "buy",
            symbol: resolved.symbol,
            name: resolved.name,
            market: resolved.market,
            date: normalizeDate(r["交易日期"]),
            quantity: cleanNumber(r["股數"]),
            price: cleanNumber(r["單價"]),
            fee: cleanNumber(r["手續費"]),
            ratio: cleanNumber(r["分割比例"]),
          });
        }
      });
    }

    if (wb.Sheets["我的庫存"]) {
      const hRows = window.XLSX.utils.sheet_to_json(wb.Sheets["我的庫存"]);
      hRows.forEach((r) => {
        const rawSym = r["股票代號"] || "";
        const rawName = r["股票名稱"] || "";
        const shares = cleanNumber(r["持有股數"]);
        if ((rawSym || rawName) && shares > 0) {
          const resolved = resolveStockIdentity(rawSym, rawName);
          state.holdings.push({
            id: safeId(),
            accountId: String(r["帳戶ID"] || DEFAULT_ACCOUNT_ID),
            symbol: resolved.symbol,
            name: resolved.name,
            market: resolved.market,
            shares,
            costBasis: cleanNumber(r["總投資成本"]),
            currentPrice: cleanNumber(r["目前現價"]),
            dividends: cleanNumber(r["累計股息"]),
            fees: cleanNumber(r["累計手續費"]),
            buyDate: normalizeDate(r["首次買入日"]),
          });
        }
      });
    }

    return normalizeImportedState(state);
  }

  const aggregatedState = {
    accounts: [],
    holdings: [],
    transactions: [],
    customFields: [],
    settings: {},
    openingBalances: {},
  };
  let parsedAnySheet = false;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) continue;

    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const partial = parseBrokerTableRows(rows);

    if (partial) {
      if (partial.holdings && partial.holdings.length > 0) {
        aggregatedState.holdings.push(...partial.holdings);
      }
      if (partial.transactions && partial.transactions.length > 0) {
        aggregatedState.transactions.push(...partial.transactions);
      }
      parsedAnySheet = true;
    }
  }

  if (!parsedAnySheet || (aggregatedState.holdings.length === 0 && aggregatedState.transactions.length === 0)) {
    throw new Error("無法識別此 Excel 檔案欄位格式，請確保含有股票代號（或名稱）、股數以及價格（或金額）欄位。");
  }

  const finalState = normalizeImportedState(aggregatedState);
  finalState._isExternalTable = true;
  return finalState;
}