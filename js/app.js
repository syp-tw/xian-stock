import { getHoldingMetrics, getPortfolioMetrics, estimateFee } from "./calculations.js";
import { parseBackup, serializeBackup, serializeCsv } from "./backup.js";
import { applyTranslations, formatMoney, formatQuantity, formatTwd, locale, translateText } from "./i18n.js";
import { hasSavedState, loadState, loadStorageMode, saveState, saveStorageMode } from "./storage.js";
import { getSharedFilePath, getSharedFileRecord, readSharedFile, removeSharedFileRecord, saveSharedDirectoryRecord, saveSharedFileRecord, supportsSharedFiles, writeNewSharedFile, writeSharedFile } from "./shared-file.js";
import { fetchQuote, quoteMarket, searchQuotes } from "./quotes.js";

let storageMode = loadStorageMode();
const state = loadState(storageMode);
const elements = {
  body: document.querySelector("#holdings-body"),
  emptyState: document.querySelector("#empty-state"),
  customHeaders: document.querySelector("#custom-header-anchor"),
  transactionDialog: document.querySelector("#transaction-dialog"),
  transactionForm: document.querySelector("#transaction-form"),
  suggestions: document.querySelector("#quote-suggestions"),
  symbolInput: document.querySelector("#transaction-symbol"),
  priceInput: document.querySelector("#transaction-price"),
  quantityInput: document.querySelector("#transaction-quantity"),
  feeInput: document.querySelector("#transaction-fee"),
  currentPriceInput: document.querySelector("#transaction-current-price"),
  transactionType: document.querySelector("#transaction-type"),
  transactionError: document.querySelector("#transaction-error"),
  toastRegion: document.querySelector("#toast-region"),
};
let activeFilter = "all";
let suggestionTimer;
let suggestionController;
let selectedQuote = null;
let activeHoldingId = null;
let editingTransactionId = null;
let sharedFileRecord = null;
let sharedActionInProgress = false;
let sharedStatusMessage = null;
let cloudSaveBlocked = false;
let cloudFileReady = false;
let cloudSaveQueue = Promise.resolve();

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => crypto.randomUUID();

function toast(message, isError = false) {
  const node = document.createElement("div");
  node.className = `toast${isError ? " error" : ""}`;
  node.textContent = translateText(message, state.settings.language);
  elements.toastRegion.append(node);
  window.setTimeout(() => node.remove(), 3600);
}

