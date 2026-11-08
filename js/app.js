// js/app.js - 核心主控調度模組（大幅瘦身重構，專注於全域狀態、表格渲染與匯入匯出協調）
import { getHoldingMetrics, getPortfolioMetrics } from "./calculations.js";
import { 
  parseBackup, serializeBackup, serializeJsBackup, 
  serializeCsv, parseCsvBackup, serializeExcel, parseExcelBackup 
} from "./backup.js";
import { applyTranslations, formatMoney, formatQuantity, formatTwd, translateText } from "./i18n.js";
import { 
  loadState, loadStorageMode, saveState, 
  BASE_COLUMNS, DEFAULT_SETTINGS, DEFAULT_ACCOUNT_ID 
} from "./storage.js";
import { getStockName } from "./quotes.js";
import { today, applyTransactionToHolding, makeId } from "./ledger.js";
import { CloudSyncManager } from "./cloud-sync.js";
import { GoogleSheetSyncManager } from "./google-sheet-sync.js";
import { TransactionDialog } from "./dialog-transaction.js";
import { UsStockStreamManager } from "./us-stream.js";
import { getAccountById, renderAccountSelector, openAccountManager } from "./ui-accounts.js";
import { MarketPoller } from "./market-poller.js";
import { initBatchManager } from "./ui-batch.js";
import { initHoldingDialogs } from "./dialog-holding.js";
import { initSettingsDialog } from "./dialog-settings.js";

let storageMode = loadStorageMode();
const state = loadState(storageMode);

// 1. 自動升級舊版欄位排序
const legacyCols = ["currentPrice", "averageCost", "profit", "returnRate", "marketValue", "cost"];
if (Array.isArray(state.settings.columnOrder) && state.settings.columnOrder.some((c) => legacyCols.includes(c))) {
  state.settings.columnOrder = [...DEFAULT_SETTINGS.columnOrder];
  state.settings.hiddenColumns = [...DEFAULT_SETTINGS.hiddenColumns];
  saveState(state, storageMode);
}

// 2. 清理持股為 0 的殘留標的
const beforePurgeCount = state.holdings.length;
state.holdings = state.holdings.filter((h) => Number(h.shares) > 0);
if (state.holdings.length !== beforePurgeCount) saveState(state, storageMode);

// 3. 校正既有持倉中文名稱
let hasRepairedNames = false;
for (const holding of state.holdings) {
  if (!holding.name || holding.name === holding.symbol || holding.name === holding.symbol.replace(/\.(TW|TWO)$/i, "")) {
    const knownName = getStockName(holding.symbol);
    if (knownName) {
      holding.name = knownName;
      hasRepairedNames = true;
    }
  }
}
if (hasRepairedNames) saveState(state, storageMode);

const elements = {
  headerRow: document.querySelector("#holdings-header-row"),
  body: document.querySelector("#holdings-body"),
  emptyState: document.querySelector("#empty-state"),
  toastRegion: document.querySelector("#toast-region"),
  accountSelector: document.querySelector("#account-selector"),
  currentViewLabel: document.querySelector("#current-view-label"),
  summaryAccountTitle: document.querySelector("#summary-account-title"),
};

let activeFilter = "all";

function toast(message, isError = false) {
  const node = document.createElement("div");
  node.className = `toast${isError ? " error" : ""}`;
  node.textContent = translateText(message, state.settings.language);
  elements.toastRegion?.append(node);
  window.setTimeout(() => node.remove(), 3600);
}

function persist() {
  if (!saveState(state, storageMode)) {
    toast("無法儲存資料，請確認瀏覽器儲存空間或隱私設定。", true);
    return;
  }
  if (storageMode === "cloud") cloudSync.scheduleSave(storageMode);
  if (storageMode === "google-sheet") googleSheetSync.scheduleAutoSave();
}

