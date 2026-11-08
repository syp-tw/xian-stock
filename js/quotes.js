// js/quotes.js - 行情報價、即時搜尋、離線中文股名字典、自動記憶庫與多市場智慧切換服務
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
 * 具備嚴格超時熔斷保護的 fetch 封裝，防止任何單一網路請求永久掛起
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

export const TAIWAN_STOCK_DICT = {
  // === 熱門市值型、科技、海外與主動型 ETF ===
  "0050": "元大台灣50", "0051": "元大中型100", "0052": "富邦科技", "0056": "元大高股息",
  "006208": "富邦台50", "00662": "富邦NASDAQ", "00692": "富邦公司治理", "00713": "元大台灣高息低波",
  "00730": "富邦臺灣優質高息", "00731": "復華富時高息低波", "00757": "統一FANG+", "00830": "國泰費城半導體",
  "00878": "國泰永續高股息", "00881": "國泰台灣5G+", "00891": "中信關鍵半導體", "00892": "富邦台灣半導體",
  "00893": "國泰智能電動車", "00895": "富邦未來車", "00900": "富邦特選高股息30", "00915": "凱基優選高股息30",
  "00918": "大華優利高填息30", "00919": "群益台灣精選高息", "00922": "國泰台灣領袖50", "00923": "群益台ESG低碳50",
  "00927": "群益半導體收益", "00929": "復華台灣科技優息", "00930": "永豐ESG低碳高息", "00932": "兆豐永續高息等權",
  "00934": "中信成長高股息", "00935": "野村臺灣新科技50", "00936": "台新臺灣永續高息", "00939": "統一台灣高息動能",
  "00940": "元大台灣價值高息", "00941": "中信上游半導體", "00943": "兆豐電子高息等權", "00944": "野村趨勢動能高息",
  "00946": "群益科技高息成長", "00947": "台新臺灣IC設計", "00949": "復華日本龍頭", "00951": "台新日本半導體",
  "00952": "凱基台灣AI 50", "00961": "FT臺灣永續高息", "00962": "台新AI優息動能", "009811": "統一美國50",
  "00981A": "主動統一台股增長", "00403A": "主動統一升級50", "00406A": "主動中信台灣收益", "009816": "凱基台灣TOP50",

  // === 正二 (Leveraged 2X) 與反一 (Inverse) 槓桿 ETF ===
  "00631L": "元大台灣50正2", "00685L": "群益臺灣加權正2", "00675L": "富邦臺灣加權正2",
  "00670L": "富邦NASDAQ正2", "00672L": "元大S&P原油正2", "00715L": "期街口布蘭特正2",
  "00680L": "元大美債20正2", "00663L": "國泰臺灣加權正2", "00633L": "富邦上証正2",
  "00637L": "元大滬深300正2", "00655L": "國泰中國A50正2",
  "00632R": "元大台灣50反1", "00671R": "富邦NASDAQ反1", "00676R": "富邦臺灣加權反1",
  "00686R": "群益臺灣加權反1", "00681R": "元大美債20反1", "00664R": "國泰臺灣加權反1",
  "00634R": "富邦上証反1", "00638R": "元大滬深300反1", "00656R": "國泰中國A50反1",

  // === 債券 ETF ===
  "00937B": "群益ESG投等債20+", "00942B": "台新美A公司債20+", "00679B": "元大美債20年", "00687B": "國泰20年美債",
  "00933B": "國泰10Y+金融債", "00720B": "元大投資級公司債", "00751B": "元大AAA至A公司債", "00772B": "中信高評級公司債",
  "00725B": "國泰投資級公司債", "00740B": "富邦全球投等債", "00746B": "富邦A級公司債", "00761B": "國泰A級公司債",
  "00773B": "中信優先金融債", "00788B": "元大10年IG銀行債", "00795B": "中信美國公債20年", "00724B": "群益投資級金融債",
  "00754B": "群益AAA-AA公司債", "00948B": "中信優息投資級債", "00945B": "凱基美國非投等債", "00953B": "群益優選非投等債",
  "00957B": "中信特選非投等債",

  // === 權值電子、半導體與熱門股票 ===
  "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2308": "台達電", "2382": "廣達",
  "2303": "聯電", "3711": "日月光投控", "2412": "中華電", "2357": "華碩", "3231": "緯創",
  "2376": "技嘉", "2377": "微星", "2395": "研華", "3034": "聯詠", "3037": "欣興",
  "2408": "南亞科", "2344": "華邦電", "2337": "旺宏", "2327": "國巨", "3008": "大立光",
  "2356": "英業達", "2324": "仁寶", "2353": "宏碁", "4938": "和碩", "3045": "台灣大",
  "4904": "遠傳", "2301": "光寶科", "2474": "可成", "2354": "鴻準", "3017": "奇鋐",
  "3324": "雙鴻", "6669": "緯穎", "3661": "世芯-KY", "3443": "創意",

  // === 經典傳產、食品、塑膠、紡織 ===
  "1101": "台泥", "1102": "亞泥", "1203": "味王", "1215": "卜蜂", "1216": "統一",
  "1217": "愛之味", "1218": "泰山", "1301": "台塑", "1303": "南亞", "1308": "亞聚",
  "1309": "台達化", "1310": "台苯", "1312": "國喬", "1314": "中石化", "1316": "上曜",
  "1325": "恆大", "1326": "台化", "1337": "再生-KY", "1338": "廣華-KY", "1340": "勝悅-KY",
  "1432": "大魯閣", "1440": "南紡", "1449": "佳和", "1452": "宏益", "1471": "首利",

  // === 機電、線纜、化學、生醫 ===
  "1503": "士電", "1504": "東元", "1513": "中興電", "1519": "華城", "1524": "耿鼎",
  "1526": "日馳", "1527": "鑽全", "1528": "恩德", "1536": "和大", "1540": "喬福",
  "1565": "精華", "1570": "力肯", "1582": "信錦", "1584": "精剛", "1589": "永冠-KY",
  "1591": "駿吉-KY", "1604": "聲寶", "1605": "華新", "1609": "大亞", "1611": "中電",
  "1707": "葡萄王", "1708": "東鹼", "1709": "和益", "1712": "興農", "1714": "和桐",
  "1718": "中纖", "1722": "台肥", "1723": "中碳", "1724": "國慶科技", "1733": "五鼎",
  "1734": "杏輝", "1737": "臺鹽", "1781": "合世", "1783": "和康生", "1784": "訊聯",
  "1785": "光洋科", "1786": "科妍", "1815": "富喬", "1904": "正隆", "1909": "榮成",

  // === 鋼鐵、汽車、航運 ===
  "2002": "中鋼", "2012": "春雨", "2014": "中鴻", "2020": "美亞", "2022": "聚亨",
  "2023": "燁輝", "2024": "志聯", "2025": "千興", "2030": "彰源", "2031": "新光鋼",
  "2069": "世豐", "2102": "泰豐", "2104": "國際中橡", "2108": "南帝", "2201": "裕隆",
  "2206": "三陽工業", "2207": "和泰車", "2208": "台船", "2603": "長榮", "2605": "新興",
  "2609": "陽明", "2610": "華航", "2611": "志信", "2612": "中航", "2613": "中櫃",
  "2614": "東森", "2615": "萬海", "2616": "山隆", "2618": "長榮航", "2636": "台驊控股",
  "2641": "正德",

  // === 金融、觀光、百貨 ===
  "2705": "六福", "2727": "王品", "2734": "易飛網", "2801": "彰銀", "2812": "台中銀",
  "2834": "臺企銀", "2838": "聯邦銀", "2880": "華南金", "2881": "富邦金", "2882": "國泰金",
  "2883": "凱基金", "2884": "玉山金", "2885": "元大金", "2886": "兆豐金", "2887": "台新金",
  "2889": "國票金", "2890": "永豐金", "2891": "中信金", "2892": "第一金", "2912": "統一超",
  "2913": "農林", "2929": "淘帝-KY", "5871": "中租-KY", "5876": "上海商銀", "5880": "合庫金",

  // === 其它代表性中小型與熱門個股 ===
  "3008": "大立光", "3017": "奇鋐", "3037": "欣興", "3231": "緯創", "3293": "鈊象",
  "3443": "創意", "3529": "力旺", "3661": "世芯-KY", "4966": "譜瑞-KY", "5274": "信驊",
  "5347": "世界", "5483": "中美晶", "6446": "藥華藥", "6472": "保瑞", "6488": "環球晶",
  "6669": "緯穎", "8069": "元太", "8299": "群聯"
};

