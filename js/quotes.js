// js/quotes.js - 行情報價、即時搜尋、離線中文股名字典、自動記憶庫與多市場智慧切換服務
const isNetlify = window.location.hostname.endsWith(".netlify.app");
const apiRoot = isNetlify ? `${window.location.origin}/quote-api` : null;
const yahooApiRoot = apiRoot ? `${apiRoot}/yahoo` : "https://query1.finance.yahoo.com";
const searchUrl = `${yahooApiRoot}/v1/finance/search`;
const twseListUrl = apiRoot ? `${apiRoot}/twse/v1/opendata/t187ap03_L` : "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
const tpexListUrl = apiRoot ? `${apiRoot}/tpex/openapi/v1/mopsfin_t187ap03_O` : "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O";

// 1. 本地核心台股與熱門 ETF 對照庫（免受 CORS 限制，0ms 秒查）
export const TAIWAN_STOCK_DICT = {
  // === 熱門 ETF ===
  "0050": "元大台灣50", "0051": "元大中型100", "0052": "富邦科技", "0056": "元大高股息",
  "006208": "富邦台50", "00692": "富邦公司治理", "00713": "元大台灣高息低波", "00730": "富邦臺灣優質高息",
  "00731": "復華富時高息低波", "00878": "國泰永續高股息", "00881": "國泰台灣5G+", "00891": "中信關鍵半導體",
  "00892": "富邦台灣半導體", "00893": "國泰智能電動車", "00895": "富邦未來車", "00900": "富邦特選高股息30",
  "00915": "凱基優選高股息30", "00918": "大華優利高填息30", "00919": "群益台灣精選高息", "00922": "國泰台灣領袖50",
  "00923": "群益台ESG低碳50", "00927": "群益半導體收益", "00929": "復華台灣科技優息", "00930": "永豐ESG低碳高息",
  "00932": "兆豐永續高息等權", "00934": "中信成長高股息", "00935": "野村臺灣新科技50", "00936": "台新臺灣永續高息",
  "00939": "統一台灣高息動能", "00940": "元大台灣價值高息", "00944": "野村趨勢動能高息", "00946": "群益科技高息成長",
  "00679B": "元大美債20年", "00687B": "國泰20年美債", "00937B": "群益ESG投等債20+", "00933B": "國泰10Y+金融債",
  "00720B": "元大投資級公司債", "00751B": "元大AAA至A公司債", "00772B": "中信高評級公司債",

  // === 權值電子與半導體 ===
  "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2308": "台達電", "2382": "廣達",
  "2303": "聯電", "3711": "日月光投控", "2412": "中華電", "2357": "華碩", "3231": "緯創",
  "2376": "技嘉", "2377": "微星", "2395": "研華", "3034": "聯詠", "3037": "欣興",
  "2408": "南亞科", "2344": "華邦電", "2337": "旺宏", "2327": "國巨", "3008": "大立光",
  "6488": "環球晶", "5347": "世界", "3443": "創意", "3661": "世芯-KY", "6669": "緯穎",
  "2356": "英業達", "2324": "仁寶", "2353": "宏碁", "4938": "和碩", "3045": "台灣大",
  "4904": "遠傳", "2301": "光寶科", "2474": "可成", "2354": "鴻準", "3017": "奇鋐",
  "3324": "雙鴻", "3529": "力旺", "5269": "祥碩", "5274": "信驊", "6770": "力積電",
  "6415": "矽力*-KY", "8069": "元太", "2409": "友達", "3481": "群創",

  // === 金融類股 ===
  "2881": "富邦金", "2882": "國泰金", "2891": "中信金", "2886": "兆豐金", "2884": "玉山金",
  "2892": "第一金", "2880": "華南金", "2885": "元大金", "2887": "台新金", "2890": "永豐金",
  "2801": "彰銀", "5880": "合庫金", "5876": "上海商銀", "2883": "凱基金", "2888": "新光金",
  "2834": "臺企銀", "2812": "台中銀", "2838": "聯邦銀", "2889": "國票金", "5871": "中租-KY",

  // === 傳產、航運與重要指標 ===
  "2603": "長榮", "2609": "陽明", "2615": "萬海", "2610": "華航", "2618": "長榮航",
  "2002": "中鋼", "1101": "台泥", "1102": "亞泥", "1301": "台塑", "1303": "南亞",
  "1326": "台化", "6505": "台塑化", "1216": "統一", "2207": "和泰車", "2201": "裕隆",
  "1402": "遠東新", "9904": "寶成", "9910": "豐泰", "2912": "統一超", "5904": "寶雅",
  "1795": "美時", "6472": "保瑞", "6446": "藥華藥", "1513": "中興電", "1519": "華城",
  "1504": "東元", "1503": "士電", "1605": "華新",
};

