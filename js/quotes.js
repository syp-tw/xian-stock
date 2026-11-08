// js/quotes.js - 行情報價、即時搜尋、離線中文股名字典、自動記憶庫與多市場智慧切換服務
const isNetlify = window.location.hostname.endsWith(".netlify.app");
const apiRoot = isNetlify ? `${window.location.origin}/quote-api` : null;
const yahooApiRoot = apiRoot ? `${apiRoot}/yahoo` : "https://query1.finance.yahoo.com";
const searchUrl = `${yahooApiRoot}/v1/finance/search`;
const twseListUrl = apiRoot ? `${apiRoot}/twse/v1/opendata/t187ap03_L` : "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
const tpexListUrl = apiRoot ? `${apiRoot}/tpex/openapi/v1/mopsfin_t187ap03_O` : "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O";

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

  // === 債券 ETF (櫃買中心 TPEx 上櫃掛牌，對應 .TWO) ===
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

  // === 機電、電器、線纜、化學、生醫 ===
  "1503": "士電", "1504": "東元", "1513": "中興電", "1519": "華城", "1524": "耿鼎",
  "1526": "日馳", "1527": "鑽全", "1528": "恩德", "1536": "和大", "1540": "喬福",
  "1565": "精華", "1570": "力肯", "1582": "信錦", "1584": "精剛", "1589": "永冠-KY",
  "1591": "駿吉-KY", "1604": "聲寶", "1605": "華新", "1609": "大亞", "1611": "中電",
  "1707": "葡萄王", "1708": "東鹼", "1709": "和益", "1712": "興農", "1714": "和桐",
  "1718": "中纖", "1722": "台肥", "1723": "中碳", "1724": "國慶科技", "1733": "五鼎",
  "1734": "杏輝", "1737": "臺鹽", "1781": "合世", "1783": "和康生", "1784": "訊聯",
  "1785": "光洋科", "1786": "科妍", "1815": "富喬", "1904": "正隆", "1909": "榮成",

  // === 鋼鐵、橡膠、汽車、航運 ===
  "2002": "中鋼", "2012": "春雨", "2014": "中鴻", "2020": "美亞", "2022": "聚亨",
  "2023": "燁輝", "2024": "志聯", "2025": "千興", "2030": "彰源", "2031": "新光鋼",
  "2069": "世豐", "2102": "泰豐", "2104": "國際中橡", "2108": "南帝", "2201": "裕隆",
  "2206": "三陽工業", "2207": "和泰車", "2208": "台船", "2603": "長榮", "2605": "新興",
  "2609": "陽明", "2610": "華航", "2611": "志信", "2612": "中航", "2613": "中櫃",
  "2614": "東森", "2615": "萬海", "2616": "山隆", "2618": "長榮航", "2636": "台驊控股",
  "2641": "正德",

  // === 觀光、餐飲、金融、貿易百貨 ===
  "2705": "六福", "2727": "王品", "2734": "易飛網", "2801": "彰銀", "2812": "台中銀",
  "2834": "臺企銀", "2838": "聯邦銀", "2880": "華南金", "2881": "富邦金", "2882": "國泰金",
  "2883": "凱基金", "2884": "玉山金", "2885": "元大金", "2886": "兆豐金", "2887": "台新金",
  "2889": "國票金", "2890": "永豐金", "2891": "中信金", "2892": "第一金", "2912": "統一超",
  "2913": "農林", "2929": "淘帝-KY", "5871": "中租-KY", "5876": "上海商銀", "5880": "合庫金",

  // === 電子通路、零組件、光電、通信 (2000-3000) ===
  "2312": "金寶", "2328": "廣宇", "2329": "華泰", "2332": "友訊", "2338": "光罩",
  "2340": "台亞", "2342": "茂矽", "2355": "敬鵬", "2364": "倫飛", "2365": "昆盈",
  "2367": "燿華", "2369": "菱生", "2371": "大同", "2390": "云辰", "2401": "凌陽",
  "2402": "毅嘉", "2405": "輔信", "2406": "國碩", "2409": "友達", "2417": "圓剛",
  "2425": "承啟", "2426": "鼎元", "2438": "翔耀", "2439": "美律", "2442": "新美齊",
  "2453": "凌群", "2457": "飛宏", "2461": "光群雷", "2464": "盟立", "2478": "大毅",
  "2481": "強茂", "2482": "連宇", "2484": "希華", "2485": "兆赫", "2488": "漢平",
  "2498": "宏達電", "2504": "國產", "2515": "中工", "2516": "新建", "2534": "宏盛",
  "2537": "聯上發", "2547": "日勝生",

  // === 3000-4000 區段股票 ===
  "3010": "華立", "3011": "今皓", "3023": "信邦", "3024": "憶聲", "3025": "星通",
  "3027": "盛達", "3029": "零壹", "3033": "威健", "3038": "全台", "3041": "揚智",
  "3042": "晶技", "3043": "科風", "3048": "益登", "3049": "精金", "3051": "力特",
  "3056": "富華新", "3057": "喬鼎", "3060": "銘異", "3095": "及成", "3105": "穩懋",
  "3118": "進階", "3122": "笙泉", "3128": "昇銳", "3131": "弘塑", "3169": "亞信",
  "3176": "基亞", "3209": "全科", "3213": "茂訊", "3221": "台嘉碩", "3228": "金麗科",
  "3236": "千如", "3268": "海德威", "3276": "宇環", "3290": "東浦", "3293": "鈊象",
  "3306": "鼎天", "3311": "閎暉", "3312": "弘憶股", "3313": "斐成", "3317": "尼克森",
  "3321": "同泰", "3322": "建舜電", "3323": "加百裕", "3325": "旭品", "3338": "泰碩",
  "3339": "泰谷", "3360": "尚立", "3372": "典範", "3390": "旭軟", "3430": "奇鈦科",
  "3438": "類比科", "3455": "由田", "3498": "陽程", "3499": "環天科", "3508": "位速",
  "3520": "華盈", "3527": "聚積", "3529": "力旺", "3537": "堡達", "3540": "曜越",
  "3541": "西柏", "3543": "州巧", "3545": "敦泰", "3548": "兆利", "3550": "聯穎",
  "3552": "同致", "3556": "禾瑞亞", "3576": "聯合再生", "3580": "友威科", "3587": "閎康",
  "3588": "通嘉", "3607": "谷崧", "3645": "達邁", "3646": "艾恩特", "3673": "TPK-KY",
  "3686": "達能", "3687": "歐買尬", "3702": "大聯大",

  // === 4000-5000 區段股票 ===
  "4105": "東洋", "4109": "加捷生醫", "4114": "健喬", "4128": "中天", "4132": "國鼎",
  "4133": "亞諾法", "4142": "國光生", "4147": "中裕", "4150": "優你康", "4160": "訊聯基因",
  "4162": "智擎", "4167": "松瑞藥", "4171": "瑞基", "4174": "浩鼎", "4303": "信立",
  "4306": "炎洲", "4416": "郡都開發", "4510": "高鋒", "4513": "福裕", "4523": "永彰",
  "4526": "東台", "4533": "協易機", "4541": "晟田", "4543": "萬在", "4552": "力達-KY",
  "4714": "永捷", "4721": "美琪瑪", "4735": "豪展", "4739": "康普", "4743": "合一",
  "4744": "皇將", "4746": "台耀", "4754": "國碳科", "4903": "聯光通", "4909": "新復興",
  "4912": "聯德控股-KY", "4916": "事欣科", "4923": "力士", "4931": "新盛力", "4934": "太極",
  "4939": "亞電", "4953": "緯致", "4960": "誠美材", "4961": "天鈺", "4968": "立積",
  "4973": "廣穎", "4974": "亞泰", "4976": "佳凌", "4999": "鑫禾",

  // === 5000-6000 區段股票 ===
  "5009": "榮剛", "5011": "久陽", "5014": "建錩", "5202": "力新", "5210": "寶碩",
  "5222": "全訊", "5227": "立凱-KY", "5272": "笙科", "5274": "信驊", "5315": "光聯",
  "5347": "世界", "5351": "鈺創", "5356": "協益", "5398": "慕康生醫", "5410": "國眾",
  "5425": "台半", "5452": "佶優", "5471": "松翰", "5481": "新華", "5483": "中美晶",
  "5488": "松普", "5490": "同亨", "5498": "凱崴", "5512": "力麒", "5521": "工信",
  "5608": "四維航",

  // === 6000 區段股票 ===
  "6104": "創惟", "6109": "亞元", "6114": "光聚晶電", "6116": "彩晶", "6120": "達運",
  "6125": "廣運", "6126": "信音", "6127": "九豪", "6143": "振曜", "6156": "松上",
  "6160": "欣技", "6164": "華興", "6165": "浪凡", "6169": "昱泉", "6179": "亞通",
  "6180": "橘子", "6182": "合晶", "6183": "關貿", "6185": "幃翔", "6186": "新潤",
  "6189": "豐藝", "6190": "萬泰科", "6202": "盛群", "6204": "艾華", "6207": "雷科",
  "6217": "中探針", "6221": "晉泰", "6224": "聚鼎", "6233": "旺玖", "6235": "華孚",
  "6237": "驊訊", "6243": "迅杰", "6244": "茂迪", "6248": "沛波", "6257": "矽格",
  "6261": "久元", "6266": "泰詠", "6269": "台郡", "6274": "台燿", "6276": "安鈦克",
  "6284": "佳邦", "6411": "晶焱", "6415": "矽力*-KY", "6416": "瑞祺電通", "6419": "京晨科",
  "6432": "今展科", "6438": "迅得", "6441": "廣錠", "6443": "元晶", "6446": "藥華藥",
  "6462": "神盾", "6470": "宇智", "6472": "保瑞", "6485": "點序", "6486": "互動",
  "6488": "環球晶", "6492": "生華科", "6494": "九齊", "6505": "台塑化", "6517": "保勝光學",
  "6530": "創威", "6532": "瑞耘", "6538": "倉和", "6547": "高端疫苗", "6549": "景凱",
  "6558": "興能高", "6576": "逸達", "6586": "醣基", "6588": "東典光電", "6591": "動力-KY",
  "6593": "台灣銘板", "6598": "ABC-KY", "6621": "華宇藥", "6672": "騰輝電子-KY", "6706": "惠特",
  "6727": "亞泰金屬", "6742": "澤米", "6770": "力積電", "6793": "天力離岸", "6797": "圓點奈米",
  "6799": "來頡", "6810": "新穎生醫", "6886": "遠東生技", "6926": "清淨海",

  // === 8000-9999 區段股票 ===
  "8011": "台通", "8027": "钛昇", "8039": "台虹", "8048": "德勝", "8050": "廣積",
  "8054": "安國", "8064": "東捷", "8069": "元太", "8074": "鉅橡", "8076": "伍豐",
  "8085": "福華", "8086": "宏捷科", "8088": "品安", "8092": "建暐", "8096": "擎亞",
  "8099": "大世科", "8104": "錸寶", "8107": "大億金茂", "8111": "立碁", "8119": "公信",
  "8150": "南茂", "8171": "天宇", "8213": "志超", "8215": "明基材", "8222": "寶一",
  "8227": "巨有科技", "8240": "華宏", "8249": "菱光", "8261": "富鼎", "8299": "群聯",
  "8383": "千附", "8429": "金麗-KY", "8431": "匯鑽科", "8435": "鉅邁", "8436": "大江",
  "8437": "大地-KY", "8440": "綠電", "8443": "阿瘦", "8474": "光隆", "8936": "國統",
  "9910": "豐泰", "9912": "偉聯", "9914": "美利達", "9919": "康那香", "9935": "慶豐富",
  "9943": "好樂迪", "9962": "有益",
};