function replaceState(nextState, { syncCloud = true } = {}) {
  const previousState = { ...state };
  Object.assign(state, nextState);
  delete state.storageError;
  state.holdings = state.holdings.filter((h) => Number(h.shares) > 0);
  if (!saveState(state, storageMode)) {
    Object.assign(state, previousState);
    throw new Error("無法儲存匯入資料，原有資料未變更。");
  }
  if (storageMode === "cloud" && syncCloud) cloudSync.scheduleSave(storageMode);
  if (storageMode === "google-sheet") googleSheetSync.scheduleAutoSave();
  const langSetting = document.querySelector("#language-setting");
  if (langSetting) langSetting.value = state.settings.language;
  syncUsStreamSubscriptions();
  render();
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ----------------- 連線與模組實例化 -----------------
const cloudSync = new CloudSyncManager({
  getState: () => state,
  onStateReplace: replaceState,
  render,
  toast,
});

const googleSheetSync = new GoogleSheetSyncManager({
  getState: () => state,
  onStateReplace: replaceState,
  toast,
});

const txDialog = new TransactionDialog({
  getState: () => state,
  onTransactionSaved: (activeHolding) => {
    state.holdings = state.holdings.filter((h) => Number(h.shares) > 0);
    syncUsStreamSubscriptions();
    persist();
    render();
    if (activeHolding && activeHolding.shares > 0) holdingDialogs.openHoldingDetails(activeHolding);
  },
  onOpenDetails: (holding) => holdingDialogs.openHoldingDetails(holding),
  toast,
});

async function fetchUsWsUrl() {
  try {
    const rawUrl = new URL(state.settings.quoteApiUrl || "https://my-stock-api-nhaj.onrender.com/api/realtime");
    const baseUrl = `${rawUrl.protocol}//${rawUrl.host}`;
    const res = await fetch(`${baseUrl}/api/us-ws-url`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.ws_url;
  } catch {
    return "";
  }
}

const usStream = new UsStockStreamManager({
  getWsUrl: fetchUsWsUrl,
  token: state.settings.finnhubToken || "",
  mode: state.settings.usStreamMode || "standard",
  onPriceUpdate: ({ symbol, price, timestamp }) => {
    let hasUpdated = false;
    for (const holding of state.holdings) {
      if (holding.market === "US" && holding.symbol.toUpperCase() === symbol.toUpperCase()) {
        holding.currentPrice = price;
        holding.updatedAt = new Date(timestamp).toISOString();
        if (holding.previousClose && Number(holding.previousClose) > 0) {
          holding.dailyChangePerShare = price - Number(holding.previousClose);
        }
        hasUpdated = true;
      }
    }
    if (hasUpdated) {
      persist();
      render();
    }
  },
  onStatusChange: (status) => {
    const elem = document.querySelector("#us-stream-status");
    if (!elem) return;
    elem.className = `stream-indicator ${status}`;
    const map = { connected: "美股即時串流中", connecting: "美股串流連線中…", disconnected: "美股串流已斷線", missing_token: "後端未設定 FINNHUB_TOKEN", error: "美股串流異常" };
    elem.title = map[status] || status;
  },
});

function syncUsStreamSubscriptions() {
  const activeUsSymbols = state.holdings.filter((h) => h.market === "US" && Number(h.shares) > 0).map((h) => h.symbol);
  usStream.setSymbols(activeUsSymbols);
}

const marketPoller = new MarketPoller({
  getState: () => state,
  persist,
  render,
  usStream,
  toast,
});

// 初始化 3 大抽離模組
initBatchManager({
  state,
  persist,
  render,
  toast,
  renderAccountSelector: () => renderAccountSelector({ state, elements }),
});

const holdingDialogs = initHoldingDialogs({
  state,
  persist,
  render,
  toast,
  txDialog,
  syncUsStreamSubscriptions,
});

const settingsDialog = initSettingsDialog({
  state,
  getStorageMode: () => storageMode,
  setStorageMode: (mode) => { storageMode = mode; },
  persist,
  render,
  toast,
  cloudSync,
  googleSheetSync,
  usStream,
  syncUsStreamSubscriptions,
  replaceState,
  txDialog,
});

// ----------------- 表格排序與欄位設定 -----------------
function getActiveColumns() {
  const customMap = new Map(state.customFields.map((f) => [f.id, { id: f.id, label: f.name, isCustom: true }]));
  const baseMap = new Map(BASE_COLUMNS.map((c) => [c.id, c]));
  const combined = [];
  const currentOrder = state.settings.columnOrder || DEFAULT_SETTINGS.columnOrder;

  for (const colId of currentOrder) {
    if (baseMap.has(colId)) combined.push(baseMap.get(colId));
    else if (customMap.has(colId)) combined.push(customMap.get(colId));
  }
  for (const [id, field] of customMap.entries()) {
    if (!combined.some((c) => c.id === id)) combined.splice(combined.length - 1, 0, field);
  }
  for (const baseCol of BASE_COLUMNS) {
    if (!combined.some((c) => c.id === baseCol.id)) {
      const defIdx = DEFAULT_SETTINGS.columnOrder.indexOf(baseCol.id);
      const insertAt = defIdx >= 0 && defIdx < combined.length ? defIdx : Math.max(0, combined.length - 1);
      combined.splice(insertAt, 0, baseCol);
    }
  }

  const hiddenSet = new Set(state.settings.hiddenColumns || DEFAULT_SETTINGS.hiddenColumns);
  return combined.filter((col) => !hiddenSet.has(col.id));
}

function handleSort(key) {
  if (key === "actions") return;
  if (state.settings.sortKey === key) {
    state.settings.sortDirection = state.settings.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.settings.sortKey = key;
    state.settings.sortDirection = "desc";
  }
  persist();
  render();
}

function getSortedHoldings(holdings) {
  const key = state.settings.sortKey || "marketValueCost";
  const dir = state.settings.sortDirection === "asc" ? 1 : -1;

  return [...holdings].sort((a, b) => {
    const metricsA = getHoldingMetrics(a);
    const metricsB = getHoldingMetrics(b);
    let valA, valB;
    if (key === "symbol") return String(a.symbol).localeCompare(String(b.symbol)) * dir;
    if (key === "buyDate") return String(a.buyDate || "").localeCompare(String(b.buyDate || "")) * dir;
    if (key === "priceCost" || key === "currentPrice") { valA = a.currentPrice; valB = b.currentPrice; }
    else if (key === "averageCost") { valA = metricsA.averageCost; valB = metricsB.averageCost; }
    else if (key === "shares") { valA = a.shares; valB = b.shares; }
    else if (key === "fees") { valA = a.fees; valB = b.fees; }
    else if (key === "dividends") { valA = a.dividends || 0; valB = b.dividends || 0; }
    else if (key === "cost") { valA = metricsA.cost; valB = metricsB.cost; }
    else if (key === "marketValueCost" || key === "marketValue") { valA = metricsA.marketValue; valB = metricsB.marketValue; }
    else if (key === "profitRate" || key === "profit") { valA = metricsA.profit; valB = metricsB.profit; }
    else if (key === "returnRate") { valA = metricsA.returnRate; valB = metricsB.returnRate; }
    else {
      valA = a.custom?.[key] ?? "";
      valB = b.custom?.[key] ?? "";
      const numA = Number(valA);
      const numB = Number(valB);
      if (valA !== "" && valB !== "" && Number.isFinite(numA) && Number.isFinite(numB)) return (numA - numB) * dir;
      return String(valA).localeCompare(String(valB)) * dir;
    }
    if (valA === Infinity) return 1 * dir;
    if (valB === Infinity) return -1 * dir;
    return ((Number(valA) || 0) - (Number(valB) || 0)) * dir;
  });
}

function formatReturnRate(rate) {
  if (rate === Infinity) return "+∞%";
  return `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%`;
}

function textCell(text, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function renderTableHeaders() {
  const headerRow = elements.headerRow;
  if (!headerRow) return;
  headerRow.replaceChildren();

  const activeColumns = getActiveColumns();
  for (const col of activeColumns) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = `sortable-header ${col.id === "actions" ? "action-header" : ""}`;

    if (col.label.includes(" / ") && col.id !== "symbol") {
      const [mainTitle, subTitle] = col.label.split(" / ");
      const wrap = document.createElement("div");
      wrap.className = "th-compound-wrap";
      const mainSpan = document.createElement("span");
      mainSpan.textContent = translateText(mainTitle, state.settings.language);
      const subSpan = document.createElement("small");
      subSpan.textContent = translateText(subTitle, state.settings.language);
      wrap.append(mainSpan, subSpan);
      th.append(wrap);
    } else {
      const textSpan = document.createElement("span");
      textSpan.textContent = translateText(col.label, state.settings.language);
      th.append(textSpan);
    }

    if (col.id !== "actions") {
      th.tabIndex = 0;
      th.setAttribute("role", "button");
      th.setAttribute("aria-label", `依 ${col.label} 排序`);

      if (state.settings.sortKey === col.id) {
        th.classList.add("sorted");
        const arrow = document.createElement("span");
        arrow.className = "sort-arrow";
        arrow.textContent = state.settings.sortDirection === "asc" ? " ▲" : " ▼";
        th.append(arrow);
      }

      const triggerSort = () => handleSort(col.id);
      th.addEventListener("click", triggerSort);
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          triggerSort();
        }
      });
    }

    if (col.isCustom) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "custom-delete";
      removeBtn.textContent = "×";
      removeBtn.title = translateText(`刪除「${col.label}」欄位`, state.settings.language);
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        holdingDialogs.deleteCustomField({ id: col.id, name: col.label });
      });
      th.append(removeBtn);
    }

    headerRow.append(th);
  }
}