function persist() {
  if (!saveState(state, storageMode)) {
    toast("無法儲存資料，請確認瀏覽器儲存空間或隱私設定。", true);
    return;
  }
  if (storageMode === "cloud") scheduleCloudSave();
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

function replaceState(nextState, { syncCloud = true } = {}) {
  const previousState = {
    holdings: state.holdings,
    customFields: state.customFields,
    settings: state.settings,
    transactions: state.transactions,
    openingBalances: state.openingBalances,
    storageError: state.storageError,
  };
  Object.assign(state, nextState);
  delete state.storageError;
  if (!saveState(state, storageMode)) {
    Object.assign(state, previousState);
    throw new Error("無法儲存匯入資料，原有資料未變更。");
  }
  if (storageMode === "cloud" && syncCloud) scheduleCloudSave();
  document.querySelector("#language-setting").value = state.settings.language;
  render();
}

function updateSharedFileControls(statusMessage) {
  if (statusMessage !== undefined) sharedStatusMessage = statusMessage;
  const supported = supportsSharedFiles() && "indexedDB" in window;
  const linked = Boolean(sharedFileRecord?.handle);
  const directorySelected = Boolean(sharedFileRecord?.directoryHandle);
  const cloudOption = document.querySelector("#storage-mode option[value='cloud']");
  cloudOption.disabled = (!supported || !cloudFileReady) && storageMode !== "cloud";
  const folderButton = document.querySelector("#shared-folder-select");
  folderButton.disabled = typeof window.showDirectoryPicker !== "function" || !("indexedDB" in window) || sharedActionInProgress;
  folderButton.textContent = translateText(sharedActionInProgress ? "處理中…" : "選取同步資料夾", state.settings.language);
  document.querySelector("#shared-file-open").disabled = typeof window.showOpenFilePicker !== "function" || !("indexedDB" in window) || sharedActionInProgress;
  document.querySelector("#shared-file-create").disabled = typeof window.showDirectoryPicker !== "function" || !("indexedDB" in window) || sharedActionInProgress;
  document.querySelector("#shared-file-load").disabled = !supported || !linked || sharedActionInProgress;
  document.querySelector("#shared-file-save").disabled = !supported || !linked || sharedActionInProgress;
  document.querySelector("#shared-file-disconnect").disabled = !linked || sharedActionInProgress;
  const filePath = sharedFileRecord?.displayPath
    || (directorySelected
      ? sharedFileRecord.handle
        ? `${sharedFileRecord.directoryHandle.name}/`
        : `${sharedFileRecord.directoryHandle.name}/（尚未選擇共用檔案）`
      : sharedFileRecord?.handle?.name || "");
  document.querySelector("#shared-file-path").textContent = filePath
    ? filePath
    : translateText("尚未選取同步資料夾。", state.settings.language);
  document.querySelector("#shared-file-status").textContent = translateText(
    sharedActionInProgress
      ? "正在處理共用檔案操作，請稍候。"
      : sharedStatusMessage || (cloudSaveBlocked
      ? "雲端自動同步已暫停；請先載入最新版本或重新授權。"
      : linked && !cloudFileReady ? "共用檔案尚未啟用；請載入檔案並授予讀寫權限。"
        : linked ? "共用檔案已連結並啟用。"
          : directorySelected
            ? `同步資料夾「${sharedFileRecord.directoryHandle.name}」已選取；可直接連結既有檔案，或建立新的共用檔。`
            : supported ? "可直接連結既有 JSON；按「建立／另存共用檔」選擇資料夾並自動建立新檔。"
              : "此瀏覽器不支援共用檔案存取，仍可使用 JSON／CSV 匯出與 JSON 還原。"),
    state.settings.language,
  );
  document.querySelector("#storage-mode").value = storageMode;
  document.querySelector("#storage-location-label").textContent = translateText(
    storageMode === "cloud" ? "資料同步至已連結的雲端檔案" : "資料僅儲存於此裝置",
    state.settings.language,
  );
  document.querySelector("#storage-mode-status").textContent = translateText(
    storageMode === "cloud"
      ? linked && cloudFileReady ? "目前使用雲端檔案；變更會自動同步。" : "雲端模式尚未連結檔案；請連結檔案或切回本機模式。"
      : cloudFileReady ? "目前使用本機儲存；資料僅保存在此瀏覽器。"
        : directorySelected
          ? `同步資料夾「${sharedFileRecord.directoryHandle.name}」已選取；可直接選取或建立共用 JSON 檔。`
          : "連結既有 JSON 不需先選資料夾；建立新檔時，按鈕會請你選擇資料夾並自動建立。",
    state.settings.language,
  );
}

function sharedFileError(error) {
  toast(translateText(error.message || "共用檔案操作失敗。", state.settings.language), true);
}

function scheduleCloudSave() {
  if (cloudSaveBlocked) return;
  const content = serializeBackup(state);
  cloudSaveQueue = cloudSaveQueue.then(async () => {
    if (storageMode !== "cloud" || cloudSaveBlocked) return;
    if (!sharedFileRecord?.handle) {
      throw new Error("雲端模式尚未連結共用檔案；請先連結檔案或切回本機模式。");
    }
    const result = await writeSharedFile(
      sharedFileRecord.handle,
      content,
      sharedFileRecord.fingerprint,
    );
    if (result.conflict) {
      cloudSaveBlocked = true;
      updateSharedFileControls("共用檔案已在其他位置變更；為避免覆蓋，請先載入最新版本。");
      toast("共用檔案已在其他位置變更；雲端自動同步已暫停，請先載入最新版本。", true);
      return;
    }
    sharedFileRecord.fingerprint = result.fingerprint;
    await saveSharedFileRecord(sharedFileRecord.handle, result.fingerprint, sharedFileRecord.displayPath);
    updateSharedFileControls("雲端資料已自動同步。");
  }).catch((error) => {
    cloudSaveBlocked = true;
    updateSharedFileControls("雲端自動同步失敗；請重新授權或切回本機模式。");
    sharedFileError(error);
  });
}

async function initializeSharedFile() {
  if (!supportsSharedFiles() || !("indexedDB" in window)) {
    updateSharedFileControls();
    return;
  }
  try {
    sharedFileRecord = await getSharedFileRecord();
    const handle = sharedFileRecord?.handle;
    let startupStatus;
    if (handle && await handle.queryPermission({ mode: "readwrite" }) === "granted") {
      const file = await readSharedFile(handle);
      parseBackup(file.text);
      cloudFileReady = true;
      if (storageMode === "cloud") {
        if (hasSavedState("cloud") && !state.storageError) {
          if (file.fingerprint !== sharedFileRecord.fingerprint) {
            cloudSaveBlocked = true;
            startupStatus = "共用檔案已在其他位置變更；為避免覆蓋，請先載入最新版本。";
          } else {
            cloudSaveBlocked = false;
            scheduleCloudSave();
          }
        } else {
          const imported = parseBackup(file.text);
          Object.assign(state, imported);
          delete state.storageError;
          if (!saveState(state, "cloud")) throw new Error("無法儲存雲端資料的本機快取。");
          sharedFileRecord.fingerprint = file.fingerprint;
          await saveSharedFileRecord(handle, file.fingerprint, sharedFileRecord.displayPath);
          cloudSaveBlocked = false;
          render();
        }
      }
    }
    if (handle && await handle.queryPermission({ mode: "readwrite" }) !== "granted") {
      cloudFileReady = false;
      if (storageMode === "cloud") cloudSaveBlocked = true;
      updateSharedFileControls(storageMode === "cloud"
        ? "雲端模式需要重新授權；請按「載入共用檔」同步，或切回本機模式。"
        : "共用檔案已連結；操作時需重新授權。");
    } else {
      updateSharedFileControls(startupStatus);
    }
  } catch (error) {
    cloudFileReady = false;
    if (storageMode === "cloud") cloudSaveBlocked = true;
    updateSharedFileControls("無法讀取共用檔案設定，請重新連結檔案。");
    sharedFileError(error);
  }
}

async function selectSharedDirectory(pickerPromise) {
  const directoryHandle = await pickerPromise;
  sharedFileRecord = await saveSharedDirectoryRecord(directoryHandle);
  if (sharedFileRecord.handle) {
    const displayPath = await getSharedFilePath(directoryHandle, sharedFileRecord.handle);
    if (displayPath) {
      sharedFileRecord.displayPath = displayPath;
      await saveSharedFileRecord(sharedFileRecord.handle, sharedFileRecord.fingerprint, displayPath);
      updateSharedFileControls("同步資料夾路徑已更新。");
      return;
    }
    updateSharedFileControls("目前連結的檔案不在所選同步資料夾內；請重新連結共用檔案。");
    return;
  }
  updateSharedFileControls(`同步資料夾「${directoryHandle.name}」已選取；可直接連結既有檔案，或建立新的共用檔。`);
}

function startSharedDirectorySelection() {
  let pickerPromise;
  try {
    pickerPromise = window.showDirectoryPicker({ mode: "readwrite" });
  } catch (error) {
    updateSharedFileControls(error.message || "無法開啟資料夾選擇器。");
    sharedFileError(error);
    return;
  }
  runSharedAction(() => selectSharedDirectory(pickerPromise));
}

async function selectAndLoadSharedFile() {
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    ...(sharedFileRecord?.directoryHandle ? { startIn: sharedFileRecord.directoryHandle } : {}),
    types: [{ description: "鮮存股 JSON 備份", accept: { "application/json": [".json"] } }],
  });
  const file = await readSharedFile(handle);
  const resolvedPath = sharedFileRecord?.directoryHandle
    ? await getSharedFilePath(sharedFileRecord.directoryHandle, handle)
    : null;
  const displayPath = resolvedPath || handle.name;
  const imported = parseBackup(file.text);
  if (!window.confirm(translateText("連結共用檔會更新雲端資料快取；本機資料會保留。是否繼續？", state.settings.language))) return;
  if (storageMode === "cloud") replaceState(imported, { syncCloud: false });
  else if (!saveState(imported, "cloud")) throw new Error("無法儲存雲端資料的本機快取。");
  sharedFileRecord = { ...sharedFileRecord, handle, fingerprint: file.fingerprint, displayPath };
  await saveSharedFileRecord(handle, file.fingerprint, displayPath);
  cloudFileReady = true;
  cloudSaveBlocked = false;
  updateSharedFileControls(resolvedPath ? undefined : "相對路徑無法取得；目前僅顯示檔名。");
  toast(storageMode === "cloud" ? "已載入雲端資料並啟用自動同步。" : "已連結雲端檔案；本機資料未變更，可切換至雲端模式。");
}

async function createSharedFile() {
  let directoryHandle = sharedFileRecord?.directoryHandle;
  if (!directoryHandle) {
    directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  }
  const permission = await directoryHandle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("瀏覽器未授權同步資料夾讀寫權限，尚未建立共用檔。");
  toast("同步資料夾已選取，正在建立共用 JSON 檔…");
  const fileName = `xian-stock-shared-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}.json`;
  const handle = await directoryHandle.getFileHandle(fileName, { create: true });
  const content = serializeBackup(state);
  const fileFingerprint = await writeNewSharedFile(handle, content);
  const resolvedPath = await getSharedFilePath(directoryHandle, handle);
  const displayPath = resolvedPath || handle.name;
  await saveSharedDirectoryRecord(directoryHandle);
  await saveSharedFileRecord(handle, fileFingerprint, displayPath);
  sharedFileRecord = { ...(sharedFileRecord || {}), directoryHandle, handle, fingerprint: fileFingerprint, displayPath };
  cloudFileReady = true;
  cloudSaveBlocked = false;
  updateSharedFileControls(resolvedPath ? undefined : "相對路徑無法取得；目前僅顯示檔名。");
  toast("已建立並連結共用檔案。");
}

async function loadSharedFile() {
  if (!sharedFileRecord?.handle) return;
  const file = await readSharedFile(sharedFileRecord.handle);
  const imported = parseBackup(file.text);
  if (!window.confirm(translateText("載入共用檔會更新雲端資料；本機資料會保留。是否繼續？", state.settings.language))) return;
  if (storageMode === "cloud") replaceState(imported, { syncCloud: false });
  else if (!saveState(imported, "cloud")) throw new Error("無法儲存雲端資料的本機快取。");
  sharedFileRecord.fingerprint = file.fingerprint;
  await saveSharedFileRecord(sharedFileRecord.handle, file.fingerprint, sharedFileRecord.displayPath);
  cloudFileReady = true;
  cloudSaveBlocked = false;
  updateSharedFileControls();
  toast(storageMode === "cloud" ? "已載入最新雲端資料。" : "已更新雲端資料快取；本機資料未變更。");
}

