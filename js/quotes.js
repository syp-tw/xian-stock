const isLocalDevelopment = window.location.protocol === "file:"
  || ["localhost", "127.0.0.1"].includes(window.location.hostname);
const isNetlify = window.location.hostname.endsWith(".netlify.app");
const apiRoot = isNetlify ? `${window.location.origin}/quote-api` : null;
const yahooApiRoot = apiRoot ? `${apiRoot}/yahoo` : "https://query1.finance.yahoo.com";
const searchUrl = `${yahooApiRoot}/v1/finance/search`;
const twseListUrl = apiRoot ? `${apiRoot}/twse/v1/opendata/t187ap03_L` : "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
const tpexListUrl = apiRoot ? `${apiRoot}/tpex/openapi/v1/mopsfin_t187ap03_O` : "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O";
let taiwanListingsPromise;

function loadTaiwanListings() {
  if (!taiwanListingsPromise) {
    taiwanListingsPromise = Promise.all([twseListUrl, tpexListUrl].map(async (url) => {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("目前無法取得台股公司清單，請改輸入股票代號或稍後再試。");
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
    ].filter((company) => /^\d{4,6}\.(TW|TWO)$/.test(company.symbol) && company.name));
    taiwanListingsPromise = taiwanListingsPromise.catch((error) => {
      taiwanListingsPromise = undefined;
      throw error;
    });
  }
  return taiwanListingsPromise;
}

async function searchTaiwanCompanyNames(query, signal) {
  const listings = await loadTaiwanListings();
  if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  const normalizedQuery = query.trim().normalize("NFC").toLocaleLowerCase();
  return listings
    .map((company) => ({
      ...company,
      matchRank: company.aliases.some((name) => name.normalize("NFC").toLocaleLowerCase() === normalizedQuery) ? 0
        : company.aliases.some((name) => name.normalize("NFC").toLocaleLowerCase().startsWith(normalizedQuery)) ? 1
          : 2,
    }))
    .filter((company) => company.aliases.some((name) => name.normalize("NFC").toLocaleLowerCase().includes(normalizedQuery)))
    .sort((a, b) => a.matchRank - b.matchRank || a.name.localeCompare(b.name, "zh-Hant"))
    .slice(0, 10)
    .map(({ matchRank, ...company }) => company);
}

function inferMarket(quote) {
  const exchange = `${quote.exchange || ""} ${quote.exchDisp || ""}`.toUpperCase();
  const symbol = String(quote.symbol || "").toUpperCase();
  if (/\.(TW|TWO)$/.test(symbol) || /TAIWAN|TAIWAN OTC|TAIPEI/.test(exchange)) return "TW";
  if (/\.(TO|V|CN|NE)$/.test(symbol) || /TORONTO|TSX|TSXV|CANADIAN SECURITIES|NEO EXCHANGE/.test(exchange)) return "CA";
  if (/NMS|NYQ|NASDAQ|NYSE|ASE|BATS|NYSE ARCA/.test(exchange)) return "US";
  if (/\.T$/.test(symbol)) return "US";
  return null;
}

function normalizedSymbol(query) {
  const symbol = query.trim().toUpperCase();
  if (/^\d{4,6}$/.test(symbol)) return `${symbol}.TW`;
  return symbol;
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
  const ticker = symbol.toUpperCase();
  const market = /\.(TW|TWO)$/.test(ticker) || /^\d+$/.test(ticker) ? "TW"
    : /\.(TO|V|CN|NE)$/.test(ticker) ? "CA" : "US";
  if (market === "CA") {
    throw new Error("目前 Render 報價 API 僅支援台股與美股；加拿大股請切換至 Yahoo Finance。");
  }
  url.searchParams.set(market === "TW" ? "tw_codes" : "us_symbols", ticker.replace(/\.(TW|TWO)$/i, ""));
  return { url, market, ticker: ticker.replace(/\.(TW|TWO)$/i, "") };
}

export async function searchQuotes(query, signal, settings = {}) {
  if (settings.quoteProvider !== "yahoo") {
    if (!isTickerQuery(query)) return [];
    const symbol = normalizedSymbol(query);
    const market = /\.(TW|TWO)$/.test(symbol) || /^\d+$/.test(symbol) ? "TW"
      : /\.(TO|V|CN|NE)$/.test(symbol) ? "CA" : "US";
    return [{
      symbol,
      name: symbol.replace(/\.(TW|TWO)$/i, ""),
      market,
      exchange: "Render API",
    }];
  }
  if (/[^\x00-\x7F]/.test(query)) return searchTaiwanCompanyNames(query, signal);
  const url = new URL(searchUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", "10");
  url.searchParams.set("newsCount", "0");
  url.searchParams.set("listsCount", "0");
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("目前無法取得報價搜尋結果，請稍後再試。");
  const data = await response.json();
  return (data.quotes || []).filter((quote) => ["EQUITY", "ETF", "MUTUALFUND"].includes(quote.quoteType) && inferMarket(quote))
    .map((quote) => ({
      symbol: quote.symbol,
      name: quote.shortname || quote.longname || quote.symbol,
      market: inferMarket(quote),
      exchange: quote.exchDisp || quote.exchange || "",
    }));
}

export async function fetchQuote(symbol, signal, settings = {}) {
  if (settings.quoteProvider !== "yahoo") {
    const { url, market, ticker } = getRenderApiUrl(settings, symbol);
    const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Render 報價 API 回應錯誤（${response.status}）。`);
    const result = await response.json();
    const quote = result?.[market === "TW" ? "tw" : "us"]?.[ticker];
    const price = Number(quote?.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Render 報價 API 未回傳有效股價，請確認股票代號。");
    const openingPrice = quote.open === null || quote.open === undefined ? NaN : Number(quote.open);
    const dailyPercent = quote.dp === null || quote.dp === undefined ? NaN : Number(quote.dp);
    const dailyChangePerShare = market === "TW"
      ? Number.isFinite(openingPrice) ? price - openingPrice : null
      : Number.isFinite(dailyPercent) ? price * dailyPercent / 100 : null;
    return {
      price,
      currency: market === "TW" ? "TWD" : "USD",
      market,
      dailyChangePerShare,
    };
  }
  const url = new URL(`${yahooApiRoot}/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1m");
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("無法取得這檔股票的即時報價。");
  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error("此股票目前沒有可用的報價資料。");
  const quote = result.indicators?.quote?.[0];
  const closes = quote?.close || [];
  let price = Number(result.meta?.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) {
    price = Number([...closes].reverse().find((close) => Number.isFinite(close) && close > 0));
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error("報價來源沒有提供有效的目前股價。");
  const currency = result.meta.currency || "USD";
  const previousClose = Number(result.meta.chartPreviousClose || result.meta.previousClose);
  const market = currency === "TWD" ? "TW" : currency === "CAD" ? "CA" : "US";
  return {
    price,
    currency,
    market,
    dailyChangePerShare: Number.isFinite(previousClose) && previousClose > 0 ? price - previousClose : null,
  };
}

export function quoteMarket(symbol) {
  if (/\.(TO|V|CN|NE)$/i.test(symbol.trim())) return "CA";
  return /\.(TW|TWO)$/i.test(symbol) || /^\d+$/.test(symbol.trim()) ? "TW" : "US";
}
