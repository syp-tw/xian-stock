// calculations.js - 核心財務、手續費、報酬率與總覽指標計算模組

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

  // 零成本（已全數收回本金但仍有持股）時，若有獲利則為無限大報酬率
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
  if (!holdings || holdings.length === 0) {
    return { cost: 0, marketValue: 0, profit: 0, dividends: 0, dailyProfit: 0, returnRate: 0 };
  }

  // 匯率防呆：避免 0 或 NaN
  const usdFx = Number(settings.fxRate) > 0 ? Number(settings.fxRate) : 32.5;
  const cadFx = Number(settings.cadFxRate) > 0 ? Number(settings.cadFxRate) : 23.5;

  const rates = {
    USD: usdFx,
    CAD: cadFx,
    TWD: 1,
  };

  const totals = holdings.reduce((sum, holding) => {
    const market = holding.market || "TW";
    const currency = holding.currency || (market === "US" ? "USD" : market === "CA" ? "CAD" : "TWD");
    const conversion = rates[currency] || 1;

    const metrics = getHoldingMetrics(holding);
    const dividends = Number(holding.dividends) || 0;

    sum.cost += metrics.cost * conversion;
    sum.marketValue += metrics.marketValue * conversion;
    sum.profit += metrics.profit * conversion;
    sum.dividends += dividends * conversion; // 加總全持股累計股息

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

  // 美股與加股手續費估算 (計件制或低消)
  if (market === "US" || market === "CA") {
    const prefix = market === "CA" ? "ca" : "us";
    const minFee = Number(settings[`${prefix}Minimum`]) || 0;
    const perShareFee = shares * (Number(settings[`${prefix}PerShare`]) || 0);
    return Math.max(minFee, perShareFee);
  }

  // 台股券商手續費 (小數點無條件捨去，符合法規)
  const commissionRate = (Number(settings.twRate) || 0.1425) / 100;
  const discount = (Number(settings.twDiscount) || 100) / 100;
  const rawCommission = Math.floor(amount * commissionRate * discount);
  const configuredMinFee = settings.twMinimum !== undefined && settings.twMinimum !== "" ? Number(settings.twMinimum) : 20;

  // 實務保護：若金額大於 0 但算出來的手續費與低消皆為 0，台股券商依例至少收 1 元
  let commission = Math.max(configuredMinFee, rawCommission);
  if (commission === 0 && amount > 0) {
    commission = 1;
  }

  // 台股證券交易稅：僅在賣出時課徵（ETF 0.1%，一般股票 0.3%，無條件捨去）
  let tax = 0;
  if (type === "sell") {
    const isEtf = /^00\d+/.test(String(symbol).trim());
    const taxRate = isEtf ? 0.001 : 0.003;
    tax = Math.floor(amount * taxRate);
  }

  return commission + tax;
}