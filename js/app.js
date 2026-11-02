// js/app.js - 前端主控調度模組（整合多格式匯入匯出、Google 試算表全平台同步、美股 WebSocket 串流與多帳戶管理）
import { getHoldingMetrics, getPortfolioMetrics } from "./calculations.js";
import { 
  parseBackup, serializeBackup, serializeJsBackup, 
  serializeCsv, parseCsvBackup, serializeExcel, parseExcelBackup 
} from "./backup.js";
import { applyTranslations, formatMoney, formatQuantity, formatTwd, locale, translateText } from "./i18n.js";
import { 
  loadState, loadStorageMode, saveState, saveStorageMode, 
  BASE_COLUMNS, DEFAULT_SETTINGS, DEFAULT_ACCOUNT_ID 
} from "./storage.js";
import { getStockName } from "./quotes.js";
import { 
  normalizeSymbol, ledgerKey, transactionsForHolding, 
  holdingBalance, rebuildHolding, makeId, today 
} from "./ledger.js";
import { CloudSyncManager } from "./cloud-sync.js";
import { GoogleSheetSyncManager } from "./google-sheet-sync.js";
import { TransactionDialog } from "./dialog-transaction.js";
import { UsStockStreamManager } from "./us-stream.js";
import { getAccountById, renderAccountSelector, openAccountManager } from "./ui-accounts.js";
import { MarketPoller } from "./market-poller.js";

let storageMode = loadStorageMode();
const state = loadState(storageMode);

// 1. 自動補齊舊版 LocalStorage 缺少的新官方欄位
if (Array.isArray(state.settings.columnOrder) && !state.settings.columnOrder.includes("dividends")) {
  const defIdx = DEFAULT_SETTINGS.columnOrder.indexOf("dividends");
  state.settings.columnOrder.splice(defIdx >= 0 ? defIdx : state.settings.columnOrder.length - 1, 0, "dividends");
  saveState(state, storageMode);
}

// 2. 核心清洗：徹底清除持股為 0 的殘留標的
const beforePurgeCount = state.holdings.length;
state.holdings = state.holdings.filter((h) => Number(h.shares) > 0);
if (state.holdings.length !== beforePurgeCount) {
  saveState(state, storageMode);
}

// 3. 自動校正既有持倉中文名稱
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
let activeHoldingId = null;

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

// ----------------- 雲端同步與交握模組實例化 -----------------
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
    if (activeHolding && activeHolding.shares > 0) openHoldingDetails(activeHolding);
  },
  onOpenDetails: (holding) => openHoldingDetails(holding),
  toast,
});

function getBackendBaseUrl() {
  try {
    const url = new URL(state.settings.quoteApiUrl || "https://my-stock-api-nhaj.onrender.com/api/realtime");
    return `${url.protocol}//${url.host}`;
  } catch {
    return "https://my-stock-api-nhaj.onrender.com";
  }
}

async function fetchUsWsUrl() {
  const baseUrl = getBackendBaseUrl();
  const res = await fetch(`${baseUrl}/api/us-ws-url`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || "後端交握失敗，未能取得美股串流授權");
  }
  const data = await res.json();
  return data.ws_url;
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

        if (holding.previousClose !== null && holding.previousClose !== undefined && Number(holding.previousClose) > 0) {
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
    updateStreamStatusUI(status);
  },
});

function syncUsStreamSubscriptions() {
  const activeUsSymbols = state.holdings
    .filter((h) => h.market === "US" && Number(h.shares) > 0)
    .map((h) => h.symbol);
  usStream.setSymbols(activeUsSymbols);
}

function updateStreamStatusUI(status) {
  const statusElem = document.querySelector("#us-stream-status");
  if (!statusElem) return;
  statusElem.className = `stream-indicator ${status}`;
  const labelMap = {
    connected: "美股即時串流中",
    connecting: "美股串流連線中…",
    disconnected: "美股串流已斷線",
    missing_token: "後端未設定 FINNHUB_TOKEN",
    error: "美股串流異常",
  };
  statusElem.title = labelMap[status] || status;
}

function updateStreamModeButtonUI(mode) {
  const btn = document.querySelector("#us-stream-mode-toggle");
  if (!btn) return;
  const isGeek = mode === "geek";
  btn.textContent = isGeek ? "⚡ Geek 模式" : "⏱️ 標準模式";
  btn.className = `stream-mode-btn ${isGeek ? "active-geek" : "active-standard"}`;
}

const marketPoller = new MarketPoller({
  getState: () => state,
  persist,
  render,
  usStream,
  toast,
});