export const US_STOCK_DICT = {
  "AAPL": "Apple (蘋果)", "MSFT": "Microsoft (微軟)", "NVDA": "NVIDIA (輝達)", "TSM": "TSMC ADR (台積電)",
  "GOOGL": "Alphabet (谷歌A)", "GOOG": "Alphabet (谷歌C)", "AMZN": "Amazon (亞馬遜)", "META": "Meta (臉書)",
  "TSLA": "Tesla (特斯拉)", "AMD": "AMD (超微)", "AVGO": "Broadcom (博通)", "QCOM": "Qualcomm (高通)",
  "INTC": "Intel (英特爾)", "ASML": "ASML (艾司摩爾)", "NFLX": "Netflix (網飛)", "COST": "Costco (好市多)",
  "BRK.B": "波克夏B", "V": "Visa", "DIS": "Disney (迪士尼)", "VOO": "Vanguard 標普500 ETF",
  "QQQ": "Invesco 納斯達克100 ETF", "SPY": "SPDR 標普500 ETF", "VT": "Vanguard 全球股票 ETF", "VTI": "Vanguard 全美市場 ETF",
  "F": "Ford (福特汽車)",
};

export const TAIWAN_STOCK_ALIASES = {
  "00631": "00631L", "00632": "00632R", "00685": "00685L", "00686": "00686R",
  "00675": "00675L", "00676": "00676R", "00670": "00670L", "00671": "00671R",
  "00679": "00679B", "00687": "00687B", "00937": "00937B", "00942": "00942B",
  "00933": "00933B", "00720": "00720B", "00751": "00751B", "00772": "00772B",
  "00948": "00948B", "00945": "00945B", "00953": "00953B",
};

