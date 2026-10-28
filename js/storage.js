const STORAGE_KEY = "he-xu-stock-ledger-v1";
const CLOUD_CACHE_KEY = `${STORAGE_KEY}-cloud-cache`;
const STORAGE_MODE_KEY = `${STORAGE_KEY}-storage-mode`;

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
  return {
    id: String(item.id || crypto.randomUUID()),
    symbol: String(item.symbol).toUpperCase(),
    name: String(item.name || item.symbol),
    market,
    currency,
    buyDate: String(item.buyDate || new Date().toISOString().slice(0, 10)),
    shares: Math.max(0, Number(item.shares) || 0),
    costBasis: Math.max(0, Number(item.costBasis) || 0),
    currentPrice: Math.max(0, Number(item.currentPrice) || 0),
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
    return normalizeHolding(item);
  }).filter((item) => item && item.shares > 0);

  const customFields = (parsed.customFields || []).map((field) => {
    if (!isObject(field) || !String(field.id || "").trim() || !String(field.name || "").trim()) {
      throw new Error("備份中有無效的自訂欄位。");
    }
    return { id: String(field.id), name: String(field.name) };
  });
  const transactions = parsed.transactions.map((transaction) => {
    if (!isObject(transaction)) throw new Error("備份中有無效的交易資料。");
    return transaction;
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

  return {
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
    if (!raw) return { holdings: [], customFields: [], settings: { ...DEFAULT_SETTINGS }, transactions: [], openingBalances: {} };
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) throw new Error("儲存資料格式不正確。");
    const fields = Array.isArray(parsed.customFields)
      ? parsed.customFields.filter((field) => isObject(field) && field.id && field.name).map((field) => ({ id: String(field.id), name: String(field.name) }))
      : [];
    return {
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings.map(normalizeHolding).filter((item) => item && item.shares > 0) : [],
      customFields: fields,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(isObject(parsed.settings) ? parsed.settings : {}),
        language: parsed.settings?.language === "en-US" ? "en-US" : "zh-TW",
        overviewCurrency: parsed.settings?.overviewCurrency === "USD" ? "USD" : "TWD",
        quoteProvider: parsed.settings?.quoteProvider === "yahoo" ? "yahoo" : "render-api",
        quoteApiUrl: typeof parsed.settings?.quoteApiUrl === "string" ? parsed.settings.quoteApiUrl : DEFAULT_SETTINGS.quoteApiUrl,
      },
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      openingBalances: isObject(parsed.openingBalances) ? parsed.openingBalances : {},
    };
  } catch (error) {
    console.error("無法讀取已儲存的存股資料：", error);
    return { holdings: [], customFields: [], settings: { ...DEFAULT_SETTINGS }, transactions: [], openingBalances: {}, storageError: true };
  }
}

export function saveState(state, mode = "local") {
  try {
    const serializable = {
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