async function saveToSharedFile() {
  if (!sharedFileRecord?.handle) return;
  const currentFile = await readSharedFile(sharedFileRecord.handle);
  if (currentFile.fingerprint !== sharedFileRecord.fingerprint
      && !window.confirm(translateText("共用檔在上次載入後已被修改。若繼續儲存，將以此瀏覽器資料覆寫最新版本。是否仍要覆寫？", state.settings.language))) {
    return;
  }
  const result = await writeSharedFile(
    sharedFileRecord.handle,
    serializeBackup(state),
    currentFile.fingerprint,
  );
  if (result.conflict) {
    cloudSaveBlocked = true;
    toast("共用檔再次被修改，為避免覆蓋他人資料，請先重新載入。", true);
    return;
  }
  sharedFileRecord.fingerprint = result.fingerprint;
  await saveSharedFileRecord(sharedFileRecord.handle, result.fingerprint, sharedFileRecord.displayPath);
  cloudFileReady = true;
  cloudSaveBlocked = false;
  updateSharedFileControls();
  toast("已儲存至共用檔案。");
}

async function switchStorageMode(nextMode) {
  if (nextMode === storageMode) return;
  const previousMode = storageMode;
  if (nextMode === "cloud") {
    if (!cloudFileReady || !sharedFileRecord?.handle) {
      document.querySelector("#storage-mode").value = previousMode;
      updateSharedFileControls("請先連結並載入或建立共用檔案，再切換至雲端模式。");
      return;
    }
    if (!window.confirm(translateText("切換至雲端會載入共用檔資料；本機資料將保留，之後的編輯會自動同步至雲端。是否繼續？", state.settings.language))) {
      document.querySelector("#storage-mode").value = previousMode;
      return;
    }
    const file = await readSharedFile(sharedFileRecord.handle);
    const imported = parseBackup(file.text);
    await saveSharedFileRecord(sharedFileRecord.handle, file.fingerprint, sharedFileRecord.displayPath);
    sharedFileRecord.fingerprint = file.fingerprint;
    cloudFileReady = true;
    if (!saveStorageMode("cloud")) throw new Error("無法儲存儲存位置設定。");
    storageMode = "cloud";
    try {
      replaceState(imported, { syncCloud: false });
      cloudSaveBlocked = false;
      toast("已切換至雲端；後續變更會自動同步。");
    } catch (error) {
      storageMode = previousMode;
      saveStorageMode(previousMode);
      document.querySelector("#storage-mode").value = previousMode;
      throw error;
    }
  } else {
    if (!window.confirm(translateText("切換至本機會載入此瀏覽器原有資料；雲端資料會保留不變。是否繼續？", state.settings.language))) {
      document.querySelector("#storage-mode").value = previousMode;
      return;
    }
    const localState = loadState("local");
    if (localState.storageError) {
      throw new Error("無法讀取本機已儲存資料，未切換儲存位置。");
    }
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
  updateSharedFileControls();
  const settingsForm = document.querySelector("#settings-form");
  for (const [key, value] of Object.entries(state.settings)) settingsForm.elements[key].value = value;
}

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

function makeHoldingRow(holding) {
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
  const nameCell = document.createElement("td");
  const nameWrap = document.createElement("div");
  nameWrap.className = "holding-name";
  const avatar = document.createElement("span");
  avatar.className = `stock-avatar${holding.market !== "TW" ? " us" : ""}`;
  avatar.textContent = holding.market === "US" ? "US" : holding.market === "CA" ? "CA" : "台";
  const copy = document.createElement("span");
  copy.className = "stock-copy";
  const symbol = document.createElement("strong");
  symbol.textContent = holding.symbol;
  const name = document.createElement("small");
  name.textContent = holding.name;
  copy.append(symbol, name);
  nameWrap.append(avatar, copy);
  nameCell.append(nameWrap);
  row.append(nameCell);
  row.append(textCell(holding.buyDate || "—"));
  row.append(textCell(formatMoney(metrics.averageCost, holding.market, 2, state.settings.language)));
  row.append(textCell(formatQuantity(holding.shares, state.settings.language)));
  const currentPriceCell = textCell(formatMoney(holding.currentPrice, holding.market, 2, state.settings.language));
  if (holding.updatedAt) currentPriceCell.title = `${translateText("上次更新：", state.settings.language)}${new Date(holding.updatedAt).toLocaleString(state.settings.language)}`;
  row.append(currentPriceCell);
  row.append(textCell(formatMoney(holding.fees, holding.market, 2, state.settings.language)));
  row.append(textCell(formatMoney(metrics.cost, holding.market, 2, state.settings.language)));
  row.append(textCell(formatMoney(metrics.marketValue, holding.market, 2, state.settings.language)));
  const profitCell = textCell(formatMoney(metrics.profit, holding.market, 2, state.settings.language), metrics.profit > 0 ? "gain" : metrics.profit < 0 ? "loss" : "muted-value");
  row.append(profitCell);
  row.append(textCell(`${metrics.returnRate >= 0 ? "+" : ""}${metrics.returnRate.toFixed(2)}%`, metrics.returnRate > 0 ? "gain" : metrics.returnRate < 0 ? "loss" : "muted-value"));
  for (const field of state.customFields) row.append(textCell(String(holding.custom?.[field.id] || "—"), "custom-cell"));
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
  trade.addEventListener("click", () => openTransactionDialog(holding));
  actions.append(edit, trade, remove);
  actionsCell.append(actions);
  row.append(actionsCell);
  return row;
}

function renderCustomHeaders() {
  document.querySelectorAll("[data-custom-header]").forEach((header) => header.remove());
  elements.customHeaders.hidden = true;
  for (const field of state.customFields) {
    const header = document.createElement("th");
    header.className = "custom-header-cell";
    header.dataset.customHeader = field.id;
    header.scope = "col";
    const group = document.createElement("div");
    group.className = "custom-header-content";
    const label = document.createElement("span");
    label.textContent = field.name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "custom-delete";
    remove.textContent = "×";
    remove.title = translateText(`刪除「${field.name}」欄位`, state.settings.language);
    remove.setAttribute("aria-label", remove.title);
    remove.addEventListener("click", () => deleteCustomField(field));
    group.append(label, remove);
    header.append(group);
    elements.customHeaders.before(header);
  }
}

function render() {
  renderCustomHeaders();
  elements.body.replaceChildren();
  const visible = state.holdings.filter((holding) => activeFilter === "all" || holding.market === activeFilter);
  for (const holding of visible) elements.body.append(makeHoldingRow(holding));
  const hasHoldings = visible.length > 0;
  elements.emptyState.classList.toggle("visible", !hasHoldings);
  document.querySelector("table").hidden = !hasHoldings;
  document.querySelector("#table-count").textContent = `${visible.length} 檔`;
  document.querySelector("#table-footer-count").textContent = `顯示 ${visible.length} 筆持倉`;

  const totals = getPortfolioMetrics(state.holdings, state.settings);
  const isUsd = state.settings.overviewCurrency === "USD";
  const primaryMarketValue = isUsd
    ? formatMoney(totals.marketValue / state.settings.fxRate, "US", 2, state.settings.language)
    : formatTwd(totals.marketValue, 0, state.settings.language);
  const alternateMarketValue = isUsd
    ? formatTwd(totals.marketValue, 0, state.settings.language)
    : formatMoney(totals.marketValue / state.settings.fxRate, "US", 2, state.settings.language);
  document.querySelector("#total-value").textContent = primaryMarketValue;
  document.querySelector("#total-value-alternate").textContent = alternateMarketValue;
  document.querySelector("#total-value-alternate-label").textContent = translateText(
    isUsd ? "新台幣等值" : "美元等值",
    state.settings.language,
  );
  document.querySelector("#summary-currency-note").textContent = translateText(
    isUsd ? "依庫存現價估算・美元" : "依庫存現價估算・新台幣",
    state.settings.language,
  );
  document.querySelectorAll("[data-overview-currency]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.overviewCurrency === state.settings.overviewCurrency));
  });
  document.querySelector("#settings-form").elements.overviewCurrency.value = state.settings.overviewCurrency;
  const formatOverviewAmount = (value) => isUsd
    ? formatMoney(value / state.settings.fxRate, "US", 2, state.settings.language)
    : formatTwd(value, 0, state.settings.language);
  document.querySelector("#total-cost").textContent = formatOverviewAmount(totals.cost);
  const profitElement = document.querySelector("#total-profit");
  profitElement.textContent = `${totals.profit > 0 ? "+" : ""}${formatOverviewAmount(totals.profit)}`;
  setProfitColor(profitElement, totals.profit);
  const dailyProfitElement = document.querySelector("#daily-profit");
  dailyProfitElement.textContent = totals.dailyProfit === null
    ? "—"
    : `${totals.dailyProfit > 0 ? "+" : ""}${formatOverviewAmount(totals.dailyProfit)}`;
  setProfitColor(dailyProfitElement, totals.dailyProfit || 0);
  const returnElement = document.querySelector("#average-return");
  returnElement.textContent = `${totals.returnRate > 0 ? "+" : ""}${totals.returnRate.toFixed(2)}%`;
  setProfitColor(returnElement, totals.returnRate);
  document.querySelector("#holding-count").innerHTML = `${state.holdings.length} <small>檔</small>`;
  applyTranslations(state.settings.language);
}

