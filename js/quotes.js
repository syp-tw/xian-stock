// js/quotes.js - 行情報價、即時搜尋與多市場智慧切換服務（瘦身優化版）
import {
  isLikelyTwo,
  normalizedSymbol,
  quoteMarket,
  getStockName,
  rememberStockName,
  loadCustomDict,
  TAIWAN_STOCK_DICT,
  US_STOCK_DICT,
  TAIWAN_STOCK_ALIASES
} from "./stock-dict.js";

// 🌟 全量向前轉發字典與識別函式，確保既有模組免改 import 路徑
export * from "./stock-dict.js";

const isNetlify = window.location.hostname.endsWith(".netlify.app");
const apiRoot = isNetlify ? `${window.location.origin}/quote-api` : null;
const yahooApiRoot = apiRoot ? `${apiRoot}/yahoo` : "https://query1.finance.yahoo.com";
const searchUrl = `${yahooApiRoot}/v1/finance/search`;
const twseListUrl = apiRoot ? `${apiRoot}/twse/v1/opendata/t187ap03_L` : "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
const tpexListUrl = apiRoot ? `${apiRoot}/tpex/openapi/v1/mopsfin_t187ap03_O` : "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O";

/**
 * 判斷當前是否落在台灣證券市場開盤常規交易時間（含盤後定價撮合至 14:35）
 * 台北時間（UTC+8）週一至週五 09:00 - 14:35
 */
export function isTaiwanRegularMarketHours(timestampMs = Date.now()) {
  const date = new Date(timestampMs);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    hour12: false,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
  });

  const parts = formatter.formatToParts(date);
  let weekday = "";
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === "weekday") weekday = part.value;
    else if (part.type === "hour") hour = parseInt(part.value, 10);
    else if (part.type === "minute") minute = parseInt(part.value, 10);
  }

  if (weekday === "Sat" || weekday === "Sun") return false;

  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 540 && totalMinutes <= 875;
}

