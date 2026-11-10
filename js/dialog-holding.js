// js/dialog-holding.js - 持倉詳情、歷史交易明細刪改、庫存資料校正與自訂欄位模組（含自動 PULL/PUSH 安全防護）
import { getHoldingMetrics } from "./calculations.js";
import { formatMoney, formatQuantity, locale, translateText, applyTranslations } from "./i18n.js";
import { getAccountById } from "./ui-accounts.js";
import { getStockName } from "./quotes.js";
import { 
  transactionsForHolding, rebuildHolding, normalizeSymbol, 
  ledgerKey, holdingBalance, makeId 
} from "./ledger.js";
import { DEFAULT_ACCOUNT_ID } from "./storage.js";

export function initHoldingDialogs({
  state,
  persist,
  render,
  toast,
  txDialog,
  syncUsStreamSubscriptions,
  onBeforeAction,
  onAfterAction
}) {
  let activeHoldingId = null;

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
      empty.textContent = translateText("尚無交易明細，點選「新增交易」開始記錄。", state.settings.language);
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
      edit.textContent = translateText("編輯", state.settings.language);
      edit.addEventListener("click", () => {
        document.querySelector("#holding-details-dialog")?.close();
        txDialog.openEdit(holding, transaction);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "row-action danger";
      remove.textContent = translateText("刪除", state.settings.language);
      remove.addEventListener("click", () => deleteTransaction(holding, transaction));
      actions.append(edit, remove);
      entry.append(main, quantity, price, fee, actions);
      historyElement.append(entry);
    }
    applyTranslations(state.settings.language);
  }

  async function deleteTransaction(holding, transaction) {
    const typeLabel = translateText(locale.transactionLabels[transaction.type] || transaction.type, state.settings.language);
    const prompt = transaction.locked
      ? `${translateText("確定刪除舊版／校正明細", state.settings.language)}：${typeLabel}（${transaction.date}）？${translateText("目前持倉股數與成本不會變更。", state.settings.language)}`
      : `${translateText("確定刪除交易明細", state.settings.language)}：${typeLabel}（${transaction.date}）？`;
    if (!window.confirm(prompt)) return;

    if (typeof onBeforeAction === "function") await onBeforeAction();

    const originalIndex = state.transactions.findIndex((item) => item.id === transaction.id);
    if (originalIndex < 0) return;
    const [removed] = state.transactions.splice(originalIndex, 1);
    try {
      const updatedHolding = rebuildHolding(holding, state);
      state.holdings = state.holdings.filter((h) => Number(h.shares) > 0);
      syncUsStreamSubscriptions();
      persist();
      render();

      if (typeof onAfterAction === "function") await onAfterAction();

      if (updatedHolding && updatedHolding.shares > 0) openHoldingDetails(updatedHolding);
      else document.querySelector("#holding-details-dialog")?.close();
      toast(transaction.locked
        ? "舊版／校正交易明細已刪除，並同步至雲端。"
        : "交易明細已刪除，庫存已重算並同步至雲端。");
    } catch (error) {
      state.transactions.splice(originalIndex, 0, removed);
      const detailsErr = document.querySelector("#details-error");
      if (detailsErr) detailsErr.textContent = translateText(error.message, state.settings.language);
      renderTransactionHistory(holding);
    }
  }

  async function deleteHolding(holding) {
    const resolvedName = getStockName(holding.symbol) || holding.name || holding.symbol;
    const holdingAccount = getAccountById(holding.accountId || DEFAULT_ACCOUNT_ID, state);
    
    const relatedTransactions = state.transactions.filter(
      (item) =>
        item.symbol?.toUpperCase() === holding.symbol.toUpperCase() &&
        (!item.market || item.market === holding.market) &&
        (item.accountId || DEFAULT_ACCOUNT_ID) === (holding.accountId || DEFAULT_ACCOUNT_ID)
    );

    const confirmMsg = translateText(
      `確定刪除「${holdingAccount.name}」的 ${holding.symbol}（${resolvedName}）及其持倉資料？\n注意：此操作將一併刪除 ${relatedTransactions.length} 筆關聯的歷史交易明細，無法還原！`,
      state.settings.language
    );

    if (!window.confirm(confirmMsg)) return;

    if (typeof onBeforeAction === "function") await onBeforeAction();

    state.holdings = state.holdings.filter((item) => item.id !== holding.id);
    state.transactions = state.transactions.filter(
      (item) => !(
        item.symbol?.toUpperCase() === holding.symbol.toUpperCase() &&
        (!item.market || item.market === holding.market) &&
        (item.accountId || DEFAULT_ACCOUNT_ID) === (holding.accountId || DEFAULT_ACCOUNT_ID)
      )
    );

    delete state.openingBalances[ledgerKey(holding)];
    if (holding.market === "US") syncUsStreamSubscriptions();

    persist();
    render();

    if (typeof onAfterAction === "function") await onAfterAction();

    toast(`${holding.symbol} 及其交易紀錄已徹底刪除，並已同步至雲端。`);
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

  document.querySelector("#edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = document.querySelector("#edit-error");
    if (error) error.textContent = "";

    const names = ["shares", "costBasis", "currentPrice", "fees"];
    for (const name of names) {
      if (!Number.isFinite(Number(form.elements[name]?.value)) || Number(form.elements[name]?.value) < 0) {
        if (error) error.textContent = translateText("請確認各欄位皆為有效的非負數值。", state.settings.language);
        form.elements[name]?.focus();
        return;
      }
    }

    if (typeof onBeforeAction === "function") await onBeforeAction();

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

    if (typeof onAfterAction === "function") await onAfterAction();

    document.querySelector("#edit-dialog")?.close();
    toast("庫存資料已更新，並已同步至雲端。");
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

  return { openHoldingDetails, openEditDialog, deleteHolding, deleteCustomField };
}