export const US_STOCK_DICT = {
  "AAPL": "Apple (蘋果)", "MSFT": "Microsoft (微軟)", "NVDA": "NVIDIA (輝達)", "TSM": "TSMC ADR (台積電)",
  "GOOGL": "Alphabet (谷歌A)", "GOOG": "Alphabet (谷歌C)", "AMZN": "Amazon (亞馬遜)", "META": "Meta (臉書)",
  "TSLA": "Tesla (特斯拉)", "AMD": "AMD (超微)", "AVGO": "Broadcom (博通)", "QCOM": "Qualcomm (高通)",
  "INTC": "Intel (英特爾)", "ASML": "ASML (艾司摩爾)", "NFLX": "Netflix (網飛)", "COST": "Costco (好市多)",
  "BRK.B": "波克夏B", "V": "Visa", "DIS": "Disney (迪士尼)", "VOO": "Vanguard 標普500 ETF",
  "QQQ": "Invesco 納斯達克100 ETF", "SPY": "SPDR 標普500 ETF", "VT": "Vanguard 全球股票 ETF", "VTI": "Vanguard 全美市場 ETF",
};

export const TAIWAN_STOCK_ALIASES = {
  "00631": "00631L",
  "00632": "00632R",
  "00685": "00685L",
  "00686": "00686R",
  "00675": "00675L",
  "00676": "00676R",
  "00670": "00670L",
  "00671": "00671R",
  "00679": "00679B",
  "00687": "00687B",
  "00937": "00937B",
  "00942": "00942B",
  "00933": "00933B",
  "00720": "00720B",
  "00751": "00751B",
  "00772": "00772B",
  "00948": "00948B",
  "00945": "00945B",
  "00953": "00953B",
};

