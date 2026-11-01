// js/calculations.js - 核心財務、手續費、報酬率與總覽指標計算模組

export function getHoldingMetrics(holding) {
  const cost = Number(holding.costBasis) || 0;
  const shares = Number(holding.shares) || 0;
  const price = Number(holding.currentPrice) || 0;
  const marketValue = price * shares;
  const profit = marketValue - cost;

  const dailyProfit = holding.dailyChangePerShare !== null
    && holding.dailyChangePerShare !== undefined
    && Number.isFinite(Number(holding.dailyChangePerShare))
    ? Number(holding.dailyChangePerShare) * shares
    : null;

  let returnRate = 0;
  if (cost > 0) {
    returnRate = (profit / cost) * 100;
  } else if (cost === 0 && profit > 0) {
    returnRate = Infinity;
  }

  return {
    cost,
    marketValue,
    profit,
    dailyProfit,
    returnRate,
    averageCost: shares > 0 ? cost / shares : 0,
  };
}

export function getPortfolioMetrics(holdings, settings = {}) {
  // 嚴格只計算實際持股數大於 0 的標的
  const activeHoldings = (holdings || []).filter((h) => Number(h.shares) > 0);

  if (!activeHoldings.length) {
    return { cost: 0, marketValue: 0, profit: 0, dividends: 0, dailyProfit: 0, returnRate: 0 };
  }

  const usdFx = Number(settings.fxRate) > 0 ? Number(settings.fxRate) : 32.5;
  const cadFx = Number(settings.cadFxRate) > 0 ? Number(settings.cadFxRate) : 23.5;

  const rates = {
    USD: usdFx,
    CAD: cadFx,
    TWD: 1,
  };

  const totals = activeHoldings.reduce((sum, holding) => {
    const market = holding.market || "TW";
    const currency = holding.currency || (market === "US" ? "USD" : market === "CA" ? "CAD" : "TWD");
    const conversion = rates[currency] || 1;

    const metrics = getHoldingMetrics(holding);
    const dividends = Number(holding.dividends) || 0;

    sum.cost += metrics.cost * conversion;
    sum.marketValue += metrics.marketValue * conversion;
    sum.profit += metrics.profit * conversion;
    sum.dividends += dividends * conversion;

    if (metrics.dailyProfit !== null) {
      sum.dailyProfit += metrics.dailyProfit * conversion;
    } else {
      sum.dailyProfitComplete = false;
    }
    return sum;
  }, { cost: 0, marketValue: 0, profit: 0, dividends: 0, dailyProfit: 0, dailyProfitComplete: true });

  const { dailyProfitComplete, ...metrics } = totals;

  let totalReturnRate = 0;
  if (metrics.cost > 0) {
    totalReturnRate = (metrics.profit / metrics.cost) * 100;
  } else if (metrics.cost === 0 && metrics.profit > 0) {
    totalReturnRate = Infinity;
  }

  return {
    ...metrics,
    dividends: totals.dividends,
    dailyProfit: dailyProfitComplete ? totals.dailyProfit : null,
    returnRate: totalReturnRate,
  };
}

export function estimateFee(market, quantity, price, settings = {}, type = "buy", symbol = "") {
  const shares = Math.max(0, Number(quantity) || 0);
  const amount = Math.max(0, Number(price) || 0) * shares;

  if (shares === 0 || amount === 0) return 0;

  if (market === "US" || market === "CA") {
    const prefix = market === "CA" ? "ca" : "us";
    const minFee = Number(settings[`${prefix}Minimum`]) || 0;
    const perShareFee = shares * (Number(settings[`${prefix}PerShare`]) || 0);
    return Math.max(minFee, perShareFee);
  }

  // 台股手續費計算
  const commissionRate = (Number(settings.twRate) || 0.1425) / 100;
  const discount = (Number(settings.twDiscount) || 100) / 100;
  const rawCommission = Math.floor(amount * commissionRate * discount);
  const configuredMinFee = settings.twMinimum !== undefined && settings.twMinimum !== "" ? Number(settings.twMinimum) : 20;

  let commission = Math.max(configuredMinFee, rawCommission);
  // 台股實務防呆：只要交易金額 > 0，手續費最低計收 1 元
  if (commission === 0 && amount > 0) {
    commission = 1;
  }

  let tax = 0;
  if (type === "sell") {
    const cleanSym = String(symbol).trim().toUpperCase();
    // 依規定：債券型 ETF (00xxxB) 停徵證券交易稅；一般股票型 ETF (00開頭) 為 0.1%；一般個股為 0.3%
    const isBondEtf = /^00\d+B/i.test(cleanSym);
    const isStockEtf = /^00\d+/i.test(cleanSym);
    const taxRate = isBondEtf ? 0 : (isStockEtf ? 0.001 : 0.003);
    tax = Math.floor(amount * taxRate);
  }

  return commission + tax;
}