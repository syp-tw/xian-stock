// js/ui-batch.js - 批量管理、條件篩選與帳戶移轉模組
import { getAccountById } from "./ui-accounts.js";
import { getStockName } from "./quotes.js";
import { formatMoney, formatQuantity, translateText } from "./i18n.js";
import { makeId } from "./ledger.js";
import { DEFAULT_ACCOUNT_ID } from "./storage.js";

/**
 * 初始化批量管理與帳戶移轉控制器
 */
export function initBatchManager({ state, persist, render, toast, renderAccountSelector }) {
  const dialog = document.querySelector("#batch-dialog");
  const list = document.querySelector("#batch-holdings-list");
  const targetAccSelect = document.querySelector("#batch-target-account");
  const sharesInput = document.querySelector("#batch-filter-shares");
  const marketSelect = document.querySelector("#batch-filter-market");
  const selectAllCheckbox = document.querySelector("#batch-select-all");
  const summaryLabel = document.querySelector("#batch-selected-summary");

  if (!dialog || !list || !targetAccSelect) return { openBatchManager: () => {} };

  function refreshTargetAccounts() {
    targetAccSelect.replaceChildren();
    for (const acc of (state.accounts || [])) {
      const opt = document.createElement("option");
      opt.value = acc.id;
      opt.textContent = `💼 ${acc.name}`;
      targetAccSelect.append(opt);
    }
    const oddAcc = state.accounts.find((a) => a.name.includes("零股") || a.name.includes("零"));
    if (oddAcc) {
      targetAccSelect.value = oddAcc.id;
    } else if (state.accounts.length > 1) {
      targetAccSelect.value = state.accounts[1].id;
    }
  }

  function getFilteredHoldings() {
    const maxSharesVal = sharesInput?.value.trim();
    const maxShares = maxSharesVal !== "" ? Number(maxSharesVal) : Infinity;
    const selectedMarket = marketSelect?.value || "all";

    return state.holdings.filter((h) => {
      if (Number(h.shares) <= 0) return false;
      if (Number.isFinite(maxShares) && Number(h.shares) >= maxShares) return false;
      if (selectedMarket !== "all" && h.market !== selectedMarket) return false;
      return true;
    });
  }

  function renderBatchList() {
    list.replaceChildren();
    const matchedHoldings = getFilteredHoldings();

    if (!matchedHoldings.length) {
      const empty = document.createElement("li");
      empty.className = "batch-holding-item";
      empty.style.justifyContent = "center";
      empty.style.color = "#8f9d95";
      empty.style.padding = "20px";
      empty.textContent = translateText("沒有符合此條件的持倉標的。", state.settings.language);
      list.append(empty);
      if (summaryLabel) summaryLabel.textContent = translateText("已選取 0 / 0 檔標的", state.settings.language);
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      return;
    }

    matchedHoldings.forEach((holding) => {
      const li = document.createElement("li");
      li.className = "batch-holding-item";

      const left = document.createElement("div");
      left.className = "batch-item-left";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "batch-item-checkbox";
      checkbox.value = holding.id;
      checkbox.checked = true;
      checkbox.addEventListener("change", updateSelectionSummary);

      const info = document.createElement("div");
      info.className = "batch-item-info";
      const autoName = getStockName(holding.symbol) || holding.name;
      const title = document.createElement("strong");
      title.textContent = `${holding.symbol} ${autoName}`;
      const accInfo = getAccountById(holding.accountId || DEFAULT_ACCOUNT_ID, state);
      const sub = document.createElement("small");
      sub.textContent = `${translateText("現屬帳戶：", state.settings.language)}${accInfo.name}`;
      info.append(title, sub);

      left.append(checkbox, info);

      const right = document.createElement("div");
      right.className = "batch-item-right";
      const pill = document.createElement("span");
      pill.className = "batch-shares-pill";
      pill.textContent = `${formatQuantity(holding.shares, state.settings.language)} 股`;
      const val = document.createElement("small");
      val.className = "batch-item-account";
      val.textContent = `現值: ${formatMoney(holding.currentPrice * holding.shares, holding.market, 0, state.settings.language)}`;
      right.append(pill, val);

      li.append(left, right);
      list.append(li);
    });

    updateSelectionSummary();
  }

  function updateSelectionSummary() {
    const checkboxes = list.querySelectorAll(".batch-item-checkbox");
    const total = checkboxes.length;
    let checkedCount = 0;
    checkboxes.forEach((cb) => { if (cb.checked) checkedCount++; });

    if (summaryLabel) {
      summaryLabel.textContent = `已選取 ${checkedCount} / ${total} 檔標的`;
    }
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = total > 0 && checkedCount === total;
      selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < total;
    }
  }

  selectAllCheckbox.onclick = () => {
    const checkboxes = list.querySelectorAll(".batch-item-checkbox");
    checkboxes.forEach((cb) => { cb.checked = selectAllCheckbox.checked; });
    updateSelectionSummary();
  };

  sharesInput.oninput = renderBatchList;
  marketSelect.onchange = renderBatchList;

  dialog.querySelectorAll(".quick-tag-btn").forEach((btn) => {
    btn.onclick = () => {
      dialog.querySelectorAll(".quick-tag-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      sharesInput.value = btn.dataset.shares;
      renderBatchList();
    };
  });

  const createOddBtn = dialog.querySelector("#batch-create-odd-account-btn");
  if (createOddBtn) {
    createOddBtn.onclick = () => {
      const existing = state.accounts.find((a) => a.name === "零股帳戶");
      if (existing) {
        targetAccSelect.value = existing.id;
        toast("已選中既有的「零股帳戶」。");
        return;
      }
      const newId = makeId();
      state.accounts.push({ id: newId, name: "零股帳戶", color: "#3b73af" });
      persist();
      renderAccountSelector();
      refreshTargetAccounts();
      targetAccSelect.value = newId;
      toast("已為您建立「零股帳戶」並自動選中！");
    };
  }

  const confirmBtn = dialog.querySelector("#batch-confirm-move-btn");
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const targetAccId = targetAccSelect.value;
      if (!targetAccId) {
        toast("請選擇目標帳戶。", true);
        return;
      }
      const targetAcc = getAccountById(targetAccId, state);

      const checkedBoxes = list.querySelectorAll(".batch-item-checkbox:checked");
      if (!checkedBoxes.length) {
        toast("請至少勾選一檔要移動的標的。", true);
        return;
      }

      const selectedIds = new Set(Array.from(checkedBoxes).map((cb) => cb.value));
      let movedCount = 0;

      for (const holding of state.holdings) {
        if (selectedIds.has(holding.id)) {
          const oldAccId = holding.accountId || DEFAULT_ACCOUNT_ID;
          if (oldAccId === targetAccId) continue;

          for (const tx of state.transactions) {
            if (
              tx.symbol.toUpperCase() === holding.symbol.toUpperCase() &&
              (!tx.market || tx.market === holding.market) &&
              (tx.accountId || DEFAULT_ACCOUNT_ID) === oldAccId
            ) {
              tx.accountId = targetAccId;
            }
          }

          holding.accountId = targetAccId;
          movedCount++;
        }
      }

      if (movedCount > 0) {
        persist();
        render();
        dialog.close();
        toast(`🎉 成功將 ${movedCount} 檔標的及所有歷史交易移轉至「${targetAcc.name}」！`);
      } else {
        toast("選取的標的已在目標帳戶內，未進行移動。");
      }
    };
  }

  function openBatchManager() {
    refreshTargetAccounts();
    renderBatchList();
    dialog.showModal();
  }

  document.querySelector("#batch-move-btn")?.addEventListener("click", openBatchManager);

  return { openBatchManager };
}