// 完整上櫃 (TPEx / .TWO) 熱門代碼快取集合
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
  if (isNetlify) {
    const res = await fetch(rawUrl, { signal, headers: { Accept: "application/json" } });
    if (res.ok) return await res.json();
  }

  try {
    const res = await fetch(rawUrl, { signal, headers: { Accept: "application/json" } });
    if (res.ok) return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw err;
  }

  const proxies = [
    `https://corsproxy.io/?url=${encodeURIComponent(rawUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl, { signal, headers: { Accept: "application/json" } });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      if (e.name === "AbortError") throw e;
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

/**
 * 核心身分識別函數：支援純股名 100% 精準反查
 */
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

  // 當代碼為空，依據股名四階段精確反查代號
  if (!sym || /[^\x00-\x7F]/.test(sym)) {
    const query = (sym && /[^\x00-\x7F]/.test(sym) ? sym : name)
      .toLowerCase()
      .replace(/[\s_()（）\-*]/g, "");

    // 第一階段：完全精準匹配
    for (const [code, dictName] of Object.entries(mergedDict)) {
      const cleanDictName = String(dictName).toLowerCase().replace(/[\s_()（）\-*]/g, "");
      if (cleanDictName === query) {
        sym = code;
        name = dictName;
        break;
      }
    }

    // 第二階段：別名與簡稱映射
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

    // 第三階段：長度優先 + 特徵隔離模糊匹配
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

    // 第四階段：美股英文比對
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

export async function fetchOfficialMisQuote(symbol, signal) {
  const clean = symbol.replace(/\.(TW|TWO)$/i, "").trim().toLowerCase();
  const isTwo = isLikelyTwo(symbol);
  const channel = `${isTwo ? "otc" : "tse"}_${clean}.${isTwo ? "two" : "tw"}`;
  const rawUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${channel}&_=${Date.now()}`;

  const data = await fetchWithCorsFallback(rawUrl, signal);
  const item = data?.msgArray?.[0];
  if (!item) throw new Error("MIS 查無此股票");

  let price = Number(item.z);
  if (!Number.isFinite(price) || price <= 0) {
    const bestBids = String(item.b || "").split("_");
    const bestAsks = String(item.a || "").split("_");
    price = Number(bestBids[0]) || Number(bestAsks[0]) || Number(item.y);
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error("MIS 查無有效現價");

  const prevClose = Number(item.y) || null;
  const canonical = `${clean.toUpperCase()}.${isTwo ? "TWO" : "TW"}`;
  const resolvedName = getStockName(canonical) || item.n || item.c;
  rememberStockName(canonical, resolvedName);

  return {
    price,
    currency: "TWD",
    market: "TW",
    name: resolvedName,
    dailyChangePerShare: prevClose ? price - prevClose : null,
    previousClose: prevClose,
  };
}

async function doFetchYahooChart(symbol, signal) {
  const targetUrl = `${yahooApiRoot}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
  const data = await fetchWithCorsFallback(targetUrl, signal);
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

export async function fetchQuote(symbol, signal, settings = {}) {
  const targetMarket = quoteMarket(symbol);

  if (settings.quoteProvider === "yahoo" || targetMarket === "CA") {
    return fetchYahooQuote(symbol, signal);
  }

  try {
    const { url, market, ticker } = getRenderApiUrl(settings, symbol);
    const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
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
  } catch {
    if (targetMarket === "TW") {
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