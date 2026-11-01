// ledger.js - 會計帳務與交易重算核心引擎（純業務邏輯，不依賴 DOM）
import { getHoldingMetrics } from "./calculations.js";

export const today = () => new Date().toISOString().slice(0, 10);
export const makeId = () => crypto.randomUUID();

export function normalizeSymbol(symbol, market) {
  const value = symbol.trim().toUpperCase();
  if (market === "TW" && !/\.(TW|TWO)$/.test(value)) return `${value}.TW`;
  return value;
}

export function emptyHolding({ symbol, name, market, id = makeId() }) {
  return {
    id,
    symbol,
    name: name || symbol,
    market,
    currency: market === "US" ? "USD" : market === "CA" ? "CAD" : "TWD",
    buyDate: today(),
    shares: 0,
    costBasis: 0,
    currentPrice: 0,
    dailyChangePerShare: null,
    fees: 0,
    realizedProfit: 0,
    dividends: 0,
    custom: {},
    updatedAt: null,
  };
}

export function ledgerKey(holding) {
  return `${holding.market}:${holding.symbol.toUpperCase()}`;
}

export function transactionsForHolding(holding, transactions) {
  return transactions.filter(
    (item) =>
      item.symbol?.toUpperCase() === holding.symbol.toUpperCase() &&
      (!item.market || item.market === holding.market)
  );
}

export function holdingBalance(holding) {
  return {
    shares: holding.shares,
    costBasis: holding.costBasis,
    fees: holding.fees,
    realizedProfit: holding.realizedProfit,
    dividends: holding.dividends,
    currentPrice: holding.currentPrice,
    dailyChangePerShare: holding.dailyChangePerShare ?? null,
    buyDate: holding.buyDate,
  };
}

export function applyTransactionToHolding(holding, transaction) {
  const { type, date, quantity, price, fee, ratio, currentPrice, dailyChangePerShare } = transaction;
  const oldShares = holding.shares;
  if (type !== "buy" && holding.shares <= 0) throw new Error("這檔股票尚無持倉，請先新增買入紀錄。");

  if (type === "buy") {
    if (quantity <= 0 || price <= 0) throw new Error("買入股數與價格都必須大於 0。");
    holding.shares += quantity;
    holding.costBasis += quantity * price + fee;
    holding.fees += fee;
    if (!holding.buyDate || date < holding.buyDate) holding.buyDate = date;
    holding.currentPrice = Number(currentPrice) || holding.currentPrice || price;
    if (Number.isFinite(dailyChangePerShare)) holding.dailyChangePerShare = dailyChangePerShare;
  } else if (type === "sell") {
    if (quantity <= 0 || quantity > holding.shares + 1e-8 || price <= 0) {
      throw new Error("賣出股數不可超過持有股數，價格必須大於 0。");
    }
    // 若全數賣出，強制歸零成本與股數，避免浮點數除法殘留微小非零成本
    if (quantity >= holding.shares - 1e-6) {
      holding.realizedProfit += quantity * price - fee - holding.costBasis;
      holding.costBasis = 0;
      holding.shares = 0;
    } else {
      const allocatedCost = holding.shares > 0 ? (holding.costBasis * quantity) / holding.shares : 0;
      holding.costBasis = Math.max(0, holding.costBasis - allocatedCost);
      holding.shares = Math.max(0, holding.shares - quantity);
      holding.realizedProfit += quantity * price - fee - allocatedCost;
    }
    holding.fees += fee;
    holding.currentPrice = Number(currentPrice) || price;
  } else if (type === "dividend") {
    if (price < 0) throw new Error("配息金額不得小於 0。");
    holding.dividends += (quantity || holding.shares) * price;
  } else if (type === "stockDividend") {
    if (quantity <= 0) throw new Error("配股股數必須大於 0。");
    holding.shares += quantity;
    if (oldShares > 0 && holding.currentPrice > 0) {
      holding.currentPrice = (holding.currentPrice * oldShares) / holding.shares;
    }
  } else if (type === "split") {
    const splitRatio = Number(ratio);
    if (splitRatio <= 0) throw new Error("分割比例必須大於 0。");
    holding.shares *= splitRatio;
    holding.currentPrice = Number(currentPrice) > 0 ? Number(currentPrice) : holding.currentPrice / splitRatio;
  } else if (type === "capitalReduction") {
    if (price < 0) throw new Error("每股退還金額不得小於 0。");
    if (quantity > holding.shares + 1e-8) throw new Error("減少股數不可超過目前持有股數。");

    const cancelledShares = Math.max(0, quantity || 0);
    const returnedAmount = price * oldShares;
    const previousMarketValue = holding.currentPrice * oldShares;

    holding.shares = Math.max(0, holding.shares - cancelledShares);

    // 現金減資退還股款：先扣減成本，超額認列資本利得
    if (returnedAmount > 0) {
      const costReduction = Math.min(holding.costBasis, returnedAmount);
      holding.costBasis -= costReduction;
      holding.realizedProfit += returnedAmount - costReduction;
    }

    if (Number(currentPrice) > 0) {
      holding.currentPrice = Number(currentPrice);
    } else if (cancelledShares > 0 && holding.shares > 0) {
      const estimatedPrice = (previousMarketValue - returnedAmount) / holding.shares;
      // 防呆：若估算股價 <= 0，維持原現價，避免市值失真
      holding.currentPrice = estimatedPrice > 0 ? estimatedPrice : holding.currentPrice;
    }
  }
}