function findHolding(symbol, market) {
  return state.holdings.find((holding) => holding.symbol.toUpperCase() === symbol.toUpperCase() && holding.market === market);
}

function openTransactionDialog(holding = null) {
  elements.transactionForm.reset();
  editingTransactionId = null;
  elements.transactionForm.elements.transactionId.value = "";
  elements.symbolInput.readOnly = false;
  document.querySelector("#search-quote").disabled = false;
  document.querySelector("#transaction-legacy-notice").hidden = true;
  activeHoldingId = holding?.id || null;
  elements.feeInput.dataset.manual = "false";
  elements.transactionError.textContent = "";
  elements.transactionDialog.querySelector("#transaction-title").textContent = holding ? `新增「${holding.symbol}」交易` : "新增交易";
  elements.transactionDialog.querySelector("#save-transaction").textContent = holding ? "確認交易" : "確認新增";
  elements.transactionForm.elements.date.value = today();
  selectedQuote = holding ? { symbol: holding.symbol, name: holding.name, market: holding.market } : null;
  if (holding) {
    elements.symbolInput.value = holding.symbol;
    elements.currentPriceInput.value = holding.currentPrice || "";
    document.querySelector("#price-currency").textContent = locale.currency[holding.market].symbol;
  }
  elements.transactionType.value = "buy";
  elements.symbolInput.readOnly = Boolean(holding);
  updateTransactionFields();
  elements.transactionDialog.showModal();
  applyTranslations(state.settings.language);
  if (!holding) elements.symbolInput.focus();
}

function updateTransactionFields() {
  const type = elements.transactionType.value;
  const quantityField = document.querySelector("#quantity-field");
  const priceField = document.querySelector("#price-field");
  const feeField = document.querySelector("#fee-field");
  const splitField = document.querySelector("#split-field");
  const currentPriceField = document.querySelector("#quote-price-field");
  const quantityLabels = { buy: "買入股數", sell: "賣出股數", dividend: "配息股數", stockDividend: "新增配股股數", split: "目前持有股數", capitalReduction: "減少股數（選填）" };
  const priceLabels = { buy: "買入價格", sell: "賣出價格", dividend: "每股配息金額", stockDividend: "配股價格（參考）", split: "目前每股價格（參考）", capitalReduction: "每股退還金額" };
  quantityField.hidden = type === "split" || type === "dividend";
  priceField.hidden = type === "stockDividend" || type === "split";
  feeField.hidden = !["buy", "sell"].includes(type);
  splitField.hidden = type !== "split";
  currentPriceField.hidden = !["buy", "split", "capitalReduction"].includes(type);
  const currentPriceLabel = document.querySelector("#current-price-label");
  currentPriceLabel.replaceChildren(document.createTextNode(type === "split" ? "分割後每股價格 " : type === "capitalReduction" ? "減資後每股價格 " : "目前現價 "));
  const optionalLabel = document.createElement("span");
  optionalLabel.className = "optional-label";
  optionalLabel.textContent = type === "buy" ? "可修改" : "選填，留白自動調整";
  currentPriceLabel.append(optionalLabel);
  const currentPriceHelp = document.querySelector("#current-price-help");
  currentPriceHelp.hidden = type === "buy";
  currentPriceHelp.textContent = type === "split"
    ? "留白會依分割比例調整原股價，以維持分割前市值。"
    : "留白會依減少股數調整原股價，以維持減資前市值。";
  document.querySelector("#quantity-label").textContent = quantityLabels[type];
  document.querySelector("#price-label").textContent = priceLabels[type];
  elements.quantityInput.required = ["buy", "sell", "stockDividend"].includes(type);
  elements.priceInput.required = ["buy", "sell", "dividend", "capitalReduction"].includes(type);
  document.querySelector("#split-ratio").required = type === "split";
  elements.feeInput.required = false;
  updateFeeEstimate();
  updatePreview();
  applyTranslations(state.settings.language);
}

function updateFeeEstimate() {
  const enteredSymbol = elements.symbolInput.value.trim();
  const market = selectedQuote?.symbol.toUpperCase() === enteredSymbol.toUpperCase()
    ? selectedQuote.market
    : enteredSymbol ? quoteMarket(enteredSymbol) : "TW";
  const fee = estimateFee(market, elements.quantityInput.value, elements.priceInput.value, state.settings);
  if (elements.feeInput.dataset.manual !== "true" || !elements.feeInput.value) elements.feeInput.value = fee ? String(Number(fee.toFixed(4))) : "";
  document.querySelector("#fee-help").textContent = `依${locale.currency[market].label}手續費設定預估，可自行修改。`;
}

function updatePreview() {
  const type = elements.transactionType.value;
  const enteredQuantity = Number(elements.quantityInput.value) || 0;
  const price = Number(elements.priceInput.value) || 0;
  const enteredSymbol = elements.symbolInput.value.trim();
  const market = selectedQuote?.symbol.toUpperCase() === enteredSymbol.toUpperCase()
    ? selectedQuote.market
    : enteredSymbol ? quoteMarket(enteredSymbol) : "TW";
  const matchingHolding = enteredSymbol
    ? findHolding(normalizeSymbol(enteredSymbol, market), market)
    : null;
  const quantity = type === "dividend" && enteredQuantity === 0
    ? matchingHolding?.shares || 0
    : enteredQuantity;
  const amount = quantity * price;
  const preview = document.querySelector("#preview-amount");
  if (["buy", "sell", "dividend", "capitalReduction"].includes(type) && amount) {
    preview.textContent = formatMoney(amount, market, 2, state.settings.language);
  } else if (type === "stockDividend" && quantity) preview.textContent = `${formatQuantity(quantity, state.settings.language)} 股`;
  else if (type === "split" && Number(document.querySelector("#split-ratio").value)) preview.textContent = `持股數將乘以 ${document.querySelector("#split-ratio").value}`;
  else preview.textContent = "—";
  applyTranslations(state.settings.language);
}

