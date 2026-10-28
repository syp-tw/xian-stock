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
  return {
    cost,
    marketValue,
    profit,
    dailyProfit,
    returnRate: cost > 0 ? (profit / cost) * 100 : 0,
    averageCost: shares > 0 ? cost / shares : 0,
  };
}

export function getPortfolioMetrics(holdings, settings) {
  const rates = {
    USD: Number(settings.fxRate) || 32.5,
    CAD: Number(settings.cadFxRate) || 23.5,
    TWD: 1,
  };
  const totals = holdings.reduce((sum, holding) => {
    const currency = holding.currency || (holding.market === "US" ? "USD" : holding.market === "CA" ? "CAD" : "TWD");
    const conversion = rates[currency] || 1;
    const metrics = getHoldingMetrics(holding);
    sum.cost += metrics.cost * conversion;
    sum.marketValue += metrics.marketValue * conversion;
    sum.profit += metrics.profit * conversion;
    if (metrics.dailyProfit !== null) {
      sum.dailyProfit += metrics.dailyProfit * conversion;
    } else sum.dailyProfitComplete = false;
    return sum;
  }, { cost: 0, marketValue: 0, profit: 0, dailyProfit: 0, dailyProfitComplete: holdings.length > 0 });
  const { dailyProfitComplete, ...metrics } = totals;
  return {
    ...metrics,
    dailyProfit: dailyProfitComplete ? totals.dailyProfit : null,
    returnRate: metrics.cost > 0 ? (metrics.profit / metrics.cost) * 100 : 0,
  };
}

export function estimateFee(market, quantity, price, settings) {
  const shares = Math.max(0, Number(quantity) || 0);
  const amount = Math.max(0, Number(price) || 0) * shares;
  if (market === "US" || market === "CA") {
    const prefix = market === "CA" ? "ca" : "us";
    return Math.max(Number(settings[`${prefix}Minimum`]) || 0, shares * (Number(settings[`${prefix}PerShare`]) || 0));
  }
  const commissionRate = (Number(settings.twRate) || 0) / 100;
  const discount = (Number(settings.twDiscount) || 0) / 100;
  const commission = amount * commissionRate * discount;
  return commission > 0 ? Math.max(Number(settings.twMinimum) || 0, commission) : 0;
}