export function ensureOpeningBalance(holding, state) {
  const key = ledgerKey(holding);
  if (state.openingBalances[key]) return;
  const history = transactionsForHolding(holding, state.transactions);
  if (!history.length) {
    state.openingBalances[key] = holdingBalance(holding);
    return;
  }
  const replayed = emptyHolding(holding);
  try {
    for (const transaction of history
      .filter((item) => !item.locked)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
      transaction.market ||= holding.market;
      transaction.name ||= holding.name;
      transaction.quantity = Number(transaction.quantity) || 0;
      transaction.price = Number(transaction.price) || 0;
      transaction.fee = Number(transaction.fee) || 0;
      transaction.ratio = Number(transaction.ratio) || 0;
      transaction.currentPrice = Number(transaction.currentPrice) || 0;
      applyTransactionToHolding(replayed, transaction);
    }
    if (
      Math.abs(replayed.shares - holding.shares) > 1e-6 ||
      Math.abs(replayed.costBasis - holding.costBasis) > 0.02
    ) {
      throw new Error("交易明細與目前庫存不同步。");
    }
    state.openingBalances[key] = holdingBalance(emptyHolding(holding));
  } catch {
    for (const transaction of history) transaction.locked = true;
    state.openingBalances[key] = holdingBalance(holding);
  }
}

export function rebuildHolding(holding, state) {
  ensureOpeningBalance(holding, state);
  const baseline = state.openingBalances[ledgerKey(holding)];
  const quoteSnapshot = {
    currentPrice: holding.currentPrice,
    dailyChangePerShare: holding.dailyChangePerShare ?? null,
    updatedAt: holding.updatedAt,
  };
  const rebuilt = { ...emptyHolding(holding), ...baseline, custom: { ...holding.custom } };

  const history = state.transactions
    .filter(
      (item) =>
        item.symbol?.toUpperCase() === holding.symbol.toUpperCase() &&
        (!item.market || item.market === holding.market) &&
        !item.locked
    )
    .sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      const cmp = dateA.localeCompare(dateB);
      return cmp !== 0 ? cmp : String(a.createdAt).localeCompare(String(b.createdAt));
    });

  for (const transaction of history) applyTransactionToHolding(rebuilt, transaction);

  rebuilt.updatedAt = quoteSnapshot.updatedAt;
  rebuilt.dailyChangePerShare = quoteSnapshot.dailyChangePerShare;
  if (!rebuilt.currentPrice || rebuilt.currentPrice <= 0) {
    rebuilt.currentPrice = quoteSnapshot.currentPrice;
  }

  const position = state.holdings.findIndex((item) => item.id === holding.id);
  if (rebuilt.shares <= 1e-8) {
    if (position >= 0) state.holdings.splice(position, 1);
    return null;
  }
  if (position >= 0) state.holdings[position] = rebuilt;
  else state.holdings.push(rebuilt);
  return rebuilt;
}

export function addTransaction(
  { type, symbol, name, market, date, quantity, price, fee, ratio, currentPrice, dailyChangePerShare },
  state
) {
  const canonicalSymbol = normalizeSymbol(symbol, market);
  let holding = state.holdings.find(
    (h) => h.symbol.toUpperCase() === canonicalSymbol.toUpperCase() && h.market === market
  );
  if (holding) ensureOpeningBalance(holding, state);
  else {
    holding = emptyHolding({ symbol: canonicalSymbol, name: name || canonicalSymbol, market });
    state.openingBalances[ledgerKey(holding)] = holdingBalance(holding);
  }
  if (name && (holding.name === holding.symbol || holding.name === holding.symbol.replace(/\.(TW|TWO)$/i, ""))) {
    holding.name = name;
  }
  const transaction = {
    id: makeId(),
    type,
    symbol: canonicalSymbol,
    name: name || holding.name,
    market,
    date,
    quantity: type === "dividend" && !(Number(quantity) > 0) ? holding.shares : Number(quantity) || 0,
    price: Number(price) || 0,
    fee: Number(fee) || 0,
    ratio: Number(ratio) || 0,
    currentPrice: Number(currentPrice) || 0,
    dailyChangePerShare,
    createdAt: new Date().toISOString(),
  };
  applyTransactionToHolding(holding, transaction);
  if (!state.holdings.some((item) => item.id === holding.id) && holding.shares > 1e-8) {
    state.holdings.push(holding);
  }
  if (holding.shares <= 1e-8) {
    state.holdings = state.holdings.filter((item) => item.id !== holding.id);
  }
  state.transactions.push(transaction);
  return holding;
}