function applyQuoteSelection(quote) {
  selectedQuote = quote;
  elements.symbolInput.value = quote.symbol;
  elements.suggestions.classList.remove("visible");
  elements.transactionError.textContent = "";
  document.querySelector("#price-currency").textContent = locale.currency[quote.market].symbol;
  fetchQuote(quote.symbol, undefined, state.settings).then((result) => {
    if (selectedQuote?.symbol !== quote.symbol) return;
    if (result.market !== quote.market) {
      toast("報價幣別與預期市場不同，請確認股票代號。", true);
    }
    selectedQuote = { ...quote, dailyChangePerShare: result.dailyChangePerShare };
    elements.currentPriceInput.value = String(result.price);
    if (elements.transactionType.value === "buy") elements.priceInput.value = String(result.price);
    updateFeeEstimate();
    updatePreview();
    toast(`${quote.symbol} 已帶入報價 ${formatMoney(result.price, quote.market, 2, state.settings.language)}。`);
  }).catch((error) => {
    if (error.name === "AbortError") return;
    toast(`${error.message} 可手動輸入價格。`, true);
  });
}

function renderSuggestions(quotes) {
  elements.suggestions.replaceChildren();
  if (!quotes.length) {
    const empty = document.createElement("div");
    empty.className = "quote-empty";
    empty.textContent = "找不到符合的台股、美股或加拿大股，請再試試看代號。";
    elements.suggestions.append(empty);
  } else {
    for (const quote of quotes) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "suggestion-option";
      option.setAttribute("role", "option");
      const main = document.createElement("span");
      main.className = "suggestion-main";
      const symbol = document.createElement("strong");
      symbol.textContent = quote.symbol;
      const name = document.createElement("small");
      name.textContent = quote.name;
      main.append(symbol, name);
      const market = document.createElement("span");
      market.className = "suggestion-market";
      const separator = state.settings.language === "en-US" ? " · " : "・";
      market.textContent = `${state.settings.language === "en-US" ? locale.currency[quote.market].englishLabel : locale.currency[quote.market].label}${separator}${quote.exchange}`;
      option.append(main, market);
      option.addEventListener("click", () => applyQuoteSelection(quote));
      elements.suggestions.append(option);
    }
  }
  elements.suggestions.classList.add("visible");
  applyTranslations(state.settings.language);
}

async function lookupSymbol(inputValue) {
  const query = inputValue.trim();
  if (query.length < 1) return toast("請先輸入股票代號或名稱。", true);
  elements.suggestions.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "quote-loading";
  loading.textContent = "正在搜尋台股、美股與加拿大股…";
  elements.suggestions.append(loading);
  elements.suggestions.classList.add("visible");
  applyTranslations(state.settings.language);
  try {
    const results = await searchQuotes(query, undefined, state.settings);
    renderSuggestions(results);
    if (results.length === 0) toast("找不到股票，請確認代號或輸入英文名稱。", true);
  } catch (error) {
    if (error.name !== "AbortError") {
      elements.suggestions.classList.remove("visible");
      toast(error.message, true);
    }
  }
}

async function refreshHoldingQuote(holding) {
  try {
    const result = await fetchQuote(holding.symbol, undefined, state.settings);
    holding.currentPrice = result.price;
    holding.dailyChangePerShare = result.dailyChangePerShare;
    holding.updatedAt = new Date().toISOString();
    return true;
  } catch (error) {
    console.error(`更新 ${holding.symbol} 報價失敗：`, error);
    return false;
  }
}

function normalizeSymbol(symbol, market) {
  const value = symbol.trim().toUpperCase();
  if (market === "TW" && !/\.(TW|TWO)$/.test(value)) return `${value}.TW`;
  return value;
}

function emptyHolding({ symbol, name, market, id = makeId() }) {
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

function ledgerKey(holding) {
  return `${holding.market}:${holding.symbol.toUpperCase()}`;
}

function transactionsForHolding(holding) {
  return state.transactions.filter((item) => item.symbol?.toUpperCase() === holding.symbol.toUpperCase() && (!item.market || item.market === holding.market));
}

function holdingBalance(holding) {
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

function applyTransactionToHolding(holding, transaction) {
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
    if (quantity <= 0 || quantity > holding.shares + 1e-8 || price <= 0) throw new Error("賣出股數不可超過持有股數，價格必須大於 0。");
    const allocatedCost = holding.shares > 0 ? (holding.costBasis * quantity) / holding.shares : 0;
    holding.costBasis = Math.max(0, holding.costBasis - allocatedCost);
    holding.shares = Math.max(0, holding.shares - quantity);
    holding.fees += fee;
    holding.realizedProfit += quantity * price - fee - allocatedCost;
    holding.currentPrice = Number(currentPrice) || price;
  } else if (type === "dividend") {
    if (price < 0) throw new Error("配息金額不得小於 0。");
    holding.dividends += (quantity || holding.shares) * price;
  } else if (type === "stockDividend") {
    if (quantity <= 0) throw new Error("配股股數必須大於 0。");
    holding.shares += quantity;
    if (oldShares > 0 && holding.currentPrice > 0) holding.currentPrice = (holding.currentPrice * oldShares) / holding.shares;
  } else if (type === "split") {
    const splitRatio = Number(ratio);
    if (splitRatio <= 0) throw new Error("分割比例必須大於 0。");
    holding.shares *= splitRatio;
    holding.currentPrice = Number(currentPrice) > 0 ? Number(currentPrice) : holding.currentPrice / splitRatio;
  } else if (type === "capitalReduction") {
    if (price <= 0) throw new Error("每股退還金額必須大於 0。");
    if (quantity > holding.shares + 1e-8) throw new Error("減少股數不可超過目前持有股數。");
    const cancelledShares = Math.max(0, quantity || 0);
    const returnedAmount = price * (quantity > 0 ? cancelledShares : holding.shares);
    const previousMarketValue = holding.currentPrice * oldShares;
    if (quantity > 0) {
      const allocatedCost = oldShares > 0 ? (holding.costBasis * cancelledShares) / oldShares : 0;
      holding.costBasis = Math.max(0, holding.costBasis - allocatedCost);
      holding.shares = Math.max(0, holding.shares - cancelledShares);
      holding.realizedProfit += returnedAmount - allocatedCost;
    } else {
      const costReduction = Math.min(holding.costBasis, returnedAmount);
      holding.costBasis -= costReduction;
      holding.realizedProfit += returnedAmount - costReduction;
    }
    if (Number(currentPrice) > 0) holding.currentPrice = Number(currentPrice);
    else if (quantity > 0 && holding.shares > 0) holding.currentPrice = previousMarketValue / holding.shares;
  }
  return holding;
}

function ensureOpeningBalance(holding) {
  const key = ledgerKey(holding);
  if (state.openingBalances[key]) return;
  const history = transactionsForHolding(holding);
  if (!history.length) {
    state.openingBalances[key] = holdingBalance(holding);
    return;
  }
  const replayed = emptyHolding(holding);
  try {
    for (const transaction of history.filter((item) => !item.locked).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
      transaction.market ||= holding.market;
      transaction.name ||= holding.name;
      transaction.quantity = Number(transaction.quantity) || 0;
      transaction.price = Number(transaction.price) || 0;
      transaction.fee = Number(transaction.fee) || 0;
      transaction.ratio = Number(transaction.ratio) || 0;
      transaction.currentPrice = Number(transaction.currentPrice) || 0;
      applyTransactionToHolding(replayed, transaction);
    }
    if (Math.abs(replayed.shares - holding.shares) > 1e-6 || Math.abs(replayed.costBasis - holding.costBasis) > 0.02) {
      throw new Error("交易明細與目前庫存不同步。");
    }
    state.openingBalances[key] = holdingBalance(emptyHolding(holding));
  } catch {
    for (const transaction of history) transaction.locked = true;
    state.openingBalances[key] = holdingBalance(holding);
  }
}

function rebuildHolding(holding) {
  ensureOpeningBalance(holding);
  const baseline = state.openingBalances[ledgerKey(holding)];
  const quoteSnapshot = {
    currentPrice: holding.currentPrice,
    dailyChangePerShare: holding.dailyChangePerShare ?? null,
    updatedAt: holding.updatedAt,
  };
  const rebuilt = { ...emptyHolding(holding), ...baseline, custom: { ...holding.custom } };
  const history = state.transactions
    .filter((item) => item.symbol?.toUpperCase() === holding.symbol.toUpperCase() && (!item.market || item.market === holding.market) && !item.locked)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  for (const transaction of history) applyTransactionToHolding(rebuilt, transaction);
  Object.assign(rebuilt, quoteSnapshot);
  const position = state.holdings.findIndex((item) => item.id === holding.id);
  if (rebuilt.shares <= 1e-8) {
    if (position >= 0) state.holdings.splice(position, 1);
    return null;
  }
  if (position >= 0) state.holdings[position] = rebuilt;
  else state.holdings.push(rebuilt);
  return rebuilt;
}

function addTransaction({ type, symbol, name, market, date, quantity, price, fee, ratio, currentPrice, dailyChangePerShare }) {
  const canonicalSymbol = normalizeSymbol(symbol, market);
  let holding = findHolding(canonicalSymbol, market);
  if (holding) ensureOpeningBalance(holding);
  else {
    holding = emptyHolding({ symbol: canonicalSymbol, name: name || canonicalSymbol, market });
    state.openingBalances[ledgerKey(holding)] = holdingBalance(holding);
  }
  if (name && (holding.name === holding.symbol || holding.name === holding.symbol.replace(/\.(TW|TWO)$/i, ""))) holding.name = name;
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
  if (!state.holdings.some((item) => item.id === holding.id) && holding.shares > 1e-8) state.holdings.push(holding);
  if (holding.shares <= 1e-8) state.holdings = state.holdings.filter((item) => item.id !== holding.id);
  state.transactions.push(transaction);
  return holding;
}

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
  ensureOpeningBalance(holding);
  const metrics = getHoldingMetrics(holding);
  const dialog = document.querySelector("#holding-details-dialog");
  document.querySelector("#details-title").textContent = `${holding.symbol}｜${holding.name}`;
  const summary = document.querySelector("#details-summary");
  summary.replaceChildren(
    detailsMetric("持有股數", formatQuantity(holding.shares, state.settings.language)),
    detailsMetric("投資本金", formatMoney(metrics.cost, holding.market, 2, state.settings.language)),
    detailsMetric("目前市值", formatMoney(metrics.marketValue, holding.market, 2, state.settings.language)),
    detailsMetric("帳面損益", formatMoney(metrics.profit, holding.market, 2, state.settings.language), metrics.profit > 0 ? "gain" : metrics.profit < 0 ? "loss" : ""),
  );
  const history = transactionsForHolding(holding);
  const hasLegacyTransactions = history.some((transaction) => transaction.locked);
  document.querySelector("#details-error").textContent = "";
  document.querySelector("#details-legacy-notice").textContent = hasLegacyTransactions
    ? translateText("標示為舊版／校正的明細可編輯或刪除；這些變更只更新歷史紀錄，不會重算目前持倉股數與成本。", state.settings.language)
    : "";
  renderTransactionHistory(holding);
  if (!dialog.open) dialog.showModal();
  applyTranslations(state.settings.language);
}