function makeHoldingRow(holding, activeColumns) {
  const row = document.createElement("tr");
  row.className = "holding-row";
  row.tabIndex = 0;
  row.setAttribute("aria-label", translateText(`查看 ${holding.symbol} 交易明細`, state.settings.language));
  row.addEventListener("click", (event) => {
    if (!event.target.closest("button")) holdingDialogs.openHoldingDetails(holding);
  });
  row.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !event.target.closest("button")) {
      event.preventDefault();
      holdingDialogs.openHoldingDetails(holding);
    }
  });

  const metrics = getHoldingMetrics(holding);
  const autoResolvedName = getStockName(holding.symbol) || holding.name || holding.symbol;
  const holdingAccount = getAccountById(holding.accountId || DEFAULT_ACCOUNT_ID, state);

  for (const col of activeColumns) {
    if (col.id === "symbol") {
      const nameCell = document.createElement("td");
      const nameWrap = document.createElement("div");
      nameWrap.className = "holding-name";

      const avatar = document.createElement("span");
      avatar.className = `stock-avatar${holding.market === "US" ? " us" : holding.market === "CA" ? " ca" : ""}`;
      avatar.textContent = holding.market === "US" ? "US" : holding.market === "CA" ? "CA" : "台";

      const copy = document.createElement("span");
      copy.className = "stock-copy";

      const titleRow = document.createElement("div");
      titleRow.className = "stock-title-row";
      const symbol = document.createElement("strong");
      symbol.textContent = holding.symbol;
      titleRow.append(symbol);

      if (state.activeAccountId === "all") {
        const badge = document.createElement("span");
        badge.className = "account-badge";
        badge.textContent = holdingAccount.name;
        titleRow.append(badge);
      }

      const subInfo = document.createElement("small");
      subInfo.textContent = `${autoResolvedName} · ${formatQuantity(holding.shares, state.settings.language)} ${translateText("股", state.settings.language)}`;

      copy.append(titleRow, subInfo);
      nameWrap.append(avatar, copy);
      nameCell.append(nameWrap);
      row.append(nameCell);
    } else if (col.id === "priceCost") {
      const cell = document.createElement("td");
      cell.className = "compound-cell";
      const top = document.createElement("div");
      top.className = "compound-top";
      top.textContent = formatMoney(holding.currentPrice, holding.market, 2, state.settings.language);
      const bottom = document.createElement("div");
      bottom.className = "compound-bottom muted";
      bottom.textContent = formatMoney(metrics.averageCost, holding.market, 2, state.settings.language);
      cell.append(top, bottom);
      row.append(cell);
    } else if (col.id === "profitRate") {
      const cell = document.createElement("td");
      cell.className = "compound-cell";
      const profitClass = metrics.profit > 0 ? "gain" : metrics.profit < 0 ? "loss" : "muted-value";
      const top = document.createElement("div");
      top.className = `compound-top ${profitClass}`;
      top.textContent = formatMoney(metrics.profit, holding.market, 2, state.settings.language);
      const bottom = document.createElement("div");
      bottom.className = `compound-bottom ${profitClass}`;
      bottom.textContent = formatReturnRate(metrics.returnRate);
      cell.append(top, bottom);
      row.append(cell);
    } else if (col.id === "marketValueCost") {
      const cell = document.createElement("td");
      cell.className = "compound-cell";
      const top = document.createElement("div");
      top.className = "compound-top";
      top.textContent = formatMoney(metrics.marketValue, holding.market, 2, state.settings.language);
      const bottom = document.createElement("div");
      bottom.className = "compound-bottom muted";
      bottom.textContent = formatMoney(metrics.cost, holding.market, 2, state.settings.language);
      cell.append(top, bottom);
      row.append(cell);
    } else if (col.id === "currentPrice") {
      row.append(textCell(formatMoney(holding.currentPrice, holding.market, 2, state.settings.language)));
    } else if (col.id === "averageCost") {
      row.append(textCell(formatMoney(metrics.averageCost, holding.market, 2, state.settings.language)));
    } else if (col.id === "profit") {
      row.append(textCell(formatMoney(metrics.profit, holding.market, 2, state.settings.language), metrics.profit > 0 ? "gain" : metrics.profit < 0 ? "loss" : "muted-value"));
    } else if (col.id === "returnRate") {
      row.append(textCell(formatReturnRate(metrics.returnRate), metrics.returnRate > 0 ? "gain" : metrics.returnRate < 0 ? "loss" : "muted-value"));
    } else if (col.id === "marketValue") {
      row.append(textCell(formatMoney(metrics.marketValue, holding.market, 2, state.settings.language)));
    } else if (col.id === "cost") {
      row.append(textCell(formatMoney(metrics.cost, holding.market, 2, state.settings.language)));
    } else if (col.id === "fees") {
      row.append(textCell(formatMoney(holding.fees, holding.market, 2, state.settings.language)));
    } else if (col.id === "dividends") {
      row.append(textCell(formatMoney(holding.dividends || 0, holding.market, 2, state.settings.language)));
    } else if (col.id === "shares") {
      row.append(textCell(formatQuantity(holding.shares, state.settings.language)));
    } else if (col.id === "buyDate") {
      row.append(textCell(holding.buyDate ? holding.buyDate.slice(0, 10) : "—"));
    } else if (col.id === "actions") {
      const actionsCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "cell-actions";
      const edit = document.createElement("button");
      edit.className = "row-action";
      edit.textContent = translateText("編輯", state.settings.language);
      edit.addEventListener("click", () => holdingDialogs.openEditDialog(holding));
      const remove = document.createElement("button");
      remove.className = "row-action danger";
      remove.textContent = translateText("刪除", state.settings.language);
      remove.addEventListener("click", () => holdingDialogs.deleteHolding(holding));
      const trade = document.createElement("button");
      trade.className = "row-action";
      trade.textContent = translateText("交易", state.settings.language);
      trade.addEventListener("click", () => txDialog.open(holding));
      actions.append(edit, trade, remove);
      actionsCell.append(actions);
      row.append(actionsCell);
    } else {
      row.append(textCell(String(holding.custom?.[col.id] || "—"), "custom-cell"));
    }
  }

  return row;
}