// ----------------- 儲存模式切換（支援本機、PC共用檔與 Google 試算表） -----------------
async function switchStorageMode(nextMode) {
  if (nextMode === storageMode) return;
  const previousMode = storageMode;

  if (nextMode === "google-sheet") {
    const webhook = state.settings.googleSheetWebhook;
    if (!googleSheetSync.isValidWebhookUrl(webhook)) {
      document.querySelector("#storage-mode").value = previousMode;
      toast("請先在偏好設定中填寫正確的 Google 試算表 Webhook 網址。", true);
      return;
    }
    if (!saveStorageMode("google-sheet")) throw new Error("無法儲存儲存位置設定。");
    storageMode = "google-sheet";
    await googleSheetSync.pushToGoogleSheet({ silent: false });
    toast("已切換為 Google 試算表全平台雲端同步！後續變更自動同步。");
  } else if (nextMode === "cloud") {
    if (!cloudSync.cloudFileReady || !cloudSync.sharedFileRecord?.handle) {
      document.querySelector("#storage-mode").value = previousMode;
      cloudSync.updateControls("請先連結並載入或建立共用檔案，再切換至雲端模式。", storageMode);
      return;
    }
    if (!window.confirm(translateText("切換至雲端會載入共用檔資料；本機資料將保留，之後的編輯會自動同步至雲端。是否繼續？", state.settings.language))) {
      document.querySelector("#storage-mode").value = previousMode;
      return;
    }
    await cloudSync.loadFile(storageMode);
    if (!saveStorageMode("cloud")) throw new Error("無法儲存儲存位置設定。");
    storageMode = "cloud";
    cloudSync.cloudSaveBlocked = false;
    toast("已切換至雲端；後續變更會自動同步。");
  } else {
    if (!window.confirm(translateText("切換至本機會載入此瀏覽器原有資料；雲端資料會保留不變。是否繼續？", state.settings.language))) {
      document.querySelector("#storage-mode").value = previousMode;
      return;
    }
    const localState = loadState("local");
    if (localState.storageError) throw new Error("無法讀取本機已儲存資料，未切換儲存位置。");
    if (!saveStorageMode("local")) throw new Error("無法儲存儲存位置設定。");
    storageMode = "local";
    try {
      replaceState(localState, { syncCloud: false });
      toast("已切換至本機；雲端資料保持不變。");
    } catch (error) {
      storageMode = previousMode;
      saveStorageMode(previousMode);
      document.querySelector("#storage-mode").value = previousMode;
      throw error;
    }
  }

  cloudSync.updateControls(undefined, storageMode);
  const settingsForm = document.querySelector("#settings-form");
  if (settingsForm) {
    for (const [key, value] of Object.entries(state.settings)) {
      if (settingsForm.elements[key]) settingsForm.elements[key].value = value;
    }
  }
}

// ----------------- 欄位配置與排序核心邏輯 -----------------
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
      const insertAt = defIdx >= 0 && defIdx < combined.length ? defIdx : combined.length - 1;
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
  const key = state.settings.sortKey || "marketValue";
  const dir = state.settings.sortDirection === "asc" ? 1 : -1;

  return [...holdings].sort((a, b) => {
    const metricsA = getHoldingMetrics(a);
    const metricsB = getHoldingMetrics(b);

    let valA, valB;
    if (key === "symbol") {
      valA = a.symbol;
      valB = b.symbol;
      return String(valA).localeCompare(String(valB)) * dir;
    } else if (key === "buyDate") {
      valA = a.buyDate || "";
      valB = b.buyDate || "";
      return String(valA).localeCompare(String(valB)) * dir;
    } else if (key === "averageCost") {
      valA = metricsA.averageCost;
      valB = metricsB.averageCost;
    } else if (key === "shares") {
      valA = a.shares;
      valB = b.shares;
    } else if (key === "currentPrice") {
      valA = a.currentPrice;
      valB = b.currentPrice;
    } else if (key === "fees") {
      valA = a.fees;
      valB = b.fees;
    } else if (key === "dividends") {
      valA = a.dividends || 0;
      valB = b.dividends || 0;
    } else if (key === "cost") {
      valA = metricsA.cost;
      valB = metricsB.cost;
    } else if (key === "marketValue") {
      valA = metricsA.marketValue;
      valB = metricsB.marketValue;
    } else if (key === "profit") {
      valA = metricsA.profit;
      valB = metricsB.profit;
    } else if (key === "returnRate") {
      valA = metricsA.returnRate;
      valB = metricsB.returnRate;
    } else {
      valA = a.custom?.[key] || "";
      valB = b.custom?.[key] || "";
      return String(valA).localeCompare(String(valB)) * dir;
    }

    if (valA === Infinity) return 1 * dir;
    if (valB === Infinity) return -1 * dir;
    return ((Number(valA) || 0) - (Number(valB) || 0)) * dir;
  });
}

// ----------------- 表格繪製與投資總覽 -----------------
function setProfitColor(element, value) {
  element.classList.toggle("positive", value > 0);
  element.classList.toggle("negative", value < 0);
}

