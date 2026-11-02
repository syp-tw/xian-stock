// js/storage.js - 本地儲存、雲端快取與狀態持久化模組

const STORAGE_KEY = "he-xu-stock-ledger-v1";
const CLOUD_CACHE_KEY = `${STORAGE_KEY}-cloud-cache`;
const STORAGE_MODE_KEY = `${STORAGE_KEY}-storage-mode`;

export const DEFAULT_ACCOUNT_ID = "default";

export const DEFAULT_ACCOUNTS = [
  { id: DEFAULT_ACCOUNT_ID, name: "主要帳戶", color: "#418874" }
];

export const BASE_COLUMNS = [
  { id: "symbol", label: "股票代號+名稱 / 股數", locked: true },
  { id: "currentPrice", label: "目前現價" },
  { id: "averageCost", label: "平均買入價" },
  { id: "profit", label: "帳面損益" },
  { id: "returnRate", label: "報酬率" },
  { id: "marketValue", label: "目前市值" },
  { id: "cost", label: "投資本金" },
  { id: "fees", label: "手續費" },
  { id: "dividends", label: "股息" },
  { id: "shares", label: "目前股數" },
  { id: "buyDate", label: "買入日期" },
  { id: "actions", label: "操作", locked: true },
];

export const DEFAULT_SETTINGS = {
  language: "zh-TW",
  twRate: 0.1425,
  twDiscount: 28,
  twMinimum: 0,
  usPerShare: 0.005,
  usMinimum: 0,
  fxRate: 32.5,
  caPerShare: 0,
  caMinimum: 0,
  cadFxRate: 23.5,
  overviewCurrency: "TWD",
  quoteProvider: "render-api",
  quoteApiUrl: "https://my-stock-api-nhaj.onrender.com/api/realtime?tw_codes=2330&us_symbols=AAPL",
  finnhubToken: "",
  usStreamMode: "standard",
  sortKey: "marketValue",
  sortDirection: "desc",
  columnOrder: [
    "symbol",
    "currentPrice",
    "averageCost",
    "profit",
    "returnRate",
    "marketValue",
    "cost",
    "fees",
    "dividends",
    "shares",
    "buyDate",
    "actions",
  ],
  hiddenColumns: ["buyDate", "shares"],
};

export function loadStorageMode() {
  try {
    return localStorage.getItem(STORAGE_MODE_KEY) === "cloud" ? "cloud" : "local";
  } catch (error) {
    console.error("無法讀取儲存位置設定：", error);
    return "local";
  }
}

export function saveStorageMode(mode) {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode === "cloud" ? "cloud" : "local");
    return true;
  } catch (error) {
    console.error("無法儲存儲存位置設定：", error);
    return false;
  }
}