const KNOWN_TPEX_CODES = new Set([
  "1565", "1584", "1591", "1781", "1784", "1785", "1786", "1815", "2069", "2641",
  "2734", "3095", "3105", "3118", "3122", "3128", "3131", "3169", "3176", "3209",
  "3213", "3221", "3228", "3236", "3268", "3276", "3290", "3293", "3313", "3322",
  "3323", "3325", "3339", "3360", "3372", "3390", "3438", "3455", "3498", "3499",
  "3508", "3520", "3527", "3529", "3537", "3540", "3541", "3543", "3548", "3552",
  "3556", "3580", "3587", "3588", "3646", "3687", "4105", "4109", "4114", "4128",
  "4132", "4133", "4147", "4150", "4160", "4162", "4167", "4171", "4174", "4303",
  "4416", "4510", "4513", "4523", "4533", "4541", "4543", "4552", "4714", "4735",
  "4743", "4744", "4746", "4754", "4903", "4909", "4916", "4923", "4931", "4939",
  "4953", "4973", "4974", "5009", "5011", "5014", "5202", "5210", "5222", "5227",
  "5272", "5274", "5315", "5347", "5351", "5356", "5398", "5410", "5425", "5452",
  "5471", "5481", "5483", "5488", "5490", "5498", "6104", "6109", "6114", "6125",
  "6126", "6127", "6143", "6156", "6160", "6169", "6179", "6180", "6182", "6185",
  "6186", "6204", "6207", "6217", "6221", "6224", "6233", "6237", "6244", "6248",
  "6261", "6266", "6274", "6276", "6284", "6411", "6415", "6419", "6432", "6441",
  "6446", "6470", "6472", "6485", "6488", "6492", "6494", "6517", "6530", "6532",
  "6538", "6547", "6549", "6558", "6576", "6586", "6588", "6593", "6598", "6621",
  "6727", "6797", "6799", "6810", "6886", "6926", "8027", "8048", "8054", "8064",
  "8069", "8076", "8086", "8088", "8092", "8096", "8107", "8111", "8171", "8222",
  "8227", "8299", "8383", "8431", "8435", "8436", "8440", "8443", "8936"
]);

export function isLikelyTwo(codeOrSymbol) {
  if (!codeOrSymbol) return false;
  const clean = String(codeOrSymbol).trim().toUpperCase().replace(/\.(TW|TWO)$/i, "");
  if (/^00\d{3,4}B$/i.test(clean)) return true;
  return KNOWN_TPEX_CODES.has(clean);
}