function textCell(text, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function formatReturnRate(rate) {
  if (rate === Infinity) return "+∞%";
  return `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%`;
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

    const textSpan = document.createElement("span");
    textSpan.textContent = translateText(col.label, state.settings.language);
    th.append(textSpan);

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
        deleteCustomField({ id: col.id, name: col.label });
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
    if (!event.target.closest("button")) openHoldingDetails(holding);
  });
  row.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !event.target.closest("button")) {
      event.preventDefault();
      openHoldingDetails(holding);
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
      const formattedShares = formatQuantity(holding.shares, state.settings.language);
      const sharesUnit = translateText("股", state.settings.language);
      subInfo.textContent = `${autoResolvedName} · ${formattedShares} ${sharesUnit}`;

      copy.append(titleRow, subInfo);
      nameWrap.append(avatar, copy);
      nameCell.append(nameWrap);
      row.append(nameCell);
    } else if (col.id === "currentPrice") {
      row.append(textCell(formatMoney(holding.currentPrice, holding.market, 2, state.settings.language)));
    } else if (col.id === "averageCost") {
      row.append(textCell(formatMoney(metrics.averageCost, holding.market, 2, state.settings.language)));
    } else if (col.id === "profit") {
      const profitCell = textCell(formatMoney(metrics.profit, holding.market, 2, state.settings.language), metrics.profit > 0 ? "gain" : metrics.profit < 0 ? "loss" : "muted-value");
      row.append(profitCell);
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
      edit.textContent = "編輯";
      edit.addEventListener("click", () => openEditDialog(holding));
      const remove = document.createElement("button");
      remove.className = "row-action danger";
      remove.textContent = "刪除";
      remove.addEventListener("click", () => deleteHolding(holding));
      const trade = document.createElement("button");
      trade.className = "row-action";
      trade.textContent = "交易";
      trade.title = translateText("新增買入、賣出或股利等交易", state.settings.language);
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
    if (filter === "all") tab.hidden = false;
    else tab.hidden = !hasMarket[filter];
  });

  if (activeFilter !== "all" && !hasMarket[activeFilter]) {
    activeFilter = "all";
  }

  marketTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === activeFilter);
  });

  const visible = accountScopedHoldings.filter((holding) => activeFilter === "all" || holding.market === activeFilter);
  const sorted = getSortedHoldings(visible);

  for (const holding of sorted) {
    elements.body?.append(makeHoldingRow(holding, activeColumns));
  }

  const hasHoldings = visible.length > 0;
  elements.emptyState?.classList.toggle("visible", !hasHoldings);
  
  const table = document.querySelector("table");
  if (table) table.hidden = !hasHoldings;
  
  const tableCount = document.querySelector("#table-count");
  if (tableCount) tableCount.textContent = `${visible.length} 檔`;
  
  const tableFooterCount = document.querySelector("#table-footer-count");
  if (tableFooterCount) tableFooterCount.textContent = `顯示 ${visible.length} 筆持倉`;

  // 指標總覽動態換算
  const totals = getPortfolioMetrics(accountScopedHoldings, state.settings);
  const isUsd = state.settings.overviewCurrency === "USD";
  const fxRate = Number(state.settings.fxRate) > 0 ? Number(state.settings.fxRate) : 32.5;

  const primaryMarketValue = isUsd
    ? formatMoney(totals.marketValue / fxRate, "US", 2, state.settings.language)
    : formatTwd(totals.marketValue, 0, state.settings.language);
  const alternateMarketValue = isUsd
    ? formatTwd(totals.marketValue, 0, state.settings.language)
    : formatMoney(totals.marketValue / fxRate, "US", 2, state.settings.language);

  const totalVal = document.querySelector("#total-value");
  if (totalVal) totalVal.textContent = primaryMarketValue;

  const totalValAlt = document.querySelector("#total-value-alternate");
  if (totalValAlt) totalValAlt.textContent = alternateMarketValue;

  const totalValAltLabel = document.querySelector("#total-value-alternate-label");
  if (totalValAltLabel) {
    totalValAltLabel.textContent = translateText(isUsd ? "新台幣等值" : "美元等值", state.settings.language);
  }

  const summaryNote = document.querySelector("#summary-currency-note");
  if (summaryNote) {
    summaryNote.textContent = translateText(isUsd ? "依庫存現價估算・美元" : "依庫存現價估算・新台幣", state.settings.language);
  }

  document.querySelectorAll("[data-overview-currency]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.overviewCurrency === state.settings.overviewCurrency));
  });

  const settingsForm = document.querySelector("#settings-form");
  if (settingsForm?.elements.overviewCurrency) {
    settingsForm.elements.overviewCurrency.value = state.settings.overviewCurrency;
  }

  const formatOverviewAmount = (value) => isUsd
    ? formatMoney(value / fxRate, "US", 2, state.settings.language)
    : formatTwd(value, 0, state.settings.language);

  const totalCost = document.querySelector("#total-cost");
  if (totalCost) totalCost.textContent = formatOverviewAmount(totals.cost);

  const profitElement = document.querySelector("#total-profit");
  if (profitElement) {
    profitElement.textContent = `${totals.profit > 0 ? "+" : ""}${formatOverviewAmount(totals.profit)}`;
    setProfitColor(profitElement, totals.profit);
  }

  const dividendsElement = document.querySelector("#total-dividends");
  if (dividendsElement) {
    dividendsElement.textContent = formatOverviewAmount(totals.dividends || 0);
  }

  const dailyProfitElement = document.querySelector("#daily-profit");
  if (dailyProfitElement) {
    dailyProfitElement.textContent = totals.dailyProfit === null
      ? "—"
      : `${totals.dailyProfit > 0 ? "+" : ""}${formatOverviewAmount(totals.dailyProfit)}`;
    setProfitColor(dailyProfitElement, totals.dailyProfit || 0);
  }

  const returnElement = document.querySelector("#average-return");
  if (returnElement) {
    returnElement.textContent = formatReturnRate(totals.returnRate);
    setProfitColor(returnElement, totals.returnRate === Infinity ? 1 : totals.returnRate);
  }

  const holdingCount = document.querySelector("#holding-count");
  if (holdingCount) holdingCount.innerHTML = `${accountScopedHoldings.length} <small>檔</small>`;

  applyTranslations(state.settings.language);
}

