// js/ui-accounts.js - 投資帳戶管理、選單渲染、改名與防呆校驗解耦模組
import { makeId } from "./ledger.js";
import { DEFAULT_ACCOUNT_ID } from "./storage.js";
import { translateText } from "./i18n.js";

export const ACCOUNT_COLORS = ["#418874", "#3b73af", "#b35c44", "#7b5cb7", "#a07830", "#3a8589"];

/**
 * 依帳戶 ID 獲取帳戶資料，若找不到則回傳預設主要帳戶
 * @param {string} accountId 
 * @param {Object} state 
 * @returns {Object}
 */
export function getAccountById(accountId, state) {
  return state.accounts?.find((a) => a.id === accountId) || { id: accountId, name: "主要帳戶", color: "#418874" };
}

/**
 * 渲染頂部帳戶切換下拉選單，並聯動更新麵包屑與總覽標題
 * @param {Object} params
 * @param {Object} params.state
 * @param {Object} params.elements DOM 元素快取物件
 */
export function renderAccountSelector({ state, elements }) {
  const selector = elements.accountSelector;
  if (!selector) return;

  selector.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = translateText("🌐 全部帳戶總覽", state.settings.language);
  allOption.selected = state.activeAccountId === "all";
  selector.append(allOption);

  for (const acc of (state.accounts || [])) {
    const opt = document.createElement("option");
    opt.value = acc.id;
    opt.textContent = `💼 ${acc.name}`;
    opt.selected = state.activeAccountId === acc.id;
    selector.append(opt);
  }

  const activeAcc = state.activeAccountId === "all" ? null : getAccountById(state.activeAccountId, state);
  if (elements.currentViewLabel) {
    elements.currentViewLabel.textContent = activeAcc
      ? activeAcc.name
      : translateText("全部帳戶總覽", state.settings.language);
  }
  if (elements.summaryAccountTitle) {
    elements.summaryAccountTitle.textContent = activeAcc
      ? `${translateText("目前投資總市值", state.settings.language)}（${activeAcc.name}）`
      : `${translateText("目前投資總市值", state.settings.language)}（${translateText("全部帳戶", state.settings.language)}）`;
  }
}

/**
 * 開啟投資帳戶管理對話框（支援新增、改名、刪除與防呆）
 * @param {Object} params
 * @param {Object} params.state 全域狀態物件
 * @param {Function} params.persist 本地與雲端儲存回調
 * @param {Function} params.renderAccountSelector 選單重繪回調
 * @param {Function} params.render 全頁重繪回調
 * @param {Function} params.toast 訊息提示回調
 */
export function openAccountManager({ state, persist, renderAccountSelector, render, toast }) {
  const dialog = document.querySelector("#accounts-dialog");
  const list = document.querySelector("#accounts-list");
  if (!dialog || !list) return;

  function renderList() {
    list.replaceChildren();
    for (const acc of (state.accounts || [])) {
      const li = document.createElement("li");
      li.className = "account-item";

      const left = document.createElement("div");
      left.className = "account-item-left";
      const dot = document.createElement("span");
      dot.className = "account-color-dot";
      dot.style.backgroundColor = acc.color || "#418874";
      const name = document.createElement("strong");
      name.textContent = acc.name;
      left.append(dot, name);

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "account-item-actions";
      actionsDiv.style.display = "flex";
      actionsDiv.style.gap = "6px";

      // 1. 改名按鈕
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "row-action";
      renameBtn.textContent = translateText("改名", state.settings.language);
      renameBtn.addEventListener("click", () => {
        const newName = window.prompt(
          translateText("請輸入帳戶新名稱：", state.settings.language),
          acc.name
        );
        if (newName === null) return;
        const trimmed = newName.trim();
        if (!trimmed) {
          toast("帳戶名稱不可為空。", true);
          return;
        }
        if (trimmed === acc.name) return;
        if (state.accounts.some((a) => a.id !== acc.id && a.name.toLowerCase() === trimmed.toLowerCase())) {
          toast("已經有同名的投資帳戶。", true);
          return;
        }
        acc.name = trimmed;
        persist();
        renderAccountSelector();
        renderList();
        render();
        toast(`帳戶已改名為「${trimmed}」。`);
      });
      actionsDiv.append(renameBtn);

      // 2. 刪除按鈕（帳戶數 > 1 時開放，且具備持倉/交易防呆）
      if ((state.accounts || []).length > 1) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "row-action danger";
        delBtn.textContent = translateText("刪除", state.settings.language);
        delBtn.addEventListener("click", () => {
          const hasHoldings = state.holdings.some(
            (h) => (h.accountId || DEFAULT_ACCOUNT_ID) === acc.id && Number(h.shares) > 0
          );
          const hasTransactions = state.transactions.some(
            (t) => (t.accountId || DEFAULT_ACCOUNT_ID) === acc.id
          );

          if (hasHoldings || hasTransactions) {
            alert(translateText("此帳戶內仍有持倉或交易紀錄，無法直接刪除。請先將持倉出清或轉移。", state.settings.language));
            return;
          }

          if (window.confirm(translateText(`確定刪除「${acc.name}」帳戶？`, state.settings.language))) {
            state.accounts = state.accounts.filter((a) => a.id !== acc.id);
            if (state.activeAccountId === acc.id) {
              state.activeAccountId = "all";
            }
            persist();
            renderAccountSelector();
            renderList();
            render();
            toast(`已刪除「${acc.name}」帳戶。`);
          }
        });
        actionsDiv.append(delBtn);
      }

      li.append(left, actionsDiv);
      list.append(li);
    }
  }

  const addForm = document.querySelector("#add-account-form");
  if (addForm) {
    addForm.onsubmit = (e) => {
      e.preventDefault();
      const input = document.querySelector("#new-account-name");
      const name = input?.value.trim();
      if (!name) return;

      if (state.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
        toast("已經有同名的投資帳戶。", true);
        return;
      }

      const newId = makeId();
      const nextColor = ACCOUNT_COLORS[state.accounts.length % ACCOUNT_COLORS.length];
      state.accounts.push({ id: newId, name, color: nextColor });
      input.value = "";
      persist();
      renderAccountSelector();
      renderList();
      render();
      toast(`已新增「${name}」帳戶。`);
    };
  }

  renderList();
  dialog.showModal();
}