export function normalizedSymbol(query) {
  let symbol = query.trim().toUpperCase();
  if (/\.(TW|TWO|TO|V|CN|NE)$/i.test(symbol)) return symbol;
  const rawClean = symbol.replace(/\.(TW|TWO)$/i, "");
  if (TAIWAN_STOCK_ALIASES[rawClean]) {
    symbol = TAIWAN_STOCK_ALIASES[rawClean];
  }
  if (/^\d{4,6}[A-Z]?$/.test(symbol)) {
    const isTwo = isLikelyTwo(symbol);
    return `${symbol}.${isTwo ? "TWO" : "TW"}`;
  }
  return symbol;
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

export function getStockName(symbolOrQuery) {
  if (!symbolOrQuery) return null;
  let clean = String(symbolOrQuery).trim().toUpperCase();
  clean = clean.replace(/\.(TW|TWO|TO|V|CN|NE)$/i, "");
  if (TAIWAN_STOCK_ALIASES[clean]) {
    clean = TAIWAN_STOCK_ALIASES[clean];
  }
  const customDict = loadCustomDict();

  return TAIWAN_STOCK_DICT[clean]
    || customDict[clean]
    || (fullStockDict && fullStockDict[clean])
    || US_STOCK_DICT[clean]
    || null;
}

function extractCodeAndName(str) {
  if (!str) return null;
  const s = String(str)
    .replace(/[\uFF08]/g, "(")
    .replace(/[\uFF09]/g, ")")
    .trim();

  let m = s.match(/^\(([\w.]+)\)\s*[-_/:]*\s*(.+)$/);
  if (m) return { code: m[1].trim(), name: m[2].trim() };

  m = s.match(/^(.+?)\s*[-_/:]*\s*\(([\w.]+)\)$/);
  if (m) return { code: m[2].trim(), name: m[1].trim() };

  m = s.match(/^([0-9]{4,6}[A-Za-z]?|[A-Za-z]{1,6}(?:\.[A-Za-z]{1,3})?)\s+[-_/:]*\s*(.+)$/);
  if (m && !/^[0-9]+$/.test(m[2])) {
    return { code: m[1].trim(), name: m[2].trim() };
  }

  m = s.match(/^(.+?)\s+[-_/:]*\s*([0-9]{4,6}[A-Za-z]?|[A-Za-z]{1,6}(?:\.[A-Za-z]{1,3})?)$/);
  if (m && !/^[0-9]+$/.test(m[1])) {
    return { code: m[2].trim(), name: m[1].trim() };
  }

  m = s.match(/^([0-9]{4,6}[A-Za-z]?)([^\x00-\x7F]+.*)$/);
  if (m) return { code: m[1].trim(), name: m[2].trim() };

  return null;
}

export function resolveStockIdentity(rawSymbol = "", rawName = "") {
  let sym = String(rawSymbol || "").trim();
  let name = String(rawName || "").trim();

  if (
    /合計|小計|總計|總額|總預估|總現值|總融資|總利息|總損益|總成本|總報酬率|注意事項|備註|說明|製表|列印|客戶|帳號|免責/i.test(sym) ||
    /合計|小計|總計|總額|總預估|總現值|總融資|總利息|總損益|總成本|總報酬率|注意事項|備註|說明|製表|列印|客戶|帳號|免責/i.test(name)
  ) {
    return null;
  }

  sym = sym.replace(/[\s_]*(?:盤後|零股|零|\(零\)|（零）)$/i, "");
  name = name.replace(/[\s_]*(?:盤後|零股|零|\(零\)|（零）)$/i, "");

  const extractedFromSym = extractCodeAndName(sym);
  if (extractedFromSym) {
    sym = extractedFromSym.code;
    if (!name || name === rawSymbol) name = extractedFromSym.name;
  }

  const extractedFromName = extractCodeAndName(name);
  if (extractedFromName) {
    if (!sym) sym = extractedFromName.code;
    name = extractedFromName.name;
  }

  const isSymChinese = /[^\x00-\x7F]/.test(sym);
  const isNameTickerLike = /^[A-Za-z0-9.]{1,10}$/.test(name);
  if (isSymChinese && isNameTickerLike) {
    const temp = sym;
    sym = name;
    name = temp;
  }

  const mergedDict = {
    ...TAIWAN_STOCK_DICT,
    ...loadCustomDict(),
    ...(fullStockDict || {}),
  };

  if (!sym || /[^\x00-\x7F]/.test(sym)) {
    const query = (sym && /[^\x00-\x7F]/.test(sym) ? sym : name)
      .toLowerCase()
      .replace(/[\s_()（）\-*]/g, "");

    for (const [code, dictName] of Object.entries(mergedDict)) {
      const cleanDictName = String(dictName).toLowerCase().replace(/[\s_()（）\-*]/g, "");
      if (cleanDictName === query) {
        sym = code;
        name = dictName;
        break;
      }
    }

    if (!sym || /[^\x00-\x7F]/.test(sym)) {
      const NAME_ALIASES = {
        "台灣50": "0050", "台50": "0050", "元大台50": "0050",
        "台灣50正2": "00631L", "台50正2": "00631L", "元大台50正2": "00631L", "50正2": "00631L",
        "台灣50反1": "00632R", "台50反1": "00632R", "元大台50反1": "00632R", "50反1": "00632R",
        "群益臺灣加權正2": "00685L", "群益加權正2": "00685L", "加權正2": "00685L",
        "富邦臺灣加權正2": "00675L", "富邦加權正2": "00675L",
        "元大美債20年": "00679B", "元大美債20": "00679B", "美債20年": "00679B",
        "國泰20年美債": "00687B", "國泰美債20年": "00687B", "國泰美債20": "00687B",
        "群益esg投等債20+": "00937B", "群益esg投等債": "00937B",
        "台新美a公司債20+": "00942B", "台新美a公司債": "00942B",
        "台新新光金": "2887", "新光金": "2888", "台新金": "2887",
      };
      if (NAME_ALIASES[query]) {
        sym = NAME_ALIASES[query];
        name = mergedDict[sym] || query;
      }
    }

    if (!sym || /[^\x00-\x7F]/.test(sym)) {
      const isLev2 = /正2|正向|2x|bull/i.test(query);
      const isInv1 = /反1|反向|bear/i.test(query);
      const isBond = /債|bond/i.test(query);

      const sortedEntries = Object.entries(mergedDict).sort(
        ([, a], [, b]) => String(b).length - String(a).length
      );

      for (const [code, dictName] of sortedEntries) {
        const cleanDictName = String(dictName).toLowerCase().replace(/[\s_()（）\-*]/g, "");
        const dictIsLev2 = /正2|正向|2x|bull/i.test(cleanDictName);
        const dictIsInv1 = /反1|反向|bear/i.test(cleanDictName);
        const dictIsBond = /債|bond/i.test(cleanDictName) || code.endsWith("B");

        if (isLev2 !== dictIsLev2) continue;
        if (isInv1 !== dictIsInv1) continue;
        if (isBond !== dictIsBond && (isBond || dictIsBond)) continue;

        if (cleanDictName.includes(query) || query.includes(cleanDictName)) {
          sym = code;
          name = dictName;
          break;
        }
      }
    }

    if (!sym || /[^\x00-\x7F]/.test(sym)) {
      for (const [code, desc] of Object.entries(US_STOCK_DICT)) {
        const cleanDesc = desc.toLowerCase().replace(/\s+/g, "");
        if (cleanDesc.includes(query) || query.includes(code.toLowerCase())) {
          sym = code;
          name = desc;
          break;
        }
      }
    }
  }

  let canonicalSymbol = sym.toUpperCase();
  const rawClean = canonicalSymbol.replace(/\.(TW|TWO)$/i, "");
  if (TAIWAN_STOCK_ALIASES[rawClean]) {
    canonicalSymbol = TAIWAN_STOCK_ALIASES[rawClean];
  }

  let market = quoteMarket(canonicalSymbol);

  if (/^\d{4,6}[A-Z]?$/.test(canonicalSymbol)) {
    const isTwo = isLikelyTwo(canonicalSymbol);
    canonicalSymbol = `${canonicalSymbol}.${isTwo ? "TWO" : "TW"}`;
    market = "TW";
  }

  if (!name || name === sym || name === canonicalSymbol || name === canonicalSymbol.replace(/\.(TW|TWO)$/i, "")) {
    const resolvedName = getStockName(canonicalSymbol) || getStockName(sym);
    if (resolvedName) {
      name = resolvedName;
    } else {
      name = canonicalSymbol.replace(/\.(TW|TWO)$/i, "");
    }
  }

  if (canonicalSymbol && name) {
    rememberStockName(canonicalSymbol, name);
  }

  return {
    symbol: canonicalSymbol,
    name,
    market,
  };
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
    ...(fullStockDict || {}),
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

  // 2. 🌟 關鍵修復：只有當手動指定走 Yahoo 或加拿大股時才走前端直連 Yahoo。
  // 假日休市時絕不略過後端！交由後端伺服器代理取得 5 日線收盤價，免除瀏覽器端 CORS 阻擋。
  if (skipRender || settings.quoteProvider === "yahoo" || targetMarket === "CA") {
    return fetchYahooQuote(symbol, signal);
  }

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

export function quoteMarket(symbol) {
  let s = String(symbol || "").trim().toUpperCase();
  const rawClean = s.replace(/\.(TW|TWO)$/i, "");
  if (TAIWAN_STOCK_ALIASES[rawClean]) {
    s = TAIWAN_STOCK_ALIASES[rawClean];
  }
  if (/\.(TO|V|CN|NE)$/i.test(s)) return "CA";
  if (/\.(TW|TWO)$/i.test(s) || /^\d{4,6}[A-Z]?$/i.test(s)) return "TW";
  return "US";
}