export function hasSavedState(mode = "local") {
  try {
    return localStorage.getItem(mode === "cloud" ? CLOUD_CACHE_KEY : STORAGE_KEY) !== null;
  } catch (error) {
    console.error("無法檢查已儲存的存股資料：", error);
    return false;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeHolding(item) {
  if (!isObject(item) || !item.symbol) return null;
  const market = ["US", "CA"].includes(item.market) ? item.market : "TW";
  const currency = market === "US" ? "USD" : market === "CA" ? "CAD" : "TWD";
  const dateStr = String(item.buyDate || new Date().toISOString().slice(0, 10));
  const buyDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.slice(0, 10);

  return {
    id: String(item.id || crypto.randomUUID()),
    accountId: String(item.accountId || DEFAULT_ACCOUNT_ID),
    symbol: String(item.symbol).toUpperCase(),
    name: String(item.name || item.symbol),
    market,
    currency,
    buyDate,
    shares: Math.max(0, Number(item.shares) || 0),
    costBasis: Math.max(0, Number(item.costBasis) || 0),
    currentPrice: Math.max(0, Number(item.currentPrice) || 0),
    previousClose: item.previousClose !== null && item.previousClose !== undefined && Number.isFinite(Number(item.previousClose))
      ? Number(item.previousClose)
      : null,
    dailyChangePerShare: item.dailyChangePerShare !== null
      && item.dailyChangePerShare !== undefined
      && Number.isFinite(Number(item.dailyChangePerShare))
      ? Number(item.dailyChangePerShare)
      : null,
    fees: Math.max(0, Number(item.fees) || 0),
    realizedProfit: Number(item.realizedProfit) || 0,
    dividends: Number(item.dividends) || 0,
    custom: isObject(item.custom) ? item.custom : {},
    updatedAt: item.updatedAt || null,
  };
}

export function normalizeImportedState(parsed) {
  if (!isObject(parsed)) throw new Error("備份資料格式不正確。");
  if (!Array.isArray(parsed.holdings) || !Array.isArray(parsed.transactions)) {
    throw new Error("備份資料缺少庫存或交易清單。");
  }
  if (parsed.customFields !== undefined && !Array.isArray(parsed.customFields)) {
    throw new Error("自訂欄位資料格式不正確。");
  }
  if (parsed.settings !== undefined && !isObject(parsed.settings)) {
    throw new Error("偏好設定資料格式不正確。");
  }
  if (parsed.openingBalances !== undefined && !isObject(parsed.openingBalances)) {
    throw new Error("期初庫存資料格式不正確。");
  }

  let accounts = DEFAULT_ACCOUNTS;
  if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
    accounts = parsed.accounts.map((acc) => ({
      id: String(acc.id || crypto.randomUUID()),
      name: String(acc.name || "未命名帳戶"),
      color: String(acc.color || "#418874"),
    }));
  }

  const validAccountIds = new Set(accounts.map((a) => a.id));

  const holdings = parsed.holdings.map((item) => {
    if (!isObject(item) || !String(item.symbol || "").trim()) {
      throw new Error("備份中有無效的庫存資料。");
    }
    for (const key of ["shares", "costBasis", "currentPrice", "fees", "realizedProfit", "dividends"]) {
      if (item[key] !== undefined && !Number.isFinite(Number(item[key]))) {
        throw new Error("備份中有無效的庫存數值。");
      }
    }
    if (item.dailyChangePerShare !== undefined && item.dailyChangePerShare !== null
      && !Number.isFinite(Number(item.dailyChangePerShare))) {
      throw new Error("備份中有無效的庫存數值。");
    }
    const normalized = normalizeHolding(item);
    if (normalized && !validAccountIds.has(normalized.accountId)) {
      normalized.accountId = accounts[0].id;
    }
    return normalized;
  }).filter((item) => item && item.shares > 0);

  const customFields = (parsed.customFields || []).map((field) => {
    if (!isObject(field) || !String(field.id || "").trim() || !String(field.name || "").trim()) {
      throw new Error("備份中有無效的自訂欄位。");
    }
    return { id: String(field.id), name: String(field.name) };
  });

  const transactions = parsed.transactions.map((transaction) => {
    if (!isObject(transaction)) throw new Error("備份中有無效的交易資料。");
    const accId = String(transaction.accountId || DEFAULT_ACCOUNT_ID);
    return {
      ...transaction,
      accountId: validAccountIds.has(accId) ? accId : accounts[0].id,
    };
  });

  const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
  for (const key of ["twRate", "twDiscount", "twMinimum", "usPerShare", "usMinimum", "fxRate", "caPerShare", "caMinimum", "cadFxRate"]) {
    if (!Number.isFinite(Number(settings[key])) || Number(settings[key]) < 0) {
      throw new Error("備份中的手續費或匯率設定無效。");
    }
    settings[key] = Number(settings[key]);
  }
  if (settings.twDiscount > 100 || settings.fxRate === 0 || settings.cadFxRate === 0) {
    throw new Error("備份中的手續費或匯率設定超出有效範圍。");
  }

  settings.language = settings.language === "en-US" ? "en-US" : "zh-TW";
  settings.overviewCurrency = settings.overviewCurrency === "USD" ? "USD" : "TWD";
  settings.quoteProvider = settings.quoteProvider === "yahoo" ? "yahoo" : "render-api";
  settings.quoteApiUrl = typeof settings.quoteApiUrl === "string" ? settings.quoteApiUrl : DEFAULT_SETTINGS.quoteApiUrl;
  settings.finnhubToken = typeof settings.finnhubToken === "string" ? settings.finnhubToken : DEFAULT_SETTINGS.finnhubToken;
  settings.usStreamMode = settings.usStreamMode === "geek" ? "geek" : "standard";
  settings.sortKey = typeof settings.sortKey === "string" ? settings.sortKey : DEFAULT_SETTINGS.sortKey;
  settings.sortDirection = settings.sortDirection === "asc" ? "asc" : "desc";
  settings.columnOrder = Array.isArray(settings.columnOrder) ? settings.columnOrder : DEFAULT_SETTINGS.columnOrder;
  settings.hiddenColumns = Array.isArray(settings.hiddenColumns) ? settings.hiddenColumns : DEFAULT_SETTINGS.hiddenColumns;

  return {
    accounts,
    activeAccountId: parsed.activeAccountId || "all",
    holdings,
    customFields,
    settings,
    transactions,
    openingBalances: parsed.openingBalances || {},
  };
}

export function loadState(mode = "local") {
  try {
    const raw = localStorage.getItem(mode === "cloud" ? CLOUD_CACHE_KEY : STORAGE_KEY);
    if (!raw) {
      return {
        accounts: [...DEFAULT_ACCOUNTS],
        activeAccountId: "all",
        holdings: [],
        customFields: [],
        settings: { ...DEFAULT_SETTINGS },
        transactions: [],
        openingBalances: {},
      };
    }
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) throw new Error("儲存資料格式不正確。");

    let accounts = DEFAULT_ACCOUNTS;
    if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
      accounts = parsed.accounts.map((acc) => ({
        id: String(acc.id || crypto.randomUUID()),
        name: String(acc.name || "主要帳戶"),
        color: String(acc.color || "#418874"),
      }));
    }

    const fields = Array.isArray(parsed.customFields)
      ? parsed.customFields.filter((field) => isObject(field) && field.id && field.name).map((field) => ({ id: String(field.id), name: String(field.name) }))
      : [];

    return {
      accounts,
      activeAccountId: parsed.activeAccountId || "all",
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings.map(normalizeHolding).filter((item) => item && item.shares > 0) : [],
      customFields: fields,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(isObject(parsed.settings) ? parsed.settings : {}),
        language: parsed.settings?.language === "en-US" ? "en-US" : "zh-TW",
        overviewCurrency: parsed.settings?.overviewCurrency === "USD" ? "USD" : "TWD",
        quoteProvider: parsed.settings?.quoteProvider === "yahoo" ? "yahoo" : "render-api",
        quoteApiUrl: typeof parsed.settings?.quoteApiUrl === "string" ? parsed.settings.quoteApiUrl : DEFAULT_SETTINGS.quoteApiUrl,
        finnhubToken: typeof parsed.settings?.finnhubToken === "string" ? parsed.settings.finnhubToken : DEFAULT_SETTINGS.finnhubToken,
        usStreamMode: parsed.settings?.usStreamMode === "geek" ? "geek" : "standard",
        sortKey: parsed.settings?.sortKey || DEFAULT_SETTINGS.sortKey,
        sortDirection: parsed.settings?.sortDirection || DEFAULT_SETTINGS.sortDirection,
        columnOrder: Array.isArray(parsed.settings?.columnOrder) ? parsed.settings.columnOrder : DEFAULT_SETTINGS.columnOrder,
        hiddenColumns: Array.isArray(parsed.settings?.hiddenColumns) ? parsed.settings.hiddenColumns : DEFAULT_SETTINGS.hiddenColumns,
      },
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions.map((t) => ({ ...t, accountId: t.accountId || DEFAULT_ACCOUNT_ID })) : [],
      openingBalances: isObject(parsed.openingBalances) ? parsed.openingBalances : {},
    };
  } catch (error) {
    console.error("無法讀取已儲存的存股資料：", error);
    return {
      accounts: [...DEFAULT_ACCOUNTS],
      activeAccountId: "all",
      holdings: [],
      customFields: [],
      settings: { ...DEFAULT_SETTINGS },
      transactions: [],
      openingBalances: {},
      storageError: true,
    };
  }
}

export function saveState(state, mode = "local") {
  try {
    const serializable = {
      accounts: state.accounts || DEFAULT_ACCOUNTS,
      activeAccountId: state.activeAccountId || "all",
      holdings: state.holdings,
      customFields: state.customFields,
      settings: state.settings,
      transactions: state.transactions,
      openingBalances: state.openingBalances,
    };
    localStorage.setItem(mode === "cloud" ? CLOUD_CACHE_KEY : STORAGE_KEY, JSON.stringify(serializable));
    return true;
  } catch (error) {
    console.error("無法儲存存股資料至瀏覽器：", error);
    return false;
  }
}