// ----------------- 全頁渲染核心流程 -----------------
function render() {
  const activeColumns = getActiveColumns();
  renderTableHeaders();
  renderAccountSelector({ state, elements });

  if (elements.body) elements.body.replaceChildren();

  const accountScopedHoldings = state.holdings.filter((h) => 
    Number(h.shares) > 0 && 
    (!state.activeAccountId || state.activeAccountId === "all" || (h.accountId || DEFAULT_ACCOUNT_ID) === state.activeAccountId)
  );

  const hasMarket = {
    TW: accountScopedHoldings.some((h) => h.market === "TW"),
    US: accountScopedHoldings.some((h) => h.market === "US"),
    CA: accountScopedHoldings.some((h) => h.market === "CA"),
  };

  const marketTabs = document.querySelectorAll(".table-tab[data-filter]");
  marketTabs.forEach((tab) => {
    const filter = tab.dataset.filter;
    tab.hidden = filter !== "all" && !hasMarket[filter];
  });

  if (activeFilter !== "all" && !hasMarket[activeFilter]) activeFilter = "all";
  marketTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.filter === activeFilter));

  const visible = accountScopedHoldings.filter((holding) => activeFilter === "all" || holding.market === activeFilter);
  const sorted = getSortedHoldings(visible);

  for (const holding of sorted) {
    try {
      elements.body?.append(makeHoldingRow(holding, activeColumns));
    } catch (err) {
      console.error(`渲染標的 ${holding.symbol} 異常:`, err);
    }
  }

  const hasHoldings = visible.length > 0;
  elements.emptyState?.classList.toggle("visible", !hasHoldings);
  const table = document.querySelector("table");
  if (table) table.hidden = !hasHoldings;

  const tableCount = document.querySelector("#table-count");
  if (tableCount) tableCount.textContent = `${visible.length} 檔`;
  const tableFooterCount = document.querySelector("#table-footer-count");
  if (tableFooterCount) tableFooterCount.textContent = `顯示 ${visible.length} 筆持倉`;

  // 指標總覽動態計算
  const totals = getPortfolioMetrics(accountScopedHoldings, state.settings);
  const isUsd = state.settings.overviewCurrency === "USD";
  const fxRate = Number(state.settings.fxRate) > 0 ? Number(state.settings.fxRate) : 32.5;

  const primaryMarketValue = isUsd ? formatMoney(totals.marketValue / fxRate, "US", 2, state.settings.language) : formatTwd(totals.marketValue, 0, state.settings.language);
  const alternateMarketValue = isUsd ? formatTwd(totals.marketValue, 0, state.settings.language) : formatMoney(totals.marketValue / fxRate, "US", 2, state.settings.language);

  const totalVal = document.querySelector("#total-value");
  if (totalVal) totalVal.textContent = primaryMarketValue;
  const totalValAlt = document.querySelector("#total-value-alternate");
  if (totalValAlt) totalValAlt.textContent = alternateMarketValue;
  const totalValAltLabel = document.querySelector("#total-value-alternate-label");
  if (totalValAltLabel) totalValAltLabel.textContent = translateText(isUsd ? "新台幣等值" : "美元等值", state.settings.language);

  const summaryNote = document.querySelector("#summary-currency-note");
  if (summaryNote) summaryNote.textContent = translateText(isUsd ? "依庫存現價估算・美元" : "依庫存現價估算・新台幣", state.settings.language);

  document.querySelectorAll("[data-overview-currency]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.overviewCurrency === state.settings.overviewCurrency));
  });

  const formatOverviewAmount = (value) => isUsd ? formatMoney(value / fxRate, "US", 2, state.settings.language) : formatTwd(value, 0, state.settings.language);

  const totalCost = document.querySelector("#total-cost");
  if (totalCost) totalCost.textContent = formatOverviewAmount(totals.cost);

  const profitElement = document.querySelector("#total-profit");
  if (profitElement) {
    profitElement.textContent = `${totals.profit > 0 ? "+" : ""}${formatOverviewAmount(totals.profit)}`;
    profitElement.classList.toggle("positive", totals.profit > 0);
    profitElement.classList.toggle("negative", totals.profit < 0);
  }

  const dividendsElement = document.querySelector("#total-dividends");
  if (dividendsElement) dividendsElement.textContent = formatOverviewAmount(totals.dividends || 0);

  const dailyProfitElement = document.querySelector("#daily-profit");
  if (dailyProfitElement) {
    dailyProfitElement.textContent = totals.dailyProfit === null ? "—" : `${totals.dailyProfit > 0 ? "+" : ""}${formatOverviewAmount(totals.dailyProfit)}`;
    dailyProfitElement.classList.toggle("positive", (totals.dailyProfit || 0) > 0);
    dailyProfitElement.classList.toggle("negative", (totals.dailyProfit || 0) < 0);
  }

  const returnElement = document.querySelector("#average-return");
  if (returnElement) {
    returnElement.textContent = formatReturnRate(totals.returnRate);
    returnElement.classList.toggle("positive", totals.returnRate > 0);
    returnElement.classList.toggle("negative", totals.returnRate < 0);
  }

  const holdingCount = document.querySelector("#holding-count");
  if (holdingCount) holdingCount.innerHTML = `${accountScopedHoldings.length} <small>檔</small>`;

  applyTranslations(state.settings.language);
}

