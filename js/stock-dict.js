// js/stock-dict.js - 常用股票字典、櫃買代碼辨識、自訂別名與股票身分自動解析模組

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

export const KNOWN_TPEX_CODES = new Set([
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

const CUSTOM_DICT_STORAGE_KEY = "xian-stock-custom-dict";
export function loadCustomDict() {
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
export async function fetchFullStockDict() {
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

export function extractCodeAndName(str) {
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