function renderTransactionHistory(holding) {
  const historyElement = document.querySelector("#transaction-history");
  const transactions = transactionsForHolding(holding).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  document.querySelector("#details-transaction-count").textContent = `${transactions.length} 筆`;
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
    edit.addEventListener("click", () => openEditTransaction(holding, transaction));
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

function openEditTransaction(holding, transaction) {
  document.querySelector("#holding-details-dialog").close();
  openTransactionDialog(holding);
  elements.symbolInput.readOnly = Boolean(transaction.locked);
  document.querySelector("#search-quote").disabled = Boolean(transaction.locked);
  const form = elements.transactionForm;
  form.elements.transactionId.value = transaction.id;
  editingTransactionId = transaction.id;
  elements.transactionType.value = transaction.type;
  form.elements.date.value = transaction.date || today();
  form.elements.quantity.value = transaction.quantity || "";
  form.elements.price.value = transaction.price || "";
  form.elements.fee.value = transaction.fee || "";
  form.elements.ratio.value = transaction.ratio || "";
  form.elements.currentPrice.value = transaction.currentPrice || "";
  elements.feeInput.dataset.manual = "true";
  updateTransactionFields();
  elements.transactionDialog.querySelector("#transaction-title").textContent = `編輯 ${translateText(locale.transactionLabels[transaction.type] || transaction.type, state.settings.language)}交易`;
  elements.transactionDialog.querySelector("#save-transaction").textContent = "儲存變更";
  const legacyNotice = document.querySelector("#transaction-legacy-notice");
  legacyNotice.hidden = !transaction.locked;
  legacyNotice.textContent = transaction.locked
    ? translateText("此為舊版／校正明細；編輯只會更新歷史紀錄，不會重算目前持倉股數與成本。", state.settings.language)
    : "";
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
    const updatedHolding = rebuildHolding(holding);
    persist();
    render();
    if (updatedHolding) openHoldingDetails(updatedHolding);
    else document.querySelector("#holding-details-dialog").close();
    toast(transaction.locked
      ? "舊版／校正交易明細已刪除；目前持倉股數與成本未變更。"
      : "交易明細已刪除，庫存成本已重新計算。");
  } catch (error) {
    state.transactions.splice(originalIndex, 0, removed);
    document.querySelector("#details-error").textContent = translateText(error.message, state.settings.language);
    renderTransactionHistory(holding);
  }
}

function deleteHolding(holding) {
  if (!window.confirm(translateText(`確定刪除 ${holding.symbol}（${holding.name}）及其持倉資料？`, state.settings.language))) return;
  state.holdings = state.holdings.filter((item) => item.id !== holding.id);
  persist();
  render();
  toast(`${holding.symbol} 已刪除。`);
}

function openEditDialog(holding) {
  const form = document.querySelector("#edit-form");
  for (const [key, value] of Object.entries({
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    date: holding.buyDate,
    shares: holding.shares,
    costBasis: holding.costBasis,
    currentPrice: holding.currentPrice,
    fees: holding.fees,
  })) form.elements[key].value = value;
  const customFields = document.querySelector("#edit-custom-fields");
  customFields.replaceChildren();
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
    customFields.append(wrapper);
  }
  document.querySelector("#edit-error").textContent = "";
  document.querySelector("#edit-dialog").showModal();
  applyTranslations(state.settings.language);
}

function deleteCustomField(field) {
  if (!window.confirm(translateText(`確定刪除「${field.name}」欄位及所有該欄位資料？`, state.settings.language))) return;
  state.customFields = state.customFields.filter((item) => item.id !== field.id);
  for (const holding of state.holdings) delete holding.custom[field.id];
  persist();
  render();
  toast(`「${field.name}」欄位已刪除。`);
}

function openSettings() {
  const form = document.querySelector("#settings-form");
  for (const [key, value] of Object.entries(state.settings)) form.elements[key].value = value;
  document.querySelector("#storage-mode").value = storageMode;
  document.querySelector("#settings-error").textContent = "";
  document.querySelector("#settings-dialog").showModal();
  updateSharedFileControls();
  applyTranslations(state.settings.language);
}

