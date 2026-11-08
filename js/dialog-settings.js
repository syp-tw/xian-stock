// js/dialog-settings.js - 偏好設定、分頁、儲存模式切換、Google Apps Script 腳本與連線模組
import { translateText, applyTranslations } from "./i18n.js";
import { saveStorageMode, loadState } from "./storage.js";

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

const numericSettingKeys = ["twRate", "twDiscount", "twMinimum", "usPerShare", "usMinimum", "fxRate", "caPerShare", "caMinimum", "cadFxRate"];

export function initSettingsDialog({
  state,
  getStorageMode,
  setStorageMode,
  persist,
  render,
  toast,
  cloudSync,
  googleSheetSync,
  usStream,
  syncUsStreamSubscriptions,
  replaceState,
  txDialog,
}) {
  function openSettings() {
    const form = document.querySelector("#settings-form");
    if (!form) return;
    for (const [key, value] of Object.entries(state.settings)) {
      if (form.elements[key]) form.elements[key].value = value;
    }
    const storageSelect = document.querySelector("#storage-mode");
    if (storageSelect) storageSelect.value = getStorageMode();
    const settingsErr = document.querySelector("#settings-error");
    if (settingsErr) settingsErr.textContent = "";

    const firstTab = document.querySelector(".settings-tab-btn[data-settings-tab='cloud']");
    if (firstTab) firstTab.click();

    document.querySelector("#settings-dialog")?.showModal();
    cloudSync.updateControls(undefined, getStorageMode());
    applyTranslations(state.settings.language);
  }

  function setupSettingsTabs() {
    const tabBtns = document.querySelectorAll(".settings-tab-btn");
    const tabPanels = document.querySelectorAll(".settings-tab-panel");

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.settingsTab;
        tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
        tabPanels.forEach((panel) => {
          panel.classList.toggle("active", panel.dataset.settingsPanel === target);
        });
      });
    });
  }

  async function switchStorageMode(nextMode) {
    const currentMode = getStorageMode();
    if (nextMode === currentMode) return;
    const previousMode = currentMode;

    if (nextMode === "google-sheet") {
      const webhook = state.settings.googleSheetWebhook;
      if (!googleSheetSync.isValidWebhookUrl(webhook)) {
        document.querySelector("#storage-mode").value = previousMode;
        toast("請先在偏好設定中填寫正確的 Google 試算表 Webhook 網址。", true);
        return;
      }
      if (!saveStorageMode("google-sheet")) throw new Error("無法儲存儲存位置設定。");
      setStorageMode("google-sheet");
      await googleSheetSync.pushToGoogleSheet({ silent: false });
      toast("已切換為 Google 試算表全平台雲端同步！後續變更自動同步。");
    } else if (nextMode === "cloud") {
      if (!cloudSync.cloudFileReady || !cloudSync.sharedFileRecord?.handle) {
        document.querySelector("#storage-mode").value = previousMode;
        cloudSync.updateControls("請先連結並載入或建立共用檔案，再切換至雲端模式。", currentMode);
        return;
      }
      if (!window.confirm(translateText("切換至雲端會載入共用檔資料；本機資料將保留，之後的編輯會自動同步至雲端。是否繼續？", state.settings.language))) {
        document.querySelector("#storage-mode").value = previousMode;
        return;
      }
      await cloudSync.loadFile(currentMode);
      if (!saveStorageMode("cloud")) throw new Error("無法儲存儲存位置設定。");
      setStorageMode("cloud");
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
      setStorageMode("local");
      try {
        replaceState(localState, { syncCloud: false });
        toast("已切換至本機；雲端資料保持不變。");
      } catch (error) {
        setStorageMode(previousMode);
        saveStorageMode(previousMode);
        document.querySelector("#storage-mode").value = previousMode;
        throw error;
      }
    }

    cloudSync.updateControls(undefined, getStorageMode());
    const settingsForm = document.querySelector("#settings-form");
    if (settingsForm) {
      for (const [key, value] of Object.entries(state.settings)) {
        if (settingsForm.elements[key]) settingsForm.elements[key].value = value;
      }
    }
  }

  // 表單驗證與提交
  document.querySelector("#settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = document.querySelector("#settings-error");
    if (error) error.textContent = "";

    for (const name of numericSettingKeys) {
      if (!Number.isFinite(Number(form.elements[name]?.value)) || Number(form.elements[name]?.value) < 0) {
        if (error) error.textContent = translateText("請確認各欄位皆為有效的非負數值。", state.settings.language);
        form.elements[name]?.focus();
        return;
      }
    }

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

  // 儲存模式切換監聽
  document.querySelector("#storage-mode")?.addEventListener("change", (event) => {
    const requestedMode = event.currentTarget.value;
    cloudSync.runAction(async () => {
      try {
        await switchStorageMode(requestedMode);
      } catch (error) {
        document.querySelector("#storage-mode").value = getStorageMode();
        throw error;
      }
    }, getStorageMode());
  });

  // 複製 GAS 腳本
  document.querySelector("#copy-gas-script-btn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      toast("✅ 試算表專用腳本已複製！請前往 Google 試算表 Apps Script 貼上。");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = GOOGLE_APPS_SCRIPT_TEMPLATE;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      toast("✅ 試算表專用腳本已複製！");
    }
  });

  // 測試 Google 試算表連線
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

  // Google 試算表手動 Push / Pull
  document.querySelector("#google-sheet-push")?.addEventListener("click", () => {
    googleSheetSync.pushToGoogleSheet({ silent: false });
  });

  document.querySelector("#google-sheet-pull")?.addEventListener("click", () => {
    googleSheetSync.pullFromGoogleSheet({ silent: false });
  });

  setupSettingsTabs();

  return { openSettings };
}