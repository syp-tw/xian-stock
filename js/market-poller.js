// js/market-poller.js - 行情報價定時輪詢、全市場批次刷新、Render 喚醒與 Page Visibility 螢幕監聽排程模組
import { fetchQuote } from "./quotes.js";

/**
 * 異步並行控制池
 */
export async function mapWithConcurrency(items, concurrency, asyncFn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const promise = Promise.resolve().then(() => asyncFn(item));
    results.push(promise);
    executing.add(promise);
    const clean = () => executing.delete(promise);
    promise.then(clean, clean);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

/**
 * 安全抓取單一股票行情並捕獲昨收價
 */
export async function safeFetchQuoteUpdate(holding, settings) {
  try {
    const result = await fetchQuote(holding.symbol, undefined, settings);
    const price = result.price;
    const dailyChange = result.dailyChangePerShare;
    
    // 自動反推或捕獲昨收價，確保 WebSocket 現價跳動時能即時推算日漲跌
    let prevClose = result.previousClose ?? null;
    if (prevClose === null && Number.isFinite(Number(dailyChange))) {
      prevClose = price - Number(dailyChange);
    }

    return {
      id: holding.id,
      success: true,
      price,
      dailyChangePerShare: dailyChange,
      previousClose: prevClose,
      name: result.name,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`更新 ${holding.symbol} 報價失敗：`, error);
    return { id: holding.id, success: false };
  }
}

/**
 * 行情報價排程與喚醒管理器
 */
export class MarketPoller {
  /**
   * @param {Object} options
   * @param {Function} options.getState 獲取目前全域狀態
   * @param {Function} options.persist 持久化儲存回調
   * @param {Function} options.render 重新渲染回調
   * @param {Object} options.usStream 美股 WebSocket 串流管理器實例
   * @param {Function} options.toast 訊息提示回調
   */
  constructor({ getState, persist, render, usStream, toast }) {
    this.getState = getState;
    this.persist = persist;
    this.render = render;
    this.usStream = usStream;
    this.toast = toast;

    this.twPollTimer = null;
    this.isPolling = false;
    this.isRefreshingAll = false;
  }

  /**
   * 啟動所有排程器（台股 10s 輪詢、首次全刷、螢幕喚醒監聽）
   */
  start() {
    this.startTwPolling();
    this.setupPageVisibilityListener();
    this.warmupBackend();
    this.refreshAllQuotes({ silent: true }); // 啟動時首刷行情
  }

  /**
   * 停止所有排程
   */
  stop() {
    if (this.twPollTimer) {
      clearInterval(this.twPollTimer);
      this.twPollTimer = null;
    }
  }

  /**
   * 背景輕量喚醒 Render 後端，避免冷啟動長時間無回應
   */
  async warmupBackend() {
    try {
      const state = this.getState();
      const rawApiUrl = state.settings.quoteApiUrl || "https://my-stock-api-nhaj.onrender.com/api/realtime";
      const baseUrl = new URL(rawApiUrl).origin;
      fetch(`${baseUrl}/`, { mode: "cors" }).catch(() => {});
    } catch {}
  }

  /**
   * 註冊 Page Visibility API（手機螢幕解鎖或分頁喚醒自動補刷行情）
   */
  setupPageVisibilityListener() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // 螢幕解鎖或回到分頁，立刻喚醒美股 WebSocket 並補刷行情
        if (this.usStream) {
          this.usStream.connect();
        }
        this.pollTaiwanStocks();
      }
    });
  }

  /**
   * 啟動台股每 10 秒自動輪詢
   */
  startTwPolling() {
    if (this.twPollTimer) clearInterval(this.twPollTimer);
    this.twPollTimer = setInterval(() => {
      this.pollTaiwanStocks();
    }, 10000);
  }

  /**
   * 執行單次台股輪詢（直通後端 5 秒防禦快取）
   */
  async pollTaiwanStocks() {
    if (this.isPolling) return;
    const state = this.getState();
    const activeTwHoldings = state.holdings.filter((h) => h.market === "TW" && Number(h.shares) > 0);
    if (!activeTwHoldings.length) return;

    const codes = [...new Set(activeTwHoldings.map((h) => h.symbol.replace(/\.(TW|TWO)$/i, "")))].join(",");
    if (!codes) return;

    this.isPolling = true;
    try {
      const rawApiUrl = state.settings.quoteApiUrl || "https://my-stock-api-nhaj.onrender.com/api/realtime";
      const parsedUrl = new URL(rawApiUrl);
      parsedUrl.searchParams.set("tw_codes", codes);
      parsedUrl.searchParams.delete("us_symbols");

      const response = await fetch(parsedUrl.toString());
      if (!response.ok) return;

      const data = await response.json();
      const twData = data.tw || {};
      let hasChanged = false;

      for (const holding of activeTwHoldings) {
        const code = holding.symbol.replace(/\.(TW|TWO)$/i, "");
        const quote = twData[code];
        if (quote && Number(quote.price) > 0) {
          holding.currentPrice = Number(quote.price);
          if (quote.name && (!holding.name || holding.name === holding.symbol)) {
            holding.name = quote.name;
          }
          if (quote.prev_close !== undefined && quote.prev_close !== null) {
            holding.previousClose = Number(quote.prev_close);
          }
          if (quote.d !== undefined && quote.d !== null) {
            holding.dailyChangePerShare = Number(quote.d);
          } else if (holding.previousClose) {
            holding.dailyChangePerShare = holding.currentPrice - holding.previousClose;
          }
          holding.updatedAt = new Date().toISOString();
          hasChanged = true;
        }
      }

      if (hasChanged) {
        this.persist();
        this.render();
      }
    } catch (err) {
      console.error("台股背景輪詢失敗:", err);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * 全市場持倉行情批次刷新（支援手動點擊「↻」或首刷）
   */
  async refreshAllQuotes({ silent = false } = {}) {
    if (this.isRefreshingAll) return;
    const state = this.getState();
    const activeHoldings = state.holdings.filter((h) => Number(h.shares) > 0);
    if (!activeHoldings.length) {
      if (!silent) this.toast("目前沒有庫存可更新報價。");
      return;
    }

    this.isRefreshingAll = true;
    const button = document.querySelector("#refresh-quotes");
    if (button) {
      button.classList.add("loading");
      button.disabled = true;
    }

    try {
      const quoteResults = await mapWithConcurrency(activeHoldings, 3, (h) => safeFetchQuoteUpdate(h, state.settings));
      let successCount = 0;
      for (const update of quoteResults) {
        if (update.success) {
          const target = state.holdings.find((h) => h.id === update.id);
          if (target) {
            target.currentPrice = update.price;
            target.dailyChangePerShare = update.dailyChangePerShare;
            target.previousClose = update.previousClose ?? target.previousClose ?? (update.dailyChangePerShare !== null ? update.price - update.dailyChangePerShare : null);
            target.updatedAt = update.updatedAt;
            if (update.name && (!target.name || target.name === target.symbol)) {
              target.name = update.name;
            }
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        this.persist();
        this.render();
      }

      if (!silent) {
        if (successCount === activeHoldings.length) {
          this.toast(`已成功更新 ${successCount} 檔股票最新行情。`);
        } else {
          this.toast(`${successCount} / ${activeHoldings.length} 檔行情更新成功，其餘稍後自動重試。`, successCount === 0);
        }
      }
    } catch (err) {
      console.error("批次更新行情異常:", err);
      if (!silent) this.toast("行情更新失敗，請檢查網路或稍後再試。", true);
    } finally {
      this.isRefreshingAll = false;
      if (button) {
        button.classList.remove("loading");
        button.disabled = false;
      }
    }
  }
}