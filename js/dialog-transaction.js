// js/dialog-transaction.js - 新增與編輯交易彈窗控制器（含帳戶隔離、即時查價與交易前後自動同步）
import { estimateFee } from "./calculations.js";
import { formatMoney, formatQuantity, locale, translateText, applyTranslations } from "./i18n.js";
import { fetchQuote, getStockName, quoteMarket, searchQuotes, normalizedSymbol } from "./quotes.js";
import { addTransaction, normalizeSymbol, rebuildHolding, today } from "./ledger.js";
import { DEFAULT_ACCOUNT_ID } from "./storage.js";

const FIELD_LABELS = {
  quantity: {
    buy: "買入股數",
    sell: "賣出股數",
    dividend: "配息股數（選填）",
    stockDividend: "新增配股股數",
    split: "目前持有股數",
    capitalReduction: "減少股數（選填）",
  },
  price: {
    buy: "買入價格",
    sell: "賣出價格",
    dividend: "每股配息金額",
    stockDividend: "配股價格（參考）",
    split: "目前每股價格（參考）",
    capitalReduction: "每股退還金額",
  },
};

export class TransactionDialog {
  constructor({ getState, onBeforeSave, onTransactionSaved, onOpenDetails, toast }) {
    this.getState = getState;
    this.onBeforeSave = onBeforeSave;
    this.onTransactionSaved = onTransactionSaved;
    this.onOpenDetails = onOpenDetails;
    this.toast = toast;

    this.activeHoldingId = null;
    this.editingTransactionId = null;
    this.selectedQuote = null;
    this.suggestionTimer = null;
    this.autoFetchTimer = null;
    this.suggestionController = null;
    this.quoteFetchController = null;

    try {
      this.initElements();
      this.initEventListeners();
    } catch (err) {
      console.error("TransactionDialog 初始化失敗:", err);
    }
  }

  initElements() {
    this.dialog = document.querySelector("#transaction-dialog");
    this.form = document.querySelector("#transaction-form");
    this.title = document.querySelector("#transaction-title");
    this.saveBtn = document.querySelector("#save-transaction");
    this.legacyNotice = document.querySelector("#transaction-legacy-notice");
    this.errorElem = document.querySelector("#transaction-error");

    this.accountSelect = document.querySelector("#transaction-account");
    this.symbolInput = document.querySelector("#transaction-symbol");
    this.priceInput = document.querySelector("#transaction-price");
    this.quantityInput = document.querySelector("#transaction-quantity");
    this.feeInput = document.querySelector("#transaction-fee");
    this.currentPriceInput = document.querySelector("#transaction-current-price");
    this.transactionType = document.querySelector("#transaction-type");
    this.suggestions = document.querySelector("#quote-suggestions");
    this.searchQuoteBtn = document.querySelector("#search-quote");
    this.splitRatioInput = document.querySelector("#split-ratio");
    this.previewAmount = document.querySelector("#preview-amount");
    this.priceCurrency = document.querySelector("#price-currency");
    this.feeHelp = document.querySelector("#fee-help");

    this.quantityField = document.querySelector("#quantity-field");
    this.priceField = document.querySelector("#price-field");
    this.feeField = document.querySelector("#fee-field");
    this.splitField = document.querySelector("#split-field");
    this.currentPriceField = document.querySelector("#quote-price-field");
    this.quantityLabel = document.querySelector("#quantity-label");
    this.priceLabel = document.querySelector("#price-label");
  }

  cancelPendingAsyncRequests() {
    clearTimeout(this.suggestionTimer);
    clearTimeout(this.autoFetchTimer);
    if (this.suggestionController) {
      this.suggestionController.abort();
      this.suggestionController = null;
    }
    if (this.quoteFetchController) {
      this.quoteFetchController.abort();
      this.quoteFetchController = null;
    }
    this.suggestions?.classList.remove("visible");
  }