// 常用美股中英對照
export const US_STOCK_DICT = {
  "AAPL": "Apple (蘋果)", "MSFT": "Microsoft (微軟)", "NVDA": "NVIDIA (輝達)", "TSM": "TSMC ADR (台積電)",
  "GOOGL": "Alphabet (谷歌A)", "GOOG": "Alphabet (谷歌C)", "AMZN": "Amazon (亞馬遜)", "META": "Meta (臉書)",
  "TSLA": "Tesla (特斯拉)", "AMD": "AMD (超微)", "AVGO": "Broadcom (博通)", "QCOM": "Qualcomm (高通)",
  "INTC": "Intel (英特爾)", "ASML": "ASML (艾司摩爾)", "NFLX": "Netflix (網飛)", "COST": "Costco (好市多)",
  "BRK.B": "波克夏B", "V": "Visa", "DIS": "Disney (迪士尼)", "VOO": "Vanguard 標普500 ETF",
  "QQQ": "Invesco 納斯達克100 ETF", "SPY": "SPDR 標普500 ETF", "VT": "Vanguard 全球股票 ETF", "VTI": "Vanguard 全美市場 ETF",
};

// 2. 本地自適應學習庫（自動記憶使用者查詢或編輯過的冷門股）
const CUSTOM_DICT_STORAGE_KEY = "xian-stock-custom-dict";
function loadCustomDict() {
  try {
    const raw = localStorage.getItem(CUSTOM_DICT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function rememberStockName(symbol, name) {
  if (!symbol || !name || symbol === name) return;
  const rawCode = symbol.trim().toUpperCase().replace(/\.(TW|TWO|TO|V|CN|NE)$/i, "");
  const customDict = loadCustomDict();
  if (customDict[rawCode] !== name) {
    customDict[rawCode] = name;
    try {
      localStorage.setItem(CUSTOM_DICT_STORAGE_KEY, JSON.stringify(customDict));
    } catch {}
  }
}

// 3. 自動探測專案內的 data/tw-stocks.json（若有的話）
let fullStockDict = null;
async function fetchFullStockDict() {
  if (fullStockDict) return fullStockDict;
  try {
    const res = await fetch("./data/tw-stocks.json");
    if (res.ok) {
      fullStockDict = await res.json();
      return fullStockDict;
    }
  } catch {}
  return null;
}
fetchFullStockDict();

// 代號或名稱自動解析器（優先序：全量檔案 -> 自訂記憶庫 -> 內建常用庫）
export function getStockName(symbolOrQuery) {
  if (!symbolOrQuery) return null;
  const clean = String(symbolOrQuery).trim().toUpperCase();
  const rawCode = clean.replace(/\.(TW|TWO|TO|V|CN|NE)$/i, "");

  const customDict = loadCustomDict();

  return (fullStockDict && (fullStockDict[rawCode] || fullStockDict[clean]))
    || customDict[rawCode]
    || customDict[clean]
    || TAIWAN_STOCK_DICT[rawCode]
    || TAIWAN_STOCK_DICT[clean]
    || US_STOCK_DICT[clean]
    || null;
}

let taiwanListingsPromise;
function loadTaiwanListings() {
  if (!taiwanListingsPromise) {
    taiwanListingsPromise = Promise.all([twseListUrl, tpexListUrl].map(async (url) => {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
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
    ].filter((company) => /^\d{4,6}\.(TW|TWO)$/.test(company.symbol) && company.name))
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

  url.searchParams.set(market === "TW" ? "tw_codes" : "us_symbols", ticker.replace(/\.(TW|TWO)$/i, ""));
  return { url, market, ticker: ticker.replace(/\.(TW|TWO)$/i, "") };
}

async function fetchYahooQuote(symbol, signal) {
  const url = new URL(`${yahooApiRoot}/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1m");
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("無法取得即時報價，請確認股票代號。");

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

  // 自動擷取股名並記憶
  const resolvedName = getStockName(symbol) || result.meta?.shortName || result.meta?.longName || symbol;
  rememberStockName(symbol, resolvedName);

  return {
    price,
    currency,
    market,
    name: resolvedName,
    dailyChangePerShare: Number.isFinite(previousClose) && previousClose > 0 ? price - previousClose : null,
  };
}

export async function searchQuotes(query, signal, settings = {}) {
  const trimmed = query.trim();
  const normalizedQuery = trimmed.normalize("NFC").toLocaleLowerCase();
  const results = [];
  const seenSymbols = new Set();

  const mergedDict = {
    ...TAIWAN_STOCK_DICT,
    ...loadCustomDict(),
    ...(fullStockDict || {})
  };

  // 1. 本地字典 0ms 秒速模糊搜尋（含自動記憶庫）
  for (const [code, name] of Object.entries(mergedDict)) {
    const normName = String(name).normalize("NFC").toLocaleLowerCase();
    const normCode = String(code).toLocaleLowerCase();
    if (normName.includes(normalizedQuery) || normCode.startsWith(normalizedQuery)) {
      const isTwo = /^(?:6488|5347|8069|3529|5274|6770|6472|6446)/.test(code);
      const symbol = `${code}.${isTwo ? "TWO" : "TW"}`;
      seenSymbols.add(symbol);
      results.push({
        symbol,
        name,
        market: "TW",
        exchange: isTwo ? "TPEx" : "TWSE",
        matchRank: normName === normalizedQuery || normCode === normalizedQuery ? 0
          : normName.startsWith(normalizedQuery) || normCode.startsWith(normalizedQuery) ? 1 : 2
      });
    }
  }

  // 2. 本地常用美股比對
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
          matchRank: normSym === normalizedQuery ? 0 : 1
        });
      }
    }
  }

  // 3. 補充證交所線上公開清單（若可用且未被阻擋）
  if (/[^\x00-\x7F]/.test(trimmed)) {
    try {
      const onlineList = await loadTaiwanListings();
      if (!signal?.aborted && Array.isArray(onlineList)) {
        for (const item of onlineList) {
          if (!seenSymbols.has(item.symbol)) {
            const match = item.aliases?.some((a) => a.normalize("NFC").toLocaleLowerCase().includes(normalizedQuery));
            if (match) {
              seenSymbols.add(item.symbol);
              results.push(item);
              rememberStockName(item.symbol, item.name);
            }
          }
        }
      }
    } catch {}
  }

  // 4. Yahoo 全市場搜尋 API 補充
  if (settings.quoteProvider === "yahoo" && !/[^\x00-\x7F]/.test(trimmed)) {
    try {
      const url = new URL(searchUrl);
      url.searchParams.set("q", trimmed);
      url.searchParams.set("quotesCount", "8");
      url.searchParams.set("newsCount", "0");
      url.searchParams.set("listsCount", "0");
      const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
      if (response.ok) {
        const data = await response.json();
        const yahooQuotes = (data.quotes || [])
          .filter((quote) => ["EQUITY", "ETF", "MUTUALFUND"].includes(quote.quoteType) && inferMarket(quote))
          .map((quote) => ({
            symbol: quote.symbol,
            name: getStockName(quote.symbol) || quote.shortname || quote.longname || quote.symbol,
            market: inferMarket(quote),
            exchange: quote.exchDisp || quote.exchange || "",
          }));
        for (const yq of yahooQuotes) {
          if (!seenSymbols.has(yq.symbol)) {
            seenSymbols.add(yq.symbol);
            results.push(yq);
            rememberStockName(yq.symbol, yq.name);
          }
        }
      }
    } catch {}
  }

  // 5. 保底代號推算
  if (results.length === 0 && isTickerQuery(trimmed)) {
    const symbol = normalizedSymbol(trimmed);
    const market = quoteMarket(symbol);
    const name = getStockName(symbol) || symbol.replace(/\.(TW|TWO)$/i, "");
    results.push({
      symbol,
      name,
      market,
      exchange: market === "TW" ? "TWSE" : market === "CA" ? "TSX" : "US",
    });
  }

  return results.slice(0, 10);
}

export async function fetchQuote(symbol, signal, settings = {}) {
  const targetMarket = quoteMarket(symbol);

  // 加拿大股或 Yahoo 模式一律調用 Yahoo Finance
  if (settings.quoteProvider === "yahoo" || targetMarket === "CA") {
    return fetchYahooQuote(symbol, signal);
  }

  // 台股與美股調用 Render API
  const { url, market, ticker } = getRenderApiUrl(settings, symbol);
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Render 報價 API 回應錯誤（${response.status}）。`);

  const result = await response.json();
  const quote = result?.[market === "TW" ? "tw" : "us"]?.[ticker];

  const price = Number(quote?.price ?? quote?.c);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Render 報價 API 未回傳有效股價，請確認股票代號。");
  }

  const openingPrice = quote?.open == null ? NaN : Number(quote.open);
  const prevClose = quote?.pc ?? quote?.prev_close ?? quote?.yesterday_close ?? quote?.previousClose ?? NaN;
  const directChange = quote?.d ?? quote?.change ?? NaN;
  const dailyPercent = quote?.dp == null ? NaN : Number(quote.dp);

  let dailyChangePerShare = null;
  if (Number.isFinite(Number(directChange))) {
    dailyChangePerShare = Number(directChange);
  } else if (Number.isFinite(Number(prevClose)) && Number(prevClose) > 0) {
    dailyChangePerShare = price - Number(prevClose);
  } else if (Number.isFinite(dailyPercent)) {
    dailyChangePerShare = (price * dailyPercent) / 100;
  } else if (market === "TW" && Number.isFinite(openingPrice)) {
    dailyChangePerShare = price - openingPrice;
  }

  // 自動解析中文股票名稱並存入記憶庫
  const resolvedName = getStockName(symbol) || quote?.name || quote?.n || quote?.shortName || symbol;
  rememberStockName(symbol, resolvedName);

  return {
    price,
    currency: market === "TW" ? "TWD" : "USD",
    market,
    name: resolvedName,
    dailyChangePerShare,
  };
}

export function quoteMarket(symbol) {
  if (/\.(TO|V|CN|NE)$/i.test(symbol.trim())) return "CA";
  return /\.(TW|TWO)$/i.test(symbol) || /^\d+$/.test(symbol.trim()) ? "TW" : "US";
}