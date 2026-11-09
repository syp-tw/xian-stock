// js/calculations.js - 核心財務、手續費、報酬率與總覽指標計算模組

export function getHoldingMetrics(holding) {
  const cost = Number(holding.costBasis) || 0;
  const shares = Number(holding.shares) || 0;
  const price = Number(holding.currentPrice) || 0;
  const marketValue = price * shares;
  const profit = marketValue - cost;

  // 優先使用 dailyChangePerShare；若無，則由 (currentPrice - previousClose) 即時動態換算
  let dailyChange = null;
  if (holding.dailyChangePerShare !== null && holding.dailyChangePerShare !== undefined && Number.isFinite(Number(holding.dailyChangePerShare))) {
    dailyChange = Number(holding.dailyChangePerShare);
  } else if (holding.previousClose !== null && holding.previousClose !== undefined && Number(holding.previousClose) > 0 && price > 0) {
    dailyChange = price - Number(holding.previousClose);
  }

  const dailyProfit = dailyChange !== null ? dailyChange * shares : null;

  // 動態反推前一交易日收盤價，精確計算漲跌幅 %
  let prevClose = null;
  if (holding.previousClose !== null && holding.previousClose !== undefined && Number(holding.previousClose) > 0) {
    prevClose = Number(holding.previousClose);
  } else if (dailyChange !== null && price > 0) {
    prevClose = price - dailyChange;
  }

  let dailyChangeRate = null;
  if (dailyChange !== null && prevClose && prevClose > 0) {
    dailyChangeRate = (dailyChange / prevClose) * 100;
  }

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
    dailyChange,
    dailyChangeRate,
    returnRate,
    averageCost: shares > 0 ? cost / shares : 0,
  };
}

export function getPortfolioMetrics(holdings, settings = {}) {
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
      sum.hasAnyDailyProfit = true;
    }
    return sum;
  }, { cost: 0, marketValue: 0, profit: 0, dividends: 0, dailyProfit: 0, hasAnyDailyProfit: false });

  let totalReturnRate = 0;
  if (totals.cost > 0) {
    totalReturnRate = (totals.profit / totals.cost) * 100;
  } else if (totals.cost === 0 && totals.profit > 0) {
    totalReturnRate = Infinity;
  }

  return {
    cost: totals.cost,
    marketValue: totals.marketValue,
    profit: totals.profit,
    dividends: totals.dividends,
    dailyProfit: totals.hasAnyDailyProfit ? totals.dailyProfit : null,
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
  if (commission === 0 && amount > 0) {
    commission = 1;
  }

  let tax = 0;
  if (type === "sell") {
    const cleanSym = String(symbol).trim().toUpperCase();
    const isBondEtf = /^00\d+B/i.test(cleanSym);
    const isStockEtf = /^00\d+/i.test(cleanSym);
    const taxRate = isBondEtf ? 0 : (isStockEtf ? 0.001 : 0.003);
    tax = Math.floor(amount * taxRate);
  }

  return commission + tax;
}