  getTargetHolding() {
    try {
      const state = this.getState();
      const currentAccountId = this.accountSelect?.value || DEFAULT_ACCOUNT_ID;

      if (this.activeHoldingId) {
        return state.holdings?.find((item) => item.id === this.activeHoldingId) || null;
      }
      const entered = this.symbolInput?.value?.trim();
      if (!entered) return null;

      const normalizedEntered = entered.toUpperCase();
      const cleanEntered = normalizedEntered.replace(/\.(TW|TWO|TO|V|CN|NE)$/i, "");

      const accountHoldings = (state.holdings || []).filter(
        (h) => (h.accountId || DEFAULT_ACCOUNT_ID) === currentAccountId
      );

      if (this.selectedQuote) {
        const match = accountHoldings.find(
          (h) => h.symbol.toUpperCase() === this.selectedQuote.symbol.toUpperCase() &&
            (!this.selectedQuote.market || h.market === this.selectedQuote.market)
        );
        if (match) return match;
      }

      const exactMatch = accountHoldings.find((h) => h.symbol.toUpperCase() === normalizedEntered);
      if (exactMatch) return exactMatch;

      const baseMatch = accountHoldings.find((h) => {
        const cleanHoldingSymbol = h.symbol.toUpperCase().replace(/\.(TW|TWO|TO|V|CN|NE)$/i, "");
        return cleanHoldingSymbol === cleanEntered;
      });
      if (baseMatch) return baseMatch;

      const nameMatch = accountHoldings.find((h) => {
        const holdingName = (h.name || "").trim().toUpperCase();
        return holdingName === normalizedEntered || holdingName.includes(normalizedEntered);
      });
      if (nameMatch) return nameMatch;

      return null;
    } catch {
      return null;
    }
  }