// ----------------- 自訂欄位順序彈窗 -----------------
function openColumnManager() {
  const dialog = document.querySelector("#column-manager-dialog");
  const list = dialog?.querySelector("#column-order-list");
  if (!dialog || !list) return;

  function renderColumnList() {
    list.replaceChildren();
    const customMap = new Map(state.customFields.map((f) => [f.id, { id: f.id, label: f.name, isCustom: true }]));
    const baseMap = new Map(BASE_COLUMNS.map((c) => [c.id, c]));
    const currentOrder = state.settings.columnOrder || DEFAULT_SETTINGS.columnOrder;
    const orderedCols = [];

    for (const colId of currentOrder) {
      if (baseMap.has(colId)) orderedCols.push(baseMap.get(colId));
      else if (customMap.has(colId)) orderedCols.push(customMap.get(colId));
    }
    for (const [id, field] of customMap.entries()) {
      if (!orderedCols.some((c) => c.id === id)) orderedCols.splice(orderedCols.length - 1, 0, field);
    }
    for (const baseCol of BASE_COLUMNS) {
      if (!orderedCols.some((c) => c.id === baseCol.id)) {
        const defIdx = DEFAULT_SETTINGS.columnOrder.indexOf(baseCol.id);
        const insertAt = defIdx >= 0 && defIdx < orderedCols.length ? defIdx : Math.max(0, orderedCols.length - 1);
        orderedCols.splice(insertAt, 0, baseCol);
      }
    }

    const hiddenSet = new Set(state.settings.hiddenColumns || DEFAULT_SETTINGS.hiddenColumns);

    orderedCols.forEach((col, index) => {
      const li = document.createElement("li");
      li.className = "column-item";

      const left = document.createElement("div");
      left.className = "column-item-left";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !hiddenSet.has(col.id);
      checkbox.disabled = Boolean(col.locked);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.settings.hiddenColumns = state.settings.hiddenColumns.filter((id) => id !== col.id);
        else if (!state.settings.hiddenColumns.includes(col.id)) state.settings.hiddenColumns.push(col.id);
        persist();
        render();
      });

      const label = document.createElement("span");
      label.textContent = translateText(col.label, state.settings.language);
      left.append(checkbox, label);

      const actions = document.createElement("div");
      actions.className = "column-item-actions";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "move-btn";
      upBtn.textContent = "↑";
      upBtn.disabled = index === 0 || col.locked || orderedCols[index - 1]?.locked;
      upBtn.addEventListener("click", () => {
        const temp = orderedCols[index - 1];
        orderedCols[index - 1] = orderedCols[index];
        orderedCols[index] = temp;
        state.settings.columnOrder = orderedCols.map((c) => c.id);
        persist();
        renderColumnList();
        render();
      });

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "move-btn";
      downBtn.textContent = "↓";
      downBtn.disabled = index === orderedCols.length - 1 || col.locked || orderedCols[index + 1]?.locked;
      downBtn.addEventListener("click", () => {
        const temp = orderedCols[index + 1];
        orderedCols[index + 1] = orderedCols[index];
        orderedCols[index] = temp;
        state.settings.columnOrder = orderedCols.map((c) => c.id);
        persist();
        renderColumnList();
        render();
      });

      actions.append(upBtn, downBtn);
      li.append(left, actions);
      list.append(li);
    });
  }

  const resetBtn = dialog.querySelector("#reset-columns-btn");
  if (resetBtn) {
    resetBtn.onclick = () => {
      state.settings.columnOrder = [...DEFAULT_SETTINGS.columnOrder];
      state.settings.hiddenColumns = [...DEFAULT_SETTINGS.hiddenColumns];
      persist();
      renderColumnList();
      render();
    };
  }

  renderColumnList();
  dialog.showModal();
}

