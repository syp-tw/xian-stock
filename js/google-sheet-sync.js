// js/google-sheet-sync.js - Google 試算表 Webhook 雲端雙向同步模組（支援全平台 iOS/Android/PC）
import { serializeBackup, parseBackup } from "./backup.js";
import { saveState, loadState } from "./storage.js";

export class GoogleSheetSyncManager {
  /**
   * @param {Object} options
   * @param {Function} options.getState 獲取目前記憶體 state
   * @param {Function} options.onStateReplace 替換 state 並重繪回調
   * @param {Function} options.toast 提示訊息回調
   */
  constructor({ getState, onStateReplace, toast }) {
    this.getState = getState;
    this.onStateReplace = onStateReplace;
    this.toast = toast;

    this.isSyncing = false;
    this.autoSaveTimer = null;
  }

  /**
   * 取得已設定之 Google Apps Script Webhook 網址
   */
  getWebhookUrl() {
    const state = this.getState();
    return (state.settings?.googleSheetWebhook || "").trim();
  }

  /**
   * 驗證網址格式
   */
  isValidWebhookUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === "https:" &&
        parsed.hostname === "script.google.com" &&
        parsed.pathname.includes("/macros/s/") &&
        parsed.pathname.endsWith("/exec")
      );
    } catch {
      return false;
    }
  }

  /**
   * 排程防抖自動儲存至 Google 試算表
   */
  scheduleAutoSave() {
    const webhookUrl = this.getWebhookUrl();
    if (!this.isValidWebhookUrl(webhookUrl)) return;

    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.pushToGoogleSheet({ silent: true });
    }, 3000); // 使用者停止操作 3 秒後自動寫入
  }

  /**
   * 上傳當前資料庫至 Google 試算表 (POST)
   */
  async pushToGoogleSheet({ silent = false } = {}) {
    const webhookUrl = this.getWebhookUrl();
    if (!this.isValidWebhookUrl(webhookUrl)) {
      if (!silent) this.toast("請先在偏好設定中填寫正確的 Google 試算表 Webhook 網址。", true);
      return false;
    }

    if (this.isSyncing) return false;
    this.isSyncing = true;
    if (!silent) this.toast("正在同步資料至 Google 試算表…");

    try {
      const state = this.getState();
      const payload = serializeBackup(state);

      // Google Apps Script Web App 使用 POST 傳入 JSON
      const response = await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors", // 配合 GAS 重定向機制，no-cors 能確保跨域發送成功
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (!silent) this.toast("已成功同步備份至 Google 試算表！");
      return true;
    } catch (error) {
      console.error("同步至 Google 試算表失敗:", error);
      if (!silent) this.toast(`同步失敗: ${error.message}`, true);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 從 Google 試算表拉取最新資料並替換本機 (GET)
   */
  async pullFromGoogleSheet({ silent = false } = {}) {
    const webhookUrl = this.getWebhookUrl();
    if (!this.isValidWebhookUrl(webhookUrl)) {
      if (!silent) this.toast("請確認 Google 試算表 Webhook 網址設定正確。", true);
      return false;
    }

    if (this.isSyncing) return false;
    this.isSyncing = true;
    if (!silent) this.toast("正在從 Google 試算表載入最新資料…");

    try {
      const response = await fetch(webhookUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Google 試算表回應錯誤 (${response.status})`);
      }

      const raw = await response.json();
      if (raw.empty) {
        if (!silent) this.toast("Google 試算表內尚無任何庫存備份。");
        return false;
      }
      if (raw.error) {
        throw new Error(raw.error);
      }

      const importedState = parseBackup(typeof raw === "string" ? raw : JSON.stringify(raw));
      this.onStateReplace(importedState, { syncCloud: false });

      if (!silent) this.toast("已從 Google 試算表載入最新資產紀錄！");
      return true;
    } catch (error) {
      console.error("載入 Google 試算表資料失敗:", error);
      if (!silent) this.toast(`無法載入: ${error.message}`, true);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }
}