/**
 * 具備嚴格超時熔斷保護的 fetch 封裝
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  if (options.signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Request timeout")), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener("abort", () => {
      clearTimeout(timer);
      controller.abort();
    });
  }

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithCorsFallback(rawUrl, signal) {
  if (signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }

  if (isNetlify) {
    try {
      const res = await fetchWithTimeout(rawUrl, { signal, headers: { Accept: "application/json" } }, 2500);
      if (res.ok) return await res.json();
    } catch {}
  }

  try {
    const res = await fetchWithTimeout(rawUrl, { signal, headers: { Accept: "application/json" } }, 1500);
    if (res.ok) return await res.json();
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  if (signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }

  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(rawUrl)}`,
  ];

  for (const proxyUrl of proxies) {
    if (signal?.aborted) break;
    try {
      const res = await fetchWithTimeout(proxyUrl, { signal, headers: { Accept: "application/json" } }, 2800);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }

  throw new Error("無法取得報價資料，請檢查網路連線。");
}

export function getQuoteDataFromResponse(dataGroup, targetCode) {
  if (!dataGroup || typeof dataGroup !== "object" || !targetCode) return null;
  const clean = String(targetCode).replace(/^(tse_|otc_)/i, "").replace(/\.(TW|TWO)$/i, "").trim();
  const upper = clean.toUpperCase();
  const lower = clean.toLowerCase();

  const direct = dataGroup[upper] || dataGroup[lower] || dataGroup[clean]
              || dataGroup[`${upper}.TW`] || dataGroup[`${lower}.tw`]
              || dataGroup[`${upper}.TWO`] || dataGroup[`${lower}.two`]
              || dataGroup[`tse_${lower}.tw`] || dataGroup[`otc_${lower}.two`];
  if (direct) return direct;

  for (const [k, v] of Object.entries(dataGroup)) {
    const kCleanUpper = k.replace(/^(tse_|otc_)/i, "").replace(/\.(TW|TWO)$/i, "").trim().toUpperCase();
    if (kCleanUpper === upper) return v;
  }
  return null;
}

let taiwanListingsPromise;
function loadTaiwanListings() {
  if (!taiwanListingsPromise) {
    taiwanListingsPromise = Promise.all([twseListUrl, tpexListUrl].map(async (url) => {
      const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 2500);
      if (!response.ok) throw new Error("遠端清單無法取得");
      return response.json();
    })).then(([twse, tpex]) => [
      ...twse.map((company) => ({
        symbol: `${String(company["公司代號"] || "").trim()}.TW`,
        name: String(company["公司簡稱"] || company["公司名稱"] || "").trim(),
        aliases: [company["公司簡稱"], company["公司名稱"]].filter(Boolean).map((name) => String(name).trim()),
        market: "TW",
        exchange: "TWSE",
      })),
      ...tpex.map((company) => ({
        symbol: `${String(company.SecuritiesCompanyCode || "").trim()}.TWO`,
        name: String(company.CompanyAbbreviation || company.CompanyName || "").trim(),
        aliases: [company.CompanyAbbreviation, company.CompanyName].filter(Boolean).map((name) => String(name).trim()),
        market: "TW",
        exchange: "TPEx",
      })),
    ].filter((company) => /^\d{4,6}[A-Z]?\.(TW|TWO)$/.test(company.symbol) && company.name))
    .catch(() => []);
  }
  return taiwanListingsPromise;
}

function inferMarket(quote) {
  const exchange = `${quote.exchange || ""} ${quote.exchDisp || ""}`.toUpperCase();
  const symbol = String(quote.symbol || "").toUpperCase();
  if (/\.(TW|TWO)$/.test(symbol) || /TAIWAN|TAIWAN OTC|TAIPEI/.test(exchange)) return "TW";
  if (/\.(TO|V|CN|NE)$/.test(symbol) || /TORONTO|TSX|TSXV|CANADIAN SECURITIES|NEO EXCHANGE/.test(exchange)) return "CA";
  if (/NMS|NYQ|NASDAQ|NYSE|ASE|BATS|NYSE ARCA/.test(exchange)) return "US";
  return null;
}

function isTickerQuery(query) {
  return /^[A-Z0-9][A-Z0-9.^=-]{0,19}(?:\.(?:TW|TWO|TO|V|CN|NE))?$/i.test(query.trim());
}

function getRenderApiUrl(settings, symbol) {
  let url;
  try {
    url = new URL(settings.quoteApiUrl);
  } catch {
    throw new Error("Render 報價 API 網址無效，請至偏好設定確認。");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Render 報價 API 必須使用有效的 HTTPS 網址。");
  }
  url.search = "";
  url.hash = "";
  let ticker = symbol.toUpperCase().trim();
  const rawClean = ticker.replace(/\.(TW|TWO)$/i, "");
  if (TAIWAN_STOCK_ALIASES[rawClean]) {
    ticker = TAIWAN_STOCK_ALIASES[rawClean];
  }

  const market = quoteMarket(ticker);
  const clean = ticker.replace(/\.(TW|TWO)$/i, "");

  const codesParam = market === "TW"
    ? (clean.toLowerCase() !== clean.toUpperCase() ? `${clean.toUpperCase()},${clean.toLowerCase()}` : clean)
    : clean;

  url.searchParams.set(market === "TW" ? "tw_codes" : "us_symbols", codesParam);
  return { url, market, ticker: clean };
}

export async function fetchFinnhubQuote(symbol, token, signal) {
  const cleanSym = symbol.trim().toUpperCase().replace(/\.(US)$/i, "");
  const targetUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cleanSym)}&token=${encodeURIComponent(token)}`;

  const res = await fetchWithTimeout(targetUrl, { signal, headers: { Accept: "application/json" } }, 2800);
  if (!res.ok) throw new Error("Finnhub REST API 響應錯誤");

  const data = await res.json();
  const price = Number(data.c);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Finnhub 查無有效現價");
  }

  const prevClose = Number(data.pc) || null;
  const directChange = Number(data.d);
  let dailyChangePerShare = null;
  if (Number.isFinite(directChange)) {
    dailyChangePerShare = directChange;
  } else if (prevClose && prevClose > 0) {
    dailyChangePerShare = price - prevClose;
  }

  const resolvedName = getStockName(cleanSym) || cleanSym;
  rememberStockName(cleanSym, resolvedName);

  return {
    price,
    currency: "USD",
    market: "US",
    name: resolvedName,
    dailyChangePerShare,
    previousClose: prevClose,
  };
}

export async function fetchOfficialMisQuote(symbol, signal) {
  const clean = symbol.replace(/\.(TW|TWO)$/i, "").trim().toLowerCase();
  const isTwo = isLikelyTwo(symbol);
  const channel = `${isTwo ? "otc" : "tse"}_${clean}.${isTwo ? "two" : "tw"}`;
  const rawUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${channel}&_=${Date.now()}`;

  const data = await fetchWithCorsFallback(rawUrl, signal);
  const item = data?.msgArray?.[0];
  if (!item) throw new Error("MIS 查無此股票");

  const prevClose = Number(item.y) || null;
  let price = Number(item.z);
  const hasTradeToday = Number.isFinite(price) && price > 0;

  if (!hasTradeToday) {
    const bestBids = String(item.b || "").split("_");
    const bestAsks = String(item.a || "").split("_");
    price = Number(bestBids[0]) || Number(bestAsks[0]) || prevClose;
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error("MIS 查無有效現價");

  const canonical = `${clean.toUpperCase()}.${isTwo ? "TWO" : "TW"}`;
  const resolvedName = getStockName(canonical) || item.n || item.c;
  rememberStockName(canonical, resolvedName);

  const dailyChangePerShare = (hasTradeToday && prevClose) ? (price - prevClose) : null;

  return {
    price,
    currency: "TWD",
    market: "TW",
    name: resolvedName,
    dailyChangePerShare,
    previousClose: prevClose,
  };
}

async function doFetchYahooChart(symbol, signal) {
  const targetUrl = `${yahooApiRoot}/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const data = await fetchWithCorsFallback(targetUrl, signal);
  const result = data.chart?.result?.[0];
  if (!result) throw new Error("此股票目前沒有可用的報價資料。");

  const quote = result.indicators?.quote?.[0];
  const closes = (quote?.close || []).filter((close) => Number.isFinite(close) && close > 0);
  let price = Number(result.meta?.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) {
    price = Number([...closes].reverse()[0]);
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error("報價來源沒有提供有效的目前股價。");

  const currency = result.meta.currency || "USD";
  let previousClose = Number(result.meta.chartPreviousClose || result.meta.previousClose);

  if ((!Number.isFinite(previousClose) || previousClose <= 0) && closes.length >= 2) {
    previousClose = closes[closes.length - 2];
  }

  const market = currency === "TWD" ? "TW" : currency === "CAD" ? "CA" : "US";
  const resolvedName = getStockName(symbol) || result.meta?.shortName || result.meta?.longName || symbol;
  rememberStockName(symbol, resolvedName);

  return {
    price,
    currency,
    market,
    name: resolvedName,
    dailyChangePerShare: Number.isFinite(previousClose) && previousClose > 0 ? price - previousClose : null,
    previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : null,
  };
}

async function fetchYahooQuote(rawSymbol, signal) {
  let symbol = rawSymbol.trim().toUpperCase();
  const rawClean = symbol.replace(/\.(TW|TWO)$/i, "");
  if (TAIWAN_STOCK_ALIASES[rawClean]) {
    symbol = TAIWAN_STOCK_ALIASES[rawClean];
  }

  if (!/\.(TW|TWO|TO|V|CN|NE)$/i.test(symbol)) {
    const isTwo = isLikelyTwo(symbol);
    symbol = `${symbol}.${isTwo ? "TWO" : "TW"}`;
  }

  try {
    return await doFetchYahooChart(symbol, signal);
  } catch (firstErr) {
    if (signal?.aborted) throw firstErr;
    if (symbol.endsWith(".TW")) {
      const altSymbol = symbol.replace(/\.TW$/i, ".TWO");
      try {
        const res = await doFetchYahooChart(altSymbol, signal);
        return { ...res, symbol: altSymbol };
      } catch {}
    } else if (symbol.endsWith(".TWO")) {
      const altSymbol = symbol.replace(/\.TWO$/i, ".TW");
      try {
        const res = await doFetchYahooChart(altSymbol, signal);
        return { ...res, symbol: altSymbol };
      } catch {}
    }
    throw firstErr;
  }
}

export async function searchQuotes(query, signal, settings = {}) {
  let trimmed = query.trim();
  const rawClean = trimmed.replace(/\.(TW|TWO)$/i, "").toUpperCase();
  if (TAIWAN_STOCK_ALIASES[rawClean]) {
    trimmed = TAIWAN_STOCK_ALIASES[rawClean];
  }

  const normalizedQuery = trimmed.normalize("NFC").toLocaleLowerCase();
  const results = [];
  const seenSymbols = new Set();

  const mergedDict = {
    ...TAIWAN_STOCK_DICT,
    ...loadCustomDict(),
  };

  for (const [code, name] of Object.entries(mergedDict)) {
    const normName = String(name).normalize("NFC").toLocaleLowerCase();
    const normCode = String(code).toLocaleLowerCase();
    if (normName.includes(normalizedQuery) || normCode.startsWith(normalizedQuery)) {
      const isTwo = isLikelyTwo(code);
      const symbol = `${code}.${isTwo ? "TWO" : "TW"}`;
      seenSymbols.add(symbol);
      results.push({
        symbol,
        name,
        market: "TW",
        exchange: isTwo ? "TPEx" : "TWSE",
        matchRank: normName === normalizedQuery || normCode === normalizedQuery ? 0
          : normName.startsWith(normalizedQuery) || normCode.startsWith(normalizedQuery) ? 1 : 2,
      });
    }
  }

  for (const [symbol, name] of Object.entries(US_STOCK_DICT)) {
    const normName = name.normalize("NFC").toLocaleLowerCase();
    const normSym = symbol.toLocaleLowerCase();
    if (normName.includes(normalizedQuery) || normSym.startsWith(normalizedQuery)) {
      if (!seenSymbols.has(symbol)) {
        seenSymbols.add(symbol);
        results.push({
          symbol,
          name,
          market: "US",
          exchange: "US",
          matchRank: normSym === normalizedQuery ? 0 : 1,
        });
      }
    }
  }

  if (/[^\x00-\x7F]/.test(trimmed)) {
    try {
      const onlineList = await loadTaiwanListings();
      if (!signal?.aborted && Array.isArray(onlineList)) {
        for (const item of onlineList) {
          if (!seenSymbols.has(item.symbol)) {
            const match = item.aliases?.some((a) => a.normalize("NFC").toLocaleLowerCase().includes(normalizedQuery));
            if (match) {
              seenSymbols.add(item.symbol);
              results.push({
                ...item,
                matchRank: item.name.toLocaleLowerCase() === normalizedQuery ? 0 : 1,
              });
              rememberStockName(item.symbol, item.name);
            }
          }
        }
      }
    } catch {}
  }

  if (settings.quoteProvider === "yahoo" && !/[^\x00-\x7F]/.test(trimmed)) {
    try {
      const rawSearch = `${yahooApiRoot}/v1/finance/search?q=${encodeURIComponent(trimmed)}&quotesCount=8&newsCount=0&listsCount=0`;
      const data = await fetchWithCorsFallback(rawSearch, signal);
      const yahooQuotes = (data.quotes || [])
        .filter((quote) => ["EQUITY", "ETF", "MUTUALFUND"].includes(quote.quoteType) && inferMarket(quote))
        .map((quote) => ({
          symbol: quote.symbol,
          name: getStockName(quote.symbol) || quote.shortname || quote.longname || quote.symbol,
          market: inferMarket(quote),
          exchange: quote.exchDisp || quote.exchange || "",
          matchRank: quote.symbol.toUpperCase() === trimmed.toUpperCase() ? 0 : 2,
        }));
      for (const yq of yahooQuotes) {
        if (!seenSymbols.has(yq.symbol)) {
          seenSymbols.add(yq.symbol);
          results.push(yq);
          rememberStockName(yq.symbol, yq.name);
        }
      }
    } catch {}
  }

  if (results.length === 0 && isTickerQuery(trimmed)) {
    const symbol = normalizedSymbol(trimmed);
    const market = quoteMarket(symbol);
    const name = getStockName(symbol) || symbol.replace(/\.(TW|TWO)$/i, "");
    results.push({
      symbol,
      name,
      market,
      exchange: market === "TW" ? (symbol.endsWith(".TWO") ? "TPEx" : "TWSE") : market === "CA" ? "TSX" : "US",
      matchRank: 0,
    });
  }

  results.sort((a, b) => (a.matchRank ?? 2) - (b.matchRank ?? 2));
  return results.slice(0, 10);
}

export async function fetchQuote(symbol, signal, settings = {}, options = {}) {
  const targetMarket = quoteMarket(symbol);
  const skipRender = Boolean(options.skipRender);

  // 1. 若美股有設定 Finnhub Token，優先直連官方 REST API
  if (targetMarket === "US" && settings.finnhubToken) {
    try {
      return await fetchFinnhubQuote(symbol, settings.finnhubToken, signal);
    } catch (finnhubErr) {
      if (signal?.aborted) throw finnhubErr;
    }
  }

  // 2. 只有手動指定走 Yahoo 或加拿大股才走前端直連 Yahoo
  if (skipRender || settings.quoteProvider === "yahoo" || targetMarket === "CA") {
    return fetchYahooQuote(symbol, signal);
  }

  // 3. 其餘情況統一透過後端 API 代理
  try {
    const { url, market, ticker } = getRenderApiUrl(settings, symbol);
    const response = await fetchWithTimeout(url, { signal, headers: { Accept: "application/json" } }, 3500);
    if (!response.ok) throw new Error();

    const result = await response.json();
    const dataPool = result?.[market === "TW" ? "tw" : "us"] || {};
    const quote = getQuoteDataFromResponse(dataPool, ticker);

    const price = Number(quote?.price ?? quote?.c);
    if (!Number.isFinite(price) || price <= 0) throw new Error();

    const prevClose = quote?.pc ?? quote?.prev_close ?? quote?.yesterday_close ?? quote?.previousClose ?? NaN;
    const directChange = quote?.d ?? quote?.change ?? NaN;

    let dailyChangePerShare = null;
    if (Number.isFinite(Number(directChange))) {
      dailyChangePerShare = Number(directChange);
    } else if (Number.isFinite(Number(prevClose)) && Number(prevClose) > 0) {
      dailyChangePerShare = price - Number(prevClose);
    }

    const resolvedName = getStockName(symbol) || quote?.name || quote?.n || symbol;
    rememberStockName(symbol, resolvedName);

    return {
      price,
      currency: market === "TW" ? "TWD" : "USD",
      market,
      name: resolvedName,
      dailyChangePerShare,
      previousClose: Number.isFinite(Number(prevClose)) ? Number(prevClose) : null,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    if (targetMarket === "TW" && isTaiwanRegularMarketHours()) {
      try {
        return await fetchOfficialMisQuote(symbol, signal);
      } catch {}
    }
    return await fetchYahooQuote(symbol, signal);
  }
}