// ----------------- 多格式統一匯出與匯入 -----------------
document.querySelector("#export-backup-json")?.addEventListener("click", () => {
  downloadFile(`xian-stock-backup-${today()}.json`, serializeBackup(state), "application/json;charset=utf-8");
  toast("JSON 完整備份已下載。");
});

document.querySelector("#export-backup-js")?.addEventListener("click", () => {
  downloadFile(`xian-stock-backup-${today()}.js`, serializeJsBackup(state), "application/javascript;charset=utf-8");
  toast("JS 格式備份已下載。");
});

document.querySelector("#export-backup-csv")?.addEventListener("click", () => {
  downloadFile(`xian-stock-export-${today()}.csv`, serializeCsv(state), "text/csv;charset=utf-8");
  toast("CSV 試算表已下載。");
});

document.querySelector("#export-backup-xls")?.addEventListener("click", () => {
  try {
    const blob = serializeExcel(state);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `xian-stock-export-${today()}.xlsx`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Excel (XLSX) 活頁簿已下載。");
  } catch (err) {
    toast(err.message, true);
  }
});

document.querySelector("#import-backup-btn")?.addEventListener("click", () => {
  document.querySelector("#import-file-unified")?.click();
});

document.querySelector("#import-file-unified")?.addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  try {
    if (file.size > 25 * 1024 * 1024) throw new Error("檔案超過 25 MB，無法匯入。");
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    let imported;

    if (ext === ".xlsx" || ext === ".xls") {
      const buf = await file.arrayBuffer();
      imported = parseExcelBackup(buf);
    } else if (ext === ".csv") {
      const text = await file.text();
      imported = parseCsvBackup(text);
    } else if (ext === ".json" || ext === ".js") {
      const text = await file.text();
      imported = parseBackup(text);
    } else {
      throw new Error("不支援的格式，請匯入 JSON、JS、CSV 或 Excel (XLSX/XLS)。");
    }

    const currentHoldingsCount = state.holdings.filter((h) => Number(h.shares) > 0).length;
    const currentTxCount = state.transactions.length;
    const isExternal = Boolean(imported._isExternalTable);

    // 存在舊資料時詢問追加或覆蓋
    if ((currentHoldingsCount > 0 || currentTxCount > 0) && isExternal) {
      const promptText = translateText(
        `偵測到您目前已有持倉或交易紀錄。\n\n【確定】：追加補記錄（將新資料併入現有帳本）\n【取消】：全新覆蓋（清除現有資料，以此檔案為主）`,
        state.settings.language
      );
      const isAppend = window.confirm(promptText);

      if (isAppend) {
        const targetAccountId = state.activeAccountId && state.activeAccountId !== "all" ? state.activeAccountId : DEFAULT_ACCOUNT_ID;
        for (const tx of imported.transactions) {
          tx.accountId = targetAccountId;
          state.transactions.push(tx);
        }

        const holdingsMap = new Map();
        const sortedTx = [...state.transactions].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        for (const tx of sortedTx) {
          const key = `${tx.accountId}:${tx.market}:${tx.symbol}`;
          let holding = holdingsMap.get(key);
          if (!holding) {
            holding = {
              id: makeId(),
              accountId: tx.accountId || DEFAULT_ACCOUNT_ID,
              symbol: tx.symbol,
              name: tx.name || tx.symbol,
              market: tx.market,
              currency: tx.market === "US" ? "USD" : tx.market === "CA" ? "CAD" : "TWD",
              buyDate: tx.date || new Date().toISOString().slice(0, 10),
              shares: 0,
              costBasis: 0,
              currentPrice: tx.price || 0,
              dailyChangePerShare: null,
              fees: 0,
              realizedProfit: 0,
              dividends: 0,
              custom: {},
              updatedAt: null,
            };
            holdingsMap.set(key, holding);
          }
          try {
            applyTransactionToHolding(holding, tx);
          } catch {}
        }

        state.holdings = Array.from(holdingsMap.values()).filter((h) => h.shares > 0);
        persist();
        render();
        marketPoller.refreshAllQuotes({ silent: true });
        toast(`已成功追加補記 ${imported.transactions.length} 筆明細，庫存已重新計算！`);
        return;
      }
    }

    // 全新取代覆蓋
    replaceState(imported);
    marketPoller.refreshAllQuotes({ silent: true });

    const totalCount = (imported.holdings || []).length || (imported.transactions || []).length;
    if (totalCount === 25) {
      toast(`ℹ️ 提醒：本次匯入剛好為 25 筆，若您實際持股更多，請確認券商匯出時是否選擇了「顯示全部」而非預設的「每頁 25 筆」。`);
    } else {
      toast(`已成功由 ${file.name} 匯入 ${totalCount} 筆資料！`);
    }
  } catch (error) {
    toast(translateText(error.message || "無法匯入檔案。", state.settings.language), true);
  } finally {
    input.value = "";
  }
});