  updateCurrentSharesDisplay() {
    try {
      const type = this.transactionType?.value;
      const targetField = type === "split" ? this.splitField : this.quantityField;
      if (!targetField || targetField.hidden) return;

      let displayNode = document.querySelector("#shares-helper-display");
      if (!displayNode) {
        displayNode = document.createElement("button");
        displayNode.type = "button";
        displayNode.id = "shares-helper-display";
      }

      const targetLabel = targetField.querySelector("label");
      if (targetLabel) targetLabel.after(displayNode);
      else targetField.prepend(displayNode);

      const holding = this.getTargetHolding();
      if (!holding || holding.shares <= 0) {
        displayNode.style.display = "none";
        return;
      }

      displayNode.style.display = "inline-flex";
      const state = this.getState();
      const formattedShares = formatQuantity(holding.shares, state.settings?.language || "zh-TW");

      if (type === "sell") {
        displayNode.className = "quick-fill-btn sell-action";
        displayNode.textContent = `現存: ${formattedShares} 股（點擊一鍵全賣）`;
        displayNode.title = `點擊將該帳戶全數 ${formattedShares} 股填入賣出欄位`;
        displayNode.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.quantityInput) {
            this.quantityInput.value = holding.shares;
            this.quantityInput.dispatchEvent(new Event("input", { bubbles: true }));
            this.quantityInput.focus();
            this.quantityInput.select();
          }
        };
      } else {
        displayNode.className = "shares-reference-tag";
        displayNode.textContent = type === "split" ? `該帳戶持有：${formattedShares} 股` : `該帳戶庫存：${formattedShares} 股`;
        displayNode.removeAttribute("title");
        displayNode.onclick = null;
      }
    } catch (err) {
      console.error("updateCurrentSharesDisplay 執行失敗:", err);
    }
  }

  updateTransactionFields() {
    if (!this.transactionType) return;
    const type = this.transactionType.value;

    if (this.quantityField) this.quantityField.hidden = type === "split";
    if (this.priceField) this.priceField.hidden = type === "stockDividend" || type === "split";
    if (this.feeField) this.feeField.hidden = !["buy", "sell"].includes(type);
    if (this.splitField) this.splitField.hidden = type !== "split";
    if (this.currentPriceField) this.currentPriceField.hidden = !["buy", "split", "capitalReduction"].includes(type);

    if (this.quantityLabel && FIELD_LABELS.quantity[type]) this.quantityLabel.textContent = FIELD_LABELS.quantity[type];
    if (this.priceLabel && FIELD_LABELS.price[type]) this.priceLabel.textContent = FIELD_LABELS.price[type];

    if (this.quantityInput) {
      this.quantityInput.placeholder = type === "dividend" ? "留白依該帳戶庫存計算" : "";
      this.quantityInput.required = ["buy", "sell", "stockDividend"].includes(type);
    }
    if (this.priceInput) {
      this.priceInput.required = ["buy", "sell", "dividend", "capitalReduction"].includes(type);
    }
    if (this.splitRatioInput) this.splitRatioInput.required = type === "split";

    if (!this.editingTransactionId && type === "sell" && this.quantityInput && !this.quantityInput.value) {
      const holding = this.getTargetHolding();
      if (holding && holding.shares > 0) {
        this.quantityInput.value = holding.shares;
      }
    }

    this.updateCurrentSharesDisplay();
    this.updateFeeEstimate();
    this.updatePreview();
    applyTranslations(this.getState().settings?.language || "zh-TW", this.dialog);
  }

  updateFeeEstimate() {
    if (!this.symbolInput || !this.quantityInput || !this.priceInput) return;
    const enteredSymbol = this.symbolInput.value.trim();
    const market = this.selectedQuote?.symbol.toUpperCase() === enteredSymbol.toUpperCase()
      ? this.selectedQuote.market
      : enteredSymbol ? quoteMarket(enteredSymbol) : "TW";
    const type = this.transactionType?.value || "buy";
    const state = this.getState();
    const fee = estimateFee(market, this.quantityInput.value, this.priceInput.value, state.settings, type, enteredSymbol);

    if (this.feeInput && (this.feeInput.dataset.manual !== "true" || !this.feeInput.value)) {
      this.feeInput.value = fee ? String(Number(fee.toFixed(4))) : "";
    }

    const isTwSell = market === "TW" && type === "sell";
    if (this.feeHelp) {
      const currencyLabel = locale.currency[market]?.label || "台股";
      this.feeHelp.textContent = isTwSell
        ? "已包含台股券商手續費與預估證交稅（個股 0.3%，股票 ETF 0.1%，債券 ETF 免稅），可自行修改。"
        : `依${currencyLabel}手續費設定預估，可自行修改。`;
    }
  }

  updatePreview() {
    if (!this.transactionType) return;
    const type = this.transactionType.value;
    const enteredQuantity = Number(this.quantityInput?.value) || 0;
    const price = Number(this.priceInput?.value) || 0;
    const enteredSymbol = this.symbolInput?.value?.trim() || "";
    const market = this.selectedQuote?.symbol.toUpperCase() === enteredSymbol.toUpperCase()
      ? this.selectedQuote.market
      : enteredSymbol ? quoteMarket(enteredSymbol) : "TW";
    const matchingHolding = this.getTargetHolding();
    const state = this.getState();

    const quantity = type === "dividend" && enteredQuantity === 0
      ? matchingHolding?.shares || 0
      : enteredQuantity;
    const amount = quantity * price;

    if (!this.previewAmount) return;

    if (["buy", "sell", "dividend", "capitalReduction"].includes(type) && amount) {
      this.previewAmount.textContent = formatMoney(amount, market, 2, state.settings?.language || "zh-TW");
    } else if (type === "stockDividend" && quantity) {
      this.previewAmount.textContent = `${formatQuantity(quantity, state.settings?.language || "zh-TW")} 股`;
    } else if (type === "split") {
      const ratio = Number(this.splitRatioInput?.value) || 0;
      if (ratio > 0) {
        if (matchingHolding && matchingHolding.shares > 0) {
          const newShares = matchingHolding.shares * ratio;
          this.previewAmount.textContent = `${formatQuantity(matchingHolding.shares, state.settings?.language || "zh-TW")} 股 → ${formatQuantity(newShares, state.settings?.language || "zh-TW")} 股 (×${ratio})`;
        } else {
          this.previewAmount.textContent = `持股數將乘以 ${ratio}`;
        }
      } else {
        this.previewAmount.textContent = "—";
      }
    } else {
      this.previewAmount.textContent = "—";
    }
  }

  applyQuoteSelection(quote) {
    if (!quote) return;
    const canonical = normalizedSymbol(quote.symbol);
    const autoChineseName = getStockName(canonical) || quote.name;
    
    this.selectedQuote = {
      ...quote,
      symbol: canonical,
      name: autoChineseName || quote.name || canonical,
    };

    if (this.symbolInput) {
      const currentTyped = this.symbolInput.value.trim().toUpperCase();
      if (!currentTyped || currentTyped === quote.symbol.replace(/\.(TW|TWO)$/i, "")) {
        this.symbolInput.value = canonical;
      }
    }

    this.suggestions?.classList.remove("visible");
    if (this.errorElem) this.errorElem.textContent = "";
    if (this.priceCurrency) this.priceCurrency.textContent = locale.currency[quote.market]?.symbol || "NT$";

    this.updateCurrentSharesDisplay();

    if (this.transactionType?.value === "sell") {
      const holding = this.getTargetHolding();
      if (holding && holding.shares > 0 && this.quantityInput) {
        this.quantityInput.value = holding.shares;
      }
    }

    if (this.quoteFetchController) this.quoteFetchController.abort();
    this.quoteFetchController = new AbortController();

    const state = this.getState();
    fetchQuote(canonical, this.quoteFetchController.signal, state.settings)
      .then((result) => {
        const cleanSelected = this.selectedQuote?.symbol?.replace(/\.(TW|TWO)$/i, "").toUpperCase();
        const cleanFetched = canonical.replace(/\.(TW|TWO)$/i, "").toUpperCase();
        if (cleanSelected !== cleanFetched) return;

        if (result.market !== quote.market) {
          this.toast("報價幣別與預期市場不同，請確認股票代號。", true);
        }
        const finalName = getStockName(canonical) || result.name || quote.name;
        this.selectedQuote = {
          ...this.selectedQuote,
          name: finalName,
          dailyChangePerShare: result.dailyChangePerShare,
        };
        if (this.currentPriceInput) this.currentPriceInput.value = String(result.price);

        const userAlreadyTypedPrice = this.priceInput?.dataset.manual === "true";
        if (this.transactionType?.value === "buy" && !userAlreadyTypedPrice && this.priceInput) {
          this.priceInput.value = String(result.price);
        }

        this.updateFeeEstimate();
        this.updatePreview();
        this.toast(`${canonical} (${finalName}) 已帶入報價 ${formatMoney(result.price, quote.market, 2, state.settings?.language || "zh-TW")}。`);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        this.toast(`${error.message} 可手動輸入價格。`, true);
      });
  }

  renderSuggestions(quotes) {
    if (!this.suggestions) return;
    this.suggestions.replaceChildren();
    const state = this.getState();
    if (!quotes.length) {
      const empty = document.createElement("div");
      empty.className = "quote-empty";
      empty.textContent = "找不到符合的股票，請再試試看代號或中文簡稱。";
      this.suggestions.append(empty);
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
        name.textContent = getStockName(quote.symbol) || quote.name;
        main.append(symbol, name);
        const market = document.createElement("span");
        market.className = "suggestion-market";
        const separator = state.settings?.language === "en-US" ? " · " : "・";
        const label = state.settings?.language === "en-US"
          ? locale.currency[quote.market]?.englishLabel
          : locale.currency[quote.market]?.label;
        market.textContent = `${label || ""}${separator}${quote.exchange || ""}`;
        option.append(main, market);
        option.addEventListener("click", () => this.applyQuoteSelection(quote));
        this.suggestions.append(option);
      }
    }
    this.suggestions.classList.add("visible");
  }

  async lookupSymbol(inputValue) {
    const query = inputValue.trim();
    if (query.length < 1) return this.toast("請先輸入股票代號或名稱。", true);
    if (!this.suggestions) return;

    this.suggestions.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "quote-loading";
    loading.textContent = "正在搜尋股票…";
    this.suggestions.append(loading);
    this.suggestions.classList.add("visible");

    try {
      const results = await searchQuotes(query, undefined, this.getState().settings);
      this.renderSuggestions(results);
      if (results.length === 0) this.toast("找不到股票，請確認代號或中文名稱。", true);
    } catch (error) {
      if (error.name !== "AbortError") {
        this.suggestions.classList.remove("visible");
        this.toast(error.message, true);
      }
    }
  }

  open(holding = null) {
    if (!this.dialog || !this.form) return;
    this.cancelPendingAsyncRequests();
    this.form.reset();
    this.editingTransactionId = null;

    const state = this.getState();
    const accounts = state.accounts || [];

    if (this.accountSelect) {
      this.accountSelect.replaceChildren();
      for (const acc of accounts) {
        const opt = document.createElement("option");
        opt.value = acc.id;
        opt.textContent = acc.name;
        this.accountSelect.append(opt);
      }

      if (holding?.accountId) {
        this.accountSelect.value = holding.accountId;
      } else if (state.activeAccountId && state.activeAccountId !== "all") {
        this.accountSelect.value = state.activeAccountId;
      } else {
        this.accountSelect.value = accounts[0]?.id || DEFAULT_ACCOUNT_ID;
      }
      this.accountSelect.disabled = Boolean(holding);
    }

    if (this.form.elements.transactionId) this.form.elements.transactionId.value = "";
    if (this.symbolInput) this.symbolInput.readOnly = Boolean(holding);
    if (this.searchQuoteBtn) this.searchQuoteBtn.disabled = Boolean(holding);
    if (this.legacyNotice) this.legacyNotice.hidden = true;
    this.activeHoldingId = holding?.id || null;
    if (this.feeInput) this.feeInput.dataset.manual = "false";
    if (this.errorElem) this.errorElem.textContent = "";

    const autoName = holding ? (getStockName(holding.symbol) || holding.name) : null;
    if (this.title) this.title.textContent = holding ? `新增「${holding.symbol} ${autoName || ''}」交易` : "新增交易";
    if (this.saveBtn) this.saveBtn.textContent = holding ? "確認交易" : "確認新增";
    if (this.form.elements.date) this.form.elements.date.value = today();
    this.selectedQuote = holding ? { symbol: holding.symbol, name: autoName || holding.name, market: holding.market } : null;

    if (holding) {
      if (this.symbolInput) this.symbolInput.value = holding.symbol;
      if (this.currentPriceInput) this.currentPriceInput.value = holding.currentPrice || "";
      if (this.priceCurrency) this.priceCurrency.textContent = locale.currency[holding.market]?.symbol || "NT$";
    }

    if (this.transactionType) this.transactionType.value = "buy";
    this.updateTransactionFields();
    this.dialog.showModal();

    if (!holding && this.symbolInput) this.symbolInput.focus();
  }

  openEdit(holding, transaction) {
    if (!transaction) return;
    this.open(holding);
    if (this.symbolInput) this.symbolInput.readOnly = Boolean(transaction.locked);
    if (this.searchQuoteBtn) this.searchQuoteBtn.disabled = Boolean(transaction.locked);
    if (this.accountSelect) {
      this.accountSelect.value = transaction.accountId || holding?.accountId || DEFAULT_ACCOUNT_ID;
      this.accountSelect.disabled = true;
    }

    if (this.form.elements.transactionId) this.form.elements.transactionId.value = transaction.id;
    this.editingTransactionId = transaction.id;
    if (this.transactionType) this.transactionType.value = transaction.type;
    if (this.form.elements.date) this.form.elements.date.value = transaction.date || today();
    if (this.form.elements.quantity) this.form.elements.quantity.value = transaction.quantity || "";
    if (this.form.elements.price) this.form.elements.price.value = transaction.price || "";
    if (this.form.elements.fee) this.form.elements.fee.value = transaction.fee || "";
    if (this.form.elements.ratio) this.form.elements.ratio.value = transaction.ratio || "";
    if (this.form.elements.currentPrice) this.form.elements.currentPrice.value = transaction.currentPrice || "";
    if (this.feeInput) this.feeInput.dataset.manual = "true";

    this.updateTransactionFields();

    const state = this.getState();
    const typeLabel = translateText(locale.transactionLabels[transaction.type] || transaction.type, state.settings?.language || "zh-TW");
    if (this.title) this.title.textContent = `編輯 ${typeLabel}交易`;
    if (this.saveBtn) this.saveBtn.textContent = "儲存變更";
    if (this.legacyNotice) {
      this.legacyNotice.hidden = !transaction.locked;
      this.legacyNotice.textContent = transaction.locked
        ? translateText("此為舊版／校正明細；編輯只會更新歷史紀錄，不會重算目前持倉股數與成本。", state.settings?.language || "zh-TW")
        : "";
    }
  }

  initEventListeners() {
    this.dialog?.addEventListener("close", () => this.cancelPendingAsyncRequests());

    this.accountSelect?.addEventListener("change", () => {
      this.updateCurrentSharesDisplay();
      this.updatePreview();
    });

    this.transactionType?.addEventListener("change", () => {
      if (!this.editingTransactionId && ["split", "capitalReduction"].includes(this.transactionType.value)) {
        if (this.currentPriceInput) this.currentPriceInput.value = "";
      }
      this.updateTransactionFields();
    });

    [this.quantityInput, this.priceInput].forEach((input) => {
      input?.addEventListener("input", () => {
        if (this.feeInput) this.feeInput.dataset.manual = "false";
        this.updateFeeEstimate();
        this.updatePreview();
      });
    });

    this.feeInput?.addEventListener("input", () => {
      if (this.feeInput) this.feeInput.dataset.manual = "true";
    });

    this.splitRatioInput?.addEventListener("input", () => this.updatePreview());

    this.priceInput?.addEventListener("input", () => {
      if (this.priceInput) this.priceInput.dataset.manual = this.priceInput.value ? "true" : "false";
    });

    this.symbolInput?.addEventListener("input", () => {
      const rawInput = this.symbolInput.value.trim();
      const canonical = normalizedSymbol(rawInput);
      const autoChineseName = getStockName(canonical) || getStockName(rawInput);

      if (autoChineseName) {
        this.selectedQuote = {
          symbol: canonical,
          name: autoChineseName,
          market: quoteMarket(canonical),
        };
      } else {
        this.selectedQuote = null;
      }

      this.updateCurrentSharesDisplay();

      if (this.transactionType?.value === "sell") {
        const holding = this.getTargetHolding();
        if (holding && holding.shares > 0 && this.quantityInput && !this.quantityInput.value) {
          this.quantityInput.value = holding.shares;
        }
      }

      this.updateFeeEstimate();
      this.updatePreview();
      clearTimeout(this.suggestionTimer);
      clearTimeout(this.autoFetchTimer);
      if (this.suggestionController) this.suggestionController.abort();

      if (!rawInput) {
        this.suggestions?.classList.remove("visible");
        return;
      }

      if (autoChineseName) {
        this.autoFetchTimer = setTimeout(() => {
          if (this.symbolInput?.value.trim().toUpperCase() === rawInput.toUpperCase() && this.selectedQuote) {
            this.applyQuoteSelection(this.selectedQuote);
          }
        }, 350);
      }

      this.suggestionTimer = setTimeout(async () => {
        this.suggestionController = new AbortController();
        try {
          const quotes = await searchQuotes(rawInput, this.suggestionController.signal, this.getState().settings);
          if (this.symbolInput.value.trim() !== rawInput) return;
          this.renderSuggestions(quotes);
        } catch (error) {
          if (error.name !== "AbortError") {
            if (this.suggestions) {
              this.suggestions.replaceChildren();
              const message = document.createElement("div");
              message.className = "quote-empty";
              message.textContent = "報價搜尋暫時無法使用，請手動輸入價格。";
              this.suggestions.append(message);
              this.suggestions.classList.add("visible");
            }
          }
        }
      }, 250);
    });

    this.searchQuoteBtn?.addEventListener("click", () => this.lookupSymbol(this.symbolInput?.value || ""));

    this.symbolInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && this.suggestions?.classList.contains("visible")) {
        const firstOption = this.suggestions.querySelector(".suggestion-option");
        if (firstOption) {
          event.preventDefault();
          firstOption.click();
        }
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".quote-input-wrap")) this.suggestions?.classList.remove("visible");
    });

    // 🌟 表單提交：自動執行 PULL -> 本地記帳 -> 即刻 PUSH
    this.form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (this.errorElem) this.errorElem.textContent = "";

      const form = this.form;
      const type = this.transactionType?.value || "buy";
      const targetAccountId = this.accountSelect?.value || DEFAULT_ACCOUNT_ID;
      const symbolValue = this.symbolInput?.value.trim() || "";
      const selectedMarket = this.selectedQuote?.symbol.toUpperCase() === symbolValue.toUpperCase()
        ? this.selectedQuote.market
        : quoteMarket(symbolValue);
      const quantity = Number(this.quantityInput?.value) || 0;
      const price = Number(this.priceInput?.value) || 0;
      const fee = Number(this.feeInput?.value) || 0;
      const transactionId = this.editingTransactionId;

      if (!symbolValue) {
        if (this.errorElem) this.errorElem.textContent = "請輸入股票代號。";
        return;
      }
      if (["buy", "sell"].includes(type) && (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0)) {
        if (this.errorElem) this.errorElem.textContent = "股數與價格都必須是大於 0 的有效數值。";
        return;
      }
      if (!Number.isFinite(fee) || fee < 0) {
        if (this.errorElem) this.errorElem.textContent = "手續費必須是有效的非負數值。";
        return;
      }

      const originalSaveText = this.saveBtn ? this.saveBtn.textContent : "";
      if (this.saveBtn) {
        this.saveBtn.disabled = true;
        this.saveBtn.textContent = "同步中…";
      }

      try {
        // 1. 交易前自動 PULL
        if (typeof this.onBeforeSave === "function") {
          await this.onBeforeSave();
        }

        const state = this.getState();
        const canonicalSymbol = normalizedSymbol(symbolValue);
        const autoChineseName = getStockName(canonicalSymbol) || getStockName(symbolValue);
        const resolvedName = (this.selectedQuote && this.selectedQuote.name !== symbolValue)
          ? this.selectedQuote.name
          : (autoChineseName || symbolValue);

        const updatedTransaction = {
          type,
          accountId: targetAccountId,
          symbol: canonicalSymbol,
          name: resolvedName,
          market: selectedMarket,
          date: form.elements.date?.value || today(),
          quantity,
          price,
          fee,
          ratio: Number(form.elements.ratio?.value) || 0,
          currentPrice: Number(form.elements.currentPrice?.value) || 0,
          dailyChangePerShare: this.selectedQuote?.symbol.toUpperCase() === symbolValue.toUpperCase()
            ? this.selectedQuote.dailyChangePerShare
            : undefined,
        };

        if (transactionId) {
          const existingTransaction = state.transactions.find((item) => item.id === transactionId);
          const holding = state.holdings.find((item) => item.id === this.activeHoldingId);
          if (!existingTransaction || !holding) throw new Error("找不到要修改的交易明細。");
          const originalTransaction = { ...existingTransaction };
          Object.assign(existingTransaction, updatedTransaction);
          try {
            rebuildHolding(holding, state);
          } catch (error) {
            Object.assign(existingTransaction, originalTransaction);
            throw error;
          }
        } else {
          addTransaction(updatedTransaction, state);
        }

        this.dialog.close();
        const activeHolding = state.holdings.find((item) => item.id === this.activeHoldingId);
        
        // 2. 交易完成：立即強制 PUSH
        await this.onTransactionSaved(activeHolding, transactionId);

        const savedTransaction = transactionId ? state.transactions.find((item) => item.id === transactionId) : null;
        this.toast(
          savedTransaction?.locked
            ? "舊版／校正交易明細已更新；目前持倉股數與成本未變更。"
            : transactionId ? "交易明細已修改，並已同步至雲端！" : `${locale.transactionLabels[type]}紀錄已新增，並已同步至雲端！`
        );

        this.editingTransactionId = null;
        if (form.elements.transactionId) form.elements.transactionId.value = "";
      } catch (error) {
        if (this.errorElem) this.errorElem.textContent = translateText(error.message, this.getState().settings?.language || "zh-TW");
      } finally {
        if (this.saveBtn) {
          this.saveBtn.disabled = false;
          this.saveBtn.textContent = originalSaveText;
        }
      }
    });
  }
}