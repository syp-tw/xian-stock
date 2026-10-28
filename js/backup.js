import { normalizeImportedState } from "./storage.js";

const BACKUP_FORMAT = "xian-stock-backup";
const BACKUP_VERSION = 1;

export function serializeBackup(state) {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      holdings: state.holdings,
      customFields: state.customFields,
      settings: state.settings,
      transactions: state.transactions,
      openingBalances: state.openingBalances,
    },
  }, null, 2);
}

export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("檔案不是有效的 JSON 備份。");
  }
  if (parsed?.format === BACKUP_FORMAT) {
    if (parsed.version !== BACKUP_VERSION) throw new Error("備份版本不支援，請更新應用程式後再試。");
    return normalizeImportedState(parsed.data);
  }
  return normalizeImportedState(parsed);
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function serializeCsv(state) {
  const columns = [
    "record_type", "id", "symbol", "name", "market", "date", "type", "quantity", "price",
    "fee", "ratio", "current_price", "shares", "cost_basis", "realized_profit", "dividends", "data",
  ];
  const rows = [
    columns,
    ["metadata", "", "", "", "", new Date().toISOString(), "鮮存股 CSV 匯出"],
  ];
  for (const holding of state.holdings) {
    rows.push([
      "holding", holding.id, holding.symbol, holding.name, holding.market, holding.buyDate, "",
      "", "", holding.fees, "", holding.currentPrice, holding.shares, holding.costBasis,
      holding.realizedProfit, holding.dividends, JSON.stringify(holding),
    ]);
  }
  for (const transaction of state.transactions) {
    rows.push([
      "transaction", transaction.id, transaction.symbol, transaction.name, transaction.market,
      transaction.date, transaction.type, transaction.quantity, transaction.price, transaction.fee,
      transaction.ratio, transaction.currentPrice, "", "", "", "", JSON.stringify(transaction),
    ]);
  }
  for (const field of state.customFields) {
    rows.push(["custom_field", field.id, "", field.name]);
  }
  for (const [key, value] of Object.entries(state.settings)) {
    rows.push(["setting", key, "", "", "", "", "", "", "", "", "", "", "", "", "", "", value]);
  }
  for (const [id, balance] of Object.entries(state.openingBalances || {})) {
    rows.push(["opening_balance", id, "", "", "", "", "", "", "", "", "", "", "", "", "", "", JSON.stringify(balance)]);
  }
  return `\uFEFF${rows.map((row) => columns.map((_, index) => csvCell(row[index])).join(",")).join("\r\n")}`;
}