// ----------------- 全域事件監聽 -----------------
document.querySelector("#add-holding")?.addEventListener("click", () => txDialog.open());
document.querySelector("#add-holding-table")?.addEventListener("click", () => txDialog.open());
document.querySelector("#empty-add-holding")?.addEventListener("click", () => txDialog.open());
document.querySelector("#manage-columns-btn")?.addEventListener("click", openColumnManager);
document.querySelector("#open-settings")?.addEventListener("click", settingsDialog.openSettings);
document.querySelector("#open-settings-top")?.addEventListener("click", settingsDialog.openSettings);
document.querySelector("#add-custom-field")?.addEventListener("click", () => document.querySelector("#custom-field-dialog")?.showModal());
document.querySelector("#manage-accounts-btn")?.addEventListener("click", () => {
  openAccountManager({
    state,
    persist,
    renderAccountSelector: () => renderAccountSelector({ state, elements }),
    render,
    toast,
  });
});

elements.accountSelector?.addEventListener("change", (e) => {
  state.activeAccountId = e.target.value;
  persist();
  render();
});

document.querySelectorAll("[data-overview-currency]").forEach((button) => {
  button.addEventListener("click", () => {
    const currency = button.dataset.overviewCurrency;
    if (currency !== "TWD" && currency !== "USD") return;
    state.settings.overviewCurrency = currency;
    persist();
    render();
  });
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.close);
    if (dialog && typeof dialog.close === "function") dialog.close();
  });
});