const numericSettingKeys = ["twRate", "twDiscount", "twMinimum", "usPerShare", "usMinimum", "fxRate", "caPerShare", "caMinimum", "cadFxRate"];

function validatePositiveFormValues(form, names, errorElement) {
  for (const name of names) {
    if (!Number.isFinite(Number(form.elements[name].value)) || Number(form.elements[name].value) < 0) {
      errorElement.textContent = translateText("請確認各欄位皆為有效的非負數值。", state.settings.language);
      form.elements[name].focus();
      return false;
    }
  }
  return true;
}

document.querySelector("#add-holding").addEventListener("click", () => openTransactionDialog());
document.querySelector("#add-holding-table").addEventListener("click", () => openTransactionDialog());
document.querySelectorAll("[data-overview-currency]").forEach((button) => {
  button.addEventListener("click", () => {
    const currency = button.dataset.overviewCurrency;
    if (currency !== "TWD" && currency !== "USD") return;
    state.settings.overviewCurrency = currency;
    persist();
    render();
  });
});
document.querySelector("#empty-add-holding").addEventListener("click", () => openTransactionDialog());
document.querySelector("#open-settings").addEventListener("click", openSettings);
document.querySelector("#open-settings-top").addEventListener("click", openSettings);
document.querySelector("#add-custom-field").addEventListener("click", () => document.querySelector("#custom-field-dialog").showModal());
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
document.querySelectorAll(".table-tab").forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".table-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
  render();
}));
document.querySelector("#details-add-transaction").addEventListener("click", () => {
  const holding = state.holdings.find((item) => item.id === activeHoldingId);
  if (!holding) return;
  document.querySelector("#holding-details-dialog").close();
  openTransactionDialog(holding);
});
document.querySelector("#details-edit-holding").addEventListener("click", () => {
  const holding = state.holdings.find((item) => item.id === activeHoldingId);
  if (!holding) return;
  document.querySelector("#holding-details-dialog").close();
  openEditDialog(holding);
});

elements.transactionType.addEventListener("change", () => {
  if (!editingTransactionId && ["split", "capitalReduction"].includes(elements.transactionType.value)) {
    elements.currentPriceInput.value = "";
  }
  updateTransactionFields();
});
for (const input of [elements.quantityInput, elements.priceInput]) {
  input.addEventListener("input", () => {
    if (input === elements.quantityInput || input === elements.priceInput) elements.feeInput.dataset.manual = "false";
    updateFeeEstimate();
    updatePreview();
  });
}
elements.feeInput.addEventListener("input", () => { elements.feeInput.dataset.manual = "true"; });
document.querySelector("#split-ratio").addEventListener("input", updatePreview);
elements.symbolInput.addEventListener("input", () => {
  selectedQuote = null;
  elements.currentPriceInput.value = "";
  elements.priceInput.value = "";
  updateFeeEstimate();
  updatePreview();
  clearTimeout(suggestionTimer);
  if (suggestionController) suggestionController.abort();
  const value = elements.symbolInput.value.trim();
  if (!value) {
    elements.suggestions.classList.remove("visible");
    return;
  }
  suggestionTimer = setTimeout(async () => {
    suggestionController = new AbortController();
    try {
      const quotes = await searchQuotes(value, suggestionController.signal, state.settings);
      if (elements.symbolInput.value.trim() !== value) return;
      const normalizedQuery = value.toUpperCase();
      const exactQuote = quotes.find((quote) => quote.symbol.toUpperCase() === normalizedQuery)
        || quotes.find((quote) => quote.aliases?.some((name) => name.normalize("NFC").toLocaleUpperCase() === normalizedQuery))
        || quotes.find((quote) => quote.market === "TW"
          && quote.symbol.toUpperCase().replace(/\.(TWO|TW)$/, "") === normalizedQuery);
      if (exactQuote) applyQuoteSelection(exactQuote);
      else renderSuggestions(quotes);
    } catch (error) {
      if (error.name !== "AbortError") {
        elements.suggestions.replaceChildren();
        const message = document.createElement("div");
        message.className = "quote-empty";
        message.textContent = "報價搜尋暫時無法使用，請稍後再試或手動輸入股票代號。";
        elements.suggestions.append(message);
        elements.suggestions.classList.add("visible");
        applyTranslations(state.settings.language);
      }
    }
  }, 350);
});
document.querySelector("#search-quote").addEventListener("click", () => lookupSymbol(elements.symbolInput.value));
elements.symbolInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && elements.suggestions.classList.contains("visible")) {
    const firstOption = elements.suggestions.querySelector(".suggestion-option");
    if (firstOption) {
      event.preventDefault();
      firstOption.click();
    }
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".quote-input-wrap")) elements.suggestions.classList.remove("visible");
});

elements.transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.transactionError.textContent = "";
  const form = elements.transactionForm;
  const type = form.elements.type.value;
  const symbolValue = form.elements.symbol.value.trim();
  const selectedMarket = selectedQuote?.symbol.toUpperCase() === symbolValue.toUpperCase()
    ? selectedQuote.market
    : quoteMarket(symbolValue);
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const fee = Number(form.elements.fee.value) || 0;
  const transactionId = editingTransactionId;
  if (!symbolValue) {
    elements.transactionError.textContent = translateText("請輸入股票代號。", state.settings.language);
    return;
  }
  if (["buy", "sell"].includes(type) && (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0)) {
    elements.transactionError.textContent = translateText("股數與價格都必須是大於 0 的有效數值。", state.settings.language);
    return;
  }
  if (!Number.isFinite(fee) || fee < 0) {
    elements.transactionError.textContent = translateText("手續費必須是有效的非負數值。", state.settings.language);
    return;
  }
  try {
    const updatedTransaction = {
      type,
      symbol: symbolValue,
      name: selectedQuote?.symbol.toUpperCase() === symbolValue.toUpperCase() ? selectedQuote.name : symbolValue,
      market: selectedMarket,
      date: form.elements.date.value || today(),
      quantity,
      price,
      fee,
      ratio: Number(form.elements.ratio.value),
      currentPrice: Number(form.elements.currentPrice.value),
      dailyChangePerShare: selectedQuote?.symbol.toUpperCase() === symbolValue.toUpperCase()
        ? selectedQuote.dailyChangePerShare
        : undefined,
    };
    if (transactionId) {
      const existingTransaction = state.transactions.find((item) => item.id === transactionId);
      const holding = state.holdings.find((item) => item.id === activeHoldingId);
      if (!existingTransaction || !holding) throw new Error("找不到要修改的交易明細。");
      const originalTransaction = { ...existingTransaction };
      Object.assign(existingTransaction, updatedTransaction);
      try {
        rebuildHolding(holding);
      } catch (error) {
        Object.assign(existingTransaction, originalTransaction);
        throw error;
      }
    } else {
      addTransaction(updatedTransaction);
    }
    persist();
    render();
    elements.transactionDialog.close();
    editingTransactionId = null;
    form.elements.transactionId.value = "";
    const activeHolding = state.holdings.find((item) => item.id === activeHoldingId);
    if (activeHolding) openHoldingDetails(activeHolding);
    const savedTransaction = transactionId ? state.transactions.find((item) => item.id === transactionId) : null;
    toast(savedTransaction?.locked
      ? "舊版／校正交易明細已更新；目前持倉股數與成本未變更。"
      : transactionId ? "交易明細已修改，庫存成本已重新計算。" : `${locale.transactionLabels[type]}紀錄已新增。`);
  } catch (error) {
    elements.transactionError.textContent = translateText(error.message, state.settings.language);
  }
});