// ----------------- 自訂欄位彈窗 -----------------
function openColumnManager() {
  const dialog = document.querySelector("#column-manager-dialog");
  if (!dialog) return;

  function renderColumnList() {
    const list = dialog.querySelector("#column-order-list");
    if (!list) return;
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
        const insertAt = defIdx >= 0 && defIdx < combined.length ? defIdx : combined.length - 1;
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
      checkbox.disabled = col.locked;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.settings.hiddenColumns = state.settings.hiddenColumns.filter((id) => id !== col.id);
        else if (!state.settings.hiddenColumns.includes(col.id)) state.settings.hiddenColumns.push(col.id);
        persist();
        render();
      });

      const label = document.createElement("span");
      label.textContent = col.label;
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

// ----------------- 持倉詳情與編輯 -----------------
function detailsMetric(label, value, className = "") {
  const metric = document.createElement("div");
  metric.className = "details-metric";
  const title = document.createElement("span");
  title.textContent = translateText(label, state.settings.language);
  const content = document.createElement("strong");
  content.className = className;
  content.textContent = value;
  metric.append(title, content);
  return metric;
}

function openHoldingDetails(holding) {
  activeHoldingId = holding.id;
  const metrics = getHoldingMetrics(holding);
  const dialog = document.querySelector("#holding-details-dialog");
  const detailsTitle = document.querySelector("#details-title");
  const autoResolvedName = getStockName(holding.symbol) || holding.name || holding.symbol;
  const holdingAccount = getAccountById(holding.accountId || DEFAULT_ACCOUNT_ID, state);
  
  if (detailsTitle) {
    detailsTitle.textContent = `${holding.symbol}｜${autoResolvedName}（${holdingAccount.name}）`;
  }

  const summary = document.querySelector("#details-summary");
  summary?.replaceChildren(
    detailsMetric("持有股數", formatQuantity(holding.shares, state.settings.language)),
    detailsMetric("投資本金", formatMoney(metrics.cost, holding.market, 2, state.settings.language)),
    detailsMetric("目前市值", formatMoney(metrics.marketValue, holding.market, 2, state.settings.language)),
    detailsMetric("帳面損益", formatMoney(metrics.profit, holding.market, 2, state.settings.language), metrics.profit > 0 ? "gain" : metrics.profit < 0 ? "loss" : ""),
    detailsMetric("累計股息", formatMoney(holding.dividends || 0, holding.market, 2, state.settings.language))
  );

  const history = transactionsForHolding(holding, state.transactions);
  const hasLegacyTransactions = history.some((transaction) => transaction.locked);
  const detailsError = document.querySelector("#details-error");
  if (detailsError) detailsError.textContent = "";

  const legacyNotice = document.querySelector("#details-legacy-notice");
  if (legacyNotice) {
    legacyNotice.textContent = hasLegacyTransactions
      ? translateText("標示為舊版／校正的明細可編輯或刪除；這些變更只更新歷史紀錄，不會重算目前持倉股數與成本。", state.settings.language)
      : "";
  }

  renderTransactionHistory(holding);
  if (dialog && !dialog.open) dialog.showModal();
  applyTranslations(state.settings.language);
}

