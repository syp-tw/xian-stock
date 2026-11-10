// js/market-poller.js - 行情報價定時輪詢、全市場批次刷新、分頁喚醒自動 PULL 模組
import { fetchQuote, getQuoteDataFromResponse, isTaiwanRegularMarketHours } from "./quotes.js";

function chunkArray(array, size = 20) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

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

export async function safeFetchQuoteUpdate(holding, settings, timeoutMs = 5000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Timeout")), timeoutMs);

  try {
    const result = await fetchQuote(holding.symbol, controller.signal, settings, options);
    clearTimeout(timer);

    const price = result.price;
    const dailyChange = result.dailyChangePerShare;
    
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
  } catch {
    clearTimeout(timer);
    return { id: holding.id, success: false };
  }
}

export class MarketPoller {
  constructor({ getState, persist, render, usStream, toast, onSyncPull }) {
    this.getState = getState;
    this.persist = persist;
    this.render = render;
    this.usStream = usStream;
    this.toast = toast;
    this.onSyncPull = onSyncPull; // 🌟 支援分頁喚醒自動 PULL

    this.twPollTimer = null;
    this.isPolling = false;
    this.isRefreshingAll = false;
  }

  start() {
    this.startTwPolling();
    this.setupPageVisibilityListener();
    this.warmupBackend();
    this.refreshAllQuotes({ silent: true });
  }

  stop() {
    if (this.twPollTimer) {
      clearInterval(this.twPollTimer);
      this.twPollTimer = null;
    }
  }

  async warmupBackend() {
    try {
      const state = this.getState();
      const rawApiUrl = state.settings.quoteApiUrl || "https://my-stock-api-nhaj.onrender.com/api/realtime";
      const baseUrl = new URL(rawApiUrl).origin;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      fetch(`${baseUrl}/`, { mode: "cors", signal: controller.signal })
        .then(() => clearTimeout(timer))
        .catch(() => clearTimeout(timer));
    } catch {}
  }