document.querySelector("#edit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.querySelector("#edit-error");
  error.textContent = "";
  const names = ["shares", "costBasis", "currentPrice", "fees"];
  if (!validatePositiveFormValues(form, names, error)) return;
  const holding = state.holdings.find((item) => item.id === form.elements.id.value);
  if (!holding) return;
  const newSymbol = normalizeSymbol(form.elements.symbol.value, holding.market);
  const duplicate = state.holdings.find((item) => item.id !== holding.id && item.symbol.toUpperCase() === newSymbol && item.market === holding.market);
  if (duplicate) {
    error.textContent = translateText("此股號已有其他持倉，請編輯既有持倉以避免重複資料。", state.settings.language);
    return;
  }
  holding.symbol = newSymbol;
  holding.name = form.elements.name.value.trim() || newSymbol;
  holding.buyDate = form.elements.date.value;
  holding.shares = Number(form.elements.shares.value);
  holding.costBasis = Number(form.elements.costBasis.value);
  holding.currentPrice = Number(form.elements.currentPrice.value);
  holding.fees = Number(form.elements.fees.value);
  holding.custom = { ...holding.custom };
  for (const field of state.customFields) holding.custom[field.id] = form.elements[`custom-${field.id}`].value.trim();
  const history = transactionsForHolding(holding);
  if (history.length) {
    history.forEach((transaction) => { transaction.locked = true; });
    state.openingBalances[ledgerKey(holding)] = holdingBalance(holding);
  }
  if (holding.shares <= 0) state.holdings = state.holdings.filter((item) => item.id !== holding.id);
  persist();
  render();
  document.querySelector("#edit-dialog").close();
  toast("庫存資料已更新。");
});

document.querySelector("#custom-field-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = event.currentTarget.elements.name.value.trim();
  if (!name) return;
  if (state.customFields.some((field) => field.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    toast("已經有同名的自訂欄位。", true);
    return;
  }
  state.customFields.push({ id: makeId(), name });
  persist();
  render();
  event.currentTarget.reset();
  document.querySelector("#custom-field-dialog").close();
  toast(`已新增「${name}」欄位，可在編輯持倉時填寫。`);
});

document.querySelector("#settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.querySelector("#settings-error");
  error.textContent = "";
  if (!validatePositiveFormValues(form, numericSettingKeys, error)) return;
  if (Number(form.elements.twDiscount.value) > 100) {
    error.textContent = translateText("台股折扣比例不可大於 100%。", state.settings.language);
    form.elements.twDiscount.focus();
    return;
  }
  let quoteApiUrl;
  try {
    const parsedQuoteApiUrl = new URL(form.elements.quoteApiUrl.value.trim());
    if (parsedQuoteApiUrl.protocol !== "https:" || parsedQuoteApiUrl.username || parsedQuoteApiUrl.password) {
      throw new Error();
    }
    quoteApiUrl = parsedQuoteApiUrl.toString();
  } catch {
    error.textContent = translateText("Render 報價 API 請填寫有效的 HTTPS 網址。", state.settings.language);
    form.elements.quoteApiUrl.focus();
    return;
  }
  state.settings = {
    ...state.settings,
    language: form.elements.language.value,
    quoteProvider: form.elements.quoteProvider.value === "yahoo" ? "yahoo" : "render-api",
    quoteApiUrl,
    ...Object.fromEntries(numericSettingKeys.map((key) => [key, Number(form.elements[key].value)])),
  };
  persist();
  render();
  updateTransactionFields();
  document.querySelector("#settings-dialog").close();
  toast("手續費與匯率設定已儲存。");
});

document.querySelector("#storage-mode").addEventListener("change", (event) => {
  const requestedMode = event.currentTarget.value;
  runSharedAction(async () => {
    try {
      await switchStorageMode(requestedMode);
    } catch (error) {
      document.querySelector("#storage-mode").value = storageMode;
      throw error;
    }
  });
});

document.querySelector("#export-backup").addEventListener("click", () => {
  const date = today();
  downloadFile(`xian-stock-backup-${date}.json`, serializeBackup(state), "application/json;charset=utf-8");
  toast("JSON 完整備份已下載。");
});

document.querySelector("#export-csv").addEventListener("click", () => {
  downloadFile(`xian-stock-export-${today()}.csv`, serializeCsv(state), "text/csv;charset=utf-8");
  toast("CSV 試算表資料已下載。");
});

document.querySelector("#import-backup").addEventListener("click", () => {
  document.querySelector("#import-backup-file").click();
});

document.querySelector("#import-backup-file").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error("備份檔超過 20 MB，無法匯入。");
    const imported = parseBackup(await file.text());
    if (!window.confirm(translateText("還原備份會取代這個瀏覽器目前的庫存、交易與設定。建議先下載目前資料備份。是否繼續？", state.settings.language))) return;
    replaceState(imported);
    toast("資料已從 JSON 備份還原。");
  } catch (error) {
    toast(translateText(error.message || "無法匯入備份檔。", state.settings.language), true);
  } finally {
    input.value = "";
  }
});

function runSharedAction(action) {
  if (sharedActionInProgress) return;
  sharedActionInProgress = true;
  updateSharedFileControls();
  let actionResult;
  try {
    actionResult = action();
  } catch (error) {
    actionResult = Promise.reject(error);
  }
  Promise.resolve(actionResult)
    .catch((error) => {
      if (error.name === "AbortError") {
        updateSharedFileControls("已取消選取；同步資料夾位置未變更。");
      } else {
        updateSharedFileControls(error.message || "共用檔案操作失敗。");
        sharedFileError(error);
      }
    })
    .finally(() => {
      sharedActionInProgress = false;
      updateSharedFileControls(sharedStatusMessage);
    });
}

document.querySelector("#shared-file-open").addEventListener("click", () => {
  runSharedAction(selectAndLoadSharedFile);
});
document.querySelector("#shared-folder-select").addEventListener("click", () => {
  startSharedDirectorySelection();
});
document.querySelector("#shared-file-create").addEventListener("click", () => {
  runSharedAction(createSharedFile);
});
document.querySelector("#shared-file-load").addEventListener("click", () => {
  runSharedAction(loadSharedFile);
});
document.querySelector("#shared-file-save").addEventListener("click", () => {
  runSharedAction(saveToSharedFile);
});
document.querySelector("#shared-file-disconnect").addEventListener("click", () => {
  runSharedAction(async () => {
    if (storageMode === "cloud") {
      throw new Error("請先切回本機模式，再解除雲端檔案連結。");
    }
    await removeSharedFileRecord();
    sharedFileRecord = null;
    cloudFileReady = false;
    cloudSaveBlocked = false;
    updateSharedFileControls("已解除共用檔案連結；本機資料不受影響。");
  });
});

document.querySelector("#refresh-quotes").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  if (!state.holdings.length) return toast("目前沒有庫存可更新報價。");
  button.classList.add("loading");
  button.disabled = true;
  const results = await Promise.all(state.holdings.map(refreshHoldingQuote));
  persist();
  render();
  button.classList.remove("loading");
  button.disabled = false;
  const successes = results.filter(Boolean).length;
  document.querySelector("#updated-label").textContent = `更新於 ${new Date().toLocaleTimeString(state.settings.language, { hour: "2-digit", minute: "2-digit" })}`;
  if (successes === results.length) toast(`已更新 ${successes} 檔股票報價。`);
  else toast(`${successes} / ${results.length} 檔報價更新成功，失敗項目請稍後重試。`, successes === 0);
});

document.querySelector("#footer-year").textContent = new Date().getFullYear();
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
render();
initializeSharedFile();