function renderTransactionHistory(holding) {
  const historyElement = document.querySelector("#transaction-history");
  if (!historyElement) return;

  const transactions = transactionsForHolding(holding, state.transactions).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const countElem = document.querySelector("#details-transaction-count");
  if (countElem) countElem.textContent = `${transactions.length} 筆`;

  historyElement.replaceChildren();
  if (!transactions.length) {
    const empty = document.createElement("div");
    empty.className = "transaction-history-empty";
    empty.textContent = "尚無交易明細，點選「新增交易」開始記錄。";
    historyElement.append(empty);
    applyTranslations(state.settings.language);
    return;
  }

  for (const transaction of transactions) {
    const entry = document.createElement("article");
    entry.className = "transaction-entry";
    const main = document.createElement("div");
    main.className = "transaction-entry-main";
    const type = document.createElement("strong");
    type.textContent = translateText(locale.transactionLabels[transaction.type] || transaction.type, state.settings.language);
    const date = document.createElement("small");
    date.textContent = transaction.date || "—";
    main.append(type, date);
    if (transaction.locked) {
      const legacyLabel = document.createElement("span");
      legacyLabel.className = "transaction-legacy-label";
      legacyLabel.textContent = translateText("舊版／校正", state.settings.language);
      main.append(legacyLabel);
    }
    const quantity = document.createElement("span");
    quantity.className = "transaction-entry-value";
    quantity.textContent = transaction.type === "split"
      ? `${translateText("分割比例", state.settings.language)} ${transaction.ratio || "—"}`
      : `${formatQuantity(transaction.quantity, state.settings.language)} ${translateText("股", state.settings.language)}`;
    const price = document.createElement("span");
    price.className = "transaction-entry-value";
    price.textContent = transaction.type === "stockDividend"
      ? "—"
      : formatMoney(transaction.price, holding.market, 2, state.settings.language);
    const fee = document.createElement("span");
    fee.className = "transaction-entry-value";
    fee.textContent = formatMoney(transaction.fee, holding.market, 2, state.settings.language);
    const actions = document.createElement("div");
    actions.className = "transaction-entry-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "row-action";
    edit.textContent = "編輯";
    edit.title = transaction.locked
      ? translateText("編輯這筆舊版／校正明細只會更新歷史紀錄，不會重算目前持倉。", state.settings.language)
      : "";
    edit.addEventListener("click", () => {
      document.querySelector("#holding-details-dialog")?.close();
      txDialog.openEdit(holding, transaction);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "row-action danger";
    remove.textContent = "刪除";
    remove.title = transaction.locked
      ? translateText("刪除這筆舊版／校正明細不會改變目前持倉股數與成本。", state.settings.language)
      : "";
    remove.addEventListener("click", () => deleteTransaction(holding, transaction));
    actions.append(edit, remove);
    entry.append(main, quantity, price, fee, actions);
    historyElement.append(entry);
  }
  applyTranslations(state.settings.language);
}

function deleteTransaction(holding, transaction) {
  const typeLabel = translateText(locale.transactionLabels[transaction.type] || transaction.type, state.settings.language);
  const prompt = transaction.locked
    ? `${translateText("確定刪除舊版／校正明細", state.settings.language)}：${typeLabel}（${transaction.date}）？${translateText("目前持倉股數與成本不會變更。", state.settings.language)}`
    : `${translateText("確定刪除交易明細", state.settings.language)}：${typeLabel}（${transaction.date}）？`;
  if (!window.confirm(translateText(prompt, state.settings.language))) return;
  const originalIndex = state.transactions.findIndex((item) => item.id === transaction.id);
  if (originalIndex < 0) return;
  const [removed] = state.transactions.splice(originalIndex, 1);
  try {
    const updatedHolding = rebuildHolding(holding, state);
    state.holdings = state.holdings.filter((h) => Number(h.shares) > 0);
    syncUsStreamSubscriptions();
    persist();
    render();
    if (updatedHolding && updatedHolding.shares > 0) openHoldingDetails(updatedHolding);
    else document.querySelector("#holding-details-dialog")?.close();
    toast(transaction.locked
      ? "舊版／校正交易明細已刪除；目前持倉股數與成本未變更。"
      : "交易明細已刪除，庫存成本已重新計算。");
  } catch (error) {
    state.transactions.splice(originalIndex, 0, removed);
    const detailsErr = document.querySelector("#details-error");
    if (detailsErr) detailsErr.textContent = translateText(error.message, state.settings.language);
    renderTransactionHistory(holding);
  }
}

// ----------------- 級聯刪除（Cascade Delete） -----------------
function deleteHolding(holding) {
  const resolvedName = getStockName(holding.symbol) || holding.name || holding.symbol;
  const holdingAccount = getAccountById(holding.accountId || DEFAULT_ACCOUNT_ID, state);
  
  const relatedTransactions = state.transactions.filter(
    (item) =>
      item.symbol?.toUpperCase() === holding.symbol.toUpperCase() &&
      (!item.market || item.market === holding.market) &&
      (item.accountId || DEFAULT_ACCOUNT_ID) === (holding.accountId || DEFAULT_ACCOUNT_ID)
  );

  const confirmMsg = translateText(
    `確定刪除「${holdingAccount.name}」的 ${holding.symbol}（${resolvedName}）及其持倉資料？\n注意：此操作將一併徹底刪除 ${relatedTransactions.length} 筆關聯的歷史交易明細與期初紀錄，無法還原！`,
    state.settings.language
  );

  if (!window.confirm(confirmMsg)) return;

  state.holdings = state.holdings.filter((item) => item.id !== holding.id);

  state.transactions = state.transactions.filter(
    (item) => !(
      item.symbol?.toUpperCase() === holding.symbol.toUpperCase() &&
      (!item.market || item.market === holding.market) &&
      (item.accountId || DEFAULT_ACCOUNT_ID) === (holding.accountId || DEFAULT_ACCOUNT_ID)
    )
  );

  const key = ledgerKey(holding);
  delete state.openingBalances[key];

  if (holding.market === "US") {
    syncUsStreamSubscriptions();
  }

  persist();
  render();
  toast(`${holding.symbol} 及其 ${relatedTransactions.length} 筆交易紀錄已徹底刪除。`);
}

function openEditDialog(holding) {
  const form = document.querySelector("#edit-form");
  if (!form) return;
  for (const [key, value] of Object.entries({
    id: holding.id,
    symbol: holding.symbol,
    name: getStockName(holding.symbol) || holding.name,
    date: holding.buyDate,
    shares: holding.shares,
    costBasis: holding.costBasis,
    currentPrice: holding.currentPrice,
    fees: holding.fees,
  })) {
    if (form.elements[key]) form.elements[key].value = value;
  }
  const customFields = document.querySelector("#edit-custom-fields");
  customFields?.replaceChildren();
  for (const field of state.customFields) {
    const wrapper = document.createElement("div");
    wrapper.className = "form-field";
    const label = document.createElement("label");
    label.textContent = field.name;
    label.htmlFor = `edit-custom-${field.id}`;
    const input = document.createElement("input");
    input.id = `edit-custom-${field.id}`;
    input.name = `custom-${field.id}`;
    input.maxLength = 500;
    input.value = String(holding.custom?.[field.id] || "");
    input.placeholder = `輸入${field.name}`;
    wrapper.append(label, input);
    customFields?.append(wrapper);
  }
  const editError = document.querySelector("#edit-error");
  if (editError) editError.textContent = "";
  document.querySelector("#edit-dialog")?.showModal();
  applyTranslations(state.settings.language);
}

function deleteCustomField(field) {
  if (!window.confirm(translateText(`確定刪除「${field.name}」欄位及所有該欄位資料？`, state.settings.language))) return;
  state.customFields = state.customFields.filter((item) => item.id !== field.id);
  state.settings.columnOrder = (state.settings.columnOrder || []).filter((id) => id !== field.id);
  state.settings.hiddenColumns = (state.settings.hiddenColumns || []).filter((id) => id !== field.id);
  for (const holding of state.holdings) delete holding.custom[field.id];
  persist();
  render();
  toast(`「${field.name}」欄位已刪除。`);
}

function openSettings() {
  const form = document.querySelector("#settings-form");
  if (!form) return;
  for (const [key, value] of Object.entries(state.settings)) {
    if (form.elements[key]) form.elements[key].value = value;
  }
  const storageSelect = document.querySelector("#storage-mode");
  if (storageSelect) storageSelect.value = storageMode;
  const settingsErr = document.querySelector("#settings-error");
  if (settingsErr) settingsErr.textContent = "";
  document.querySelector("#settings-dialog")?.showModal();
  cloudSync.updateControls(undefined, storageMode);
  applyTranslations(state.settings.language);
}

const numericSettingKeys = ["twRate", "twDiscount", "twMinimum", "usPerShare", "usMinimum", "fxRate", "caPerShare", "caMinimum", "cadFxRate"];

function validatePositiveFormValues(form, names, errorElement) {
  for (const name of names) {
    if (!Number.isFinite(Number(form.elements[name]?.value)) || Number(form.elements[name]?.value) < 0) {
      if (errorElement) errorElement.textContent = translateText("請確認各欄位皆為有效的非負數值。", state.settings.language);
      form.elements[name]?.focus();
      return false;
    }
  }
  return true;
}

// ----------------- 內建 Google Apps Script 程式碼字串（供一鍵複製） -----------------
const GOOGLE_APPS_SCRIPT_TEMPLATE = `// 鮮存股 - 個人 Google 試算表同步專用腳本
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("_xian_stock_db");
  if (!sheet) {
    sheet = ss.insertSheet("_xian_stock_db");
    sheet.hideSheet();
  }
  return sheet;
}

function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var payload = sheet.getRange("A1").getValue();
    if (!payload) {
      return ContentService.createTextOutput(JSON.stringify({ empty: true })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var postData = e.postData.contents;
    var parsed = JSON.parse(postData);
    var sheet = getOrCreateSheet();
    sheet.getRange("A1").setValue(JSON.stringify(parsed));
    updateHumanReadableHoldings(parsed.data ? parsed.data.holdings : parsed.holdings);
    return ContentService.createTextOutput(JSON.stringify({ status: "success", updatedAt: new Date().toISOString() })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function updateHumanReadableHoldings(holdings) {
  if (!Array.isArray(holdings)) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("我的庫存總覽") || ss.insertSheet("我的庫存總覽");
  sheet.clear();
  sheet.appendRow(["股票代號", "名稱", "市場", "持有股數", "總成本", "目前現價", "累計股息", "更新時間"]);
  holdings.forEach(function(h) {
    sheet.appendRow([h.symbol, h.name, h.market, h.shares, h.costBasis, h.currentPrice, h.dividends || 0, new Date()]);
  });
}`;

// ----------------- 全域按鈕與事件綁定 -----------------
document.querySelector("#add-holding")?.addEventListener("click", () => txDialog.open());
document.querySelector("#add-holding-table")?.addEventListener("click", () => txDialog.open());
document.querySelector("#empty-add-holding")?.addEventListener("click", () => txDialog.open());
document.querySelector("#manage-columns-btn")?.addEventListener("click", openColumnManager);
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

document.querySelector("#open-settings")?.addEventListener("click", openSettings);
document.querySelector("#open-settings-top")?.addEventListener("click", openSettings);
document.querySelector("#add-custom-field")?.addEventListener("click", () => document.querySelector("#custom-field-dialog")?.showModal());
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

document.querySelector("#details-add-transaction")?.addEventListener("click", () => {
  const holding = state.holdings.find((item) => item.id === activeHoldingId);
  if (!holding) return;
  document.querySelector("#holding-details-dialog")?.close();
  txDialog.open(holding);
});

document.querySelector("#details-edit-holding")?.addEventListener("click", () => {
  const holding = state.holdings.find((item) => item.id === activeHoldingId);
  if (!holding) return;
  document.querySelector("#holding-details-dialog")?.close();
  openEditDialog(holding);
});

document.querySelector("#edit-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.querySelector("#edit-error");
  if (error) error.textContent = "";
  const names = ["shares", "costBasis", "currentPrice", "fees"];
  if (!validatePositiveFormValues(form, names, error)) return;
  const holding = state.holdings.find((item) => item.id === form.elements.id?.value);
  if (!holding) return;
  const newSymbol = normalizeSymbol(form.elements.symbol?.value || "", holding.market);
  
  const duplicate = state.holdings.find((item) => 
    item.id !== holding.id && 
    item.symbol.toUpperCase() === newSymbol && 
    item.market === holding.market &&
    (item.accountId || DEFAULT_ACCOUNT_ID) === (holding.accountId || DEFAULT_ACCOUNT_ID)
  );

  if (duplicate) {
    if (error) error.textContent = translateText("此帳戶內該股號已有其他持倉，請編輯既有持倉以避免重複資料。", state.settings.language);
    return;
  }
  
  holding.symbol = newSymbol;
  holding.name = form.elements.name?.value.trim() || getStockName(newSymbol) || newSymbol;
  holding.buyDate = form.elements.date?.value;
  holding.shares = Number(form.elements.shares?.value);
  holding.costBasis = Number(form.elements.costBasis?.value);
  holding.currentPrice = Number(form.elements.currentPrice?.value);
  holding.fees = Number(form.elements.fees?.value);

  if (holding.previousClose && Number(holding.previousClose) > 0) {
    holding.dailyChangePerShare = holding.currentPrice - Number(holding.previousClose);
  }

  holding.custom = { ...holding.custom };
  for (const field of state.customFields) {
    holding.custom[field.id] = form.elements[`custom-${field.id}`]?.value.trim() || "";
  }
  const history = transactionsForHolding(holding, state.transactions);
  if (history.length) {
    history.forEach((transaction) => { transaction.locked = true; });
    state.openingBalances[ledgerKey(holding)] = holdingBalance(holding);
  }
  if (holding.shares <= 0) state.holdings = state.holdings.filter((item) => item.id !== holding.id);
  syncUsStreamSubscriptions();
  persist();
  render();
  document.querySelector("#edit-dialog")?.close();
  toast("庫存資料已更新。");
});

document.querySelector("#custom-field-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = event.currentTarget.elements.name?.value.trim();
  if (!name) return;
  if (state.customFields.some((field) => field.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    toast("已經有同名的自訂欄位。", true);
    return;
  }
  const fieldId = makeId();
  state.customFields.push({ id: fieldId, name });
  if (state.settings.columnOrder) state.settings.columnOrder.splice(state.settings.columnOrder.length - 1, 0, fieldId);
  persist();
  render();
  event.currentTarget.reset();
  document.querySelector("#custom-field-dialog")?.close();
  toast(`已新增「${name}」欄位，可在編輯持倉時填寫。`);
});

document.querySelector("#settings-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.querySelector("#settings-error");
  if (error) error.textContent = "";
  if (!validatePositiveFormValues(form, numericSettingKeys, error)) return;
  if (Number(form.elements.twDiscount?.value) > 100) {
    if (error) error.textContent = translateText("台股折扣比例不可大於 100%。", state.settings.language);
    form.elements.twDiscount?.focus();
    return;
  }
  let quoteApiUrl;
  try {
    const parsedQuoteApiUrl = new URL(form.elements.quoteApiUrl?.value.trim());
    if (parsedQuoteApiUrl.protocol !== "https:" || parsedQuoteApiUrl.username || parsedQuoteApiUrl.password) {
      throw new Error();
    }
    quoteApiUrl = parsedQuoteApiUrl.toString();
  } catch {
    if (error) error.textContent = translateText("Render 報價 API 請填寫有效的 HTTPS 網址。", state.settings.language);
    form.elements.quoteApiUrl?.focus();
    return;
  }

  const finnhubToken = form.elements.finnhubToken?.value.trim() || "";
  const googleSheetWebhook = form.elements.googleSheetWebhook?.value.trim() || "";

  state.settings = {
    ...state.settings,
    language: form.elements.language?.value || "zh-TW",
    quoteProvider: form.elements.quoteProvider?.value === "yahoo" ? "yahoo" : "render-api",
    quoteApiUrl,
    finnhubToken,
    googleSheetWebhook,
    ...Object.fromEntries(numericSettingKeys.map((key) => [key, Number(form.elements[key]?.value) || 0])),
  };

  usStream.setToken(finnhubToken);
  syncUsStreamSubscriptions();

  persist();
  render();
  txDialog.updateTransactionFields();
  document.querySelector("#settings-dialog")?.close();
  toast("設定已儲存，行情與同步連線已更新。");
});