  setupPageVisibilityListener() {
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") {
        // 🌟 分頁切回前景時，自動靜默向雲端 PULL 最新庫存
        if (typeof this.onSyncPull === "function") {
          try {
            await this.onSyncPull();
          } catch (e) {
            console.warn("喚醒時同步庫存失敗:", e);
          }
        }
        if (this.usStream) {
          this.usStream.connect();
        }
        if (isTaiwanRegularMarketHours()) {
          this.pollTaiwanStocks();
        }
      }
    });
  }

  startTwPolling() {
    if (this.twPollTimer) clearInterval(this.twPollTimer);
    this.twPollTimer = setInterval(() => {
      if (!isTaiwanRegularMarketHours()) return;
      this.pollTaiwanStocks();
    }, 10000);
  }

  async pollTaiwanStocks() {
    if (this.isPolling) return;
    const state = this.getState();
    const activeTwHoldings = state.holdings.filter((h) => h.market === "TW" && Number(h.shares) > 0);
    if (!activeTwHoldings.length) return;

    const allCodes = [...new Set(activeTwHoldings.map((h) => h.symbol.replace(/\.(TW|TWO)$/i, "")))];
    if (!allCodes.length) return;

    this.isPolling = true;
    try {
      const rawApiUrl = state.settings.quoteApiUrl || "https://my-stock-api-nhaj.onrender.com/api/realtime";
      const codeChunks = chunkArray(allCodes, 20);

      const chunkPromises = codeChunks.map(async (chunk) => {
        const parsedUrl = new URL(rawApiUrl);
        const expandedChunk = chunk.flatMap((c) => [c.toUpperCase(), c.toLowerCase()]);
        parsedUrl.searchParams.set("tw_codes", [...new Set(expandedChunk)].join(","));
        parsedUrl.searchParams.delete("us_symbols");

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        try {
          const res = await fetch(parsedUrl.toString(), { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) return {};
          const json = await res.json();
          return json.tw || {};
        } catch {
          clearTimeout(timer);
          return {};
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      const mergedTwData = Object.assign({}, ...chunkResults);

      let hasChanged = false;
      const missingHoldings = [];

      for (const holding of activeTwHoldings) {
        const code = holding.symbol.replace(/\.(TW|TWO)$/i, "");
        const quote = getQuoteDataFromResponse(mergedTwData, code);

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
        } else {
          missingHoldings.push(holding);
        }
      }

      if (missingHoldings.length > 0) {
        const rescueResults = await mapWithConcurrency(missingHoldings, 2, (h) => safeFetchQuoteUpdate(h, state.settings, 3500));
        for (const update of rescueResults) {
          if (update.success && update.price > 0) {
            const target = state.holdings.find((h) => h.id === update.id);
            if (target) {
              target.currentPrice = update.price;
              target.dailyChangePerShare = update.dailyChangePerShare;
              target.previousClose = update.previousClose ?? target.previousClose;
              target.updatedAt = update.updatedAt;
              if (update.name && (!target.name || target.name === target.symbol)) {
                target.name = update.name;
              }
              hasChanged = true;
            }
          }
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

    if (!silent && button) {
      button.classList.add("loading");
      button.disabled = true;
    }

    let forceStopTimer = null;
    const resetLoadingState = () => {
      this.isRefreshingAll = false;
      if (button) {
        button.classList.remove("loading");
        button.disabled = false;
      }
      if (forceStopTimer) {
        clearTimeout(forceStopTimer);
        forceStopTimer = null;
      }
    };

    if (!silent) {
      forceStopTimer = setTimeout(() => {
        if (this.isRefreshingAll) {
          resetLoadingState();
          this.toast("已為您更新已知報價（部分標的連線逾時）。");
        }
      }, 10000);
    }

    try {
      const twHoldings = activeHoldings.filter((h) => h.market === "TW");
      const usHoldings = activeHoldings.filter((h) => h.market === "US");
      const caHoldings = activeHoldings.filter((h) => h.market === "CA");
      let successCount = 0;

      if (state.settings.quoteProvider !== "yahoo" && (twHoldings.length > 0 || usHoldings.length > 0)) {
        try {
          const rawApiUrl = state.settings.quoteApiUrl || "https://my-stock-api-nhaj.onrender.com/api/realtime";
          const allTwCodes = [...new Set(twHoldings.map((h) => h.symbol.replace(/\.(TW|TWO)$/i, "")))];
          const allUsCodes = [...new Set(usHoldings.map((h) => h.symbol.toUpperCase()))];
          
          const parsedUrl = new URL(rawApiUrl);
          if (allTwCodes.length > 0) {
            const expanded = allTwCodes.flatMap((c) => [c.toUpperCase(), c.toLowerCase()]);
            parsedUrl.searchParams.set("tw_codes", [...new Set(expanded)].join(","));
          } else {
            parsedUrl.searchParams.delete("tw_codes");
          }

          if (allUsCodes.length > 0) {
            parsedUrl.searchParams.set("us_symbols", allUsCodes.join(","));
          } else {
            parsedUrl.searchParams.delete("us_symbols");
          }

          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 6000);
          const res = await fetch(parsedUrl.toString(), { signal: ctrl.signal });
          clearTimeout(t);

          if (res.ok) {
            const json = await res.json();
            const twData = json.tw || {};
            const usData = json.us || {};

            for (const holding of twHoldings) {
              const code = holding.symbol.replace(/\.(TW|TWO)$/i, "");
              const q = getQuoteDataFromResponse(twData, code);
              if (q && Number(q.price) > 0) {
                holding.currentPrice = Number(q.price);
                if (q.prev_close !== undefined && q.prev_close !== null) holding.previousClose = Number(q.prev_close);
                if (q.d !== undefined && q.d !== null) holding.dailyChangePerShare = Number(q.d);
                else if (holding.previousClose) holding.dailyChangePerShare = holding.currentPrice - holding.previousClose;
                holding.updatedAt = new Date().toISOString();
                successCount++;
              }
            }

            for (const holding of usHoldings) {
              const q = usData[holding.symbol.toUpperCase()];
              if (q && Number(q.price) > 0) {
                holding.currentPrice = Number(q.price);
                if (q.prev_close !== undefined && q.prev_close !== null) holding.previousClose = Number(q.prev_close);
                if (q.d !== undefined && q.d !== null) holding.dailyChangePerShare = Number(q.d);
                else if (holding.previousClose) holding.dailyChangePerShare = holding.currentPrice - holding.previousClose;
                holding.updatedAt = new Date().toISOString();
                successCount++;
              }
            }
          }
        } catch (backendErr) {
          console.warn("後端批次更新失敗，降級至個別更新:", backendErr);
        }
      }

      const remainingHoldings = activeHoldings.filter((h) => 
        h.market === "CA" || !h.updatedAt || (Date.now() - new Date(h.updatedAt).getTime() > 30000)
      );

      if (remainingHoldings.length > 0) {
        const quoteResults = await mapWithConcurrency(
          remainingHoldings,
          2,
          (h) => safeFetchQuoteUpdate(h, state.settings, 4500)
        );

        for (const update of quoteResults) {
          if (update.success && update.price > 0) {
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
      }

      if (successCount > 0) {
        this.persist();
        this.render();
      }

      if (!silent) {
        if (successCount >= activeHoldings.length) {
          this.toast(`已成功更新 ${activeHoldings.length} 檔股票最新行情。`);
        } else if (successCount > 0) {
          this.toast(`${successCount} / ${activeHoldings.length} 檔行情更新成功。`);
        } else {
          this.toast("目前休市中或連線逾時，已維持既有現價。");
        }
      }
    } catch (err) {
      console.error("批次更新行情異常:", err);
      if (!silent) this.toast("行情更新失敗，請檢查網路連線。", true);
    } finally {
      resetLoadingState();
    }
  }
}