document.querySelectorAll(".table-tab").forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".table-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
  render();
}));

document.querySelector("#refresh-quotes")?.addEventListener("click", () => {
  marketPoller.refreshAllQuotes({ silent: false });
});

document.querySelector("#us-stream-mode-toggle")?.addEventListener("click", () => {
  const currentMode = state.settings.usStreamMode || "standard";
  const nextMode = currentMode === "standard" ? "geek" : "standard";
  state.settings.usStreamMode = nextMode;
  usStream.setMode(nextMode);
  persist();
  const btn = document.querySelector("#us-stream-mode-toggle");
  if (btn) {
    btn.textContent = nextMode === "geek" ? "⚡ Geek 模式" : "⏱️ 標準模式";
    btn.className = `stream-mode-btn ${nextMode === "geek" ? "active-geek" : "active-standard"}`;
  }
  toast(`已切換為美股 ${nextMode === "geek" ? "極客模式 (24H Ticks)" : "標準模式 (常規盤 5s 節流)"}`);
});

// 側欄錨點捲動
document.querySelectorAll(".nav-item[href]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  link.classList.add("active");
  const targetId = link.dataset.scrollTarget || link.getAttribute("href")?.slice(1);
  const target = targetId ? document.getElementById(targetId) : null;
  if (target) {
    document.querySelectorAll(".section-navigation-focus").forEach((section) => section.classList.remove("section-navigation-focus"));
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
    target.classList.add("section-navigation-focus");
    window.setTimeout(() => target.classList.remove("section-navigation-focus"), 1400);
    history.replaceState(null, "", `#${targetId}`);
  }
}));

// 共用檔案與系統啟動
document.querySelector("#shared-file-open")?.addEventListener("click", () => cloudSync.runAction(() => cloudSync.selectAndLoadFile(storageMode), storageMode));
document.querySelector("#shared-folder-select")?.addEventListener("click", () => {
  let pickerPromise;
  try {
    pickerPromise = window.showDirectoryPicker({ mode: "readwrite" });
  } catch (error) {
    cloudSync.updateControls(error.message || "無法開啟資料夾選擇器。", storageMode);
    toast(translateText(error.message || "共用檔案操作失敗。", state.settings.language), true);
    return;
  }
  cloudSync.runAction(() => cloudSync.selectDirectory(pickerPromise, storageMode), storageMode);
});
document.querySelector("#shared-file-create")?.addEventListener("click", () => cloudSync.runAction(() => cloudSync.createFile(storageMode), storageMode));
document.querySelector("#shared-file-load")?.addEventListener("click", () => cloudSync.runAction(() => cloudSync.loadFile(storageMode), storageMode));
document.querySelector("#shared-file-save")?.addEventListener("click", () => cloudSync.runAction(() => cloudSync.saveToFile(storageMode), storageMode));
document.querySelector("#shared-file-disconnect")?.addEventListener("click", () => cloudSync.runAction(() => cloudSync.disconnect(storageMode), storageMode));

const footerYear = document.querySelector("#footer-year");
if (footerYear) footerYear.textContent = new Date().getFullYear();

if (state.storageError) toast("讀取已儲存資料時發生問題，目前顯示空白資料。", true);

// ============================================================================
// 系統啟動生命週期
// ============================================================================
render();
cloudSync.init(storageMode);
usStream.connect();
syncUsStreamSubscriptions();
marketPoller.start();
const streamModeBtn = document.querySelector("#us-stream-mode-toggle");
if (streamModeBtn) {
  const isGeek = state.settings.usStreamMode === "geek";
  streamModeBtn.textContent = isGeek ? "⚡ Geek 模式" : "⏱️ 標準模式";
  streamModeBtn.className = `stream-mode-btn ${isGeek ? "active-geek" : "active-standard"}`;
}