document.querySelector("#storage-mode")?.addEventListener("change", (event) => {
  const requestedMode = event.currentTarget.value;
  cloudSync.runAction(async () => {
    try {
      await switchStorageMode(requestedMode);
    } catch (error) {
      document.querySelector("#storage-mode").value = storageMode;
      throw error;
    }
  }, storageMode);
});

// ----------------- 多格式匯出 (JSON / JS / CSV / XLS) -----------------
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

// ----------------- 多格式統一匯入 (JSON / JS / CSV / XLS) -----------------
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

    if (!window.confirm(translateText("還原/匯入檔案會更新目前的投資庫存與交易紀錄。建議先下載目前資料備份。是否繼續？", state.settings.language))) {
      return;
    }

    replaceState(imported);
    toast(`已成功由 ${file.name} 還原/匯入資料！`);
  } catch (error) {
    toast(translateText(error.message || "無法匯入檔案。", state.settings.language), true);
  } finally {
    input.value = "";
  }
});

// ----------------- 一鍵複製 Google Apps Script 腳本 -----------------
document.querySelector("#copy-gas-script-btn")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    toast("✅ 試算表專用腳本已複製！請前往 Google 試算表 Apps Script 貼上。");
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = GOOGLE_APPS_SCRIPT_TEMPLATE;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    toast("✅ 試算表專用腳本已複製！");
  }
});

// ----------------- 測試 Google 試算表連線防呆 -----------------
document.querySelector("#google-sheet-test")?.addEventListener("click", async () => {
  const webhookInput = document.querySelector("#google-sheet-webhook");
  const url = webhookInput?.value.trim();
  
  if (!url || !url.startsWith("https://script.google.com/macros/s/") || !url.endsWith("/exec")) {
    toast("⚠️ 網址格式不正確，必須是 https://script.google.com/macros/s/.../exec", true);
    return;
  }

  toast("正在測試 Google 試算表連線…");
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP 錯誤碼 ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    toast("🎉 連線成功！Google 試算表已準備就緒，可正常同步。");
  } catch (error) {
    console.error("測試連線失敗:", error);
    toast("❌ 連線失敗！請檢查部署時「誰可以存取」是否選為「所有人 (Anyone)」。", true);
  }
});

// ----------------- Google 試算表手動 Push / Pull -----------------
document.querySelector("#google-sheet-push")?.addEventListener("click", () => {
  googleSheetSync.pushToGoogleSheet({ silent: false });
});

document.querySelector("#google-sheet-pull")?.addEventListener("click", () => {
  googleSheetSync.pullFromGoogleSheet({ silent: false });
});

// ----------------- 共用檔案 (File System Access) -----------------
document.querySelector("#shared-file-open")?.addEventListener("click", () => {
  cloudSync.runAction(() => cloudSync.selectAndLoadFile(storageMode), storageMode);
});

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

document.querySelector("#shared-file-create")?.addEventListener("click", () => {
  cloudSync.runAction(() => cloudSync.createFile(storageMode), storageMode);
});

document.querySelector("#shared-file-load")?.addEventListener("click", () => {
  cloudSync.runAction(() => cloudSync.loadFile(storageMode), storageMode);
});

document.querySelector("#shared-file-save")?.addEventListener("click", () => {
  cloudSync.runAction(() => cloudSync.saveToFile(storageMode), storageMode);
});

document.querySelector("#shared-file-disconnect")?.addEventListener("click", () => {
  cloudSync.runAction(() => cloudSync.disconnect(storageMode), storageMode);
});

document.querySelector("#refresh-quotes")?.addEventListener("click", () => {
  marketPoller.refreshAllQuotes({ silent: false });
});

document.querySelector("#us-stream-mode-toggle")?.addEventListener("click", () => {
  const currentMode = state.settings.usStreamMode || "standard";
  const nextMode = currentMode === "standard" ? "geek" : "standard";
  state.settings.usStreamMode = nextMode;
  usStream.setMode(nextMode);
  persist();
  updateStreamModeButtonUI(nextMode);
  toast(`已切換為美股 ${nextMode === "geek" ? "極客模式 (24H Ticks)" : "標準模式 (常規盤 5s 節流)"}`);
});

const footerYear = document.querySelector("#footer-year");
if (footerYear) footerYear.textContent = new Date().getFullYear();

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

if (state.storageError) toast("讀取已儲存資料時發生問題，目前顯示空白資料。", true);

// ============================================================================
// 系統啟動生命週期：依序初始化渲染、雲端同步、串流連接與報價首刷
// ============================================================================
render();
cloudSync.init(storageMode);
usStream.connect();
syncUsStreamSubscriptions();
marketPoller.start();
updateStreamModeButtonUI(state.settings.usStreamMode || "standard");